/**
 * Mapper Service
 * 
 * Gera o mapper de domínio que define como os campos
 * do CSV final mapeiam para o XML
 */

const logger = require('../utils/logger');

/**
 * Gera o mapper de domínio baseado nos dados combinados
 * @param {Object} combinedData - Dados agregados + weather
 * @returns {Object} - Mapper de domínio
 */
function generateMapper(combinedData) {
  const mapper = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    mappings: {}
  };

  // Mapear campos agregados (do CSV original)
  if (combinedData.values) {
    for (const field of Object.keys(combinedData.values)) {
      mapper.mappings[field] = {
        source: 'csv',
        xmlPath: `Data/Sensors/${toPascalCase(field)}`,
        type: 'number'
      };
    }
  }

  // Mapear campos meteorológicos
  if (combinedData.weather?.current) {
    const weatherMappings = {
      'weather_temperature': {
        source: 'openweather',
        xmlPath: 'Data/Weather/Current/Temperature',
        type: 'number',
        unit: '°C'
      },
      'weather_clouds': {
        source: 'openweather',
        xmlPath: 'Data/Weather/Current/CloudCover',
        type: 'number',
        unit: '%'
      },
      'weather_wind_speed': {
        source: 'openweather',
        xmlPath: 'Data/Weather/Current/WindSpeed',
        type: 'number',
        unit: 'm/s'
      },
      'weather_radiation': {
        source: 'openweather',
        xmlPath: 'Data/Weather/Current/SolarRadiation',
        type: 'number',
        unit: 'W/m²'
      }
    };

    Object.assign(mapper.mappings, weatherMappings);
  }

  // Mapear previsões
  if (combinedData.weather?.predictions) {
    const predictionHours = ['plus4h', 'plus8h', 'plus12h'];
    
    for (const hour of predictionHours) {
      if (combinedData.weather.predictions[hour]) {
        const prefix = `forecast_${hour}`;
        mapper.mappings[`${prefix}_temperature`] = {
          source: 'openweather',
          xmlPath: `Data/Weather/Forecast/${toPascalCase(hour)}/Temperature`,
          type: 'number',
          unit: '°C'
        };
      }
    }
  }

  logger.debug('Mapper gerado', { fields: Object.keys(mapper.mappings).length });

  return mapper;
}

/**
 * Converte string para PascalCase
 * Ex: "wind_speed" → "WindSpeed"
 */
function toPascalCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Valida um mapper
 * @param {Object} mapper - Mapper a validar
 * @returns {boolean}
 */
function validateMapper(mapper) {
  if (!mapper || !mapper.mappings) {
    return false;
  }

  for (const [field, config] of Object.entries(mapper.mappings)) {
    if (!config.xmlPath || !config.type) {
      logger.warn('Campo inválido no mapper', { field });
      return false;
    }
  }

  return true;
}

module.exports = {
  generateMapper,
  validateMapper,
  toPascalCase
};