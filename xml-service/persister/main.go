package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
	"xml-service/common"

	amqp "github.com/rabbitmq/amqp091-go"
)

type XMLDocument struct {
	JobID         string `json:"job_id"`
	XMLContent    string `json:"xml_content"`
	MapperVersion string `json:"mapper_version,omitempty"`
	XSDVersion    string `json:"xsd_version,omitempty"`
}

var (
	rabbitConn  *amqp.Connection
	rabbitCh    *amqp.Channel
	httpClient  = &http.Client{Timeout: 30 * time.Second}
	supabaseURL string
	supabaseKey string
	tableName   = "xml_documents"
)

func main() {
	common.LoadEnv()

	supabaseURL = os.Getenv("SUPABASE_URL")
	supabaseKey = os.Getenv("SUPABASE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("SUPABASE_URL ou SUPABASE_KEY nao definidas")
	}

	if supabaseURL[len(supabaseURL)-1] == '/' {
		supabaseURL = supabaseURL[:len(supabaseURL)-1]
	}

	log.Printf("Conectado ao Supabase: %s", supabaseURL)

	rabbitConn, rabbitCh = common.ConnectRabbitMQ()

	q, err := rabbitCh.QueueDeclare("q_xml_persist", true, false, false, false, nil)
	common.FailOnError(err, "Falha ao declarar fila")

	err = rabbitCh.Qos(1, 0, false)
	common.FailOnError(err, "Falha QoS")

	msgs, err := rabbitCh.Consume(q.Name, "", false, false, false, false, nil)
	common.FailOnError(err, "Falha ao consumir fila")

	go startHealthServer("persister")

	log.Println("Persister a espera de mensagens...")

	done := make(chan struct{})

	go func() {
		for d := range msgs {
			processMessage(d)
		}
		close(done)
	}()

	common.WaitForShutdown(func() {
		log.Println("A encerrar Persister...")
		if rabbitCh != nil {
			rabbitCh.Close()
		}
		if rabbitConn != nil {
			rabbitConn.Close()
		}
		<-done
		log.Println("Persister encerrado")
	})
}

func startHealthServer(serviceName string) {
	port := common.GetEnv("HEALTH_PORT", "8083")
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if rabbitConn == nil || rabbitConn.IsClosed() {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"status":  "unhealthy",
				"service": serviceName,
				"error":   "RabbitMQ disconnected",
			})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"service": serviceName,
		})
	})
	log.Printf("Health check a ouvir na porta %s...", port)
	http.ListenAndServe(":"+port, nil)
}

func processMessage(d amqp.Delivery) {
	var job common.JobRequest
	if err := json.Unmarshal(d.Body, &job); err != nil {
		log.Printf("Erro parse mensagem: %v", err)
		d.Nack(false, false) // Mensagem malformada - descartar
		return
	}

	// Obter retry count do header
	retryCount := 0
	if d.Headers != nil {
		if rc, ok := d.Headers["x-retry-count"].(int32); ok {
			retryCount = int(rc)
		} else if rc, ok := d.Headers["x-retry-count"].(int64); ok {
			retryCount = int(rc)
		}
	}
	maxRetries := 3

	log.Printf("A persistir job: %s (tentativa %d/%d)", job.JobID, retryCount+1, maxRetries)

	pathXML := fmt.Sprintf("%s/result.xml", job.JobID)
	xmlBytes, err := common.DownloadFile(pathXML)
	if err != nil {
		log.Printf("Erro download XML para job %s: %v", job.JobID, err)
		handlePersisterRetry(d, job, retryCount, maxRetries, "Erro ao obter XML")
		return
	}

	doc := XMLDocument{
		JobID:         job.JobID,
		XMLContent:    string(xmlBytes),
		MapperVersion: job.MapperVersion,
		XSDVersion:    job.XSDVersion,
	}

	// Tentar upsert com backoff interno
	internalRetries := 3
	var lastErr error
	for i := 0; i < internalRetries; i++ {
		if err := upsertToSupabase(doc); err != nil {
			lastErr = err
			log.Printf("Erro Supabase para job %s (tentativa interna %d/%d): %v", job.JobID, i+1, internalRetries, err)
			if i < internalRetries-1 {
				time.Sleep(time.Duration(i+1) * 2 * time.Second)
			}
			continue
		}
		lastErr = nil
		break
	}

	if lastErr != nil {
		log.Printf("Job %s falhou apos tentativas internas", job.JobID)
		handlePersisterRetry(d, job, retryCount, maxRetries, "Erro ao guardar na base de dados")
		return
	}

	log.Printf("  Job %s guardado (Mapper: %s, XSD: %s)", job.JobID, job.MapperVersion, job.XSDVersion)

	notifyWebhook(job.WebhookURL, job.JobID, "COMPLETED", "")

	if err := common.DeleteJobFiles(job.JobID); err != nil {
		log.Printf("[AVISO] Job %s: falha ao limpar storage - %v", job.JobID, err)
	}

	d.Ack(false)
	log.Printf("[OK] Job %s concluido", job.JobID)
}

func handlePersisterRetry(d amqp.Delivery, job common.JobRequest, retryCount, maxRetries int, failReason string) {
	if retryCount < maxRetries-1 {
		log.Printf("[Job %s] A agendar retry %d/%d...", job.JobID, retryCount+2, maxRetries)
		d.Ack(false)

		body, _ := json.Marshal(job)
		rabbitCh.Publish("", "q_xml_persist", false, false, amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Headers: amqp.Table{
				"x-retry-count": int32(retryCount + 1),
			},
		})
	} else {
		log.Printf("[Job %s] Max retries (%d) atingido. Descartando.", job.JobID, maxRetries)
		notifyWebhook(job.WebhookURL, job.JobID, "FAILED", failReason)
		d.Ack(false)
	}
}

func upsertToSupabase(doc XMLDocument) error {
	url := fmt.Sprintf("%s/rest/v1/%s?on_conflict=job_id", supabaseURL, tableName)

	jsonBody, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("erro marshal: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("erro criar request: %w", err)
	}

	req.Header.Set("apikey", supabaseKey)
	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")
	req.Header.Set("Content-Profile", "xml_service")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("erro network: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("erro Supabase (%d): %s", resp.StatusCode, string(body))
}

func notifyWebhook(url, jobID, status, message string) {
	if url == "" {
		return
	}

	payload := common.WebhookPayload{
		JobID:   jobID,
		Status:  status,
		Message: message,
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Erro marshal webhook para job %s: %v", jobID, err)
		return
	}

	resp, err := httpClient.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Printf("Erro ao enviar webhook para job %s: %v", jobID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("  Webhook enviado para job %s (status: %s)", jobID, status)
	} else {
		log.Printf("  Webhook falhou para job %s (HTTP %d)", jobID, resp.StatusCode)
	}
}
