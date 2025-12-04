/**
 * Empty Channels Component
 * @module components/empty-states/empty-channels
 */
'use client';

import { Hash } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

interface EmptyChannelsProps {
  onCreateChannel?: () => void;
}

export function EmptyChannels({ onCreateChannel }: EmptyChannelsProps) {
  return (
    <EmptyState
      icon={Hash}
      title='No channels yet'
      description='Create your first channel to start organizing conversations and collaborating with your team.'
      action={
        onCreateChannel
          ? {
              label: 'Create Channel',
              onClick: onCreateChannel,
            }
          : undefined
      }
    />
  );
}
