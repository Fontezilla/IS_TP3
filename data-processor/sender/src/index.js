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
    res.end(`Status: ${isConsuming ? 'PROCESSING' : 'PAUSED'}`);
});

server.listen(port, () => {
    initializeServices();
});

async function initializeServices() {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
        db: { schema: 'data_processor' }
    });

    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.prefetch(1);

    monitorServiceHealth();
}

async function monitorServiceHealth() {
    const loop = async () => {
        const isOnline = await checkXMLService();

        if (isOnline && !isConsuming) {
            await startConsumer();
        } else if (!isOnline && isConsuming) {
            await stopConsumer();
        }

        setTimeout(loop, CHECK_INTERVAL);
    };

    loop();
}

async function checkXMLService() {
    try {
        await axios.get(`${process.env.XML_SERVICE_URL}/health`, {
            timeout: 5000,
            headers: {
                Authorization: `Bearer ${process.env.XML_SERVICE_TOKEN}`
            }
        });
        return true;
    } catch {
        return false;
    }
}

async function startConsumer() {
    const { consumerTag: tag } = await channel.consume(QUEUE_NAME, processMessage);
    consumerTag = tag;
    isConsuming = true;
}

async function stopConsumer() {
    if (!consumerTag) return;
    await channel.cancel(consumerTag);
    consumerTag = null;
    isConsuming = false;
}

async function processMessage(msg) {
    const { jobID, processed_path } = JSON.parse(msg.content.toString());

    try {
        const dataRes = await supabase
            .storage
            .from(process.env.SUPABASE_PROCESSED_BUCKET)
            .download(processed_path);

        if (dataRes.error) throw dataRes.error;

        const form = new FormData();
        form.append('source_file', Buffer.from(await dataRes.data.arrayBuffer()), 'data.csv');
        form.append('metadata', JSON.stringify({
            job_id: jobID,
            callback_url: `${process.env.CLEANER_URL}/cleanup/${jobID}`
        }));

        await axios.post(`${process.env.XML_SERVICE_URL}/upload`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${process.env.XML_SERVICE_TOKEN}`
            },
            timeout: 30000
        });

        channel.ack(msg);
    } catch (err) {
        channel.nack(msg, false, true);
        await stopConsumer();
    }
}
