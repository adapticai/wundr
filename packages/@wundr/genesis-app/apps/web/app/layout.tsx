import { Inter } from 'next/font/google';

import { Providers } from '@/components/providers';

import type { Metadata } from 'next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Neolith - AI-Powered Workspace',
    template: '%s | Neolith',
  },
  description:
    'Build and manage AI-powered organizations with Neolith. Create custom agent hierarchies, workflows, and governance structures.',
  keywords: [
    'AI',
    'organization',
    'agents',
    'automation',
    'workflow',
    'neolith',
  ],
  authors: [{ name: 'Neolith' }],
  creator: 'Neolith',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://neolith.ai',
    siteName: 'Neolith',
    title: 'Neolith - AI-Powered Workspace',
    description: 'Build and manage AI-powered organizations with Neolith',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Neolith - AI-Powered Workspace',
    description: 'Build and manage AI-powered organizations with Neolith',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <main className='min-h-screen bg-background'>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
