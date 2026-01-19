require('dotenv').config();
const amqp = require('amqplib');
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

const XML_SERVICE_URL = process.env.XML_SERVICE_URL;
const XML_SERVICE_TOKEN = process.env.XML_SERVICE_TOKEN;
const CLEANER_BASE_URL = process.env.CLEANER_URL;

const QUEUE_NAME = 'process-data';
const MAX_RETRIES = 3;
const BACKOFF_TIME = 5 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: 'data_processor' }
});

const failureCount = new Map();
let isInBackoff = false;
let backoffTimeout = null;

async function checkXMLServiceConnection() {
    try {
        await axios.get(XML_SERVICE_URL, {
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${XML_SERVICE_TOKEN}` }
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
    console.log(`[Sender] Alvo: ${XML_SERVICE_URL}`);

    const connectionStatus = await checkXMLServiceConnection();
    if (connectionStatus.connected) {
        console.log("[Sender] XML Service acessivel.");
    } else {
        console.log(`[Sender] XML Service inacessivel: ${connectionStatus.error}`);
        console.log("[Sender] A continuar... mensagens ficarao na queue.");
    }

    let channel;
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.prefetch(1);
        console.log(`[Sender] Conectado a fila '${QUEUE_NAME}'`);
    } catch (error) {
        console.error("[Sender] Erro fatal RabbitMQ:", error.message);
        process.exit(1);
    }

    const processMessage = async (msg) => {
        if (!msg) return;

        if (isInBackoff) {
            channel.nack(msg, false, true);
            return;
        }

        const content = JSON.parse(msg.content.toString());
        const { jobID, processed_path } = content;

        const currentFailures = failureCount.get(jobID) || 0;

        if (currentFailures >= MAX_RETRIES) {
            console.log(`[Job ${jobID}] Maximo de ${MAX_RETRIES} tentativas atingido. A entrar em backoff de 5 minutos...`);
            isInBackoff = true;
            channel.nack(msg, false, true);

            backoffTimeout = setTimeout(() => {
                console.log("[Sender] Backoff terminado. A retomar processamento...");
                isInBackoff = false;
                failureCount.clear();
            }, BACKOFF_TIME);

            return;
        }

        console.log(`[Job ${jobID}] Preparando pacote para envio... (tentativa ${currentFailures + 1}/${MAX_RETRIES})`);

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
                callback_url: `${CLEANER_BASE_URL}/cleanup/${jobID}`
            };
            form.append('metadata', JSON.stringify(metadata));

            console.log(`[Job ${jobID}] Enviando para o XML Service...`);

            const response = await axios.post(XML_SERVICE_URL, form, {
                headers: {
                    ...form.getHeaders(),
                    'Content-Length': form.getLengthSync(),
                    'Authorization': `Bearer ${XML_SERVICE_TOKEN}`
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
            });

            console.log(`[Job ${jobID}] Envio Sucesso! Status: ${response.status}`);

            failureCount.delete(jobID);

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

            failureCount.set(jobID, currentFailures + 1);

            channel.nack(msg, false, true);
        }
    };

    channel.consume(QUEUE_NAME, processMessage);
}

startSender();
