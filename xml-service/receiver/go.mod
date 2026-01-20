module xml-service/receiver

go 1.25.6

require (
	github.com/rabbitmq/amqp091-go v1.10.0
	xml-service/common v0.0.0
)

replace xml-service/common => ../common
