/**
 * Weather Service
 * 
 * Obtém dados meteorológicos da Open-Weather API
 * - Temperatura actual
 * - Radiância solar
 * - Previsões (+4h, +8h, +12h)
 */

const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Obtém dados meteorológicos para um timestamp
 * @param {Date} timestamp - Data/hora do job
 * @returns {Promise<Object>} - Dados meteorológicos
 */
async function getWeatherData(timestamp) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const lat = process.env.OPENWEATHER_LAT;
    const lon = process.env.OPENWEATHER_LON;

    if (!apiKey) {
      logger.warn('OPENWEATHER_API_KEY não configurada');
      return getDefaultWeatherData();
    }

    // Obter dados actuais + previsão
    const [current, forecast] = await Promise.all([
      getCurrentWeather(apiKey, lat, lon),
      getForecast(apiKey, lat, lon)
    ]);

    // Extrair previsões para +4h, +8h, +12h
    const predictions = extractPredictions(forecast, timestamp);

    return {
      current: {
        temperature: current.temp,
        clouds: current.clouds,
        windSpeed: current.wind_speed,
        radiation: current.uvi ? estimateRadiation(current.uvi) : null
      },
      predictions,
      fetchedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Erro ao obter dados meteorológicos', { error: error.message });
    return getDefaultWeatherData();
  }
}

/**
 * Obtém dados meteorológicos actuais
 */
async function getCurrentWeather(apiKey, lat, lon) {
  const response = await axios.get(`${BASE_URL}/weather`, {
    params: {
      lat,
      lon,
      appid: apiKey,
      units: 'metric'
    },
    timeout: 10000
  });

  const data = response.data;

  return {
    temp: data.main?.temp,
    clouds: data.clouds?.all,
    wind_speed: data.wind?.speed,
    uvi: null // Não disponível no endpoint /weather
  };
}

/**
 * Obtém previsão (5 dias / 3 horas)
 */
async function getForecast(apiKey, lat, lon) {
  const response = await axios.get(`${BASE_URL}/forecast`, {
    params: {
      lat,
      lon,
      appid: apiKey,
      units: 'metric'
    },
    timeout: 10000
  });

  return response.data.list || [];
}

/**
 * Extrai previsões para +4h, +8h, +12h
 * @param {Array} forecastList - Lista de previsões
 * @param {Date} baseTimestamp - Timestamp base
 * @returns {Object}
 */
function extractPredictions(forecastList, baseTimestamp) {
  const predictions = {
    plus4h: null,
    plus8h: null,
    plus12h: null
  };

  const baseTime = new Date(baseTimestamp).getTime();
  const hours = [4, 8, 12];

  for (const h of hours) {
    const targetTime = baseTime + (h * 60 * 60 * 1000);
    const closest = findClosestForecast(forecastList, targetTime);
    
    if (closest) {
      const key = `plus${h}h`;
      predictions[key] = {
        temperature: closest.main?.temp,
        clouds: closest.clouds?.all,
        windSpeed: closest.wind?.speed
      };
    }
  }

  return predictions;
}

/**
 * Encontra a previsão mais próxima de um timestamp
 */
function findClosestForecast(forecastList, targetTime) {
  if (!forecastList || forecastList.length === 0) return null;

  let closest = null;
  let minDiff = Infinity;

  for (const forecast of forecastList) {
    const forecastTime = forecast.dt * 1000; // Converter para ms
    const diff = Math.abs(forecastTime - targetTime);
    
    if (diff < minDiff) {
      minDiff = diff;
      closest = forecast;
    }
  }

  // Só aceitar se estiver dentro de 2 horas
  if (minDiff <= 2 * 60 * 60 * 1000) {
    return closest;
  }

  return null;
}

/**
 * Estima radiância solar a partir do índice UV
 * Fórmula aproximada: radiância ≈ UV * 25 W/m²
 */
function estimateRadiation(uvi) {
  if (uvi === null || uvi === undefined) return null;
  return Math.round(uvi * 25);
}

/**
 * Retorna dados default quando a API falha
 */
function getDefaultWeatherData() {
  return {
    current: {
      temperature: null,
      clouds: null,
      windSpeed: null,
      radiation: null
    },
    predictions: {
      plus4h: null,
      plus8h: null,
      plus12h: null
    },
    fetchedAt: new Date().toISOString(),
    error: 'Dados meteorológicos indisponíveis'
  };
}

module.exports = {
  getWeatherData
};