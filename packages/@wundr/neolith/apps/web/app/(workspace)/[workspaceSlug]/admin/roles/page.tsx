'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useRoles, type Role, type RolePermission } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

/**
 * Role Management Page
 *
 * Features role list, create role, and role editor
 */
export default function AdminRolesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceSlug = params.workspaceSlug as string;
  const showCreateOnLoad = searchParams.get('create') === 'true';
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Roles & Permissions',
      'Define custom roles and permissions for your team'
    );
  }, [setPageHeader]);

  const { roles, isLoading, createRole, updateRole, deleteRole } =
    useRoles(workspaceSlug);
  const [showCreateModal, setShowCreateModal] = useState(showCreateOnLoad);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const handleCreate = useCallback(
    async (data: CreateRoleData) => {
      await createRole(data);
      setShowCreateModal(false);
    },
    [createRole]
  );

  const handleUpdate = useCallback(
    async (roleId: string, data: CreateRoleData) => {
      await updateRole(roleId, data);
      setEditingRole(null);
    },
    [updateRole]
  );

  const handleDelete = useCallback(
    async (roleId: string) => {
      if (
        window.confirm(
          'Are you sure you want to delete this role? Members with this role will be assigned the default member role.'
        )
      ) {
        await deleteRole(roleId);
      }
    },
    [deleteRole]
  );

  // Define available permissions
  const availablePermissions: Permission[] = [
    {
      id: 'channels.create',
      name: 'Create Channels',
      description: 'Create new channels in the workspace',
    },
    {
      id: 'channels.delete',
      name: 'Delete Channels',
      description: 'Delete channels from the workspace',
    },
    {
      id: 'channels.manage',
      name: 'Manage Channels',
      description: 'Edit channel settings and permissions',
    },
    {
      id: 'members.invite',
      name: 'Invite Members',
      description: 'Invite new members to the workspace',
    },
    {
      id: 'members.remove',
      name: 'Remove Members',
      description: 'Remove members from the workspace',
    },
    {
      id: 'members.manage',
      name: 'Manage Members',
      description: 'Change member roles and settings',
    },
    {
      id: 'messages.delete',
      name: 'Delete Messages',
      description: 'Delete any message in the workspace',
    },
    {
      id: 'messages.pin',
      name: 'Pin Messages',
      description: 'Pin messages in channels',
    },
    {
      id: 'files.delete',
      name: 'Delete Files',
      description: 'Delete any file in the workspace',
    },
    {
      id: 'vps.manage',
      name: 'Manage VPs',
      description: 'Create, edit, and manage Orchestrators',
    },
    {
      id: 'workflows.manage',
      name: 'Manage Workflows',
      description: 'Create and edit automation workflows',
    },
    {
      id: 'settings.view',
      name: 'View Settings',
      description: 'View workspace settings',
    },
    {
      id: 'settings.edit',
      name: 'Edit Settings',
      description: 'Modify workspace settings',
    },
    {
      id: 'billing.view',
      name: 'View Billing',
      description: 'View billing information',
    },
    {
      id: 'billing.manage',
      name: 'Manage Billing',
      description: 'Update payment and subscription',
    },
  ];

  return (
    <div className='space-y-6'>
      {/* Action Button */}
      <div className='flex justify-end'>
        <button
          type='button'
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2',
            'text-sm font-medium text-primary-foreground hover:bg-primary/90'
          )}
        >
          <PlusIcon className='h-4 w-4' />
          Create Role
        </button>
      </div>

      {/* Role List */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {isLoading ? (
          <RoleCardSkeleton count={6} />
        ) : roles.length === 0 ? (
          <div className='col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed py-12'>
            <ShieldIcon className='h-12 w-12 text-muted-foreground/50' />
            <p className='mt-2 text-sm text-muted-foreground'>
              No custom roles defined yet
            </p>
            <button
              type='button'
              onClick={() => setShowCreateModal(true)}
              className='mt-4 text-sm text-primary hover:underline'
            >
              Create your first role
            </button>
          </div>
        ) : (
          roles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => setEditingRole(role)}
              onDelete={() => handleDelete(role.id)}
            />
          ))
        )}
      </div>

      {/* Default Roles Info */}
      <div className='rounded-lg border bg-card p-6'>
        <h2 className='font-semibold text-foreground'>Default Roles</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          These roles are built-in and cannot be modified
        </p>
        <div className='mt-4 grid gap-4 sm:grid-cols-3'>
          <DefaultRoleCard
            name='Owner'
            description='Full access to all workspace features'
            permissions={['All permissions']}
          />
          <DefaultRoleCard
            name='Admin'
            description='Can manage members, channels, and settings'
            permissions={['Manage members', 'Manage channels', 'View billing']}
          />
          <DefaultRoleCard
            name='Member'
            description='Standard access to channels and messaging'
            permissions={['Send messages', 'Create threads', 'Upload files']}
          />
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <RoleEditorModal
          availablePermissions={availablePermissions}
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <RoleEditorModal
          role={editingRole}
          availablePermissions={availablePermissions}
          onSave={data => handleUpdate(editingRole.id, data)}
          onClose={() => setEditingRole(null)}
        />
      )}
    </div>
  );
}

// Types - Using Role and RolePermission from use-admin hook

interface Permission {
  id: string;
  name: string;
  description: string;
}

// CreateRoleData matches Omit<Role, 'id'> from the hook
type CreateRoleData = Omit<Role, 'id'>;

// Role Card Component
interface RoleCardProps {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}

function RoleCard({ role, onEdit, onDelete }: RoleCardProps) {
  return (
    <div className='rounded-lg border bg-card p-4'>
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
            <p className='text-sm text-muted-foreground'>
              {role.memberCount} member{role.memberCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className='flex gap-1'>
          <button
            type='button'
            onClick={onEdit}
            className='rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            <EditIcon className='h-4 w-4' />
          </button>
          {!role.isSystem && (
            <button
              type='button'
              onClick={onDelete}
              className='rounded-md p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20'
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
            <span
              key={`${permission.resource}-${idx}`}
              className='rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground'
            >
              {permission.resource}: {permission.actions.join(', ')}
            </span>
          ))}
          {role.permissions.length > 3 && (
            <span className='rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
              +{role.permissions.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleCardSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card p-4'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 animate-pulse rounded-lg bg-muted' />
            <div className='space-y-2'>
              <div className='h-4 w-24 animate-pulse rounded bg-muted' />
              <div className='h-3 w-16 animate-pulse rounded bg-muted' />
            </div>
          </div>
          <div className='mt-4 h-4 w-full animate-pulse rounded bg-muted' />
          <div className='mt-4 flex gap-1'>
            <div className='h-5 w-16 animate-pulse rounded bg-muted' />
            <div className='h-5 w-16 animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </>
  );
}

// Default Role Card
function DefaultRoleCard({
  name,
  description,
  permissions,
}: {
  name: string;
  description: string;
  permissions: string[];
}) {
  return (
    <div className='rounded-lg border bg-muted/30 p-4'>
      <div className='flex items-center gap-2'>
        <ShieldIcon className='h-4 w-4 text-muted-foreground' />
        <h3 className='font-medium text-foreground'>{name}</h3>
      </div>
      <p className='mt-2 text-sm text-muted-foreground'>{description}</p>
      <ul className='mt-3 space-y-1'>
        {permissions.map(perm => (
          <li
            key={perm}
            className='flex items-center gap-2 text-sm text-muted-foreground'
          >
            <CheckIcon className='h-3 w-3 text-green-500' />
            {perm}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Role Editor Modal - uses CreateRoleData for both create and update since the form always provides all fields
interface RoleEditorModalProps {
  role?: Role;
  availablePermissions: Permission[];
  onSave: (data: CreateRoleData) => Promise<void>;
  onClose: () => void;
}

function RoleEditorModal({
  role,
  availablePermissions,
  onSave,
  onClose,
}: RoleEditorModalProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [color, setColor] = useState(role?.color ?? '#6366f1');
  // Store permissions in the API format: { resource, actions }[]
  const [permissions, setPermissions] = useState<RolePermission[]>(
    role?.permissions ?? []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave({ name, description, color, permissions });
    setIsSubmitting(false);
  };

  // Check if a resource is in the permissions list
  const hasPermission = (resource: string) =>
    permissions.some(p => p.resource === resource);

  // Toggle a permission by resource name
  const togglePermission = (permissionId: string) => {
    setPermissions(prev => {
      const exists = prev.some(p => p.resource === permissionId);
      if (exists) {
        return prev.filter(p => p.resource !== permissionId);
      } else {
        // Add with default actions
        return [...prev, { resource: permissionId, actions: ['read'] }];
      }
    });
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
      <div className='max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-card shadow-xl'>
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
          <div className='space-y-4'>
            {/* Name */}
            <div>
              <label
                htmlFor='roleName'
                className='block text-sm font-medium text-foreground'
              >
                Role Name
              </label>
              <input
                type='text'
                id='roleName'
                value={name}
                onChange={e => setName(e.target.value)}
                className={cn(
                  'mt-1 block w-full rounded-md border border-input bg-background',
                  'px-3 py-2 text-sm placeholder:text-muted-foreground',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                )}
                placeholder='e.g., Moderator'
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor='roleDescription'
                className='block text-sm font-medium text-foreground'
              >
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
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                )}
                placeholder='Describe what this role is for...'
              />
            </div>

            {/* Color */}
            <div>
              <label className='block text-sm font-medium text-foreground'>
                Color
              </label>
              <div className='mt-2 flex flex-wrap gap-2'>
                {colorOptions.map(c => (
                  <button
                    key={c}
                    type='button'
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2',
                      color === c
                        ? 'border-foreground ring-2 ring-offset-2 ring-offset-background'
                        : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className='block text-sm font-medium text-foreground'>
                Permissions
              </label>
              <p className='text-sm text-muted-foreground'>
                Select the permissions for this role
              </p>
              <div className='mt-3 max-h-60 space-y-2 overflow-y-auto rounded-md border p-3'>
                {availablePermissions.map(permission => (
                  <label
                    key={permission.id}
                    className='flex items-start gap-3 rounded-md p-2 hover:bg-muted/50'
                  >
                    <input
                      type='checkbox'
                      checked={hasPermission(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                      className='mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary'
                    />
                    <div>
                      <p className='text-sm font-medium text-foreground'>
                        {permission.name}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {permission.description}
                      </p>
                    </div>
                  </label>
                ))}
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
                'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isSubmitting
                ? 'Saving...'
                : role
                  ? 'Save Changes'
                  : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Icons
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
