/**
 * Empty Deployments Component
 * @module components/empty-states/empty-deployments
 */
'use client';

import { Rocket } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

interface EmptyDeploymentsProps {
  onDeploy?: () => void;
  filtered?: boolean;
}

export function EmptyDeployments({
  onDeploy,
  filtered,
}: EmptyDeploymentsProps) {
  if (filtered) {
    return (
      <EmptyState
        icon={Rocket}
        title='No deployments found'
        description='No deployments match your current filters. Try adjusting the environment or search query.'
      />
    );
  }

  return (
    <EmptyState
      icon={Rocket}
      title='No deployments yet'
      description='Deploy your first Orchestrator or workflow to start automating tasks and running services.'
      action={
        onDeploy
          ? {
              label: 'Create Deployment',
              onClick: onDeploy,
            }
          : undefined
      }
    />
  );
}
