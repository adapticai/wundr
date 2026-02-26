'use client';

import { BarChart3 } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

interface EmptyAnalyticsProps {
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyAnalytics({ onAction, actionLabel }: EmptyAnalyticsProps) {
  return (
    <EmptyState
      icon={BarChart3}
      title='No data to display'
      description='Analytics will populate once your workspace has active Orchestrators, completed tasks, or workflow activity. Start by creating an Orchestrator or running a workflow.'
      action={
        onAction
          ? { label: actionLabel ?? 'Get started', onClick: onAction }
          : undefined
      }
    />
  );
}
