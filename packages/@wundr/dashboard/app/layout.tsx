import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Wundr Dashboard - Intelligent Monorepo Analysis Platform',
  description:
    'Real-time dashboard for monitoring and analyzing monorepo health, dependencies, and performance metrics',
  keywords: ['dashboard', 'monorepo', 'analysis', 'visualization', 'real-time'],
  authors: [{ name: 'Wundr, by Adaptic.ai' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
  openGraph: {
    title: 'Wundr Dashboard',
    description: 'Intelligent Monorepo Analysis Platform',
    type: 'website',
    locale: 'en_US',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
