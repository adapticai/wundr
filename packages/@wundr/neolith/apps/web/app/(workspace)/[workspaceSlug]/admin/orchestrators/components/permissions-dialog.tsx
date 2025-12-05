'use client';

import { useState, useEffect } from 'react';
import { Users, Shield, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orchestratorId: string | null;
  workspaceSlug: string;
  onSuccess?: () => void;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  role: string;
}

interface Permission {
  id: string;
  label: string;
  description: string;
  category: 'access' | 'admin' | 'data';
}

const AVAILABLE_PERMISSIONS: Permission[] = [
  {
    id: 'orchestrator.use',
    label: 'Use Orchestrator',
    description: 'Can interact with and delegate tasks to the orchestrator',
    category: 'access',
  },
  {
    id: 'orchestrator.configure',
    label: 'Configure Settings',
    description: 'Can modify orchestrator settings and parameters',
    category: 'admin',
  },
  {
    id: 'orchestrator.manage_budget',
    label: 'Manage Budget',
    description: 'Can view and modify budget settings',
    category: 'admin',
  },
  {
    id: 'orchestrator.view_analytics',
    label: 'View Analytics',
    description: 'Can access detailed analytics and usage data',
    category: 'data',
  },
  {
    id: 'orchestrator.export_data',
    label: 'Export Data',
    description: 'Can export orchestrator data and conversations',
    category: 'data',
  },
];

export function PermissionsDialog({
  open,
  onOpenChange,
  orchestratorId,
  workspaceSlug,
  onSuccess,
}: PermissionsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && orchestratorId) {
      fetchPermissions();
      fetchMembers();
    }
  }, [open, orchestratorId]);

  const fetchMembers = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/members`,
      );

      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchPermissions = async () => {
    if (!orchestratorId) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/${orchestratorId}/permissions`,
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedMembers(new Set(data.allowedUserIds || []));
        setSelectedPermissions(new Set(data.permissions || ['orchestrator.use']));
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const handleSave = async () => {
    if (!orchestratorId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/${orchestratorId}/permissions`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowedUserIds: Array.from(selectedMembers),
            permissions: Array.from(selectedPermissions),
          }),
        },
      );

      if (!response.ok) throw new Error('Failed to update permissions');

      toast({
        title: 'Success',
        description: 'Permissions updated successfully',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update permissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const selectAllMembers = () => {
    setSelectedMembers(new Set(members.map(m => m.userId)));
  };

  const clearAllMembers = () => {
    setSelectedMembers(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px] max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Orchestrator Permissions</DialogTitle>
          <DialogDescription>
            Control who can access and what they can do with this orchestrator
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Allowed Users */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <Label className='flex items-center gap-2'>
                <Users className='h-4 w-4' />
                Allowed Users ({selectedMembers.size})
              </Label>
              <div className='flex gap-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={selectAllMembers}
                >
                  Select All
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={clearAllMembers}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className='border rounded-lg divide-y max-h-60 overflow-y-auto'>
              {members.length === 0 ? (
                <div className='p-4 text-center text-muted-foreground text-sm'>
                  No members found
                </div>
              ) : (
                members.map(member => (
                  <div
                    key={member.id}
                    className='flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer'
                    onClick={() => toggleMember(member.userId)}
                  >
                    <Checkbox
                      checked={selectedMembers.has(member.userId)}
                      onCheckedChange={() => toggleMember(member.userId)}
                    />
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold'>
                      {member.user.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={member.user.name || ''}
                          className='h-full w-full rounded-full object-cover'
                        />
                      ) : (
                        (member.user.name || member.user.email || 'U')
                          .substring(0, 2)
                          .toUpperCase()
                      )}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium truncate'>
                        {member.user.name || 'Unknown'}
                      </p>
                      <p className='text-xs text-muted-foreground truncate'>
                        {member.user.email}
                      </p>
                    </div>
                    <Badge variant='outline' className='text-xs'>
                      {member.role}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className='space-y-4'>
            <Label className='flex items-center gap-2'>
              <Shield className='h-4 w-4' />
              Permissions
            </Label>
            <div className='space-y-2'>
              {['access', 'admin', 'data'].map(category => {
                const categoryPerms = AVAILABLE_PERMISSIONS.filter(
                  p => p.category === category,
                );
                return (
                  <div key={category} className='space-y-2'>
                    <p className='text-sm font-medium text-muted-foreground capitalize'>
                      {category}
                    </p>
                    <div className='space-y-2 pl-4'>
                      {categoryPerms.map(permission => (
                        <div
                          key={permission.id}
                          className='flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50'
                        >
                          <Checkbox
                            id={permission.id}
                            checked={selectedPermissions.has(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                          />
                          <div className='flex-1'>
                            <label
                              htmlFor={permission.id}
                              className='text-sm font-medium cursor-pointer'
                            >
                              {permission.label}
                            </label>
                            <p className='text-xs text-muted-foreground'>
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
