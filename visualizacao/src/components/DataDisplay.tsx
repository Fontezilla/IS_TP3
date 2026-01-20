'use client';

import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Card, CardContent, Typography, CircularProgress, Alert, Box } from '@mui/material';
import { EvolucaoPrecoResponse } from '@/types/graphql';

const GET_EVOLUCAO_PRECO = gql`
  query GetEvolucaoPreco($ticker: String!, $from: String!, $to: String!) {
    evolucaoPreco(ticker: $ticker, from: $from, to: $to) {
      timestamp
      preco
    }
  }
`;

export default function DataDisplay({
  ticker,
  from,
  to,
}: {
  ticker: string;
  from: string;
  to: string;
}) {
  const { loading, error, data } = useQuery<EvolucaoPrecoResponse>(GET_EVOLUCAO_PRECO, {
    variables: { ticker, from, to },
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h5">Evolução de Preço</Typography>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">Erro: {error.message}</Alert>}
        {data?.evolucaoPreco && (
          <>
            {data.evolucaoPreco.map((item, index) => (
              <Typography key={index}>
                {item.timestamp}: {item.preco}
              </Typography>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
