/**
 * Aggregation Service
 * 
 * Calcula médias dos dados dos 4 CSVs de uma hora
 */

const logger = require('../utils/logger');

const DECIMAL_PRECISION = 4;

/**
 * Agrega dados de múltiplos CSVs (calcula médias)
 * @param {Array} csvDataArray - Array de { filename, records }
 * @returns {Object} - Dados agregados com médias
 */
function aggregate(csvDataArray) {
  if (!csvDataArray || csvDataArray.length === 0) {
    throw new Error('Nenhum dado para agregar');
  }

  if (csvDataArray.length !== 4) {
    logger.warn('Número de CSVs diferente de 4', { count: csvDataArray.length });
  }

  const allRecords = csvDataArray.flatMap(csv => csv.records);

  if (allRecords.length === 0) {
    throw new Error('CSVs sem registos');
  }

  const sampleRecord = allRecords[0];

  if (!sampleRecord || typeof sampleRecord !== 'object') {
    throw new Error('Formato de dados inválido');
  }

  if (sampleRecord.tipo_energia && sampleRecord.MW !== undefined) {
    return aggregateByEnergyType(allRecords, csvDataArray.length);
  }

  const numericColumns = Object.keys(sampleRecord).filter(key => {
    return typeof sampleRecord[key] === 'number';
  });

  if (numericColumns.length === 0) {
    throw new Error('Nenhuma coluna numérica encontrada nos CSVs');
  }

  const averages = {};

  for (const column of numericColumns) {
    const values = allRecords
      .map(record => record[column])
      .filter(value => typeof value === 'number' && !isNaN(value));

    if (values.length > 0) {
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      averages[column] = roundToPrecision(avg, DECIMAL_PRECISION);
    }
  }

  const result = {
    values: averages,
    meta: {
      totalRecords: allRecords.length,
      filesProcessed: csvDataArray.length,
      columnsAggregated: numericColumns.length
    }
  };

  logger.debug('Dados agregados', {
    records: allRecords.length,
    columns: numericColumns.length
  });

  return result;
}

/**
 * Agrega dados por tipo de energia (pivot)
 * @param {Array} records - Todos os registos dos CSVs
 * @param {number} fileCount - Número de ficheiros processados
 * @returns {Object} - Dados agregados por tipo
 */
function aggregateByEnergyType(records, fileCount) {
  const ALLOWED_TYPES = new Set(['Eólica', 'Solar', 'Consumo', 'Consumo + Armazenamento']);
  const grouped = {};

  for (const record of records) {
    const type = record.tipo_energia;
    const mw = parseFloat(record.MW);

    if (!type || isNaN(mw)) continue;

    if (!ALLOWED_TYPES.has(type)) continue;

    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(mw);
  }

  const averages = {};
  for (const [type, values] of Object.entries(grouped)) {
    if (values.length > 0) {
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      averages[type] = roundToPrecision(avg, DECIMAL_PRECISION);
    }
  }

  logger.debug('Dados agregados por tipo de energia', {
    types: Object.keys(averages).length,
    records: records.length,
    allowedTypes: Array.from(ALLOWED_TYPES)
  });

  return {
    values: averages,
    meta: {
      totalRecords: records.length,
      filesProcessed: fileCount,
      energyTypes: Object.keys(averages).length
    }
  };
}

/**
 * Arredonda para N casas decimais
 * @param {number} value - Valor a arredondar
 * @param {number} precision - Número de casas decimais
 * @returns {number}
 */
function roundToPrecision(value, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * Calcula estatísticas adicionais (opcional)
 * @param {Array} values - Array de valores numéricos
 * @returns {Object} - { min, max, avg, count }
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return { min: null, max: null, avg: null, count: 0 };
  }

  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  
  if (validValues.length === 0) {
    return { min: null, max: null, avg: null, count: 0 };
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  
  return {
    min: roundToPrecision(Math.min(...validValues), DECIMAL_PRECISION),
    max: roundToPrecision(Math.max(...validValues), DECIMAL_PRECISION),
    avg: roundToPrecision(sum / validValues.length, DECIMAL_PRECISION),
    count: validValues.length
  };
}

module.exports = {
  aggregate,
  calculateStats,
  roundToPrecision
};