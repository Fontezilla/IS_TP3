/**
 * Logger
 * 
 * Winston logger configurado para:
 * - Desenvolvimento: formato legível com cores
 * - Produção: JSON estruturado para Cloud Run
 */

const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Formato para Cloud Run (JSON estruturado)
 */
const cloudFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Formato para desenvolvimento local (legível)
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction ? cloudFormat : devFormat,
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = logger;