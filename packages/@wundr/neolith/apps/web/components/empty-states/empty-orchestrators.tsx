/**
 * Empty VPs Component
 * @module components/empty-states/empty-vps
 */
'use client';

import * as React from 'react';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyVPsProps {
  onCreateVP?: () => void;
  onBrowseTemplates?: () => void;
}

export function EmptyVPs({ onCreateVP, onBrowseTemplates }: EmptyVPsProps) {
  return (
    <EmptyState
      icon={Bot}
      title="No Orchestrators yet"
      description="Create your first Orchestrator to automate workflows and enhance your team's capabilities."
      action={
        onCreateVP
          ? {
              label: 'Create VP',
              onClick: onCreateVP,
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
