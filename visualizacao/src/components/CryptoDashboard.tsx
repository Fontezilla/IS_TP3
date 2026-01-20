'use client';

import React, { useState, useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  TextField,
  Button,
  Alert,
  Chip,
} from '@mui/material';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { EvolucaoPrecoResponse, RankingDominanciaResponse, PrecoMedioResponse } from '@/types/graphql';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Consulta GraphQL para evolução de preço
const GET_EVOLUCAO_PRECO = gql`
  query EvolucaoPreco($ticker: String!, $from: String!, $to: String!) {
    evolucaoPreco(ticker: $ticker, from: $from, to: $to) {
      timestamp
      preco
    }
  }
`;

// Consulta GraphQL para ranking de dominância
const GET_RANKING_DOMINANCIA = gql`
  query RankingDominancia($limit: Int) {
    rankingDominancia(limit: $limit) {
      ticker
      dominancia
    }
  }
`;

// Consulta GraphQL para preço médio
const GET_PRECO_MEDIO = gql`
  query PrecoMedio($from: String!, $to: String!) {
    precoMedio(from: $from, to: $to) {
      ticker
      precoMedio
    }
  }
`;

export default function CryptoDashboard() {
  const client = useApolloClient();
  const [ticker, setTicker] = useState('BTC');
  const [from, setFrom] = useState(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return yearStart.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [limit, setLimit] = useState(10);

  // Estados para armazenar os dados
  const [priceData, setPriceData] = useState<EvolucaoPrecoResponse | null>(null);
  const [rankingData, setRankingData] = useState<RankingDominanciaResponse | null>(null);
  const [avgData, setAvgData] = useState<PrecoMedioResponse | null>(null);

  // Estados de loading
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [loadingAvg, setLoadingAvg] = useState(false);

  // Estados de status
  const [priceStatus, setPriceStatus] = useState('');
  const [rankingStatus, setRankingStatus] = useState('');
  const [avgStatus, setAvgStatus] = useState('');

  const [priceError, setPriceError] = useState('');
  const [rankingError, setRankingError] = useState('');
  const [avgError, setAvgError] = useState('');

  const [priceStats, setPriceStats] = useState({
    lastPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    avgPrice: 0,
    variation: 0,
    records: 0,
  });

  // Função para formatar número como moeda
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return '$' + (value / 1000000000).toFixed(2) + 'B';
    } else if (value >= 1000000) {
      return '$' + (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
      return '$' + (value / 1000).toFixed(2) + 'K';
    }
    return '$' + value.toFixed(2);
  };

  // Função para formatar percentagem
  const formatPercent = (value: number) => {
    return value.toFixed(2) + '%';
  };

  // Função para carregar evolução de preço
  const loadEvolucaoPreco = async () => {
    setLoadingPrice(true);
    setPriceStatus('A carregar...');
    setPriceError('');

    try {
      const { data } = await client.query<EvolucaoPrecoResponse>({
        query: GET_EVOLUCAO_PRECO,
        variables: { ticker, from, to },
        fetchPolicy: 'network-only', // Força buscar dados frescos
      });

      const items = data.evolucaoPreco;

      if (items.length === 0) {
        throw new Error('Nenhum dado encontrado para o período selecionado');
      }

      // Atualizar estado com os dados
      setPriceData(data);

      // Calcular estatísticas
      const precos = items.map(i => i.preco);
      const minPreco = Math.min(...precos);
      const maxPreco = Math.max(...precos);
      const avgPreco = precos.reduce((a, b) => a + b, 0) / precos.length;
      const variation = ((precos[precos.length - 1] - precos[0]) / precos[0] * 100);

      setPriceStats({
        lastPrice: precos[precos.length - 1],
        minPrice: minPreco,
        maxPrice: maxPreco,
        avgPrice: avgPreco,
        variation: variation,
        records: items.length,
      });

      setPriceStatus('OK');
    } catch (error) {
      setPriceStatus('Erro');
      setPriceError(error instanceof Error ? error.message : 'Erro desconhecido');
      setPriceData(null);
    } finally {
      setLoadingPrice(false);
    }
  };

  // Função para carregar ranking de dominância
  const loadRankingDominancia = async () => {
    setLoadingRanking(true);
    setRankingStatus('A carregar...');
    setRankingError('');

    try {
      const { data } = await client.query<RankingDominanciaResponse>({
        query: GET_RANKING_DOMINANCIA,
        variables: { limit },
        fetchPolicy: 'network-only',
      });

      if (data.rankingDominancia.length === 0) {
        throw new Error('Nenhum dado de dominância encontrado');
      }

      // Atualizar estado com os dados
      setRankingData(data);
      setRankingStatus('OK');
    } catch (error) {
      setRankingStatus('Erro');
      setRankingError(error instanceof Error ? error.message : 'Erro desconhecido');
      setRankingData(null);
    } finally {
      setLoadingRanking(false);
    }
  };

  // Função para carregar preço médio
  const loadPrecoMedio = async () => {
    setLoadingAvg(true);
    setAvgStatus('A carregar...');
    setAvgError('');

    try {
      const { data } = await client.query<PrecoMedioResponse>({
        query: GET_PRECO_MEDIO,
        variables: { from, to },
        fetchPolicy: 'network-only',
      });

      if (data.precoMedio.length === 0) {
        throw new Error('Nenhum dado de preço médio encontrado');
      }

      // Atualizar estado com os dados
      setAvgData(data);
      setAvgStatus('OK');
    } catch (error) {
      setAvgStatus('Erro');
      setAvgError(error instanceof Error ? error.message : 'Erro desconhecido');
      setAvgData(null);
    } finally {
      setLoadingAvg(false);
    }
  };

  // Função para carregar todos os dados
  const loadAllData = async () => {
    await Promise.all([
      loadEvolucaoPreco(),
      loadRankingDominancia(),
      loadPrecoMedio(),
    ]);
  };

  // Função para limpar dados
  const clearData = () => {
    setPriceData(null);
    setRankingData(null);
    setAvgData(null);
    setPriceStatus('');
    setRankingStatus('');
    setAvgStatus('');
    setPriceError('');
    setRankingError('');
    setAvgError('');
    setPriceStats({
      lastPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      variation: 0,
      records: 0,
    });
  };

  // Carregar dados ao iniciar
  useEffect(() => {
    loadAllData();
  }, []); // Carrega apenas uma vez ao montar

  // Dados para o gráfico de evolução de preço
  const priceChartData = {
    labels: priceData?.evolucaoPreco?.map(i => new Date(i.timestamp).toLocaleDateString('pt-PT')) || [],
    datasets: [
      {
        label: `${ticker} Preço (USD)`,
        data: priceData?.evolucaoPreco?.map(i => i.preco) || [],
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: (priceData?.evolucaoPreco?.length || 0) > 50 ? 0 : 3,
      },
    ],
  };

  // Dados para o gráfico de ranking de dominância
  const rankingChartData = {
    labels: rankingData?.rankingDominancia?.map(i => i.ticker) || [],
    datasets: [
      {
        label: 'Dominância (%)',
        data: rankingData?.rankingDominancia?.map(i => i.dominancia) || [],
        backgroundColor: [
          '#00d4ff', '#7b2cbf', '#00ff88', '#ff4757', '#ffa502',
          '#2ed573', '#1e90ff', '#ff6b81', '#a55eea', '#26de81'
        ],
        borderRadius: 5,
      },
    ],
  };

  return (
    <div className="gradient-bg min-h-screen p-4 md:p-8">
      <div className="container mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 text-transparent bg-clip-text mb-2">
            Crypto BI Dashboard
          </h1>
          <p className="text-gray-400 text-lg">Visualização de dados de criptomoedas via GraphQL</p>
        </header>

        <div className="glass-card p-6 rounded-xl mb-8">
          <h3 className="text-xl font-semibold text-cyan-400 mb-5">Configuração</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Ticker (Evolução Preço)</label>
              <TextField
                fullWidth
                variant="outlined"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Ex: BTC, ETH"
                InputProps={{
                  style: { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                }}
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Data Início</label>
              <TextField
                fullWidth
                variant="outlined"
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                InputProps={{
                  style: { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                }}
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Data Fim</label>
              <TextField
                fullWidth
                variant="outlined"
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                InputProps={{
                  style: { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                }}
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Limite Ranking</label>
              <TextField
                fullWidth
                variant="outlined"
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                InputProps={{
                  style: { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                  inputProps: { min: 1, max: 100 },
                }}
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div className="flex gap-4">
              <Button
                variant="contained"
                onClick={loadAllData}
                className="bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-cyan-500 hover:to-purple-700 transition-all"
                fullWidth
              >
                Carregar Dados
              </Button>
              <Button
                variant="outlined"
                onClick={clearData}
                className="border-white/20 text-white hover:bg-white/10 transition-all"
                fullWidth
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução de Preço */}
          <div className="glass-card p-6 rounded-xl col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span className="text-2xl">📈</span>
                Evolução de Preço
                {priceStatus && (
                  <Chip
                    label={priceStatus}
                    className={priceStatus === 'OK' ? 'status-ok' : 'status-error'}
                    size="small"
                  />
                )}
              </h3>
            </div>

            {priceError && (
              <Alert severity="error" className="mb-4 bg-red-500/20 text-red-400 border border-red-500/30">
                {priceError}
              </Alert>
            )}

            {priceStatus === 'OK' && priceData && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-cyan-400 font-bold text-lg">{formatCurrency(priceStats.lastPrice)}</div>
                  <div className="text-gray-400 text-sm mt-1">Último Preço</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-cyan-400 font-bold text-lg">{formatCurrency(priceStats.minPrice)}</div>
                  <div className="text-gray-400 text-sm mt-1">Mínimo</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-cyan-400 font-bold text-lg">{formatCurrency(priceStats.maxPrice)}</div>
                  <div className="text-gray-400 text-sm mt-1">Máximo</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className={`font-bold text-lg ${priceStats.variation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {priceStats.variation >= 0 ? '+' : ''}{priceStats.variation.toFixed(2)}%
                  </div>
                  <div className="text-gray-400 text-sm mt-1">Variação</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-cyan-400 font-bold text-lg">{priceStats.records}</div>
                  <div className="text-gray-400 text-sm mt-1">Registos</div>
                </div>
              </div>
            )}

            <div className="h-80 relative">
              {loadingPrice ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="spinner"></div>
                </div>
              ) : priceData && priceData.evolucaoPreco.length > 0 ? (
                <Line
                  data={priceChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: true, position: 'top' },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => formatCurrency(ctx.raw as number),
                        },
                      },
                    },
                    scales: {
                      y: {
                        ticks: {
                          callback: (value) => formatCurrency(value as number),
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  Sem dados para exibir
                </div>
              )}
            </div>
          </div>

          {/* Ranking de Dominância */}
          <div className="glass-card p-6 rounded-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Ranking Dominância
                {rankingStatus && (
                  <Chip
                    label={rankingStatus}
                    className={rankingStatus === 'OK' ? 'status-ok' : 'status-error'}
                    size="small"
                  />
                )}
              </h3>
            </div>

            {rankingError && (
              <Alert severity="error" className="mb-4 bg-red-500/20 text-red-400 border border-red-500/30">
                {rankingError}
              </Alert>
            )}

            <div className="h-80 relative">
              {loadingRanking ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="spinner"></div>
                </div>
              ) : rankingData && rankingData.rankingDominancia.length > 0 ? (
                <Bar
                  data={rankingChartData}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => formatPercent(ctx.raw as number),
                        },
                      },
                    },
                    scales: {
                      x: {
                        ticks: {
                          callback: (value) => value + '%',
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  Sem dados para exibir
                </div>
              )}
            </div>
          </div>

          {/* Preço Médio */}
      <div className="glass-card p-4 rounded-xl h-110"> {/* Reduzi o padding e defini uma altura fixa */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">💰</span>
            Preço Médio por Ativo
            {avgStatus && (
              <Chip
                label={avgStatus}
                className={avgStatus === 'OK' ? 'status-ok' : 'status-error'}
                size="small"
              />
            )}
          </h3>
        </div>

        {avgError && (
          <Alert severity="error" className="mb-4 bg-red-500/20 text-red-400 border border-red-500/30">
            {avgError}
          </Alert>
        )}

        <div className="overflow-y-auto h-[calc(100%-80px)]"> {/* Adicionei altura calculada e overflow-y-auto */}
          {loadingAvg ? (
            <div className="flex justify-center items-center h-full">
              <div className="spinner"></div>
            </div>
          ) : avgData && avgData.precoMedio.length > 0 ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-black z-10"> {/* fundo sólido preto */}
                <tr className="border-b border-white/10">
                  <th className="p-2 text-left text-gray-400">#</th>
                  <th className="p-2 text-left text-gray-400">Ticker</th>
                  <th className="p-2 text-left text-gray-400">Preço Médio</th>
                </tr>
              </thead>
              <tbody>
                  {avgData.precoMedio.map((item, idx) => (
                    <tr
                      key={idx}
                      className="
                        border-b border-white/10
                        odd:bg-white/5
                        even:bg-white/10
                        hover:bg-white/20
                        transition-colors
                      "
                    >
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2 font-medium">{item.ticker}</td>
                      <td className="p-2">{formatCurrency(item.precoMedio)}</td>
                    </tr>
                  ))}
                </tbody>

            </table>
          ) : (
            <div className="flex justify-center items-center h-full text-gray-400">
              Sem dados para exibir
            </div>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>  
  );
}