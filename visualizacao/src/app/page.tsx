'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const DataDisplay = dynamic(
  () => import('@/components/DataDisplay'),
  { ssr: false }
);

const RankingDominanciaDisplay = dynamic(
  () => import('@/components/RankingDominanciaDisplay'),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-white mb-2">
            Dashboard BI Service
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg">
            Análise de criptomoedas e mercado
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card 1: Evolução de Preço */}
          <Card 
            className="hover:shadow-xl transition-shadow duration-300"
            sx={{ 
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent className="p-6">
              <Box display="flex" alignItems="center" mb={3}>
                <Box 
                  sx={{ 
                    backgroundColor: 'primary.main', 
                    borderRadius: 2, 
                    p: 1.5,
                    display: 'flex',
                    mr: 2
                  }}
                >
                  <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  Evolução de Preço
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Acompanhe a evolução do preço do BTC no período selecionado
              </Typography>

              {/* Preview do gráfico */}
              <Box sx={{ height: 200, mb: 2, opacity: 0.8 }}>
                <DataDisplay ticker="BTC" from="2026-01-01" to="2026-01-20" />
              </Box>

              <Link href="/evolucao-preco" passHref legacyBehavior>
                <Button 
                  variant="contained" 
                  fullWidth
                  endIcon={<ArrowForwardIcon />}
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.5
                  }}
                >
                  Ver Detalhes
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Card 2: Ranking de Dominância */}
          <Card 
            className="hover:shadow-xl transition-shadow duration-300"
            sx={{ 
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent className="p-6">
              <Box display="flex" alignItems="center" mb={3}>
                <Box 
                  sx={{ 
                    backgroundColor: 'success.main', 
                    borderRadius: 2, 
                    p: 1.5,
                    display: 'flex',
                    mr: 2
                  }}
                >
                  <LeaderboardIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  Ranking de Dominância
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Veja o ranking das criptomoedas por dominância de mercado
              </Typography>

              {/* Preview do gráfico */}
              <Box sx={{ height: 200, mb: 2, opacity: 0.8 }}>
                <RankingDominanciaDisplay initialLimit={5} />
              </Box>

              <Link href="/ranking-dominancia" passHref legacyBehavior>
                <Button 
                  variant="contained" 
                  fullWidth
                  color="success"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.5
                  }}
                >
                  Ver Detalhes
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>

        {/* Stats Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card sx={{ borderRadius: 2 }}>
            <CardContent className="text-center">
              <Typography variant="h4" fontWeight="bold" color="primary">
                2
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Análises Disponíveis
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardContent className="text-center">
              <Typography variant="h4" fontWeight="bold" color="success.main">
                Real-time
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Atualização de Dados
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardContent className="text-center">
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                BTC
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ativo Principal
              </Typography>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}