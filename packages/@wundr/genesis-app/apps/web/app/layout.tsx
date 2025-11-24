import { Inter } from 'next/font/google';

import type { Metadata } from 'next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Genesis - Organization Builder',
    template: '%s | Genesis',
  },
  description:
    'Build and manage AI-powered organizations with Genesis. Create custom agent hierarchies, workflows, and governance structures.',
  keywords: [
    'AI',
    'organization',
    'agents',
    'automation',
    'workflow',
    'genesis',
  ],
  authors: [{ name: 'Wundr' }],
  creator: 'Wundr',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://genesis.wundr.ai',
    siteName: 'Genesis',
    title: 'Genesis - Organization Builder',
    description: 'Build and manage AI-powered organizations with Genesis',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Genesis - Organization Builder',
    description: 'Build and manage AI-powered organizations with Genesis',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Providers placeholder - will be expanded with actual providers
function Providers({ children }: { children: React.ReactNode }) {
  // TODO: Add providers in this order:
  // 1. SessionProvider (next-auth)
  // 2. ApolloProvider (GraphQL)
  // 3. ThemeProvider (dark/light mode)
  // 4. ToastProvider (notifications)
  return <>{children}</>;
}

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
