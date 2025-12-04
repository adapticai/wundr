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
  onBrowseTemplates?: () => void;
}

export function EmptyOrchestrators({
  onCreateOrchestrator,
  onBrowseTemplates,
}: EmptyOrchestratorsProps) {
  return (
    <EmptyState
      icon={Bot}
      title='No Orchestrators yet'
      description="Create your first Orchestrator to automate workflows and enhance your team's capabilities."
      action={
        onCreateOrchestrator
          ? {
              label: 'Create Orchestrator',
              onClick: onCreateOrchestrator,
            }
          : undefined
      }
      secondaryAction={
        onBrowseTemplates
          ? {
              label: 'Browse Templates',
              onClick: onBrowseTemplates,
            }
          : undefined
      }
    />
  );
}
