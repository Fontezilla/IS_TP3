/**
 * Cleanup Service
 * 
 * Apaga ficheiros após confirmação do XML Service:
 * - CSVs brutos do bucket raw-data
 * - Dados processados do bucket processed-data
 */

const storageService = require('./storageService');
const logger = require('../utils/logger');

/**
 * Limpa todos os ficheiros associados a um job
 * @param {string} jobId - ID do job (ex: "job_2024-01-15_09")
 */
async function cleanup(jobId) {
  logger.info('A iniciar limpeza', { jobId });

  try {
    // 1. Carregar meta.json para saber quais CSVs apagar
    const sourceCsvFiles = await getSourceCsvFiles(jobId);

    // 2. Apagar CSVs brutos
    if (sourceCsvFiles.length > 0) {
      await deleteRawCsvs(sourceCsvFiles);
    }

    // 3. Apagar pasta do job no processed-data
    await deleteProcessedData(jobId);

    logger.info('Limpeza concluída', { jobId, csvs: sourceCsvFiles.length });

  } catch (error) {
    logger.error('Erro na limpeza', { jobId, error: error.message });
    throw error;
  }
}

/**
 * Obtém lista de CSVs fonte a partir do meta.json
 * @param {string} jobId - ID do job
 * @returns {Promise<string[]>} - Lista de nomes de ficheiros
 */
async function getSourceCsvFiles(jobId) {
  const bucket = process.env.SUPABASE_PROCESSED_BUCKET;

  try {
    const metaJson = await storageService.downloadFile(bucket, `${jobId}/meta.json`);
    const meta = JSON.parse(metaJson);
    return meta.sourceCsvFiles || [];
  } catch (error) {
    // Se não conseguir ler o meta.json, tentar inferir do jobId
    logger.warn('Não foi possível ler meta.json, a inferir CSVs do jobId', { jobId });
    return inferCsvFilesFromJobId(jobId);
  }
}

/**
 * Infere os nomes dos CSVs a partir do jobId
 * Ex: "job_2024-01-15_09" → ["2024-01-15_0900.csv", "2024-01-15_0915.csv", ...]
 * @param {string} jobId - ID do job
 * @returns {string[]} - Lista de nomes de ficheiros
 */
function inferCsvFilesFromJobId(jobId) {
  // Extrair data e hora do jobId
  const match = jobId.match(/job_(\d{4}-\d{2}-\d{2})_(\d{2})/);
  
  if (!match) {
    logger.warn('Não foi possível extrair data/hora do jobId', { jobId });
    return [];
  }

  const [, date, hour] = match;
  
  return ['00', '15', '30', '45'].map(min => `${date}_${hour}${min}.csv`);
}

/**
 * Apaga CSVs brutos do bucket raw-data
 * @param {string[]} filenames - Lista de nomes de ficheiros
 */
async function deleteRawCsvs(filenames) {
  const bucket = process.env.SUPABASE_RAW_BUCKET;

  logger.debug('A apagar CSVs brutos', { bucket, count: filenames.length });

  await storageService.deleteFiles(bucket, filenames);

  logger.info('CSVs brutos apagados', { count: filenames.length });
}

/**
 * Apaga pasta do job no bucket processed-data
 * @param {string} jobId - ID do job (nome da pasta)
 */
async function deleteProcessedData(jobId) {
  const bucket = process.env.SUPABASE_PROCESSED_BUCKET;

  logger.debug('A apagar dados processados', { bucket, jobId });

  await storageService.deleteFolder(bucket, jobId);

  logger.info('Dados processados apagados', { jobId });
}

module.exports = {
  cleanup,
  getSourceCsvFiles,
  inferCsvFilesFromJobId
};