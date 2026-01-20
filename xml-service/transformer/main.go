package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"xml-service/common"

	amqp "github.com/rabbitmq/amqp091-go"
)

type MapperFile struct {
	Version     string          `json:"version"`
	RootElement string          `json:"root_element"`
	Structure   json.RawMessage `json:"structure"`
}

type OrderedField struct {
	Tag      string
	Column   string
	Children []OrderedField
}

type CryptoReport struct {
	XMLName     xml.Name       `xml:"CryptoReport"`
	ID          string         `xml:"JobID,attr"`
	GeneratedAt string         `xml:"GeneratedAt,attr"`
	Items       []DynamicField `xml:",any"`
}

type DynamicField struct {
	XMLName  xml.Name
	Value    string         `xml:",chardata"`
	Children []DynamicField `xml:",any"`
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

	qIn, err := rabbitCh.QueueDeclare("q_xml_transform", true, false, false, false, nil)
	common.FailOnError(err, "Falha ao declarar fila de entrada")

	qOut, err := rabbitCh.QueueDeclare("q_xml_validate", true, false, false, false, nil)
	common.FailOnError(err, "Falha ao declarar fila de saida")

	err = rabbitCh.Qos(1, 0, false)
	common.FailOnError(err, "Falha QoS")

	msgs, err := rabbitCh.Consume(qIn.Name, "", false, false, false, false, nil)
	common.FailOnError(err, "Falha Consumo")

	go startHealthServer("transformer")

	log.Println("Transformer a espera de mensagens...")

	forever := make(chan struct{})

	go func() {
		for d := range msgs {
			processMessage(d, qOut.Name)
		}
	}()

	common.WaitForShutdown(func() {
		if rabbitCh != nil {
			rabbitCh.Close()
		}
		if rabbitConn != nil {
			rabbitConn.Close()
		}
		close(forever)
	})
}

func startHealthServer(serviceName string) {
	port := common.GetEnv("HEALTH_PORT", "8081")
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if rabbitConn == nil || rabbitConn.IsClosed() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": serviceName})
	})
	http.ListenAndServe(":"+port, nil)
}

func processMessage(d amqp.Delivery, outputQueue string) {
	var job common.JobRequest
	json.Unmarshal(d.Body, &job)

	csvBytes, err := common.DownloadFile(fmt.Sprintf("%s/data.csv", job.JobID))
	if err != nil {
		log.Printf("[ERRO] Job %s: falha ao obter CSV - %v", job.JobID, err)
		d.Nack(false, false)
		return
	}

	mapperBytes, err := common.DownloadFile(fmt.Sprintf("%s/mapper.json", job.JobID))
	if err != nil {
		log.Printf("[ERRO] Job %s: mapper.json nao encontrado - %v", job.JobID, err)
		d.Nack(false, false)
		return
	}

	var mapper MapperFile
	if err := json.Unmarshal(mapperBytes, &mapper); err != nil {
		log.Printf("[ERRO] Job %s: mapper.json invalido - %v", job.JobID, err)
		d.Nack(false, false)
		return
	}

	if len(mapper.Structure) == 0 || string(mapper.Structure) == "null" {
		log.Printf("[ERRO] Job %s: mapper.json sem structure", job.JobID)
		d.Nack(false, false)
		return
	}

	orderedStructure, err := parseOrderedStructure(mapper.Structure)
	if err != nil {
		log.Printf("[ERRO] Job %s: parse da structure falhou - %v", job.JobID, err)
		d.Nack(false, false)
		return
	}

	if len(orderedStructure) == 0 {
		log.Printf("[ERRO] Job %s: structure vazia", job.JobID)
		d.Nack(false, false)
		return
	}

	if mapper.RootElement == "" {
		log.Printf("[ERRO] Job %s: root_element em falta", job.JobID)
		d.Nack(false, false)
		return
	}

	job.MapperVersion = mapper.Version

	xmlBytes, err := convertToXML(job.JobID, csvBytes, mapper.RootElement, orderedStructure)
	if err != nil {
		log.Printf("[ERRO] Job %s: conversao falhou - %v", job.JobID, err)
		d.Nack(false, false)
		return
	}

	common.UploadToSupabase(fmt.Sprintf("%s/result.xml", job.JobID), bytes.NewReader(xmlBytes), "application/xml")

	newBody, _ := json.Marshal(job)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rabbitCh.PublishWithContext(ctx, "", outputQueue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         newBody,
	})

	d.Ack(false)
	log.Printf("[OK] Job %s transformado", job.JobID)
}

func parseOrderedStructure(raw json.RawMessage) ([]OrderedField, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))

	t, err := dec.Token()
	if err != nil {
		return nil, err
	}
	if delim, ok := t.(json.Delim); !ok || delim != '{' {
		return nil, fmt.Errorf("structure deve ser um objeto")
	}

	return parseOrderedObject(dec)
}

func parseOrderedObject(dec *json.Decoder) ([]OrderedField, error) {
	var fields []OrderedField

	for dec.More() {
		keyToken, err := dec.Token()
		if err != nil {
			return nil, err
		}
		key := keyToken.(string)

		valueToken, err := dec.Token()
		if err != nil {
			return nil, err
		}

		if delim, ok := valueToken.(json.Delim); ok && delim == '{' {
			children, err := parseOrderedObject(dec)
			if err != nil {
				return nil, err
			}
			fields = append(fields, OrderedField{
				Tag:      key,
				Children: children,
			})
		} else if str, ok := valueToken.(string); ok {
			fields = append(fields, OrderedField{
				Tag:    key,
				Column: str,
			})
		}
	}

	_, _ = dec.Token()
	return fields, nil
}

func convertToXML(jobID string, csvData []byte, rootElement string, structure []OrderedField) ([]byte, error) {
	csvData = bytes.TrimPrefix(csvData, []byte{0xEF, 0xBB, 0xBF})

	reader := csv.NewReader(bytes.NewReader(csvData))
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("erro ao ler CSV: %v", err)
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("CSV vazio")
	}

	headers := make([]string, len(rows[0]))
	for i, h := range rows[0] {
		headers[i] = strings.TrimSpace(h)
	}

	var items []DynamicField

	for _, row := range rows[1:] {
		rowMap := make(map[string]string)
		for i, val := range row {
			if i < len(headers) {
				rowMap[headers[i]] = strings.TrimSpace(val)
			}
		}

		children := buildRecursiveFields(structure, rowMap)

		if len(children) == 0 {
			continue
		}

		items = append(items, DynamicField{
			XMLName:  xml.Name{Local: rootElement},
			Children: children,
		})
	}

	report := CryptoReport{
		ID:          jobID,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Items:       items,
	}

	xmlHeader := []byte(xml.Header)
	xmlBody, err := xml.MarshalIndent(report, "", "  ")
	if err != nil {
		return nil, err
	}

	return append(xmlHeader, xmlBody...), nil
}

func buildRecursiveFields(structure []OrderedField, rowMap map[string]string) []DynamicField {
	var fields []DynamicField

	for _, field := range structure {
		tagName := sanitizeXMLTag(field.Tag)

		if len(field.Children) > 0 {
			children := buildRecursiveFields(field.Children, rowMap)
			fields = append(fields, DynamicField{
				XMLName:  xml.Name{Local: tagName},
				Children: children,
			})
			continue
		}

		if field.Column == "" {
			continue
		}

		csvValue, ok := rowMap[field.Column]
		if !ok {
			for key, val := range rowMap {
				if strings.EqualFold(key, field.Column) {
					csvValue = val
					ok = true
					break
				}
			}
		}

		if !ok || csvValue == "" {
			continue
		}

		fields = append(fields, DynamicField{
			XMLName: xml.Name{Local: tagName},
			Value:   csvValue,
		})
	}

	return fields
}

func sanitizeXMLTag(name string) string {
	name = strings.ReplaceAll(name, " ", "")
	var result strings.Builder
	for i, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9' && i > 0) || r == '_' || r == '-' {
			result.WriteRune(r)
		}
	}
	return result.String()
}
