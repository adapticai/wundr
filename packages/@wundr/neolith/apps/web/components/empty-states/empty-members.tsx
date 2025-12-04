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
}

export function EmptyMembers({ onInviteMembers }: EmptyMembersProps) {
  return (
    <EmptyState
      icon={Users}
      title='No team members yet'
      description='Invite team members to collaborate and work together on projects.'
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
