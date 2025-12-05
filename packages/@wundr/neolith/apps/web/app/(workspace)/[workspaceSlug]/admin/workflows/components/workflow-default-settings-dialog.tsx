'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface DefaultSettings {
  autoEnable: boolean;
  maxExecutionTime: number;
  retryOnFailure: boolean;
  retryCount: number;
  notifyOnFailure: boolean;
  notifyOnSuccess: boolean;
}

interface WorkflowDefaultSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
}

export function WorkflowDefaultSettingsDialog({
  open,
  onOpenChange,
  workspaceSlug,
}: WorkflowDefaultSettingsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<DefaultSettings>({
    autoEnable: false,
    maxExecutionTime: 300,
    retryOnFailure: true,
    retryCount: 3,
    notifyOnFailure: true,
    notifyOnSuccess: false,
  });

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/settings`,
      );

      if (!response.ok) throw new Error('Failed to fetch settings');

      const data = await response.json();
      setSettings(data.settings || settings);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load default settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/workflows/settings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        },
      );

      if (!response.ok) throw new Error('Failed to update settings');

      toast({
        title: 'Success',
        description: 'Default settings updated successfully',
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Settings className='h-5 w-5' />
            Default Workflow Settings
          </DialogTitle>
          <DialogDescription>
            Configure default settings for new workflows
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='py-8 text-center text-muted-foreground'>
            Loading settings...
          </div>
        ) : (
          <div className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label>Auto-enable New Workflows</Label>
                <p className='text-sm text-muted-foreground'>
                  Automatically set new workflows to active
                </p>
              </div>
              <Switch
                checked={settings.autoEnable}
                onCheckedChange={checked =>
                  setSettings(prev => ({ ...prev, autoEnable: checked }))
                }
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='maxExecutionTime'>
                Max Execution Time (seconds)
              </Label>
              <Input
                id='maxExecutionTime'
                type='number'
                min={30}
                max={3600}
                value={settings.maxExecutionTime}
                onChange={e =>
                  setSettings(prev => ({
                    ...prev,
                    maxExecutionTime: parseInt(e.target.value) || 300,
                  }))
                }
              />
              <p className='text-sm text-muted-foreground'>
                Maximum time a workflow can run before timing out
              </p>
            </div>

            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label>Retry on Failure</Label>
                <p className='text-sm text-muted-foreground'>
                  Automatically retry failed workflows
                </p>
              </div>
              <Switch
                checked={settings.retryOnFailure}
                onCheckedChange={checked =>
                  setSettings(prev => ({ ...prev, retryOnFailure: checked }))
                }
              />
            </div>

            {settings.retryOnFailure && (
              <div className='space-y-2'>
                <Label htmlFor='retryCount'>Retry Count</Label>
                <Input
                  id='retryCount'
                  type='number'
                  min={1}
                  max={10}
                  value={settings.retryCount}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      retryCount: parseInt(e.target.value) || 3,
                    }))
                  }
                />
              </div>
            )}

            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label>Notify on Failure</Label>
                <p className='text-sm text-muted-foreground'>
                  Send notifications when workflows fail
                </p>
              </div>
              <Switch
                checked={settings.notifyOnFailure}
                onCheckedChange={checked =>
                  setSettings(prev => ({ ...prev, notifyOnFailure: checked }))
                }
              />
            </div>

            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label>Notify on Success</Label>
                <p className='text-sm text-muted-foreground'>
                  Send notifications when workflows succeed
                </p>
              </div>
              <Switch
                checked={settings.notifyOnSuccess}
                onCheckedChange={checked =>
                  setSettings(prev => ({ ...prev, notifyOnSuccess: checked }))
                }
              />
            </div>
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
