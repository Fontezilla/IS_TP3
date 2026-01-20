'use client';

import React from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Slider,
  Paper,
  Divider,
  Chip
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { RankingDominanciaResponse } from '@/types/graphql';

// Consulta GraphQL para rankingDominancia
const GET_RANKING_DOMINANCIA = gql`
  query RankingDominancia($limit: Int) {
    rankingDominancia(limit: $limit) {
      ticker
      dominancia
    }
  }
`;

export default function RankingDominanciaDisplay({ initialLimit = 10 }: { initialLimit?: number }) {
  const [limit, setLimit] = React.useState<number>(initialLimit);
  const { loading, error, data } = useQuery<RankingDominanciaResponse>(GET_RANKING_DOMINANCIA, {
    variables: { limit },
  });

  const handleLimitChange = (event: Event, newValue: number | number[]) => {
    setLimit(newValue as number);
  };

  // Preparar dados para o gráfico
  const chartData = data?.rankingDominancia?.map(item => ({
    name: item.ticker,
    Dominância: item.dominancia,
  })) || [];

  return (
    <Card elevation={3} sx={{ p: 2, borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
            Ranking de Dominância
          </Typography>
          <Chip
            label={`Top ${limit}`}
            color="primary"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ width: '100%', mb: 3 }}>
          <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
            Limite de Resultados: {limit}
          </Typography>
          <Slider
            value={limit}
            onChange={handleLimitChange}
            min={1}
            max={50}
            step={1}
            valueLabelDisplay="auto"
            sx={{ color: 'primary.main' }}
          />
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            Erro: {error.message}
          </Alert>
        )}

        {data?.rankingDominancia && (
          <>
            <Box sx={{ height: 300, mb: 3 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Dominância" fill="#3f51b5" />
                </BarChart>
              </ResponsiveContainer>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 'medium', mb: 2 }}>
              Detalhes:
            </Typography>

            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              {data.rankingDominancia.map((item, index) => (
                <Box
                  key={index}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  p={1}
                  sx={{
                    bgcolor: index % 2 === 0 ? 'grey.200' : 'grey.100',
                    borderRadius: 1,
                    my: 0.5
                  }}
                >
                  <Typography sx={{ fontWeight: 'medium' }}>
                    {index + 1}. {item.ticker}
                  </Typography>
                  <Chip
                    label={`${item.dominancia}%`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
              ))}
            </Paper>
          </>
        )}
      </CardContent>
    </Card>
  );
}