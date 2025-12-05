'use client';

import { Users, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

interface Permission {
  userId: string;
  userName: string;
  userEmail: string;
  canExecute: boolean;
  canEdit: boolean;
}

interface WorkflowPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  workspaceSlug: string;
  onSuccess?: () => void;
}

export function WorkflowPermissionsDialog({
  open,
  onOpenChange,
  workflowId,
  workspaceSlug,
  onSuccess,
}: WorkflowPermissionsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    if (open && workflowId) {
      fetchPermissions();
    }
  }, [open, workflowId]);

  const fetchPermissions = async () => {
    if (!workflowId) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/${workflowId}/permissions`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      const data = await response.json();
      setPermissions(data.permissions || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load permissions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (
    userId: string,
    type: 'canExecute' | 'canEdit'
  ) => {
    setPermissions(prev =>
      prev.map(p => (p.userId === userId ? { ...p, [type]: !p[type] } : p))
    );
  };

  const handleSave = async () => {
    if (!workflowId) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/${workflowId}/permissions`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update permissions');
      }

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
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Users className='h-5 w-5' />
            Workflow Permissions
          </DialogTitle>
          <DialogDescription>
            Configure who can execute and edit this workflow
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='py-8 text-center text-muted-foreground'>
            Loading permissions...
          </div>
        ) : permissions.length === 0 ? (
          <div className='py-8 text-center text-muted-foreground'>
            No workspace members found
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='grid grid-cols-[1fr,auto,auto] gap-4 pb-2 border-b text-sm font-medium text-muted-foreground'>
              <div>User</div>
              <div className='text-center w-24'>Execute</div>
              <div className='text-center w-24'>Edit</div>
            </div>

            {permissions.map(permission => (
              <div
                key={permission.userId}
                className='grid grid-cols-[1fr,auto,auto] gap-4 items-center'
              >
                <div>
                  <p className='font-medium'>{permission.userName}</p>
                  <p className='text-sm text-muted-foreground'>
                    {permission.userEmail}
                  </p>
                </div>
                <div className='flex justify-center w-24'>
                  <Checkbox
                    checked={permission.canExecute}
                    onCheckedChange={() =>
                      handleTogglePermission(permission.userId, 'canExecute')
                    }
                  />
                </div>
                <div className='flex justify-center w-24'>
                  <Checkbox
                    checked={permission.canEdit}
                    onCheckedChange={() =>
                      handleTogglePermission(permission.userId, 'canEdit')
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
