require('dotenv').config();
const http = require('http');
const amqp = require('amqplib');
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

const port = process.env.PORT || 8080;
const QUEUE_NAME = 'process-data';
const CHECK_INTERVAL = 10000;

let supabase = null;
let channel = null;
let consumerTag = null;
let isConsuming = false;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end(`Status: ${isConsuming ? 'PROCESSING' : 'PAUSED (Service Offline)'}`);
});

server.listen(port, () => {
    console.log(`[Sender] HTTP server running on port ${port}`);
    initializeServices();
});

async function initializeServices() {
    try {
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
            db: { schema: 'data_processor' }
        });

        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.prefetch(1);
        
        console.log('[Sender] Conectado ao RabbitMQ. Iniciando monitorização...');

        monitorServiceHealth();

    } catch (err) {
        console.error('[Sender] Erro fatal:', err.message);
        process.exit(1);
    }
}

async function monitorServiceHealth() {
    const checkLoop = async () => {
        const isOnline = await checkXMLService();

        if (isOnline && !isConsuming) {
            console.log('[Monitor] Serviço XML está ON. Iniciando consumidor...');
            await startConsumer();
        } else if (!isOnline && isConsuming) {
            console.log('[Monitor] Serviço XML caiu. Pausando consumidor...');
            await stopConsumer();
        } else if (!isOnline) {
             console.log('[Monitor] Serviço XML continua OFF. Mantendo pausa.');
        }

        setTimeout(checkLoop, CHECK_INTERVAL);
    };

    checkLoop();
}

async function checkXMLService() {
    try {
        await axios.get(process.env.XML_SERVICE_URL, {
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${process.env.XML_SERVICE_TOKEN}` }
        });
        return true;
    } catch (err) {
        return false;
    }
}


async function startConsumer() {
    if (isConsuming) return;

    try {
        const { consumerTag: tag } = await channel.consume(QUEUE_NAME, processMessage);
        consumerTag = tag;
        isConsuming = true;
        console.log(`[RabbitMQ] Consumidor INICIADO (Tag: ${consumerTag})`);
    } catch (err) {
        console.error('[RabbitMQ] Erro ao iniciar consumidor:', err.message);
    }
}

async function stopConsumer() {
    if (!isConsuming || !consumerTag) return;

    try {
        await channel.cancel(consumerTag);
        isConsuming = false;
        consumerTag = null;
        console.log('[RabbitMQ] Consumidor PAUSADO. Mensagens mantidas na fila.');
    } catch (err) {
        console.error('[RabbitMQ] Erro ao pausar consumidor:', err.message);
    }
}

const processMessage = async (msg) => {
    if (!msg) return;

    const content = JSON.parse(msg.content.toString());
    const { jobID, processed_path } = content;

    console.log(`[Job ${jobID}] Recebido. Processando...`);

    try {
        const [dataRes, mapperRes, xsdRes] = await Promise.all([
            supabase.storage.from(process.env.SUPABASE_PROCESSED_BUCKET).download(processed_path),
            supabase.storage.from(process.env.SUPABASE_CONFIGS).download('mapper.json'),
            supabase.storage.from(process.env.SUPABASE_CONFIGS).download('schema.xsd')
        ]);

        if (dataRes.error || mapperRes.error || xsdRes.error) {
            throw new Error("Erro no Supabase (Ficheiros não encontrados)");
        }

        const form = new FormData();
        form.append('source_file', Buffer.from(await dataRes.data.arrayBuffer()), 'dados.csv');
        form.append('mapper_file', Buffer.from(await mapperRes.data.arrayBuffer()), 'mapper.json');
        form.append('schema_file', Buffer.from(await xsdRes.data.arrayBuffer()), 'schema.xsd');
        const metadata = { job_id: jobID, callback_url: `${process.env.CLEANER_URL}/cleanup/${jobID}` };
        form.append('metadata', JSON.stringify(metadata));

        await axios.post(process.env.XML_SERVICE_URL, form, {
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${process.env.XML_SERVICE_TOKEN}` },
            timeout: 30000
        });
        await supabase.from('sended_jobs').insert({
            job_id: jobID,
            processed_path: processed_path,
            status: 'SENDED',
            sent_at: new Date().toISOString()
        });

        channel.ack(msg);
        console.log(`[Job ${jobID}] Enviado com sucesso.`);

    } catch (error) {
        console.error(`[Job ${jobID}] Erro: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log(`[Job ${jobID}] Serviço caiu DURANTE o envio. Devolvendo à fila e pausando.`);
            
            channel.nack(msg, false, true);
            
            await stopConsumer(); 
        } else {
             await supabase.from('sended_jobs').insert({
                job_id: jobID,
                processed_path: processed_path,
                status: 'FAILED',
                error_log: error.message
            });
            channel.ack(msg);
        }
    }
};