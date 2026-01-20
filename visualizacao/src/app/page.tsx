'use client';

import dynamic from 'next/dynamic';

// Carrega os componentes apenas no cliente
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
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard do BI Service</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Evolução de Preço</h2>
          <DataDisplay ticker="BTC" from="2026-01-01" to="2026-01-20" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">Ranking de Dominância</h2>
          <RankingDominanciaDisplay initialLimit={10} />
        </div>
      </div>
    </main>
  );
}
