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
		log.Printf("XML Service a ouvir na porta %s...", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Erro servidor HTTP: %v", err)
		}
	}()

	common.WaitForShutdown(func() {
		log.Println("A encerrar XML Service...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		server.Shutdown(ctx)

		if rabbitCh != nil {
			rabbitCh.Close()
		}
		if rabbitConn != nil {
			rabbitConn.Close()
		}
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	expected := "Bearer " + common.GetEnv("SERVICE_TOKEN", "")

	if !common.SecureCompare(token, expected) {
		http.Error(w, "Nao autorizado", http.StatusUnauthorized)
		return
	}

	if rabbitConn == nil || rabbitConn.IsClosed() {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "unhealthy",
			"service": "xml-service",
			"error":   "RabbitMQ disconnected",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "xml-service",
	})
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo invalido", http.StatusMethodNotAllowed)
		return
	}

	token := r.Header.Get("Authorization")
	expected := "Bearer " + common.GetEnv("SERVICE_TOKEN", "")
	if !common.SecureCompare(token, expected) {
		http.Error(w, "Nao autorizado", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, "Erro multipart", http.StatusBadRequest)
		return
	}

	/* =========================
	   METADATA
	========================= */
	metadataStr := r.FormValue("metadata")
	if metadataStr == "" {
		http.Error(w, "Metadata em falta", http.StatusBadRequest)
		return
	}

	var meta MetadataRequest
	if err := json.Unmarshal([]byte(metadataStr), &meta); err != nil {
		http.Error(w, "Metadata invalida", http.StatusBadRequest)
		return
	}

	if meta.JobID == "" || meta.WebhookURL == "" {
		http.Error(w, "Campos obrigatorios da metadata em falta", http.StatusBadRequest)
		return
	}

	/* =========================
	   FICHEIROS OBRIGATORIOS
	========================= */
	fileCSV, _, err := r.FormFile("source_file")
	if err != nil {
		http.Error(w, "Ficheiro 'source_file' em falta", http.StatusBadRequest)
		return
	}
	defer fileCSV.Close()

	fileMapper, _, err := r.FormFile("mapper_file")
	if err != nil {
		http.Error(w, "Ficheiro 'mapper_file' em falta", http.StatusBadRequest)
		return
	}
	defer fileMapper.Close()

	fileSchema, _, err := r.FormFile("schema_file")
	if err != nil {
		http.Error(w, "Ficheiro 'schema_file' em falta", http.StatusBadRequest)
		return
	}
	defer fileSchema.Close()

	/* =========================
	   UPLOAD SUPABASE
	========================= */
	if err := common.UploadToSupabase(
		fmt.Sprintf("%s/data.csv", meta.JobID),
		fileCSV,
		"text/csv",
	); err != nil {
		http.Error(w, "Erro upload CSV", http.StatusInternalServerError)
		return
	}

	if err := common.UploadToSupabase(
		fmt.Sprintf("%s/mapper.json", meta.JobID),
		fileMapper,
		"application/json",
	); err != nil {
		http.Error(w, "Erro upload mapper", http.StatusInternalServerError)
		return
	}

	if err := common.UploadToSupabase(
		fmt.Sprintf("%s/schema.xsd", meta.JobID),
		fileSchema,
		"application/xml",
	); err != nil {
		http.Error(w, "Erro upload schema", http.StatusInternalServerError)
		return
	}

	/* =========================
	   RABBITMQ
	========================= */
	job := common.JobRequest{
		JobID:      meta.JobID,
		WebhookURL: meta.WebhookURL,
	}
	body, _ := json.Marshal(job)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rabbitCh.PublishWithContext(
		ctx,
		"",
		queueName,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	); err != nil {
		http.Error(w, "Erro RabbitMQ", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "accepted",
		"job_id": meta.JobID,
	})
}
