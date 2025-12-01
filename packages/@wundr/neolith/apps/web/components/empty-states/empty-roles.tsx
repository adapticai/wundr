/**
 * Empty Roles Component
 * @module components/empty-states/empty-roles
 */
'use client';

import * as React from 'react';
import { Shield } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyRolesProps {
  onCreateRole?: () => void;
}

export function EmptyRoles({ onCreateRole }: EmptyRolesProps) {
  return (
    <EmptyState
      icon={Shield}
      title='No custom roles yet'
      description='Create custom roles to define specific permissions and access levels for your team.'
      action={
        onCreateRole
          ? {
              label: 'Create Role',
              onClick: onCreateRole,
            }
          : undefined
      }
    />
  );
}
