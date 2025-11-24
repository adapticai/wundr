'use client';

import { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  memberCount: number;
  permissions: string[];
  priority: number;
  createdAt: string;
}

export interface RoleListProps {
  workspaceId: string;
  onCreateRole: () => void;
  onEditRole: (role: Role) => void;
  className?: string;
}

export function RoleList({
  workspaceId,
  onCreateRole,
  onEditRole,
  className,
}: RoleListProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/roles`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? Members with this role will be assigned the default role.')) {
      return;
    }

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/roles/${roleId}`, {
        method: 'DELETE',
      });
      fetchRoles();
    } catch {
      // Handle error
    }
  };

  const formatPermissions = (permissions: string[]) => {
    if (permissions.length === 0) {
return 'No permissions';
}
    if (permissions.length <= 3) {
return permissions.join(', ');
}
    return `${permissions.slice(0, 3).join(', ')} +${permissions.length - 3} more`;
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Roles</h2>
          <p className="text-sm text-muted-foreground">
            Manage workspace roles and permissions
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateRole}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
        >
          Create Role
        </button>
      </div>

      {/* Role list */}
      {roles.length === 0 ? (
        <div className="p-8 text-center bg-muted/50 rounded-lg">
          <p className="text-muted-foreground">No roles configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="p-4 bg-card border border-border rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{role.name}</h3>
                    {role.isSystem && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs rounded">
                        System
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                      Priority: {role.priority}
                    </span>
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditRole(role)}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm"
                  >
                    Edit
                  </button>
                  {!role.isSystem && (
                    <button
                      type="button"
                      onClick={() => handleDelete(role.id)}
                      className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatPermissions(role.permissions)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

export default RoleList;
