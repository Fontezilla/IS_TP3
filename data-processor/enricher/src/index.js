const http = require('http');
const port = process.env.PORT || 8080;

let isReady = false;
let startupError = null;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    if (startupError) {
        res.end(`Error: ${startupError}`);
    } else {
        res.end(isReady ? 'Service is running!' : 'Starting...');
    }
});

server.listen(port, '0.0.0.0',() => {
    console.log(`[Enricher] HTTP server listening on port ${port}`);

    setTimeout(() => {
        initializeServices().catch(err => {
            console.error('[Enricher] Erro fatal:', err);
            startupError = err.message;
        });
    }, 100);
});

async function initializeServices() {
    try {
        console.log('[Enricher] A carregar modulos...');

        require('dotenv').config();
        const amqp = require('amqplib');
        const { createClient } = require('@supabase/supabase-js');
        const { parse } = require('csv-parse/sync');
        const normalizer = require('./normalizer');

        console.log('[Enricher] Modulos carregados');

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        console.log('[Enricher] Supabase inicializado');

        await startEnricher(amqp, supabase, parse, normalizer);
        isReady = true;
        console.log('[Enricher] Conectado com sucesso');
    } catch (err) {
        console.error('[Enricher] Erro ao inicializar:', err.message);
        startupError = err.message;
    }
}

async function startEnricher(amqp, supabase, parse, normalizer) {
    const INPUT_QUEUE = 'raw-data';
    const OUTPUT_QUEUE = 'process-data';

    console.log("[Enricher] A conectar ao RabbitMQ...");

    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(INPUT_QUEUE, { durable: true });
    await channel.assertQueue(OUTPUT_QUEUE, { durable: true });
    await channel.prefetch(1);

    console.log("[Enricher] Aguardando mensagens...");

    channel.consume(INPUT_QUEUE, async (msg) => {
        if (!msg) return;

        const { jobID, raw_path } = JSON.parse(msg.content.toString());
        console.log(`[Job ${jobID}] Iniciando processamento...`);

        try {
            const { data: workflowData } = await supabase.storage.from(process.env.SUPABASE_CONFIGS).download('workflow.json');
            const { data: mappingData } = await supabase.storage.from(process.env.SUPABASE_CONFIGS).download('currency_mapping.json');

            if (!workflowData || !mappingData) throw new Error("Configs não encontradas no Supabase!");

            const workflow = JSON.parse(await workflowData.text());
            const mapping = JSON.parse(await mappingData.text());

            const { data: csvBlob, error: downloadError } = await supabase.storage
                .from(process.env.SUPABASE_RAW_BUCKET)
                .download(raw_path);

            if (downloadError) throw downloadError;

            const csvText = await csvBlob.text();
            const records = parse(csvText, {
                skip_empty_lines: true,
                from_line: 2
            });

            console.log(`[Job ${jobID}] Linhas no CSV: ${records.length}`);

            const validItems = normalizer.filterValidRows(records, workflow, mapping);
            console.log(`[Job ${jobID}] Moedas válidas no mapping: ${validItems.length}`);

            if (validItems.length === 0) {
                console.log(`[Job ${jobID}] Nenhuma moeda válida encontrada. A saltar...`);
                channel.ack(msg);
                return;
            }

            const geckoData = await normalizer.fetchCoinGeckoData(validItems);
            console.log(`[Job ${jobID}] Dados CoinGecko obtidos: ${Object.keys(geckoData).length}`);

            const cmcData = await normalizer.fetchCoinMarketCapData(validItems);
            console.log(`[Job ${jobID}] Dados CoinMarketCap obtidos: ${Object.keys(cmcData).length}`);

            const processedResults = normalizer.normalizeData(validItems, workflow, geckoData, cmcData);
            const uniqueResults = normalizer.removeDuplicates(processedResults, 'symbol');
            console.log(`[Job ${jobID}] Registos após remoção de duplicados: ${uniqueResults.length}`);
            const typedResults = normalizer.applyFieldTypes(uniqueResults, workflow.field_types);
            const csvOutput = normalizer.toCSV(typedResults);

            const processedFilename = raw_path.replace('processing/', '').replace('.csv', '_enriched.csv');
            const processedPath = `processed/${processedFilename}`;

            const { error: uploadError } = await supabase.storage
                .from(process.env.SUPABASE_PROCESSED_BUCKET)
                .upload(processedPath, csvOutput, {
                    contentType: 'text/csv'
                });

            if (uploadError) throw uploadError;

            const outputPayload = {
                jobID: jobID,
                raw_path: raw_path,
                processed_path: processedPath
            };

            channel.sendToQueue(OUTPUT_QUEUE, Buffer.from(JSON.stringify(outputPayload)), { persistent: true });

            channel.ack(msg);
            console.log(`[Job ${jobID}] Sucesso! Guardado em: ${processedPath}`);

        } catch (err) {
            console.error(`[Job ${jobID}] Falha:`, err.message);

            const retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;
            const maxRetries = 3;

            if (retryCount < maxRetries) {
                console.log(`[Job ${jobID}] Retry ${retryCount + 1}/${maxRetries}...`);
                channel.sendToQueue(INPUT_QUEUE, msg.content, {
                    persistent: true,
                    headers: { 'x-retry-count': retryCount + 1 }
                });
                channel.ack(msg);
            } else {
                console.error(`[Job ${jobID}] Max retries atingido. Mensagem descartada.`);
                channel.ack(msg);
            }
        }
    });
}
