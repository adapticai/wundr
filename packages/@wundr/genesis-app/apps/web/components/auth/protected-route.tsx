'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

import { FullPageSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVP?: boolean;
}

export function ProtectedRoute({ children, requireVP = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isVP } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirect('/login');
    }
    if (!isLoading && requireVP && !isVP) {
      redirect('/unauthorized');
    }
  }, [isLoading, isAuthenticated, requireVP, isVP]);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireVP && !isVP) {
    return null;
  }

  return <>{children}</>;
}
