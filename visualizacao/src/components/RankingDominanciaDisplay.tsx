'use client';

import React from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Card, CardContent, Typography, CircularProgress, Alert, Box, Slider } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { RankingDominanciaResponse } from '@/types/graphql';

const GET_RANKING_DOMINANCIA = gql`
  query RankingDominancia($limit: Int) {
    rankingDominancia(limit: $limit) {
      ticker
      dominancia
    }
  }
`;

export default function RankingDominanciaDisplay({ initialLimit = 10 }: { initialLimit?: number }) {
  const [limit, setLimit] = React.useState(initialLimit);
  const { loading, error, data } = useQuery<RankingDominanciaResponse>(GET_RANKING_DOMINANCIA, {
    variables: { limit },
  });

  const chartData = data?.rankingDominancia?.map(item => ({
    name: item.ticker,
    Dominância: item.dominancia,
  })) || [];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Ranking de Dominância
        </Typography>

        <Slider
          value={limit}
          onChange={(_, value) => setLimit(value as number)}
          min={1}
          max={50}
          step={1}
          valueLabelDisplay="auto"
          sx={{ mb: 2 }}
        />

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="150px">
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error.message}</Alert>}

        {data?.rankingDominancia && (
          <Box sx={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Dominância" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
