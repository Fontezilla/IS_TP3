module xml-service/bridge-repository

go 1.25.6

require (
	github.com/lib/pq v1.10.9
	google.golang.org/grpc v1.72.2
	google.golang.org/protobuf v1.36.6
	xml-service/common v0.0.0
)

require (
	github.com/joho/godotenv v1.5.1 // indirect
	github.com/rabbitmq/amqp091-go v1.10.0 // indirect
	golang.org/x/net v0.35.0 // indirect
	golang.org/x/sys v0.30.0 // indirect
	golang.org/x/text v0.22.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250218202821-56aae31c358a // indirect
)

replace xml-service/common => ../common
