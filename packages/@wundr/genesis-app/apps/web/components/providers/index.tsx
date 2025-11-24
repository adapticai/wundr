'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';

import { PresenceProvider } from './presence-provider';

import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PresenceWrapper>{children}</PresenceWrapper>
      </ThemeProvider>
    </SessionProvider>
  );
}

/**
 * Internal wrapper to access session and provide presence
 */
function PresenceWrapper({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return (
    <PresenceProvider userId={userId} enabled={!!userId}>
      {children}
    </PresenceProvider>
  );
}

// Re-export presence provider and hooks for direct usage
export {
  PresenceProvider,
  usePresenceContext,
  useOptionalPresenceContext,
} from './presence-provider';
