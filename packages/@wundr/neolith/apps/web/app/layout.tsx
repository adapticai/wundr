import { Outfit, Inter } from 'next/font/google';

import { Providers } from '@/components/providers';

import type { Metadata } from 'next';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
  icons: {
    icon: '/favicon.ico',
  },
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
      <body className={`${outfit.variable} ${inter.variable} font-sans antialiased bg-stone-900`}>
        <Providers>
          <main className='min-h-screen bg-stone-900'>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
