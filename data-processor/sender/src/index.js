require('dotenv').config();
const http = require('http');
const amqp = require('amqplib');
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

const port = process.env.PORT || 8080;
const QUEUE_NAME = 'process-data';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

let isConnected = false;
let supabase = null;

// 1. PRIMEIRO: Iniciar servidor HTTP (Cloud Run health check)
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end(isConnected ? 'Service is running!' : 'Starting...');
});

server.listen(port, () => {
    console.log(`[Sender] HTTP server listening on port ${port}`);
    initializeServices();
});

async function initializeServices() {
    try {
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
            db: { schema: 'data_processor' }
        });
        console.log('[Sender] Supabase inicializado');

        await startSender();
        isConnected = true;
        console.log('[Sender] Conectado com sucesso');
    } catch (err) {
        console.error('[Sender] Erro ao inicializar:', err.message);
    }
}

async function checkXMLServiceConnection() {
    try {
        await axios.get(process.env.XML_SERVICE_URL, {
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${process.env.XML_SERVICE_TOKEN}` }
        });
        return { connected: true };
    } catch (err) {
        if (err.response) {
            return { connected: true, status: err.response.status };
        }
        return { connected: false, error: err.message };
    }
}

async function startSender() {
    console.log("[Sender] Servico de Despacho Iniciado...");
    console.log(`[Sender] Alvo: ${process.env.XML_SERVICE_URL}`);

    const connectionStatus = await checkXMLServiceConnection();
    if (connectionStatus.connected) {
        console.log("[Sender] XML Service acessivel.");
    } else {
        console.log(`[Sender] XML Service inacessivel: ${connectionStatus.error}`);
        console.log("[Sender] A continuar... mensagens ficarao na queue.");
    }

    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.prefetch(1);
    console.log(`[Sender] Conectado a fila '${QUEUE_NAME}'`);

    const processMessage = async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        const { jobID, processed_path } = content;
        const retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;

        console.log(`[Job ${jobID}] Preparando pacote para envio... (tentativa ${retryCount + 1}/${MAX_RETRIES})`);

        try {
            const connCheck = await checkXMLServiceConnection();
            if (!connCheck.connected) {
                throw new Error(`XML Service inacessivel: ${connCheck.error}`);
            }

            const [dataRes, mapperRes, xsdRes] = await Promise.all([
                supabase.storage.from(process.env.SUPABASE_PROCESSED_BUCKET).download(processed_path),
                supabase.storage.from(process.env.SUPABASE_CONFIGS).download('mapper.json'),
                supabase.storage.from(process.env.SUPABASE_CONFIGS).download('schema.xsd')
            ]);

            if (dataRes.error) throw new Error(`Erro baixar CSV: ${dataRes.error.message}`);
            if (mapperRes.error) throw new Error(`Erro baixar Mapper: ${mapperRes.error.message}`);
            if (xsdRes.error) throw new Error(`Erro baixar XSD: ${xsdRes.error.message}`);

            const form = new FormData();
            form.append('source_file', Buffer.from(await dataRes.data.arrayBuffer()), 'dados_processados.csv');
            form.append('mapper_file', Buffer.from(await mapperRes.data.arrayBuffer()), 'mapper.json');
            form.append('schema_file', Buffer.from(await xsdRes.data.arrayBuffer()), 'schema.xsd');

            const metadata = {
                job_id: jobID,
                callback_url: `${process.env.CLEANER_URL}/cleanup/${jobID}`
            };
            form.append('metadata', JSON.stringify(metadata));

            console.log(`[Job ${jobID}] Enviando para o XML Service...`);

            const response = await axios.post(process.env.XML_SERVICE_URL, form, {
                headers: {
                    ...form.getHeaders(),
                    'Content-Length': form.getLengthSync(),
                    'Authorization': `Bearer ${process.env.XML_SERVICE_TOKEN}`
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
            });

            console.log(`[Job ${jobID}] Envio Sucesso! Status: ${response.status}`);

            const { error: dbError } = await supabase
                .from('sended_jobs')
                .insert({
                    job_id: jobID,
                    processed_path: processed_path,
                    status: 'SENDED',
                    sent_at: new Date().toISOString()
                });

            if (dbError) {
                console.error(`[Job ${jobID}] Aviso: Erro ao gravar na BD:`, dbError.message);
            }

            channel.ack(msg);

        } catch (error) {
            console.error(`[Job ${jobID}] Falha no processo:`, error.message);

            if (retryCount < MAX_RETRIES - 1) {
                console.log(`[Job ${jobID}] A agendar retry ${retryCount + 2}/${MAX_RETRIES} em ${RETRY_DELAY/1000}s...`);
                channel.ack(msg);

                setTimeout(() => {
                    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(content)), {
                        persistent: true,
                        headers: { 'x-retry-count': retryCount + 1 }
                    });
                }, RETRY_DELAY);
            } else {
                console.error(`[Job ${jobID}] Max retries (${MAX_RETRIES}) atingido. Mensagem descartada.`);

                await supabase
                    .from('sended_jobs')
                    .insert({
                        job_id: jobID,
                        processed_path: processed_path,
                        status: 'FAILED',
                        sent_at: new Date().toISOString()
                    });

                channel.ack(msg);
            }
        }
    };

    channel.consume(QUEUE_NAME, processMessage);
}
