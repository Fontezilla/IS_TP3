require('dotenv').config();
const amqp = require('amqplib');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

const BUCKET_NAME = process.env.SUPABASE_RAW_BUCKET;
const QUEUE_NAME = 'raw-data';
const POLLING_INTERVAL = 60000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function startWatcher() {
    console.log("[Watcher] Serviço iniciado. Polling de 1 em 1 minuto...");

    let channel;
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log(`Conectado ao RabbitMQ. Fila: ${QUEUE_NAME}`);
    } catch (error) {
        console.error("Erro fatal ao conectar RabbitMQ:", error);
        process.exit(1);
    }

    const processBucket = async () => {
        try {
            const { data: files, error } = await supabase.storage
                .from(BUCKET_NAME)
                .list('', { limit: 10, sortBy: { column: 'name', order: 'asc' } });

            if (error) {
                console.error("Erro ao listar bucket:", error.message);
                return;
            }

            const newFiles = files.filter(f => f.name.endsWith('.csv') && !f.name.includes('/'));

            if (newFiles.length === 0) {
                return;
            }

            console.log(`Detetados ${newFiles.length} novos ficheiros.`);

            for (const file of newFiles) {
                const jobID = uuidv4();
                const originalPath = file.name;
                const rawPath = `processing/${jobID}_${file.name}`;

                console.log(`[Job ${jobID}] A mover ficheiro...`);

                const { error: moveError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .move(originalPath, rawPath);

                if (moveError) {
                    console.error(`Erro ao mover ${originalPath}:`, moveError.message);
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
            console.error("Erro inesperado no ciclo:", err.message);
        }
    };

    setInterval(processBucket, POLLING_INTERVAL);
    processBucket();
}

startWatcher();
