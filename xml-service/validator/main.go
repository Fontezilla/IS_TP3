package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"time"
	"xml-service/common"

	amqp "github.com/rabbitmq/amqp091-go"
)

type XSDSchema struct {
	XMLName xml.Name `xml:"schema"`
	Version string   `xml:"version,attr"`
}

var (
	rabbitConn *amqp.Connection
	rabbitCh   *amqp.Channel
)

func main() {
	common.LoadEnv()

	rabbitConn, rabbitCh = common.ConnectRabbitMQ()
	defer rabbitConn.Close()
	defer rabbitCh.Close()

	qIn, err := rabbitCh.QueueDeclare("q_xml_validate", true, false, false, false, nil)
	common.FailOnError(err, "Falha fila entrada")

	qOut, err := rabbitCh.QueueDeclare("q_xml_persist", true, false, false, false, nil)
	common.FailOnError(err, "Falha fila saida")

	err = rabbitCh.Qos(1, 0, false)
	common.FailOnError(err, "Falha QoS")

	msgs, err := rabbitCh.Consume(qIn.Name, "", false, false, false, false, nil)
	common.FailOnError(err, "Falha ao consumir fila")

	go startHealthServer("validator")

	log.Println("Validator a espera de mensagens...")

	for d := range msgs {
		processMessage(d, qOut.Name)
	}
}

func startHealthServer(service string) {
	port := common.GetEnv("HEALTH_PORT", "8082")
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		if rabbitConn == nil || rabbitConn.IsClosed() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": service})
	})
	http.ListenAndServe(":"+port, nil)
}

func processMessage(d amqp.Delivery, outputQueue string) {
	var job common.JobRequest
	if err := json.Unmarshal(d.Body, &job); err != nil {
		log.Printf("[ERRO] Falha ao parse mensagem: %v", err)
		d.Nack(false, false)
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

	xmlBytes, err := common.DownloadFile(fmt.Sprintf("%s/result.xml", job.JobID))
	if err != nil {
		log.Printf("[ERRO] Job %s: falha ao obter XML - %v", job.JobID, err)
		handleValidatorRetry(d, job, retryCount, maxRetries)
		return
	}

	xsdBytes, err := common.DownloadFile(fmt.Sprintf("%s/schema.xsd", job.JobID))
	if err != nil || len(xsdBytes) == 0 {
		log.Printf("[ERRO] Job %s: XSD em falta", job.JobID)
		d.Nack(false, false) // Erro permanente - ficheiro em falta
		return
	}

	if err := validateXMLAgainstXSD(xmlBytes, xsdBytes); err != nil {
		log.Printf("[INVALIDO] Job %s: %v", job.JobID, err)
		d.Nack(false, false) // Erro permanente - XML invalido
		return
	}

	var schema XSDSchema
	if err := xml.Unmarshal(xsdBytes, &schema); err == nil && schema.Version != "" {
		job.XSDVersion = schema.Version
	}

	log.Printf("[OK] Job %s validado", job.JobID)

	body, _ := json.Marshal(job)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rabbitCh.PublishWithContext(ctx, "", outputQueue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	}); err != nil {
		log.Printf("[ERRO] Job %s: falha publish - %v", job.JobID, err)
		handleValidatorRetry(d, job, retryCount, maxRetries)
		return
	}

	d.Ack(false)
}

func handleValidatorRetry(d amqp.Delivery, job common.JobRequest, retryCount, maxRetries int) {
	if retryCount < maxRetries-1 {
		log.Printf("[Job %s] Retry %d/%d...", job.JobID, retryCount+1, maxRetries)
		d.Ack(false)

		body, _ := json.Marshal(job)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		rabbitCh.PublishWithContext(ctx, "", "q_xml_validate", false, false, amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Headers: amqp.Table{
				"x-retry-count": int32(retryCount + 1),
			},
		})
	} else {
		log.Printf("[Job %s] Max retries (%d) atingido. Descartando.", job.JobID, maxRetries)
		d.Ack(false)
	}
}

func validateXMLAgainstXSD(xmlBytes, xsdBytes []byte) error {
	xmlFile, err := os.CreateTemp("", "xml-*.xml")
	if err != nil {
		return err
	}
	defer os.Remove(xmlFile.Name())

	xsdFile, err := os.CreateTemp("", "schema-*.xsd")
	if err != nil {
		return err
	}
	defer os.Remove(xsdFile.Name())

	xmlFile.Write(xmlBytes)
	xsdFile.Write(xsdBytes)
	xmlFile.Close()
	xsdFile.Close()

	cmd := exec.Command("xmllint", "--noout", "--schema", xsdFile.Name(), xmlFile.Name())

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s", string(output))
	}
	return nil
}
