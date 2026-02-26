/**
 * Empty Members Component
 * @module components/empty-states/empty-members
 */
'use client';

import { Users } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

interface EmptyMembersProps {
  onInviteMembers?: () => void;
  filtered?: boolean;
}

export function EmptyMembers({ onInviteMembers, filtered }: EmptyMembersProps) {
  if (filtered) {
    return (
      <EmptyState
        icon={Users}
        title='No members found'
        description='No members match your search or filter. Try adjusting your criteria.'
      />
    );
  }

  return (
    <EmptyState
      icon={Users}
      title='No team members yet'
      description='Invite team members to collaborate and work together in this workspace.'
      action={
        onInviteMembers
          ? {
              label: 'Invite Members',
              onClick: onInviteMembers,
            }
          : undefined
      }
    />
  );
}
