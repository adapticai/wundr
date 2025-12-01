'use client';

import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import type { Role } from './role-list';

/**
 * Props for the RoleEditor component.
 */
export interface RoleEditorProps {
  /** The role to edit, or null/undefined to create a new role */
  role?: Role | null;
  /** The workspace ID for the role */
  workspaceId: string;
  /** Callback when the role is saved successfully */
  onSave: () => void;
  /** Callback when the editor is cancelled */
  onCancel: () => void;
  /** Additional CSS classes to apply */
  className?: string;
}

interface PermissionResource {
  id: string;
  name: string;
  actions: string[];
}

const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    id: 'channels',
    name: 'Channels',
    actions: ['create', 'read', 'update', 'delete', 'manage_members'],
  },
  {
    id: 'messages',
    name: 'Messages',
    actions: ['create', 'read', 'update', 'delete', 'pin'],
  },
  {
    id: 'members',
    name: 'Members',
    actions: ['read', 'invite', 'update', 'remove', 'manage_roles'],
  },
  {
    id: 'files',
    name: 'Files',
    actions: ['upload', 'read', 'delete'],
  },
  {
    id: 'workspace',
    name: 'Workspace',
    actions: ['read', 'update', 'manage_integrations', 'manage_billing'],
  },
  {
    id: 'vps',
    name: 'Orchestratoras',
    actions: ['create', 'read', 'update', 'delete', 'manage'],
  },
];

export function RoleEditor({
  role,
  workspaceId,
  onSave,
  onCancel,
  className,
}: RoleEditorProps) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [priority, setPriority] = useState(role?.priority || 50);
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(role?.permissions || [])
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      setPriority(role.priority);
      setPermissions(new Set(role.permissions));
    }
  }, [role]);

  const togglePermission = (resourceId: string, action: string) => {
    const permission = `${resourceId}:${action}`;
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const toggleAllForResource = (resourceId: string, actions: string[]) => {
    const resourcePermissions = actions.map(a => `${resourceId}:${a}`);
    const allSelected = resourcePermissions.every(p => permissions.has(p));

    setPermissions(prev => {
      const next = new Set(prev);
      if (allSelected) {
        resourcePermissions.forEach(p => next.delete(p));
      } else {
        resourcePermissions.forEach(p => next.add(p));
      }
      return next;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Role name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      const url = role
        ? `/api/workspaces/${workspaceId}/admin/roles/${role.id}`
        : `/api/workspaces/${workspaceId}/admin/roles`;

      const response = await fetch(url, {
        method: role ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          priority,
          permissions: Array.from(permissions),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save role');
      }

      onSave();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save role';
      setErrors({ ...errors, save: errorMessage });
      console.error('Failed to save role:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getEffectivePermissions = () => {
    const grouped: Record<string, string[]> = {};
    permissions.forEach(p => {
      const [resource, action] = p.split(':');
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(action);
    });
    return grouped;
  };

  const effectivePermissions = getEffectivePermissions();

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm'
      onClick={onCancel}
    >
      <div
        className={cn(
          'w-full max-w-4xl bg-card border border-border rounded-xl shadow-lg',
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold text-foreground'>
            {role ? 'Edit Role' : 'Create Role'}
          </h2>
          <button
            type='button'
            onClick={onCancel}
            className='p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
            aria-label='Close'
          >
            <XIcon className='h-5 w-5' />
          </button>
        </div>

        {/* Content */}
        <div className='p-4 max-h-[70vh] overflow-auto'>
          {errors.save && (
            <div className='mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg'>
              <p className='text-sm text-destructive'>{errors.save}</p>
            </div>
          )}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Left column - Basic info */}
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  Role Name
                </label>
                <input
                  type='text'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={role?.isSystem}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg bg-muted border text-foreground',
                    errors.name ? 'border-destructive' : 'border-border',
                    role?.isSystem && 'opacity-50 cursor-not-allowed'
                  )}
                  placeholder='e.g., Team Lead'
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                  <p id='name-error' className='mt-1 text-sm text-destructive'>
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground'
                  rows={3}
                  placeholder='Describe what this role is for...'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  Priority
                </label>
                <div className='flex items-center gap-4'>
                  <input
                    type='range'
                    value={priority}
                    onChange={e => setPriority(parseInt(e.target.value))}
                    min={1}
                    max={100}
                    className='flex-1'
                  />
                  <span className='w-12 text-center text-foreground'>
                    {priority}
                  </span>
                </div>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Higher priority roles take precedence when a member has
                  multiple roles
                </p>
              </div>

              {/* Preview */}
              <div className='p-4 bg-muted rounded-lg'>
                <h4 className='text-sm font-medium text-foreground mb-2'>
                  Effective Permissions Preview
                </h4>
                <div className='space-y-2'>
                  {Object.keys(effectivePermissions).length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No permissions selected
                    </p>
                  ) : (
                    Object.entries(effectivePermissions).map(
                      ([resource, actions]) => (
                        <div key={resource} className='text-sm'>
                          <span className='font-medium text-foreground capitalize'>
                            {resource}:
                          </span>{' '}
                          <span className='text-muted-foreground'>
                            {actions.join(', ')}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Permission matrix */}
            <div>
              <h3 className='text-sm font-medium text-foreground mb-3'>
                Permission Matrix
              </h3>
              <div className='border border-border rounded-lg overflow-hidden'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted'>
                    <tr>
                      <th className='px-3 py-2 text-left font-medium text-muted-foreground'>
                        Resource
                      </th>
                      <th className='px-3 py-2 text-left font-medium text-muted-foreground'>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border'>
                    {PERMISSION_RESOURCES.map(resource => {
                      const resourcePermissions = resource.actions.map(
                        a => `${resource.id}:${a}`
                      );
                      const allSelected = resourcePermissions.every(p =>
                        permissions.has(p)
                      );
                      const someSelected =
                        !allSelected &&
                        resourcePermissions.some(p => permissions.has(p));

                      return (
                        <tr key={resource.id}>
                          <td className='px-3 py-2'>
                            <label className='flex items-center gap-2'>
                              <input
                                type='checkbox'
                                checked={allSelected}
                                ref={el => {
                                  if (el) {
                                    el.indeterminate = someSelected;
                                  }
                                }}
                                onChange={() =>
                                  toggleAllForResource(
                                    resource.id,
                                    resource.actions
                                  )
                                }
                                className='w-4 h-4 rounded border-border'
                              />
                              <span className='font-medium text-foreground'>
                                {resource.name}
                              </span>
                            </label>
                          </td>
                          <td className='px-3 py-2'>
                            <div className='flex flex-wrap gap-2'>
                              {resource.actions.map(action => {
                                const permission = `${resource.id}:${action}`;
                                const isChecked = permissions.has(permission);

                                return (
                                  <label
                                    key={action}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer',
                                      'text-xs transition-colors',
                                      isChecked
                                        ? 'bg-stone-700/10 dark:bg-stone-300/10 text-stone-700 dark:text-stone-300'
                                        : 'bg-muted text-muted-foreground hover:text-foreground'
                                    )}
                                  >
                                    <input
                                      type='checkbox'
                                      checked={isChecked}
                                      onChange={() =>
                                        togglePermission(resource.id, action)
                                      }
                                      className='sr-only'
                                    />
                                    {action.replace('_', ' ')}
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 p-4 border-t border-border'>
          <button
            type='button'
            onClick={onCancel}
            className='px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSave}
            disabled={isSaving || role?.isSystem}
            className={cn(
              'px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSaving ? 'Saving...' : role ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

export default RoleEditor;
