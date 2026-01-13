# Data Processor

Serviço stateless de agregação e enriquecimento de dados de energia.

## 🚀 Funcionalidades

- Agrega 4 CSVs de 15min em 1 hora
- Filtra apenas 4 fontes: **Eólica, Solar, Consumo, Consumo + Armazenamento**
- Enriquece com dados meteorológicos (Open-Weather API)
- Entrega ao XML Service ou guarda para retry
- Processamento paralelo de grupos

## 📋 Pré-requisitos

- Node.js >= 18
- Conta Supabase (buckets: `raw-data`, `processed-data`)
- API Key Open-Weather

## ⚙️ Configuração

1. **Instalar dependências:**
```bash
npm install
```

2. **Configurar .env:**
```bash
cp .env.example .env
# Editar .env com as credenciais corretas
```

3. **Iniciar servidor:**
```bash
# Desenvolvimento (com nodemon)
npm run dev

# Produção
npm start
```

Servidor roda em: **http://localhost:8080**

## 🔌 Endpoints

### `GET /health`
Health check do serviço.

```bash
curl http://localhost:8080/health
```

### `POST /process`
Processa grupos completos de CSVs (chamado pelo Cloud Scheduler).

```bash
curl -X POST http://localhost:8080/process
```

### `POST /webhook/ready`
XML Service regista-se com callbackUrl.

```bash
curl -X POST http://localhost:8080/webhook/ready \
  -H "Content-Type: application/json" \
  -d '{"callbackUrl": "http://192.168.1.100:3001/receive"}'
```

### `POST /webhook/confirm`
XML Service confirma processamento (apaga ficheiros).

```bash
curl -X POST http://localhost:8080/webhook/confirm \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job_2026-01-12_09"}'
```

## 📊 Estrutura do CSV Final

**21 colunas:** 4 energia + 17 meteorologia

```csv
Eólica,Solar,Consumo,Consumo + Armazenamento,weather_temperature,weather_humidity,weather_clouds,weather_wind_speed,weather_radiation,forecast_4h_temperature,forecast_4h_humidity,forecast_4h_clouds,forecast_4h_wind_speed,forecast_8h_temperature,forecast_8h_humidity,forecast_8h_clouds,forecast_8h_wind_speed,forecast_12h_temperature,forecast_12h_humidity,forecast_12h_clouds,forecast_12h_wind_speed
2971.0000,0.0000,6145.0000,6798.0000,18.5,65,45,3.2,450,19.2,63,50,3.5,20.1,60,55,4.0,21.5,58,60,4.2
```

## 🐳 Docker

```bash
# Build
docker build -t data-processor .

# Run
docker run -p 8080:8080 --env-file .env data-processor
```

## ☁️ Deploy Cloud Run

```bash
# Deploy
gcloud run deploy data-processor \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

## 📁 Estrutura

```
Data_Processor/
├── src/
│   ├── index.js              # Entry point
│   ├── api/index.js          # Routes
│   ├── controllers/          # Controllers
│   ├── services/             # Business logic
│   │   ├── aggregationService.js  # Agregação por tipo energia
│   │   ├── csvService.js          # Leitura e validação
│   │   ├── weatherService.js      # Open-Weather API
│   │   ├── deliveryService.js     # Envio/retry
│   │   └── ...
│   ├── state/
│   │   └── callbackState.js  # Estado persistido em ficheiro
│   └── utils/
│       ├── logger.js         # Winston
│       └── timeUtils.js      # Agrupamento de CSVs
├── package.json
├── Dockerfile
└── .env
```

## ✅ Melhorias Implementadas

- ✅ CallbackState persistido em ficheiro (`.callback-state.json`)
- ✅ Validação de estrutura de CSVs
- ✅ Processamento paralelo de grupos e CSVs
- ✅ Agregação por tipo de energia (pivot)
- ✅ Filtro de 4 fontes apenas

## 📝 Licença

ISC
