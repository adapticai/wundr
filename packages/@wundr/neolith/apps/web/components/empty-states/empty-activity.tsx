/**
 * Empty Activity Component
 * @module components/empty-states/empty-activity
 */
'use client';

import { Activity } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

interface EmptyActivityProps {
  onRefresh?: () => void;
}

export function EmptyActivity({ onRefresh }: EmptyActivityProps) {
  return (
    <EmptyState
      icon={Activity}
      title='No activity yet'
      description='Activity from your team and Orchestrators will appear here once work begins in this workspace.'
      action={
        onRefresh
          ? {
              label: 'Refresh',
              onClick: onRefresh,
              variant: 'outline',
            }
          : undefined
      }
    />
  );
}
