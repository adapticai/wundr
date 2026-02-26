'use client';

import {
  Loader2,
  Shield,
  Trash2,
  Plus,
  Edit2,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'workspace' | 'channels' | 'members' | 'content';
}

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  priority: number;
  isDefault: boolean;
  isSystemRole: boolean;
  permissions: string[];
  memberCount: number;
}

const PERMISSION_CATEGORIES = {
  workspace: 'Workspace Management',
  channels: 'Channel Management',
  members: 'Member Management',
  content: 'Content Management',
};

const DEFAULT_PERMISSIONS: Permission[] = [
  // Workspace
  {
    id: 'workspace.settings.view',
    name: 'View workspace settings',
    description: 'Can view workspace settings',
    category: 'workspace',
  },
  {
    id: 'workspace.settings.edit',
    name: 'Edit workspace settings',
    description: 'Can modify workspace settings',
    category: 'workspace',
  },
  {
    id: 'workspace.delete',
    name: 'Delete workspace',
    description: 'Can delete the workspace',
    category: 'workspace',
  },
  {
    id: 'workspace.billing',
    name: 'Manage billing',
    description: 'Can manage billing and subscriptions',
    category: 'workspace',
  },

  // Channels
  {
    id: 'channels.create',
    name: 'Create channels',
    description: 'Can create new channels',
    category: 'channels',
  },
  {
    id: 'channels.delete',
    name: 'Delete channels',
    description: 'Can delete channels',
    category: 'channels',
  },
  {
    id: 'channels.manage',
    name: 'Manage channels',
    description: 'Can edit channel settings',
    category: 'channels',
  },

  // Members
  {
    id: 'members.invite',
    name: 'Invite members',
    description: 'Can invite new members',
    category: 'members',
  },
  {
    id: 'members.remove',
    name: 'Remove members',
    description: 'Can remove members',
    category: 'members',
  },
  {
    id: 'members.roles',
    name: 'Manage roles',
    description: 'Can assign and modify member roles',
    category: 'members',
  },

  // Content
  {
    id: 'content.delete.own',
    name: 'Delete own content',
    description: 'Can delete their own messages',
    category: 'content',
  },
  {
    id: 'content.delete.any',
    name: 'Delete any content',
    description: 'Can delete any messages',
    category: 'content',
  },
  {
    id: 'content.pin',
    name: 'Pin messages',
    description: 'Can pin/unpin messages',
    category: 'content',
  },
];

export default function RolesSettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    permissions: [] as string[],
  });

  // Load roles
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/roles`
        );
        if (!response.ok) {
          throw new Error('Failed to load roles');
        }
        const data = await response.json();
        setRoles(data.roles || []);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to load roles',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadRoles();
  }, [workspaceSlug, toast]);

  const toggleRoleExpansion = useCallback((roleId: string) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }, []);

  const togglePermission = useCallback((permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  }, []);

  const handleCreateRole = useCallback(async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Role name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/roles`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create role');
      }

      const { role } = await response.json();
      setRoles(prev => [...prev, role]);
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        color: '#6366f1',
        permissions: [],
      });

      toast({
        title: 'Success',
        description: 'Role created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create role',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, workspaceSlug, toast]);

  const handleEditRole = useCallback((role: Role) => {
    setEditingRole(role.id);
    setFormData({
      name: role.name,
      description: role.description,
      color: role.color,
      permissions: role.permissions,
    });
    setExpandedRoles(new Set([role.id]));
  }, []);

  const handleUpdateRole = useCallback(
    async (roleId: string) => {
      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/roles/${roleId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update role');
        }

        const { role } = await response.json();
        setRoles(prev => prev.map(r => (r.id === roleId ? role : r)));
        setEditingRole(null);
        setFormData({
          name: '',
          description: '',
          color: '#6366f1',
          permissions: [],
        });

        toast({
          title: 'Success',
          description: 'Role updated successfully',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update role',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [formData, workspaceSlug, toast]
  );

  const handleDeleteRole = useCallback(
    async (roleId: string) => {
      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/roles/${roleId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete role');
        }

        setRoles(prev => prev.filter(r => r.id !== roleId));

        toast({
          title: 'Role deleted',
          description:
            'Members previously assigned this role have been reassigned to the default role.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to delete role',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [workspaceSlug, toast]
  );

  const handlePriorityChange = useCallback(
    async (roleId: string, direction: 'up' | 'down') => {
      const role = roles.find(r => r.id === roleId);
      if (!role) {
        return;
      }

      const newPriority =
        direction === 'up' ? role.priority - 1 : role.priority + 1;

      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/roles/${roleId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: newPriority }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update priority');
        }

        const { role: updatedRole } = await response.json();
        setRoles(prev =>
          prev
            .map(r => (r.id === roleId ? updatedRole : r))
            .sort((a, b) => b.priority - a.priority)
        );

        toast({
          title: 'Success',
          description: 'Role priority updated',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to update priority',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [roles, workspaceSlug, toast]
  );

  const cancelEdit = useCallback(() => {
    setEditingRole(null);
    setShowCreateForm(false);
    setFormData({
      name: '',
      description: '',
      color: '#6366f1',
      permissions: [],
    });
  }, []);

  if (isLoading) {
    return <RolesSettingsSkeleton />;
  }

  const sortedRoles = [...roles].sort((a, b) => b.priority - a.priority);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Roles & Permissions</h1>
        <p className='mt-1 text-muted-foreground'>
          Manage workspace roles and their access permissions
        </p>
      </div>

      {/* Create Role Button */}
      {!showCreateForm && (
        <Button
          onClick={() => setShowCreateForm(true)}
          className='w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 mr-2' />
          Create Custom Role
        </Button>
      )}

      {/* Create Role Form */}
      {showCreateForm && (
        <Card className='border-primary'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Shield className='h-5 w-5' />
              Create New Role
            </CardTitle>
            <CardDescription>
              Define a custom role with specific permissions
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <RoleForm
              formData={formData}
              setFormData={setFormData}
              togglePermission={togglePermission}
            />
            <div className='flex justify-end gap-2 pt-4 border-t'>
              <Button
                variant='outline'
                onClick={cancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateRole} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Creating...
                  </>
                ) : (
                  'Create Role'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Roles */}
      <div className='space-y-3'>
        {sortedRoles.map((role, index) => {
          const isExpanded = expandedRoles.has(role.id);
          const isEditing = editingRole === role.id;

          return (
            <Card key={role.id} className={cn(isEditing && 'border-primary')}>
              <CardHeader className='pb-3'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex items-start gap-3 flex-1 min-w-0'>
                    <div
                      className='h-3 w-3 rounded-full flex-shrink-0 mt-1.5'
                      style={{ backgroundColor: role.color }}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <CardTitle className='text-lg'>{role.name}</CardTitle>
                        {role.isSystemRole && (
                          <Badge variant='secondary' className='text-xs'>
                            System
                          </Badge>
                        )}
                        {role.isDefault && (
                          <Badge variant='outline' className='text-xs'>
                            Default
                          </Badge>
                        )}
                      </div>
                      <CardDescription className='mt-1'>
                        {role.description}
                      </CardDescription>
                      <p className='text-xs text-muted-foreground mt-1'>
                        {role.memberCount}{' '}
                        {role.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-1 flex-shrink-0'>
                    {!role.isSystemRole && (
                      <>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handlePriorityChange(role.id, 'up')}
                          disabled={isSaving || index === 0}
                          title='Increase priority'
                        >
                          <ChevronUp className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handlePriorityChange(role.id, 'down')}
                          disabled={
                            isSaving || index === sortedRoles.length - 1
                          }
                          title='Decrease priority'
                        >
                          <ChevronDown className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleEditRole(role)}
                          disabled={isSaving}
                          title='Edit role'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              disabled={isSaving || role.memberCount > 0}
                              title={
                                role.memberCount > 0
                                  ? 'Cannot delete a role that has members assigned to it'
                                  : 'Delete role'
                              }
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the{' '}
                                <span className='font-semibold'>
                                  {role.name}
                                </span>{' '}
                                role? Members assigned this role will be
                                reassigned to the default Member role.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRole(role.id)}
                                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                              >
                                Delete Role
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => toggleRoleExpansion(role.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className='h-4 w-4' />
                      ) : (
                        <ChevronDown className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className='border-t pt-4'>
                  {isEditing ? (
                    <div className='space-y-4'>
                      <RoleForm
                        formData={formData}
                        setFormData={setFormData}
                        togglePermission={togglePermission}
                      />
                      <div className='flex justify-end gap-2 pt-4 border-t'>
                        <Button
                          variant='outline'
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleUpdateRole(role.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <PermissionsList permissions={role.permissions} />
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RoleForm({
  formData,
  setFormData,
  togglePermission,
}: {
  formData: {
    name: string;
    description: string;
    color: string;
    permissions: string[];
  };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  togglePermission: (permissionId: string) => void;
}) {
  return (
    <>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='role-name'>Role Name</Label>
          <Input
            id='role-name'
            value={formData.name}
            onChange={e =>
              setFormData(prev => ({ ...prev, name: e.target.value }))
            }
            placeholder='e.g., Moderator'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='role-color'>Role Color</Label>
          <div className='flex gap-2'>
            <Input
              id='role-color'
              type='color'
              value={formData.color}
              onChange={e =>
                setFormData(prev => ({ ...prev, color: e.target.value }))
              }
              className='h-10 w-20'
            />
            <Input
              value={formData.color}
              onChange={e =>
                setFormData(prev => ({ ...prev, color: e.target.value }))
              }
              placeholder='#6366f1'
              className='flex-1'
            />
          </div>
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='role-description'>Description</Label>
        <Input
          id='role-description'
          value={formData.description}
          onChange={e =>
            setFormData(prev => ({ ...prev, description: e.target.value }))
          }
          placeholder="Describe this role's purpose"
        />
      </div>

      <div className='space-y-3 border-t pt-4'>
        <Label className='text-base'>Permissions</Label>
        {Object.entries(PERMISSION_CATEGORIES).map(
          ([category, categoryName]) => {
            const categoryPermissions = DEFAULT_PERMISSIONS.filter(
              p => p.category === category
            );

            return (
              <div key={category} className='space-y-2'>
                <h4 className='text-sm font-medium text-foreground'>
                  {categoryName}
                </h4>
                <div className='space-y-2 ml-4'>
                  {categoryPermissions.map(permission => (
                    <label
                      key={permission.id}
                      className='flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-muted/50'
                    >
                      <div className='relative flex items-center justify-center h-5 w-5 mt-0.5'>
                        <input
                          type='checkbox'
                          checked={formData.permissions.includes(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                          className='sr-only'
                        />
                        <div
                          className={cn(
                            'h-4 w-4 rounded border-2 transition-colors flex items-center justify-center',
                            formData.permissions.includes(permission.id)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/50'
                          )}
                        >
                          {formData.permissions.includes(permission.id) && (
                            <Check className='h-3 w-3 text-primary-foreground' />
                          )}
                        </div>
                      </div>
                      <div className='flex-1'>
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
            );
          }
        )}
      </div>
    </>
  );
}

function PermissionsList({ permissions }: { permissions: string[] }) {
  const groupedPermissions = DEFAULT_PERMISSIONS.filter(p =>
    permissions.includes(p.id)
  ).reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <div className='space-y-4'>
      <h4 className='text-sm font-medium text-foreground'>Permissions</h4>
      {Object.entries(groupedPermissions).map(([category, perms]) => (
        <div key={category} className='space-y-2'>
          <p className='text-sm font-medium text-muted-foreground'>
            {
              PERMISSION_CATEGORIES[
                category as keyof typeof PERMISSION_CATEGORIES
              ]
            }
          </p>
          <div className='ml-4 space-y-1'>
            {perms.map(permission => (
              <div
                key={permission.id}
                className='flex items-center gap-2 text-sm'
              >
                <Check className='h-3 w-3 text-green-600' />
                <span>{permission.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {permissions.length === 0 && (
        <p className='text-sm text-muted-foreground'>No permissions assigned</p>
      )}
    </div>
  );
}

function RolesSettingsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      <div className='h-10 w-48 animate-pulse rounded bg-muted' />
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className='flex items-start justify-between'>
              <div className='space-y-2 flex-1'>
                <div className='h-6 w-48 animate-pulse rounded bg-muted' />
                <div className='h-4 w-full animate-pulse rounded bg-muted' />
              </div>
              <div className='h-8 w-8 animate-pulse rounded bg-muted' />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
