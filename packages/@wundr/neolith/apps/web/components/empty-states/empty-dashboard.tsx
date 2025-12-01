/**
 * Empty Dashboard Component
 * @module components/empty-states/empty-dashboard
 */
'use client';

import * as React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyDashboardProps {
  onGetStarted?: () => void;
}

export function EmptyDashboard({ onGetStarted }: EmptyDashboardProps) {
  return (
    <EmptyState
      icon={LayoutDashboard}
      title='Welcome to Neolith'
      description='Get started by creating your first channel or orchestrator to begin exploring the platform.'
      action={
        onGetStarted
          ? {
              label: 'Get Started',
              onClick: onGetStarted,
            }
          : undefined
      }
    />
  );
}
