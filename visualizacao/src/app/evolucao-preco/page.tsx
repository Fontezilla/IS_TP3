'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import Link from 'next/link';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  TextField, 
  Button,
  IconButton,
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { EvolucaoPrecoResponse } from '@/types/graphql';

const GET_EVOLUCAO_PRECO = gql`
  query GetEvolucaoPreco($ticker: String!, $from: String!, $to: String!) {
    evolucaoPreco(ticker: $ticker, from: $from, to: $to) {
      timestamp
      preco
    }
  }
`;

export default function EvolucaoPrecoPage() {
  const [ticker, setTicker] = useState('BTC');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-01-20');

  const { loading, error, data } = useQuery<EvolucaoPrecoResponse>(GET_EVOLUCAO_PRECO, {
    variables: { ticker, from, to },
  });

  const chartData = data?.evolucaoPreco?.map(item => ({
    timestamp: new Date(item.timestamp).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    }),
    preco: item.preco,
  })) || [];

  const stats = {
    min: Math.min(...(data?.evolucaoPreco?.map(d => d.preco) || [0])),
    max: Math.max(...(data?.evolucaoPreco?.map(d => d.preco) || [0])),
    avg: data?.evolucaoPreco?.reduce((acc, d) => acc + d.preco, 0) / (data?.evolucaoPreco?.length || 1) || 0,
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header com botão voltar */}
        <Box display="flex" alignItems="center" mb={4}>
          <Link href="/" passHref legacyBehavior>
            <IconButton sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white">
              Evolução de Preço
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Análise detalhada da evolução de preço de criptomoedas
            </p>
          </div>
        </Box>

        {/* Filtros */}
        <Card sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" mb={3}>
              Filtros de Pesquisa
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Data Inicial"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Data Final"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {data?.evolucaoPreco && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'error.main' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Preço Mínimo
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    ${stats.min.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'success.main' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Preço Máximo
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    ${stats.max.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 2, borderLeft: 4, borderColor: 'primary.main' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Preço Médio
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    ${stats.avg.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Gráfico Principal */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" mb={3}>
              Gráfico de Evolução
            </Typography>

            {loading && (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography>Carregando...</Typography>
              </Box>
            )}

            {error && (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography color="error">Erro: {error.message}</Typography>
              </Box>
            )}

            {data?.evolucaoPreco && (
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Preço']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="preco" 
                      stroke="#1976d2" 
                      strokeWidth={2}
                      dot={{ fill: '#1976d2', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Tabela de Dados */}
        {data?.evolucaoPreco && (
          <Card sx={{ mt: 4, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={3}>
                Dados Detalhados
              </Typography>
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="w-full">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="text-left p-3 font-semibold">Data</th>
                      <th className="text-right p-3 font-semibold">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evolucaoPreco.map((item, idx) => (
                      <tr 
                        key={idx} 
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <td className="p-3">
                          {new Date(item.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 text-right font-mono">
                          ${item.preco.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}