'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

import { FullPageSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrchestrator?: boolean;
}

export function ProtectedRoute({
  children,
  requireOrchestrator = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isOrchestrator } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirect('/login');
    }
    if (!isLoading && requireOrchestrator && !isOrchestrator) {
      redirect('/unauthorized');
    }
  }, [isLoading, isAuthenticated, requireOrchestrator, isOrchestrator]);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireOrchestrator && !isOrchestrator) {
    return null;
  }

  return <>{children}</>;
}
