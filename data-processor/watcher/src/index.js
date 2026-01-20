require('dotenv').config();
const http = require('http');
const amqp = require('amqplib');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const port = process.env.PORT || 8080;
const QUEUE_NAME = 'raw-data';
const POLLING_INTERVAL = 60000;

let isConnected = false;
let supabase = null;

// 1. PRIMEIRO: Iniciar servidor HTTP (Cloud Run health check)
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end(isConnected ? 'Service is running!' : 'Starting...');
});

server.listen(port, () => {
    console.log(`[Watcher] HTTP server listening on port ${port}`);
    initializeServices();
});

async function initializeServices() {
    try {
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        console.log('[Watcher] Supabase inicializado');

        await startWatcher();
        isConnected = true;
        console.log('[Watcher] Conectado com sucesso');
    } catch (err) {
        console.error('[Watcher] Erro ao inicializar:', err.message);
    }
}

async function startWatcher() {
    console.log("[Watcher] Serviço iniciado. Polling de 1 em 1 minuto...");

    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log(`[Watcher] Conectado ao RabbitMQ. Fila: ${QUEUE_NAME}`);

    const processBucket = async () => {
        try {
            const { data: files, error } = await supabase.storage
                .from(process.env.SUPABASE_RAW_BUCKET)
                .list('', { limit: 10, sortBy: { column: 'name', order: 'asc' } });

            if (error) {
                console.error("[Watcher] Erro ao listar bucket:", error.message);
                return;
            }

            const newFiles = files.filter(f => f.name.endsWith('.csv') && !f.name.includes('/'));

            if (newFiles.length === 0) {
                return;
            }

            console.log(`[Watcher] Detetados ${newFiles.length} novos ficheiros.`);

            for (const file of newFiles) {
                const jobID = uuidv4();
                const originalPath = file.name;
                const rawPath = `processing/${jobID}_${file.name}`;

                console.log(`[Job ${jobID}] A mover ficheiro...`);

                const { error: moveError } = await supabase.storage
                    .from(process.env.SUPABASE_RAW_BUCKET)
                    .move(originalPath, rawPath);

                if (moveError) {
                    console.error(`[Watcher] Erro ao mover ${originalPath}:`, moveError.message);
                    continue;
                }

                const messagePayload = {
                    jobID: jobID,
                    raw_path: rawPath
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(messagePayload)), {
                    persistent: true
                });

                console.log(`[Job ${jobID}] Enviado para fila '${QUEUE_NAME}'.`);
            }

        } catch (err) {
            console.error("[Watcher] Erro inesperado no ciclo:", err.message);
        }
    };

    setInterval(processBucket, POLLING_INTERVAL);
    processBucket();
}
