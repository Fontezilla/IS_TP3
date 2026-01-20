package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
	"xml-service/common"

	amqp "github.com/rabbitmq/amqp091-go"
)

type MetadataRequest struct {
	JobID      string `json:"job_id"`
	WebhookURL string `json:"callback_url"`
}

var (
	rabbitConn *amqp.Connection
	rabbitCh   *amqp.Channel
	queueName  string
)

func main() {
	common.LoadEnv()

	rabbitConn, rabbitCh = common.ConnectRabbitMQ()

	q, err := rabbitCh.QueueDeclare("q_xml_transform", true, false, false, false, nil)
	common.FailOnError(err, "Falha ao declarar fila")
	queueName = q.Name

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/upload", uploadHandler)

	port := common.GetEnv("PORT", "8080")
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Receiver a ouvir na porta %s...", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Erro servidor HTTP: %v", err)
		}
	}()

	common.WaitForShutdown(func() {
		log.Println("A encerrar servidor HTTP...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		server.Shutdown(ctx)

		if rabbitCh != nil {
			rabbitCh.Close()
		}
		if rabbitConn != nil {
			rabbitConn.Close()
		}

		log.Println("Receiver encerrado")
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if rabbitConn == nil || rabbitConn.IsClosed() {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "unhealthy",
			"service": "receiver",
			"error":   "RabbitMQ disconnected",
		})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "receiver",
	})
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo invalido", http.StatusMethodNotAllowed)
		return
	}

	token := r.Header.Get("Authorization")
	expectedToken := "Bearer " + common.GetEnv("SERVICE_TOKEN", "")
	if !common.SecureCompare(token, expectedToken) {
		http.Error(w, "Nao autorizado", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		log.Printf("Erro parse multipart: %v", err)
		http.Error(w, "Erro ao processar ficheiros", http.StatusBadRequest)
		return
	}

	metadataStr := r.FormValue("metadata")
	if metadataStr == "" {
		http.Error(w, "Campo 'metadata' em falta", http.StatusBadRequest)
		return
	}

	var meta MetadataRequest
	if err := json.Unmarshal([]byte(metadataStr), &meta); err != nil {
		log.Printf("Erro parse metadata: %v", err)
		http.Error(w, "Formato de metadata invalido", http.StatusBadRequest)
		return
	}

	if meta.JobID == "" {
		http.Error(w, "Campo 'job_id' em falta", http.StatusBadRequest)
		return
	}

	log.Printf("Recebido Job: %s", meta.JobID)

	fileCSV, _, err := r.FormFile("source_file")
	if err != nil {
		http.Error(w, "Ficheiro 'source_file' em falta", http.StatusBadRequest)
		return
	}
	defer fileCSV.Close()

	pathCSV := fmt.Sprintf("%s/data.csv", meta.JobID)
	if err := common.UploadToSupabase(pathCSV, fileCSV, "text/csv"); err != nil {
		log.Printf("Erro upload CSV para job %s: %v", meta.JobID, err)
		http.Error(w, "Erro ao guardar CSV", http.StatusInternalServerError)
		return
	}

	if fileMapper, _, err := r.FormFile("mapper_file"); err == nil {
		defer fileMapper.Close()
		pathMapper := fmt.Sprintf("%s/mapper.json", meta.JobID)
		if err := common.UploadToSupabase(pathMapper, fileMapper, "application/json"); err != nil {
			log.Printf("Aviso: erro upload mapper para job %s: %v", meta.JobID, err)
		}
	}

	if fileSchema, _, err := r.FormFile("schema_file"); err == nil {
		defer fileSchema.Close()
		pathSchema := fmt.Sprintf("%s/schema.xsd", meta.JobID)
		if err := common.UploadToSupabase(pathSchema, fileSchema, "application/xml"); err != nil {
			log.Printf("Aviso: erro upload schema para job %s: %v", meta.JobID, err)
		}
	}

	jobMsg := common.JobRequest{
		JobID:      meta.JobID,
		WebhookURL: meta.WebhookURL,
	}
	body, _ := json.Marshal(jobMsg)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = rabbitCh.PublishWithContext(ctx, "", queueName, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})

	if err != nil {
		log.Printf("Erro ao enfileirar job %s: %v", meta.JobID, err)
		http.Error(w, "Erro ao enfileirar", http.StatusInternalServerError)
		return
	}

	log.Printf("Job %s enfileirado", meta.JobID)

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "accepted",
		"job_id": meta.JobID,
	})
}
