/**
 * Time Utils
 * 
 * Funções para manipulação de datas e agrupamento de CSVs
 */

/**
 * Extrai data e hora de um nome de ficheiro CSV
 * Ex: "2024-01-15_0930.csv" → "2024-01-15_09"
 * @param {string} filename
 * @returns {string|null}
 */
function extractDateHourFromFilename(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2})\d{2}\.csv/);
  if (match) {
    return `${match[1]}_${match[2]}`;
  }
  return null;
}

/**
 * Gera o jobId a partir de data + hora
 * Ex: "2024-01-15_09" → "job_2024-01-15_09"
 * @param {string} dateHourKey
 * @returns {string}
 */
function formatJobId(dateHourKey) {
  return `job_${dateHourKey}`;
}

/**
 * Gera os 4 nomes de CSV esperados para uma data + hora
 * Ex: "2024-01-15_09" → [
 *   "2024-01-15_0900.csv",
 *   "2024-01-15_0915.csv",
 *   "2024-01-15_0930.csv",
 *   "2024-01-15_0945.csv"
 * ]
 * @param {string} dateHourKey
 * @returns {string[]}
 */
function getCsvFilenamesForDateHour(dateHourKey) {
  const [date, hour] = dateHourKey.split('_');
  return ['00', '15', '30', '45'].map(min => `${date}_${hour}${min}.csv`);
}

/**
 * Agrupa ficheiros CSV por data + hora e identifica grupos completos
 * Retorna apenas os grupos que têm os 4 ficheiros (00, 15, 30, 45)
 * @param {string[]} filenames
 * @returns {Object} - { "2024-01-15_09": ["file1.csv", ...], ... }
 */
function groupCsvsByDateHour(filenames) {
  const groups = {};

  for (const filename of filenames) {
    const dateHourKey = extractDateHourFromFilename(filename);
    if (dateHourKey) {
      if (!groups[dateHourKey]) {
        groups[dateHourKey] = [];
      }
      groups[dateHourKey].push(filename);
    }
  }

  // Filtrar apenas grupos completos (4 ficheiros)
  const completeGroups = {};
  for (const [dateHourKey, files] of Object.entries(groups)) {
    if (files.length === 4) {
      completeGroups[dateHourKey] = files.sort();
    }
  }

  return completeGroups;
}

/**
 * Converte dateHourKey para Date object
 * Ex: "2024-01-15_09" → Date(2024-01-15T09:00:00Z)
 * @param {string} dateHourKey
 * @returns {Date}
 */
function dateHourKeyToDate(dateHourKey) {
  const [date, hour] = dateHourKey.split('_');
  return new Date(`${date}T${hour}:00:00Z`);
}

module.exports = {
  extractDateHourFromFilename,
  formatJobId,
  getCsvFilenamesForDateHour,
  groupCsvsByDateHour,
  dateHourKeyToDate
};