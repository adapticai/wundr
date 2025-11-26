/**
 * Empty Integrations Component
 * @module components/empty-states/empty-integrations
 */
'use client';

import * as React from 'react';
import { Plug } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyIntegrationsProps {
  onBrowseIntegrations?: () => void;
}

export function EmptyIntegrations({
  onBrowseIntegrations,
}: EmptyIntegrationsProps) {
  return (
    <EmptyState
      icon={Plug}
      title="No integrations yet"
      description="Connect your favorite tools and services to extend your workflow capabilities."
      action={
        onBrowseIntegrations
          ? {
              label: 'Browse Integrations',
              onClick: onBrowseIntegrations,
            }
          : undefined
      }
    />
  );
}
