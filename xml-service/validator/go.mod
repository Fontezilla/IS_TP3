module xml-service/validator

go 1.25.6

require (
	github.com/rabbitmq/amqp091-go v1.10.0
	github.com/terminalstatic/go-xsd-validate v0.1.6
	xml-service/common v0.0.0
)

replace xml-service/common => ../common
