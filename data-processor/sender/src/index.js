require('dotenv').config();

// 1. IMPORTAR MÓDULO HTTP
const http = require('http');
const amqp = require('amqplib');
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const XML_SERVICE_BASE_URL = process.env.XML_SERVICE_URL;
const XML_SERVICE_TOKEN = process.env.XML_SERVICE_TOKEN;
const CLEANER_BASE_URL = process.env.CLEANER_URL;
const QUEUE_NAME = 'process-data';
const MAX_RETRIES = 3;
const BACKOFF_TIME = 5 * 60 * 1000;
const PORT = process.env.PORT || 8080;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: 'data_processor' }
});

const failureCount = new Map();
let isInBackoff = false;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end('Sender Service is Running!');
});


server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sender] HTTP Server listening on port ${PORT}`);
    
    startSender().catch(err => {
        console.error('[Sender] Fatal Error:', err);
    });
});



async function checkXMLServiceConnection() {
    try {
        await axios.get(`${XML_SERVICE_BASE_URL}/health`, {
            timeout: 5000,
            headers: { Authorization: `Bearer ${XML_SERVICE_TOKEN}` }
        });
        return true;
    } catch {
        return false;
    }
}

async function startSender() {
    console.log('[Sender] Serviço iniciado');
    console.log('[Sender] XML Service:', XML_SERVICE_BASE_URL);

    const isOnline = await checkXMLServiceConnection();
    console.log(`[Sender] XML Service ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

    let channel;
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.prefetch(1);
        console.log(`[Sender] Ligado à fila '${QUEUE_NAME}'`);
    } catch (err) {
        console.error('[Sender] Erro RabbitMQ:', err.message);
        return; 
    }

    const processMessage = async (msg) => {
        if (!msg) return;

        if (isInBackoff) {
            channel.nack(msg, false, true);
            return;
        }

        const { jobID, processed_path } = JSON.parse(msg.content.toString());
        const attempts = failureCount.get(jobID) || 0;

        if (attempts >= MAX_RETRIES) {
            console.log(`[Job ${jobID}] Máx. tentativas atingidas. Backoff 5 min.`);
            isInBackoff = true;
            channel.nack(msg, false, true);

            setTimeout(() => {
                console.log('[Sender] Backoff terminado');
                isInBackoff = false;
                failureCount.clear();
            }, BACKOFF_TIME);

            return;
        }

        try {
            const online = await checkXMLServiceConnection();
            if (!online) throw new Error('XML Service offline');

            const [csvRes, mapperRes, xsdRes] = await Promise.all([
                supabase.storage.from(process.env.SUPABASE_PROCESSED_BUCKET).download(processed_path),
                supabase.storage.from(process.env.SUPABASE_CONFIGS).download('mapper.json'),
                supabase.storage.from(process.env.SUPABASE_CONFIGS).download('schema.xsd')
            ]);

            if (csvRes.error) throw new Error('Erro CSV');
            if (mapperRes.error) throw new Error('Erro mapper');
            if (xsdRes.error) throw new Error('Erro XSD');

            const form = new FormData();
            form.append('source_file', Buffer.from(await csvRes.data.arrayBuffer()), 'dados.csv');
            form.append('mapper_file', Buffer.from(await mapperRes.data.arrayBuffer()), 'mapper.json');
            form.append('schema_file', Buffer.from(await xsdRes.data.arrayBuffer()), 'schema.xsd');
            form.append('metadata', JSON.stringify({
                job_id: jobID,
                callback_url: `${CLEANER_BASE_URL}/cleanup/${jobID}`
            }));

            await axios.post(`${XML_SERVICE_BASE_URL}/upload`, form, {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${XML_SERVICE_TOKEN}`
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
            });

            await supabase.from('sended_jobs').insert({
                job_id: jobID,
                processed_path,
                status: 'SENDED',
                sent_at: new Date().toISOString()
            });

            failureCount.delete(jobID);
            channel.ack(msg);
            console.log(`[Job ${jobID}] Enviado com sucesso`);

        } catch (err) {
            console.error(`[Job ${jobID}] Erro:`, err.message);
            failureCount.set(jobID, attempts + 1);
            channel.nack(msg, false, true);
        }
    };

    channel.consume(QUEUE_NAME, processMessage);
}