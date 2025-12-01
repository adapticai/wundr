/**
 * Empty Messages Component
 * @module components/empty-states/empty-messages
 */
'use client';

import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyMessagesProps {
  channelName?: string;
}

export function EmptyMessages({ channelName }: EmptyMessagesProps) {
  return (
    <EmptyState
      icon={MessageSquare}
      title={channelName ? `Welcome to #${channelName}` : 'No messages yet'}
      description='This is the beginning of your conversation. Send a message to get started.'
    />
  );
}
