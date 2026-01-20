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

	rabbitCh.Qos(1, 0, false)

	msgs, _ := rabbitCh.Consume(qIn.Name, "", false, false, false, false, nil)

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
	json.Unmarshal(d.Body, &job)

	xmlBytes, err := common.DownloadFile(fmt.Sprintf("%s/result.xml", job.JobID))
	if err != nil {
		log.Printf("[ERRO] Job %s: falha ao obter XML", job.JobID)
		d.Nack(false, false)
		return
	}

	xsdBytes, err := common.DownloadFile(fmt.Sprintf("%s/schema.xsd", job.JobID))
	if err != nil || len(xsdBytes) == 0 {
		log.Printf("[ERRO] Job %s: XSD em falta", job.JobID)
		d.Nack(false, false)
		return
	}

	if err := validateXMLAgainstXSD(xmlBytes, xsdBytes); err != nil {
		log.Printf("[INVALIDO] Job %s: %v", job.JobID, err)
		d.Nack(false, false)
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

	rabbitCh.PublishWithContext(ctx, "", outputQueue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})

	d.Ack(false)
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
