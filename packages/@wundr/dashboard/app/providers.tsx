'use client';

import * as React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { UserProvider, NotificationsProvider } from '@/lib/user-context';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      disableTransitionOnChange
    >
      <UserProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </UserProvider>
      <Toaster />
    </ThemeProvider>
  );
}
