/**
 * CSV Generator Service
 * 
 * Gera o CSV final com dados agregados + meteorológicos
 */

const { stringify } = require('csv-stringify/sync');
const logger = require('../utils/logger');

/**
 * Gera o CSV final a partir dos dados combinados
 * @param {Object} combinedData - Dados agregados + weather
 * @returns {string} - CSV como string
 */
function generate(combinedData) {
  // Construir o registo único com todos os dados
  const record = {};

  // Adicionar dados agregados dos sensores
  if (combinedData.values) {
    for (const [key, value] of Object.entries(combinedData.values)) {
      record[key] = value;
    }
  }

  // Adicionar dados meteorológicos actuais
  if (combinedData.weather?.current) {
    const current = combinedData.weather.current;
    record['weather_temperature'] = current.temperature;
    record['weather_clouds'] = current.clouds;
    record['weather_wind_speed'] = current.windSpeed;
    record['weather_radiation'] = current.radiation;
  }

  // Adicionar previsões
  if (combinedData.weather?.predictions) {
    const predictions = combinedData.weather.predictions;
    
    if (predictions.plus4h) {
      record['forecast_4h_temperature'] = predictions.plus4h.temperature;
      record['forecast_4h_clouds'] = predictions.plus4h.clouds;
      record['forecast_4h_wind_speed'] = predictions.plus4h.windSpeed;
    }

    if (predictions.plus8h) {
      record['forecast_8h_temperature'] = predictions.plus8h.temperature;
      record['forecast_8h_clouds'] = predictions.plus8h.clouds;
      record['forecast_8h_wind_speed'] = predictions.plus8h.windSpeed;
    }

    if (predictions.plus12h) {
      record['forecast_12h_temperature'] = predictions.plus12h.temperature;
      record['forecast_12h_clouds'] = predictions.plus12h.clouds;
      record['forecast_12h_wind_speed'] = predictions.plus12h.windSpeed;
    }
  }

  // Substituir valores null/undefined por string vazia
  for (const key of Object.keys(record)) {
    if (record[key] === null || record[key] === undefined) {
      record[key] = '';
    }
  }

  // Gerar CSV
  const csv = stringify([record], {
    header: true,
    columns: Object.keys(record)
  });

  logger.debug('CSV gerado', { columns: Object.keys(record).length });

  return csv;
}

/**
 * Gera CSV com múltiplos registos (se necessário)
 * @param {Array} records - Array de registos
 * @returns {string} - CSV como string
 */
function generateMultiple(records) {
  if (!records || records.length === 0) {
    throw new Error('Nenhum registo para gerar CSV');
  }

  // Usar as chaves do primeiro registo como colunas
  const columns = Object.keys(records[0]);

  const csv = stringify(records, {
    header: true,
    columns
  });

  logger.debug('CSV gerado', { records: records.length, columns: columns.length });

  return csv;
}

module.exports = {
  generate,
  generateMultiple
};