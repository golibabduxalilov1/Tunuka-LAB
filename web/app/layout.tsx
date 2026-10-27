import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/ui';

export const metadata: Metadata = {
  title: 'TunukaLab',
  description: 'Tunuka profili → yoyilma → list raskroyi → CypCut DXF',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
