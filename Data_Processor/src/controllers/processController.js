/**
 * Process Controller
 * 
 * POST /process → Processa CSVs completos (chamado pelo Cloud Scheduler)
 * 
 * Fluxo:
 * 1. Lista CSVs no bucket raw-data
 * 2. Agrupa por data+hora, filtra grupos completos (4 CSVs)
 * 3. Para cada grupo completo não processado:
 *    - Lê e agrega dados
 *    - Enriquece com Open-Weather
 *    - Gera CSV final + Mapper
 *    - Envia para XML Service OU guarda em processed-data
 */

const logger = require('../utils/logger');
const timeUtils = require('../utils/timeUtils');
const storageService = require('../services/storageService');
const csvService = require('../services/csvService');
const aggregationService = require('../services/aggregationService');
const weatherService = require('../services/weatherService');
const mapperService = require('../services/mapperService');
const csvGeneratorService = require('../services/csvGeneratorService');
const deliveryService = require('../services/deliveryService');

/**
 * Execução principal (chamada pelo Cloud Scheduler)
 */
const execute = async (req, res) => {
  logger.info('Processamento iniciado');

  try {
    // 1. Listar todos os CSVs no bucket raw-data
    const allCsvs = await storageService.listFiles(process.env.SUPABASE_RAW_BUCKET);
    logger.info('CSVs encontrados', { count: allCsvs.length });

    // 2. Agrupar por data+hora e filtrar grupos completos
    const completeGroups = timeUtils.groupCsvsByDateHour(allCsvs);
    const completeKeys = Object.keys(completeGroups);
    logger.info('Grupos completos', { count: completeKeys.length });

    if (completeKeys.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nenhum grupo completo para processar',
        processed: 0
      });
    }

    // 3. Verificar quais já foram processados
    const pendingJobs = await storageService.listFolders(process.env.SUPABASE_PROCESSED_BUCKET);
    const processedKeys = pendingJobs.map(folder => folder.replace('job_', ''));
    
    const keysToProcess = completeKeys.filter(key => !processedKeys.includes(key));
    logger.info('Grupos a processar', { count: keysToProcess.length });

    // 4. Processar grupos em paralelo
    const promises = keysToProcess.map(dateHourKey =>
      processGroup(dateHourKey, completeGroups[dateHourKey])
    );

    const results = await Promise.allSettled(promises);

    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map((r, idx) => ({
      jobId: timeUtils.formatJobId(keysToProcess[idx]),
      error: r.reason?.message || 'Erro desconhecido'
    }));

    if (failed.length > 0) {
      logger.warn('Alguns grupos falharam', { failed: failed.length, total: results.length });
    }

    res.status(200).json({
      success: true,
      message: `Processamento concluído`,
      processed: successful.length,
      failed: failed.length,
      results: successful,
      errors: failed
    });

  } catch (error) {
    logger.error('Erro no processamento', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Processa um grupo de 4 CSVs (uma hora completa)
 */
async function processGroup(dateHourKey, csvFiles) {
  const jobId = timeUtils.formatJobId(dateHourKey);
  logger.info('A processar grupo', { jobId, files: csvFiles });

  try {
    // 1. Ler CSVs
    const rawData = await csvService.readMultipleCsvs(csvFiles);

    // 2. Agregar dados (médias)
    const aggregated = aggregationService.aggregate(rawData);

    // 3. Enriquecer com dados meteorológicos
    const timestamp = timeUtils.dateHourKeyToDate(dateHourKey);
    const weather = await weatherService.getWeatherData(timestamp);

    // 4. Combinar dados
    const combinedData = {
      ...aggregated,
      weather
    };

    // 5. Gerar mapper de domínio
    const mapper = mapperService.generateMapper(combinedData);

    // 6. Gerar CSV final
    const finalCsv = csvGeneratorService.generate(combinedData);

    // 7. Montar payload
    const payload = {
      jobId,
      timestamp: timestamp.toISOString(),
      processedAt: new Date().toISOString(),
      csvData: finalCsv,
      mapper,
      meta: {
        sourceCsvFiles: csvFiles,
        version: '1.0.0'
      }
    };

    // 8. Entregar (envia para XML Service ou guarda em pending)
    const deliveryResult = await deliveryService.deliver(payload);

    return {
      jobId,
      status: deliveryResult.status,
      message: deliveryResult.message
    };

  } catch (error) {
    logger.error('Erro ao processar grupo', { jobId, error: error.message });
    return {
      jobId,
      status: 'ERROR',
      message: error.message
    };
  }
}

module.exports = {
  execute
};