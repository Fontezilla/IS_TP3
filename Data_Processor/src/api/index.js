/**
 * Routes
 *
 * Define os endpoints da API:
 * - GET  /health           → Health check
 * - POST /process          → Processa CSVs (Cloud Scheduler)
 * - POST /webhook/ready    → XML Service regista-se (envia callbackUrl)
 * - POST /webhook/confirm  → XML Service confirma (apaga ficheiros)
 */

const express = require('express');
const router = express.Router();

const healthController = require('../controllers/healthController');
const processController = require('../controllers/processController');
const webhookController = require('../controllers/webhookController');

router.get('/health', healthController.check);

router.post('/process', processController.execute);

router.post('/webhook/ready', webhookController.ready);
router.post('/webhook/confirm', webhookController.confirm);

module.exports = router;