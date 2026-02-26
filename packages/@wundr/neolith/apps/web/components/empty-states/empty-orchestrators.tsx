/**
 * Empty Orchestrators Component
 * @module components/empty-states/empty-orchestrators
 */
'use client';

import { Bot } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

interface EmptyOrchestratorsProps {
  onCreateOrchestrator?: () => void;
}

export function EmptyOrchestrators({
  onCreateOrchestrator,
}: EmptyOrchestratorsProps) {
  return (
    <EmptyState
      icon={Bot}
      title='No Orchestrators yet'
      description='Create your first Orchestrator to automate workflows and coordinate tasks across your workspace.'
      action={
        onCreateOrchestrator
          ? {
              label: 'Create Orchestrator',
              onClick: onCreateOrchestrator,
            }
          : undefined
      }
    />
  );
}
