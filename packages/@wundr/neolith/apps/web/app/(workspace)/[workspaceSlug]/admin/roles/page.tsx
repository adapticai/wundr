'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageHeader } from '@/contexts/page-header-context';
import { useRoles, useMembers, type Role, type RolePermission } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

/**
 * Permission categories for organized UI display
 */
interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: Array<'create' | 'read' | 'update' | 'delete' | 'manage'>;
}

/**
 * Admin Roles & Permissions Page
 *
 * Comprehensive role management interface with:
 * - List of all roles (system + custom)
 * - Permission matrix view
 * - Create/edit custom roles
 * - Assign permissions by category
 * - View members assigned to each role
 * - Permission inheritance options
 */
export default function AdminRolesPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Roles & Permissions',
      'Manage roles and permissions for your workspace members',
    );
  }, [setPageHeader]);

  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles(workspaceSlug);
  const { members } = useMembers(workspaceSlug);

  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Calculate member counts for each role
  const roleMembers = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(member => {
      const roleName = member.role?.name || 'Member';
      counts.set(roleName, (counts.get(roleName) || 0) + 1);
    });
    return counts;
  }, [members]);

  // Enhance roles with member counts
  const rolesWithCounts = useMemo(() => {
    return roles.map(role => ({
      ...role,
      memberCount: roleMembers.get(role.name) || 0,
    }));
  }, [roles, roleMembers]);

  const handleCreate = useCallback(
    async (data: Omit<Role, 'id'>) => {
      await createRole(data);
      setShowCreateModal(false);
    },
    [createRole],
  );

  const handleUpdate = useCallback(
    async (roleId: string, data: Partial<Role>) => {
      await updateRole(roleId, data);
      setEditingRole(null);
    },
    [updateRole],
  );

  const handleDelete = useCallback(
    async (roleId: string) => {
      const role = rolesWithCounts.find(r => r.id === roleId);
      if (!role) return;

      if (role.memberCount > 0) {
        alert(`Cannot delete role "${role.name}". ${role.memberCount} member(s) are assigned to this role. Please reassign them first.`);
        return;
      }

      if (
        window.confirm(
          `Are you sure you want to delete the "${role.name}" role? This action cannot be undone.`,
        )
      ) {
        await deleteRole(roleId);
      }
    },
    [deleteRole, rolesWithCounts],
  );

  // Define permission categories
  const permissionCategories: PermissionCategory[] = [
    {
      id: 'channels',
      name: 'Channels',
      description: 'Manage channel access and operations',
      permissions: [
        {
          id: 'channels.create',
          name: 'Create Channels',
          description: 'Create new channels in the workspace',
          resource: 'channels',
          actions: ['create'],
        },
        {
          id: 'channels.delete',
          name: 'Delete Channels',
          description: 'Delete channels from the workspace',
          resource: 'channels',
          actions: ['delete'],
        },
        {
          id: 'channels.manage',
          name: 'Manage Channels',
          description: 'Edit channel settings and permissions',
          resource: 'channels',
          actions: ['manage', 'update'],
        },
        {
          id: 'channels.read',
          name: 'View Channels',
          description: 'View and access channels',
          resource: 'channels',
          actions: ['read'],
        },
      ],
    },
    {
      id: 'messages',
      name: 'Messages',
      description: 'Control message permissions',
      permissions: [
        {
          id: 'messages.create',
          name: 'Send Messages',
          description: 'Send messages in channels',
          resource: 'messages',
          actions: ['create'],
        },
        {
          id: 'messages.delete',
          name: 'Delete Messages',
          description: 'Delete any message in the workspace',
          resource: 'messages',
          actions: ['delete'],
        },
        {
          id: 'messages.pin',
          name: 'Pin Messages',
          description: 'Pin/unpin messages in channels',
          resource: 'messages',
          actions: ['manage'],
        },
        {
          id: 'messages.edit',
          name: 'Edit Messages',
          description: 'Edit own messages',
          resource: 'messages',
          actions: ['update'],
        },
      ],
    },
    {
      id: 'files',
      name: 'Files',
      description: 'File upload and management',
      permissions: [
        {
          id: 'files.upload',
          name: 'Upload Files',
          description: 'Upload files to channels',
          resource: 'files',
          actions: ['create'],
        },
        {
          id: 'files.delete',
          name: 'Delete Files',
          description: 'Delete any file in the workspace',
          resource: 'files',
          actions: ['delete'],
        },
        {
          id: 'files.manage',
          name: 'Manage Files',
          description: 'Organize and manage file library',
          resource: 'files',
          actions: ['manage'],
        },
      ],
    },
    {
      id: 'workflows',
      name: 'Workflows',
      description: 'Automation and workflow management',
      permissions: [
        {
          id: 'workflows.create',
          name: 'Create Workflows',
          description: 'Create new automation workflows',
          resource: 'workflows',
          actions: ['create'],
        },
        {
          id: 'workflows.manage',
          name: 'Manage Workflows',
          description: 'Edit and manage all workflows',
          resource: 'workflows',
          actions: ['manage', 'update', 'delete'],
        },
        {
          id: 'workflows.execute',
          name: 'Execute Workflows',
          description: 'Trigger workflow executions',
          resource: 'workflows',
          actions: ['create'],
        },
      ],
    },
    {
      id: 'orchestrators',
      name: 'Orchestrators',
      description: 'AI orchestrator management',
      permissions: [
        {
          id: 'orchestrators.create',
          name: 'Create Orchestrators',
          description: 'Create new AI orchestrators',
          resource: 'orchestrators',
          actions: ['create'],
        },
        {
          id: 'orchestrators.manage',
          name: 'Manage Orchestrators',
          description: 'Configure and manage orchestrators',
          resource: 'orchestrators',
          actions: ['manage', 'update', 'delete'],
        },
        {
          id: 'orchestrators.interact',
          name: 'Interact with Orchestrators',
          description: 'Send tasks to orchestrators',
          resource: 'orchestrators',
          actions: ['create', 'read'],
        },
      ],
    },
    {
      id: 'members',
      name: 'Members',
      description: 'Member and team management',
      permissions: [
        {
          id: 'members.invite',
          name: 'Invite Members',
          description: 'Invite new members to the workspace',
          resource: 'members',
          actions: ['create'],
        },
        {
          id: 'members.remove',
          name: 'Remove Members',
          description: 'Remove members from the workspace',
          resource: 'members',
          actions: ['delete'],
        },
        {
          id: 'members.manage',
          name: 'Manage Members',
          description: 'Change member roles and settings',
          resource: 'members',
          actions: ['manage', 'update'],
        },
      ],
    },
    {
      id: 'admin',
      name: 'Administration',
      description: 'Workspace administration',
      permissions: [
        {
          id: 'settings.view',
          name: 'View Settings',
          description: 'View workspace settings',
          resource: 'settings',
          actions: ['read'],
        },
        {
          id: 'settings.edit',
          name: 'Edit Settings',
          description: 'Modify workspace settings',
          resource: 'settings',
          actions: ['update'],
        },
        {
          id: 'billing.view',
          name: 'View Billing',
          description: 'View billing information',
          resource: 'billing',
          actions: ['read'],
        },
        {
          id: 'billing.manage',
          name: 'Manage Billing',
          description: 'Update payment and subscription',
          resource: 'billing',
          actions: ['manage', 'update'],
        },
        {
          id: 'roles.manage',
          name: 'Manage Roles',
          description: 'Create and edit custom roles',
          resource: 'roles',
          actions: ['create', 'update', 'delete'],
        },
      ],
    },
  ];

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div className='h-8 w-48 animate-pulse rounded bg-muted' />
          <div className='h-10 w-32 animate-pulse rounded bg-muted' />
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='h-48 animate-pulse rounded-lg bg-muted' />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header Actions */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        {/* View Switcher */}
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setView('list')}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              view === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            List View
          </button>
          <button
            type='button'
            onClick={() => setView('matrix')}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              view === 'matrix'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Permission Matrix
          </button>
        </div>

        {/* Create Role Button */}
        <button
          type='button'
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2',
            'text-sm font-medium text-primary-foreground hover:bg-primary/90',
          )}
        >
          <PlusIcon className='h-4 w-4' />
          Create Role
        </button>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className='space-y-6'>
          {/* Custom Roles */}
          {rolesWithCounts.filter(r => !r.isSystem).length > 0 && (
            <div>
              <h2 className='mb-4 text-lg font-semibold text-foreground'>Custom Roles</h2>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {rolesWithCounts
                  .filter(r => !r.isSystem)
                  .map(role => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      onEdit={() => setEditingRole(role)}
                      onDelete={() => handleDelete(role.id)}
                      onViewMembers={() => setSelectedRoleId(role.id)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* System Roles */}
          <div>
            <h2 className='mb-2 text-lg font-semibold text-foreground'>System Roles</h2>
            <p className='mb-4 text-sm text-muted-foreground'>
              These roles are built-in and cannot be modified or deleted
            </p>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {rolesWithCounts
                .filter(r => r.isSystem)
                .map(role => (
                  <SystemRoleCard
                    key={role.id}
                    role={role}
                    onViewMembers={() => setSelectedRoleId(role.id)}
                  />
                ))}
            </div>
          </div>

          {/* Empty State */}
          {rolesWithCounts.filter(r => !r.isSystem).length === 0 && (
            <div className='flex flex-col items-center justify-center rounded-lg border border-dashed py-12'>
              <ShieldIcon className='h-12 w-12 text-muted-foreground/50' />
              <p className='mt-2 text-sm text-muted-foreground'>
                No custom roles defined yet
              </p>
              <button
                type='button'
                onClick={() => setShowCreateModal(true)}
                className='mt-4 text-sm text-primary hover:underline'
              >
                Create your first custom role
              </button>
            </div>
          )}
        </div>
      )}

      {/* Permission Matrix View */}
      {view === 'matrix' && (
        <PermissionMatrix
          roles={rolesWithCounts}
          categories={permissionCategories}
          onEditRole={role => setEditingRole(role)}
        />
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <RoleEditorModal
          categories={permissionCategories}
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <RoleEditorModal
          role={editingRole}
          categories={permissionCategories}
          onSave={data => handleUpdate(editingRole.id, data)}
          onClose={() => setEditingRole(null)}
        />
      )}

      {/* Members Modal */}
      {selectedRoleId && (
        <RoleMembersModal
          role={rolesWithCounts.find(r => r.id === selectedRoleId)!}
          members={members.filter(m => m.role?.name === rolesWithCounts.find(r => r.id === selectedRoleId)?.name)}
          onClose={() => setSelectedRoleId(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Role Card Components
// =============================================================================

interface RoleCardProps {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
  onViewMembers: () => void;
}

function RoleCard({ role, onEdit, onDelete, onViewMembers }: RoleCardProps) {
  return (
    <div className='rounded-lg border bg-card p-4 transition-shadow hover:shadow-md'>
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div
            className='flex h-10 w-10 items-center justify-center rounded-lg'
            style={{ backgroundColor: role.color || '#6366f1' }}
          >
            <ShieldIcon className='h-5 w-5 text-white' />
          </div>
          <div>
            <h3 className='font-medium text-foreground'>{role.name}</h3>
            <button
              type='button'
              onClick={onViewMembers}
              className='text-sm text-muted-foreground hover:text-foreground hover:underline'
            >
              {role.memberCount} member{role.memberCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
        <div className='flex gap-1'>
          <button
            type='button'
            onClick={onEdit}
            className='rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground'
            title='Edit role'
          >
            <EditIcon className='h-4 w-4' />
          </button>
          {!role.isSystem && (
            <button
              type='button'
              onClick={onDelete}
              className='rounded-md p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20'
              title='Delete role'
            >
              <TrashIcon className='h-4 w-4' />
            </button>
          )}
        </div>
      </div>

      {role.description && (
        <p className='mt-3 text-sm text-muted-foreground'>{role.description}</p>
      )}

      <div className='mt-4'>
        <p className='text-xs font-medium text-muted-foreground'>Permissions</p>
        <div className='mt-2 flex flex-wrap gap-1'>
          {role.permissions.slice(0, 3).map((permission, idx) => (
            <Badge key={`${permission.resource}-${idx}`} variant='secondary' className='text-xs'>
              {permission.resource}
            </Badge>
          ))}
          {role.permissions.length > 3 && (
            <Badge variant='outline' className='text-xs'>
              +{role.permissions.length - 3} more
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function SystemRoleCard({ role, onViewMembers }: { role: Role; onViewMembers: () => void }) {
  return (
    <div className='rounded-lg border bg-muted/30 p-4'>
      <div className='flex items-center gap-2'>
        <div
          className='flex h-8 w-8 items-center justify-center rounded-lg'
          style={{ backgroundColor: role.color || '#6366f1' }}
        >
          <ShieldIcon className='h-4 w-4 text-white' />
        </div>
        <div>
          <h3 className='font-medium text-foreground'>{role.name}</h3>
        </div>
      </div>
      <p className='mt-2 text-sm text-muted-foreground'>{role.description}</p>
      <button
        type='button'
        onClick={onViewMembers}
        className='mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
      >
        <UsersIcon className='h-4 w-4' />
        {role.memberCount} member{role.memberCount !== 1 ? 's' : ''}
      </button>
    </div>
  );
}

// =============================================================================
// Permission Matrix Component
// =============================================================================

interface PermissionMatrixProps {
  roles: Role[];
  categories: PermissionCategory[];
  onEditRole: (role: Role) => void;
}

function PermissionMatrix({ roles, categories, onEditRole }: PermissionMatrixProps) {
  // Helper to check if a role has a specific permission
  const hasPermission = (role: Role, permissionId: string): boolean => {
    const [resource] = permissionId.split('.');
    return role.permissions.some(p =>
      p.resource === resource || p.resource === '*'
    );
  };

  return (
    <div className='space-y-6'>
      <p className='text-sm text-muted-foreground'>
        View and compare permissions across all roles
      </p>

      {categories.map(category => (
        <div key={category.id} className='rounded-lg border bg-card'>
          <div className='border-b bg-muted/30 p-4'>
            <h3 className='font-semibold text-foreground'>{category.name}</h3>
            <p className='text-sm text-muted-foreground'>{category.description}</p>
          </div>

          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[300px]'>Permission</TableHead>
                  {roles.map(role => (
                    <TableHead key={role.id} className='text-center'>
                      <button
                        type='button'
                        onClick={() => !role.isSystem && onEditRole(role)}
                        className={cn(
                          'flex flex-col items-center gap-1',
                          !role.isSystem && 'hover:underline',
                        )}
                      >
                        <span>{role.name}</span>
                        {role.isSystem && (
                          <Badge variant='outline' className='text-xs'>
                            System
                          </Badge>
                        )}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.permissions.map(permission => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div>
                        <div className='font-medium'>{permission.name}</div>
                        <div className='text-sm text-muted-foreground'>
                          {permission.description}
                        </div>
                      </div>
                    </TableCell>
                    {roles.map(role => (
                      <TableCell key={role.id} className='text-center'>
                        {hasPermission(role, permission.id) ? (
                          <CheckIcon className='inline h-5 w-5 text-green-600' />
                        ) : (
                          <XIcon className='inline h-5 w-5 text-muted-foreground/30' />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Role Editor Modal
// =============================================================================

interface RoleEditorModalProps {
  role?: Role;
  categories: PermissionCategory[];
  onSave: (data: Omit<Role, 'id'>) => Promise<void>;
  onClose: () => void;
}

function RoleEditorModal({ role, categories, onSave, onClose }: RoleEditorModalProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [color, setColor] = useState(role?.color ?? '#6366f1');
  const [permissions, setPermissions] = useState<RolePermission[]>(role?.permissions ?? []);
  const [inheritFrom, setInheritFrom] = useState<string>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({ name, description, color, permissions, isSystem: false, memberCount: 0 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if a permission is enabled
  const hasPermission = (permissionId: string) => {
    const [resource] = permissionId.split('.');
    return permissions.some(p => p.resource === resource);
  };

  // Toggle permission
  const togglePermission = (permission: Permission) => {
    setPermissions(prev => {
      const exists = prev.some(p => p.resource === permission.resource);
      if (exists) {
        return prev.filter(p => p.resource !== permission.resource);
      } else {
        return [...prev, { resource: permission.resource, actions: permission.actions }];
      }
    });
  };

  // Select all in category
  const selectAllInCategory = (category: PermissionCategory, enabled: boolean) => {
    if (enabled) {
      const newPermissions = category.permissions.map(p => ({
        resource: p.resource,
        actions: p.actions,
      }));
      setPermissions(prev => {
        const filtered = prev.filter(p => !category.permissions.some(cp => cp.resource === p.resource));
        return [...filtered, ...newPermissions];
      });
    } else {
      setPermissions(prev =>
        prev.filter(p => !category.permissions.some(cp => cp.resource === p.resource))
      );
    }
  };

  const colorOptions = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#0ea5e9',
    '#64748b',
  ];

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-card shadow-xl'>
        <div className='flex items-center justify-between border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground'>
            {role ? 'Edit Role' : 'Create Role'}
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='text-muted-foreground hover:text-foreground'
          >
            <XIcon className='h-5 w-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6'>
          <div className='space-y-6'>
            {/* Basic Info */}
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <label htmlFor='roleName' className='block text-sm font-medium text-foreground'>
                  Role Name *
                </label>
                <input
                  type='text'
                  id='roleName'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={cn(
                    'mt-1 block w-full rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm placeholder:text-muted-foreground',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  )}
                  placeholder='e.g., Content Editor'
                  required
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-foreground'>Color</label>
                <div className='mt-1 flex flex-wrap gap-2'>
                  {colorOptions.map(c => (
                    <button
                      key={c}
                      type='button'
                      onClick={() => setColor(c)}
                      className={cn(
                        'h-8 w-8 rounded-full border-2',
                        color === c
                          ? 'border-foreground ring-2 ring-offset-2 ring-offset-background'
                          : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor='roleDescription' className='block text-sm font-medium text-foreground'>
                Description
              </label>
              <textarea
                id='roleDescription'
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className={cn(
                  'mt-1 block w-full rounded-md border border-input bg-background',
                  'px-3 py-2 text-sm placeholder:text-muted-foreground',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                )}
                placeholder='Describe what this role is for...'
              />
            </div>

            {/* Inherit From */}
            <div>
              <label htmlFor='inheritFrom' className='block text-sm font-medium text-foreground'>
                Inherit Permissions From
              </label>
              <select
                id='inheritFrom'
                value={inheritFrom}
                onChange={e => setInheritFrom(e.target.value)}
                className={cn(
                  'mt-1 block w-full rounded-md border border-input bg-background',
                  'px-3 py-2 text-sm',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                )}
              >
                <option value='none'>None - Start from scratch</option>
                <option value='member'>Member - Standard access</option>
                <option value='admin'>Admin - Administrative access</option>
              </select>
              <p className='mt-1 text-xs text-muted-foreground'>
                Start with permissions from an existing role
              </p>
            </div>

            {/* Permissions by Category */}
            <div>
              <label className='block text-sm font-medium text-foreground'>
                Permissions
              </label>
              <p className='mt-1 text-sm text-muted-foreground'>
                Select the permissions for this role
              </p>

              <div className='mt-4 space-y-4'>
                {categories.map(category => {
                  const categoryPerms = category.permissions;
                  const enabledCount = categoryPerms.filter(p => hasPermission(p.id)).length;
                  const allEnabled = enabledCount === categoryPerms.length;

                  return (
                    <div key={category.id} className='rounded-lg border bg-muted/30 p-4'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <h4 className='font-medium text-foreground'>{category.name}</h4>
                          <p className='text-sm text-muted-foreground'>{category.description}</p>
                        </div>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm text-muted-foreground'>
                            {enabledCount}/{categoryPerms.length}
                          </span>
                          <Switch
                            checked={allEnabled}
                            onCheckedChange={checked => selectAllInCategory(category, checked)}
                          />
                        </div>
                      </div>

                      <div className='mt-4 space-y-2'>
                        {category.permissions.map(permission => (
                          <label
                            key={permission.id}
                            className='flex items-start gap-3 rounded-md p-2 hover:bg-muted/50'
                          >
                            <input
                              type='checkbox'
                              checked={hasPermission(permission.id)}
                              onChange={() => togglePermission(permission)}
                              className='mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary'
                            />
                            <div className='flex-1'>
                              <div className='font-medium text-foreground'>{permission.name}</div>
                              <div className='text-sm text-muted-foreground'>
                                {permission.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className='mt-6 flex justify-end gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={isSubmitting || !name.trim()}
              className={cn(
                'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
                'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isSubmitting ? 'Saving...' : role ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Role Members Modal
// =============================================================================

interface RoleMembersModalProps {
  role: Role;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  }>;
  onClose: () => void;
}

function RoleMembersModal({ role, members, onClose }: RoleMembersModalProps) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='w-full max-w-lg rounded-lg bg-card shadow-xl'>
        <div className='flex items-center justify-between border-b px-6 py-4'>
          <div className='flex items-center gap-3'>
            <div
              className='flex h-8 w-8 items-center justify-center rounded-lg'
              style={{ backgroundColor: role.color || '#6366f1' }}
            >
              <ShieldIcon className='h-4 w-4 text-white' />
            </div>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>{role.name}</h2>
              <p className='text-sm text-muted-foreground'>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='text-muted-foreground hover:text-foreground'
          >
            <XIcon className='h-5 w-5' />
          </button>
        </div>

        <div className='max-h-96 overflow-y-auto p-6'>
          {members.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              No members assigned to this role
            </div>
          ) : (
            <div className='space-y-3'>
              {members.map(member => (
                <div key={member.id} className='flex items-center gap-3 rounded-lg border p-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary'>
                    {member.name?.[0] || member.email?.[0] || '?'}
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>{member.name || 'Unknown'}</div>
                    <div className='text-sm text-muted-foreground'>{member.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='flex justify-end border-t px-6 py-4'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M5 12h14' />
      <path d='M12 5v14' />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M3 6h18' />
      <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
      <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
  );
}
