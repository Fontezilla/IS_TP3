package common

import (
	"log"
	"os"

	amqp "github.com/rabbitmq/amqp091-go"
)

func ConnectRabbitMQ() (*amqp.Connection, *amqp.Channel) {
	url := os.Getenv("RABBITMQ_URL")
	if url == "" {
		log.Fatal("RABBITMQ_URL nao definida")
	}

	conn, err := amqp.Dial(url)
	FailOnError(err, "Falha ao conectar ao RabbitMQ")

	ch, err := conn.Channel()
	FailOnError(err, "Falha ao abrir canal RabbitMQ")

	log.Println("Conectado ao RabbitMQ")
	return conn, ch
}
