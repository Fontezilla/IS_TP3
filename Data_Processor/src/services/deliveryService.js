/**
 * Delivery Service
 * 
 * Envia dados para o XML Service ou guarda no bucket pending
 * se o XML Service não estiver disponível
 */

const axios = require('axios');
const storageService = require('./storageService');
const callbackState = require('../state/callbackState');
const logger = require('../utils/logger');

/**
 * Entrega o payload (envia para XML Service ou guarda em pending)
 * @param {Object} payload - { jobId, timestamp, csvData, mapper, meta }
 * @returns {Promise<Object>} - { status, message }
 */
async function deliver(payload) {
  const { jobId } = payload;

  // Verificar se XML Service está disponível
  if (callbackState.isAvailable()) {
    try {
      await sendToXmlService(payload);
      return {
        status: 'SENT',
        message: 'Enviado para XML Service'
      };
    } catch (error) {
      logger.warn('Falha ao enviar para XML Service, a guardar em pending', {
        jobId,
        error: error.message
      });
      // Se falhar, guarda em pending
      await saveToPending(payload);
      return {
        status: 'PENDING',
        message: 'XML Service indisponível, guardado para retry'
      };
    }
  } else {
    // Sem callbackUrl, guardar em pending
    await saveToPending(payload);
    return {
      status: 'PENDING',
      message: 'XML Service não registado, guardado para retry'
    };
  }
}

/**
 * Envia payload para o XML Service via HTTP POST
 * @param {Object} payload - Dados a enviar
 */
async function sendToXmlService(payload) {
  const callbackUrl = callbackState.get();
  const { jobId, csvData, mapper, meta } = payload;

  logger.info('A enviar para XML Service', { jobId, callbackUrl });

  const response = await axios.post(callbackUrl, {
    jobId,
    csvData,
    mapper,
    meta,
    webhookConfirmUrl: getConfirmWebhookUrl()
  }, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  if (response.status !== 200) {
    throw new Error(`XML Service respondeu com status ${response.status}`);
  }

  logger.info('Enviado com sucesso para XML Service', { jobId });
}

/**
 * Guarda payload no bucket pending para retry posterior
 * @param {Object} payload - Dados a guardar
 */
async function saveToPending(payload) {
  const { jobId, csvData, mapper, meta } = payload;
  const bucket = process.env.SUPABASE_PROCESSED_BUCKET;
  const folder = jobId;

  logger.info('A guardar em pending', { jobId });

  // Guardar CSV
  await storageService.uploadFile(
    bucket,
    `${folder}/data.csv`,
    csvData,
    'text/csv'
  );

  // Guardar mapper
  await storageService.uploadFile(
    bucket,
    `${folder}/mapper.json`,
    JSON.stringify(mapper, null, 2),
    'application/json'
  );

  // Guardar meta
  await storageService.uploadFile(
    bucket,
    `${folder}/meta.json`,
    JSON.stringify(meta, null, 2),
    'application/json'
  );

  logger.info('Guardado em pending', { jobId, folder });
}

/**
 * Envia todos os jobs pendentes para o XML Service
 * @returns {Promise<Object>} - { sent: [], failed: [] }
 */
async function sendPendingJobs() {
  const bucket = process.env.SUPABASE_PROCESSED_BUCKET;
  
  // Listar pastas (cada pasta é um job)
  const folders = await storageService.listFolders(bucket);
  
  if (folders.length === 0) {
    logger.info('Nenhum job pendente');
    return { sent: [], failed: [] };
  }

  logger.info('Jobs pendentes encontrados', { count: folders.length });

  const sent = [];
  const failed = [];

  for (const jobId of folders) {
    try {
      const payload = await loadPendingJob(jobId);
      await sendToXmlService(payload);
      sent.push(jobId);
    } catch (error) {
      logger.error('Falha ao enviar job pendente', { jobId, error: error.message });
      failed.push({ jobId, error: error.message });
    }
  }

  logger.info('Jobs pendentes processados', { sent: sent.length, failed: failed.length });

  return { sent, failed };
}

/**
 * Carrega um job pendente do bucket
 * @param {string} jobId - ID do job
 * @returns {Promise<Object>} - Payload completo
 */
async function loadPendingJob(jobId) {
  const bucket = process.env.SUPABASE_PROCESSED_BUCKET;

  // Carregar ficheiros
  const csvData = await storageService.downloadFile(bucket, `${jobId}/data.csv`);
  const mapperJson = await storageService.downloadFile(bucket, `${jobId}/mapper.json`);
  const metaJson = await storageService.downloadFile(bucket, `${jobId}/meta.json`);

  return {
    jobId,
    csvData,
    mapper: JSON.parse(mapperJson),
    meta: JSON.parse(metaJson)
  };
}

/**
 * Retorna o URL do webhook de confirmação
 */
function getConfirmWebhookUrl() {
  // Em produção, usar o URL do Cloud Run
  // Em dev, usar localhost
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  return `${baseUrl}/webhook/confirm`;
}

module.exports = {
  deliver,
  sendPendingJobs,
  loadPendingJob
};