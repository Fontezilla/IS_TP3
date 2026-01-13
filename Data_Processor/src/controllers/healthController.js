const logger = require('../utils/logger');
const callbackState = require('../state/callbackState');

/**
 * Health check
 */
const check = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'data-processor',
    timestamp: new Date().toISOString(),
    xmlServiceConnected: callbackState.isAvailable()
  });
};

module.exports = {
  check
};