/**
 * Empty Deployments Component
 * @module components/empty-states/empty-deployments
 */
'use client';

import * as React from 'react';
import { Rocket } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyDeploymentsProps {
  onDeploy?: () => void;
}

export function EmptyDeployments({ onDeploy }: EmptyDeploymentsProps) {
  return (
    <EmptyState
      icon={Rocket}
      title="No deployments yet"
      description="Deploy your first Virtual Person or workflow to start automating tasks."
      action={
        onDeploy
          ? {
              label: 'Deploy Now',
              onClick: onDeploy,
            }
          : undefined
      }
    />
  );
}
