# bi-service

Projeto **bi-service** desenvolvido em **Java**, responsável por consumir dados de um serviço externo (`xml-service`) via **gRPC**.

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

- **Java JDK 17** (ou compatível com o projeto)
- **Maven**
- **Docker**
- **Docker Compose**

Você pode verificar se o Maven está instalado com:

```bash
mvn -v
```

## ⚙️ Configuração

O `bi-service` depende do endereço do serviço `xml-service`, que deve ser informado através de uma variável de ambiente.

### Variável de ambiente obrigatória

O endereço do `xml-service` deve ser informado no momento da execução do Docker Compose:

```bash
GRPC_XML_REPOSITORY_ADDRESS="ip do xml-service" docker compose up -d
```

## 🚀 Subindo a aplicação

A aplicação deve ser iniciada definindo a variável de ambiente **no mesmo comando** de execução do Docker Compose:

```bash
GRPC_XML_REPOSITORY_ADDRESS="ip do xml-service" docker compose up -d

```

O serviço será iniciado em background.

## 🛠️ Build do projeto

Caso queira compilar o projeto localmente sem Docker:

```bash
mvn clean install
```

## 📡 Comunicação gRPC

O `bi-service` se comunica com o `xml-service` via **gRPC**, utilizando o endereço definido na variável `GRPC_XML_REPOSITORY_ADDRESS`.

Certifique-se de que o `xml-service` esteja ativo e acessível antes de iniciar o `bi-service`.



✅ Projeto pronto para execução!

