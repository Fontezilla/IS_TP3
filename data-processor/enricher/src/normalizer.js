const axios = require('axios');

function cleanNumericString(value) {
    let str = String(value).trim();

    // Remover aspas
    str = str.replace(/"/g, '');

    // Remover símbolo + no início
    str = str.replace(/^\+/, '');

    // Remover símbolo %
    str = str.replace(/%$/, '');

    // Remover vírgulas (separador de milhares)
    str = str.replace(/,/g, '');

    // Converter sufixos: T (trillion), B (billion), M (million), K (thousand)
    const suffixMatch = str.match(/^(-?\d*\.?\d+)\s*([TBMK])$/i);
    if (suffixMatch) {
        const num = parseFloat(suffixMatch[1]);
        const suffix = suffixMatch[2].toUpperCase();
        const multipliers = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
        return num * multipliers[suffix];
    }

    return str;
}

function convertValue(value, type) {
    if (value === null || value === undefined || value === '') return null;

    switch (type) {
        case 'number':
            const cleanedNum = cleanNumericString(value);
            const num = typeof cleanedNum === 'number' ? cleanedNum : parseFloat(cleanedNum);
            return isNaN(num) ? null : num;
        case 'integer':
            const cleanedInt = cleanNumericString(value);
            const int = typeof cleanedInt === 'number' ? Math.round(cleanedInt) : parseInt(cleanedInt, 10);
            return isNaN(int) ? null : int;
        case 'datetime':
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date.toISOString();
        case 'boolean':
            return value === 'true' || value === '1' || value === true;
        default:
            return String(value);
    }
}

module.exports = {
    filterValidRows: (records, workflow, mapping) => {
        const cols = workflow.ingestion_config.columns_mapping;

        return records
            .map(row => {
                const symbolRaw = row[cols.symbol];
                const coinData = mapping[symbolRaw];

                if (!coinData) {
                    return null;
                }

                return {
                    row,
                    symbolRaw,
                    coinData
                };
            })
            .filter(item => item !== null);
    },

    fetchCoinGeckoData: async (validItems) => {
        const geckoIds = validItems
            .map(item => item.coinData.gecko_id)
            .filter(id => id)
            .join(',');

        if (!geckoIds) return {};

        try {
            const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${geckoIds}`;
            const response = await axios.get(url);

            const dataMap = {};
            for (const coin of response.data) {
                dataMap[coin.id] = {
                    circulating_supply: coin.circulating_supply,
                    total_supply: coin.total_supply,
                    ath: coin.ath,
                    ath_date: coin.ath_date
                };
            }
            return dataMap;
        } catch (err) {
            console.error('Erro CoinGecko API:', err.message);
            return {};
        }
    },

    fetchCoinMarketCapData: async (validItems) => {
        const cmcIds = validItems
            .map(item => item.coinData.cmc_id)
            .filter(id => id)
            .join(',');

        if (!cmcIds || !process.env.CMC_API_KEY) return {};

        try {
            const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${cmcIds}`;
            const response = await axios.get(url, {
                headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY }
            });

            const dataMap = {};
            for (const [id, coin] of Object.entries(response.data.data)) {
                dataMap[id] = {
                    cmc_rank: coin.cmc_rank,
                    dominance: coin.quote?.USD?.market_cap_dominance || null,
                    tags: coin.tags ? coin.tags.join(';') : '',
                    max_supply: coin.max_supply
                };
            }
            return dataMap;
        } catch (err) {
            console.error('Erro CoinMarketCap API:', err.message);
            return {};
        }
    },

    normalizeData: (validItems, workflow, geckoData, cmcData) => {
        const cols = workflow.ingestion_config.columns_mapping;

        return validItems.map(({ row, symbolRaw, coinData }) => {
            const gecko = geckoData[coinData.gecko_id] || {};
            const cmc = cmcData[coinData.cmc_id] || {};

            return {
                symbol: coinData.ticker,
                name: coinData.name,
                price: row[cols.price],
                change_24h: row[cols.change_24h],
                change_24h_percent: row[cols.change_24h_percent],
                market_cap: row[cols.market_cap],
                volume_24h: row[cols.volume_24h],
                timestamp: new Date().toISOString(),
                circulating_supply: gecko.circulating_supply || null,
                total_supply: gecko.total_supply || null,
                ath: gecko.ath || null,
                ath_date: gecko.ath_date || null,
                cmc_rank: cmc.cmc_rank || null,
                dominance: cmc.dominance || null,
                tags: cmc.tags || '',
                max_supply: cmc.max_supply || null
            };
        });
    },

    removeDuplicates: (data, key = 'symbol') => {
        const seen = new Set();
        return data.filter(row => {
            const value = row[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    },

    applyFieldTypes: (data, fieldTypes) => {
        if (!fieldTypes) return data;

        return data.map(row => {
            const typedRow = {};
            for (const [field, value] of Object.entries(row)) {
                const type = fieldTypes[field] || 'string';
                typedRow[field] = convertValue(value, type);
            }
            return typedRow;
        });
    },

    toCSV: (data) => {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header];
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }
};
