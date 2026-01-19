require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: 'data_processor' }
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'active', role: 'cleaner' });
});

app.post('/cleanup/:jobId', async (req, res) => {
    const { jobId } = req.params;
    console.log(`[Cleaner] Pedido recebido para limpar Job: ${jobId}`);

    res.status(200).json({ message: 'Request received. Cleaning initiated.' });

    try {
        const { data: jobData, error: dbError } = await supabase
            .from('sended_jobs')
            .select('*')
            .eq('job_id', jobId)
            .single();

        if (dbError || !jobData) {
            console.warn(`[Cleaner] Job ${jobId} não encontrado na tabela 'sended_jobs'.`);
            return;
        }

        const processedPath = jobData.processed_path;

        if (processedPath) {
            const { error: delProcErr } = await supabase.storage
                .from(process.env.SUPABASE_PROCESSED_BUCKET)
                .remove([processedPath]);

            if (delProcErr) console.error(`[Cleaner] Erro ao apagar processed: ${delProcErr.message}`);
            else console.log(`[Cleaner] Processed apagado: ${processedPath}`);
        }

        const { data: fileList } = await supabase.storage
            .from(process.env.SUPABASE_RAW_BUCKET)
            .list('processing', { limit: 100, search: jobId });

        if (fileList && fileList.length > 0) {
            const rawFilesToDelete = fileList.map(f => `processing/${f.name}`);

            const { error: delRawErr } = await supabase.storage
                .from(process.env.SUPABASE_RAW_BUCKET)
                .remove(rawFilesToDelete);

            if (delRawErr) console.error(`[Cleaner] Erro ao apagar raw: ${delRawErr.message}`);
            else console.log(`[Cleaner] Raw apagado: ${rawFilesToDelete.join(', ')}`);
        } else {
            console.log(`[Cleaner] Ficheiro RAW não encontrado para Job ${jobId}.`);
        }

        const { error: finalDelErr } = await supabase
            .from('sended_jobs')
            .delete()
            .eq('job_id', jobId);

        if (finalDelErr) console.error(`[Cleaner] Erro ao limpar BD: ${finalDelErr.message}`);
        else console.log(`[Cleaner] Ciclo encerrado para Job ${jobId}.`);

    } catch (err) {
        console.error(`[Cleaner] Erro crítico: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`[Cleaner] Webhook a escutar na porta ${PORT}`);
});
