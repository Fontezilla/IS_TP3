/**
 * Webhook Controller
 * 
 * POST /webhook/ready   → XML Service regista-se (envia callbackUrl)
 * POST /webhook/confirm → XML Service confirma processamento (apaga ficheiros)
 */

const logger = require('../utils/logger');
const callbackState = require('../state/callbackState');
const deliveryService = require('../services/deliveryService');
const cleanupService = require('../services/cleanupService');

/**
 * XML Service regista-se
 * 
 * Body: { callbackUrl: "http://192.168.1.100:3001/receive" }
 * 
 * - Guarda callbackUrl em memória
 * - Envia jobs pendentes para o XML Service
 */
const ready = async (req, res) => {
  try {
    const { callbackUrl } = req.body;

    if (!callbackUrl) {
      return res.status(400).json({
        success: false,
        error: 'callbackUrl é obrigatório'
      });
    }

    // Guardar callbackUrl em memória
    callbackState.set(callbackUrl);
    logger.info('XML Service registado', { callbackUrl });

    // Enviar jobs pendentes
    const result = await deliveryService.sendPendingJobs();

    res.status(200).json({
      success: true,
      message: 'XML Service registado com sucesso',
      callbackUrl,
      pendingJobs: result
    });

  } catch (error) {
    logger.error('Erro no webhook ready', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * XML Service confirma que processou um job
 * 
 * Body: { jobId: "job_2024-01-15_09" }
 * 
 * - Apaga CSVs brutos do bucket raw-data
 * - Apaga dados do bucket processed-data (se existirem)
 */
const confirm = async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId é obrigatório'
      });
    }

    logger.info('Confirmação recebida', { jobId });

    // Apagar ficheiros
    await cleanupService.cleanup(jobId);

    res.status(200).json({
      success: true,
      message: 'Ficheiros apagados com sucesso',
      jobId
    });

  } catch (error) {
    logger.error('Erro no webhook confirm', { jobId: req.body?.jobId, error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  ready,
  confirm
};