'use client';

import dynamic from 'next/dynamic';

const CryptoDashboard = dynamic(
  () => import('@/components/CryptoDashboard'),
  { ssr: false }
);

export default function Home() {
  return <CryptoDashboard />;
}
