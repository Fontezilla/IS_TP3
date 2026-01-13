/**
 * Data Processor - Entry Point
 * 
 * Serviço stateless para agregação e enriquecimento de dados
 * 
 * Endpoints:
 * - GET  /health           → Health check
 * - POST /process          → Processa CSVs (Cloud Scheduler)
 * - POST /webhook/ready    → XML Service regista-se
 * - POST /webhook/confirm  → XML Service confirma (apaga ficheiros)
 */

require('dotenv').config();

const express = require('express');
const logger = require('./utils/logger');
const routes = require('./api');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Log de requests
app.use((req, res, next) => {
  logger.info('Request recebido', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Rotas
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado'
  });
});

// Error handler global
app.use((err, req, res, next) => {
  logger.error('Erro não tratado', {
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.info('Data Processor iniciado', {
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`${signal} recebido, a encerrar...`);
  server.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;