/**
 * Storage Service
 * 
 * Interacção com Supabase Storage
 * - raw-data: CSVs brutos do Crawler
 * - processed-data: Dados processados aguardando XML Service
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Cliente Supabase (inicializado uma vez)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Lista ficheiros num bucket
 * @param {string} bucket - Nome do bucket
 * @param {string} folder - Pasta (opcional)
 * @returns {Promise<string[]>} - Lista de nomes de ficheiros
 */
async function listFiles(bucket, folder = '') {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    logger.error('Erro ao listar ficheiros', { bucket, folder, error: error.message });
    throw error;
  }

  // Filtrar apenas ficheiros (não pastas)
  return data
    .filter(item => item.id !== null)
    .map(item => item.name);
}

/**
 * Lista pastas num bucket
 * @param {string} bucket - Nome do bucket
 * @returns {Promise<string[]>} - Lista de nomes de pastas
 */
async function listFolders(bucket) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list('', {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    logger.error('Erro ao listar pastas', { bucket, error: error.message });
    throw error;
  }

  // Filtrar apenas pastas (id é null para pastas)
  return data
    .filter(item => item.id === null)
    .map(item => item.name);
}

/**
 * Faz download de um ficheiro
 * @param {string} bucket - Nome do bucket
 * @param {string} path - Caminho do ficheiro
 * @returns {Promise<string>} - Conteúdo do ficheiro
 */
async function downloadFile(bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error) {
    logger.error('Erro ao fazer download', { bucket, path, error: error.message });
    throw error;
  }

  return await data.text();
}

/**
 * Faz upload de um ficheiro
 * @param {string} bucket - Nome do bucket
 * @param {string} path - Caminho do ficheiro
 * @param {string} content - Conteúdo do ficheiro
 * @param {string} contentType - Tipo de conteúdo (default: text/csv)
 */
async function uploadFile(bucket, path, content, contentType = 'text/csv') {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, content, {
      contentType,
      upsert: true
    });

  if (error) {
    logger.error('Erro ao fazer upload', { bucket, path, error: error.message });
    throw error;
  }

  logger.debug('Ficheiro uploaded', { bucket, path });
}

/**
 * Apaga um ficheiro
 * @param {string} bucket - Nome do bucket
 * @param {string} path - Caminho do ficheiro
 */
async function deleteFile(bucket, path) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    logger.error('Erro ao apagar ficheiro', { bucket, path, error: error.message });
    throw error;
  }

  logger.debug('Ficheiro apagado', { bucket, path });
}

/**
 * Apaga múltiplos ficheiros
 * @param {string} bucket - Nome do bucket
 * @param {string[]} paths - Lista de caminhos
 */
async function deleteFiles(bucket, paths) {
  if (paths.length === 0) return;

  const { error } = await supabase.storage
    .from(bucket)
    .remove(paths);

  if (error) {
    logger.error('Erro ao apagar ficheiros', { bucket, count: paths.length, error: error.message });
    throw error;
  }

  logger.debug('Ficheiros apagados', { bucket, count: paths.length });
}

/**
 * Apaga uma pasta e todo o seu conteúdo
 * @param {string} bucket - Nome do bucket
 * @param {string} folder - Nome da pasta
 */
async function deleteFolder(bucket, folder) {
  // Listar ficheiros na pasta
  const files = await listFiles(bucket, folder);
  
  if (files.length > 0) {
    const paths = files.map(file => `${folder}/${file}`);
    await deleteFiles(bucket, paths);
  }

  logger.debug('Pasta apagada', { bucket, folder });
}

/**
 * Verifica se um ficheiro existe
 * @param {string} bucket - Nome do bucket
 * @param {string} path - Caminho do ficheiro
 * @returns {Promise<boolean>}
 */
async function fileExists(bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path.split('/').slice(0, -1).join('/') || '', {
      search: path.split('/').pop()
    });

  if (error) {
    return false;
  }

  return data.some(item => item.name === path.split('/').pop());
}

module.exports = {
  listFiles,
  listFolders,
  downloadFile,
  uploadFile,
  deleteFile,
  deleteFiles,
  deleteFolder,
  fileExists
};