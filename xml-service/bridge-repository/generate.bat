@echo off

REM Gerar codigo Go a partir do proto
protoc --go_out=. --go_opt=paths=source_relative ^
       --go-grpc_out=. --go-grpc_opt=paths=source_relative ^
       proto/repository.proto

echo Codigo gRPC gerado com sucesso!
pause
