/**
 * CSV Service
 *
 * Lê e faz parse dos CSVs brutos do bucket raw-data
 */

const { parse } = require('csv-parse/sync');
const storageService = require('./storageService');
const logger = require('../utils/logger');

const REQUIRED_COLUMNS = ['hora', 'tipo_energia', 'MW'];

/**
 * Lê múltiplos CSVs em paralelo e retorna os dados combinados
 * @param {string[]} filenames - Lista de nomes de ficheiros
 * @returns {Promise<Array>} - Dados de todos os CSVs
 */
async function readMultipleCsvs(filenames) {
  const bucket = process.env.SUPABASE_RAW_BUCKET;

  try {
    const promises = filenames.map(async (filename) => {
      const data = await readCsv(bucket, filename);
      return {
        filename,
        records: data
      };
    });

    const allData = await Promise.all(promises);
    return allData;

  } catch (error) {
    logger.error('Erro ao ler CSVs', { error: error.message });
    throw error;
  }
}

/**
 * Lê um único CSV
 * @param {string} bucket - Nome do bucket
 * @param {string} filename - Nome do ficheiro
 * @returns {Promise<Array>} - Registos do CSV
 */
async function readCsv(bucket, filename) {
  // Download do ficheiro
  const content = await storageService.downloadFile(bucket, filename);

  // Parse do CSV
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value, context) => {
      if (context.header) return value;

      const column = context.column;
      if (column === 'hora' || column === 'tipo_energia') {
        return value;
      }

      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }
  });

  logger.debug('CSV lido', { filename, records: records.length });

  validateCsvData(filename, records);

  return records;
}

/**
 * Valida estrutura e dados do CSV
 * @param {string} filename - Nome do ficheiro
 * @param {Array} records - Registos do CSV
 * @throws {Error} Se validação falhar
 */
function validateCsvData(filename, records) {
  if (!records || records.length === 0) {
    throw new Error(`CSV vazio: ${filename}`);
  }

  const firstRecord = records[0];
  const columns = Object.keys(firstRecord);

  for (const requiredCol of REQUIRED_COLUMNS) {
    if (!columns.includes(requiredCol)) {
      throw new Error(
        `CSV ${filename} não tem coluna obrigatória: ${requiredCol}. ` +
        `Colunas encontradas: ${columns.join(', ')}`
      );
    }
  }

  const validTypes = new Set(['Eólica', 'Solar', 'Consumo', 'Consumo + Armazenamento']);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    if (!record.hora || typeof record.hora !== 'string') {
      throw new Error(`CSV ${filename}, linha ${i + 1}: coluna 'hora' inválida`);
    }

    if (!record.tipo_energia || typeof record.tipo_energia !== 'string') {
      throw new Error(`CSV ${filename}, linha ${i + 1}: coluna 'tipo_energia' inválida`);
    }

    if (!validTypes.has(record.tipo_energia)) {
      logger.warn(`Tipo de energia inesperado: ${record.tipo_energia}`, { filename });
    }

    const mw = parseFloat(record.MW);
    if (isNaN(mw) || mw < 0) {
      throw new Error(
        `CSV ${filename}, linha ${i + 1}: coluna 'MW' inválida (${record.MW})`
      );
    }

    record.MW = mw;
  }

  logger.debug('CSV validado com sucesso', { filename, records: records.length });
}

/**
 * Extrai os headers de um CSV
 * @param {string} bucket - Nome do bucket
 * @param {string} filename - Nome do ficheiro
 * @returns {Promise<string[]>} - Lista de headers
 */
async function getHeaders(bucket, filename) {
  const content = await storageService.downloadFile(bucket, filename);
  const firstLine = content.split('\n')[0];
  return firstLine.split(',').map(h => h.trim());
}

module.exports = {
  readMultipleCsvs,
  readCsv,
  getHeaders
};