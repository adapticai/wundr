'use client';

import { useState, useEffect } from 'react';
import { Settings, DollarSign, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface DefaultSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
}

interface DefaultSettings {
  defaultBudgetLimit: number;
  defaultBillingPeriod: 'daily' | 'weekly' | 'monthly';
  defaultAlertThreshold: number;
  autoEnableNewOrchestrators: boolean;
  requireApprovalForTasks: boolean;
  defaultPermissions: string[];
}

export function DefaultSettingsDialog({
  open,
  onOpenChange,
  workspaceSlug,
}: DefaultSettingsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<DefaultSettings>({
    defaultBudgetLimit: 1000,
    defaultBillingPeriod: 'monthly',
    defaultAlertThreshold: 80,
    autoEnableNewOrchestrators: false,
    requireApprovalForTasks: false,
    defaultPermissions: ['orchestrator.use'],
  });

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/defaults`,
      );

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('Failed to fetch default settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/defaults`,
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
        description: 'Failed to update default settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Default Orchestrator Settings</DialogTitle>
          <DialogDescription>
            Set default configurations for new orchestrators
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Budget Defaults */}
          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <DollarSign className='h-4 w-4 text-muted-foreground' />
              <Label className='text-base font-semibold'>Budget Defaults</Label>
            </div>

            <div className='space-y-2 pl-6'>
              <Label htmlFor='defaultBudgetLimit'>Default Budget Limit</Label>
              <div className='relative'>
                <DollarSign className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  id='defaultBudgetLimit'
                  type='number'
                  value={settings.defaultBudgetLimit}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      defaultBudgetLimit: parseFloat(e.target.value) || 0,
                    })
                  }
                  className='pl-9'
                  min='0'
                  step='0.01'
                />
              </div>
            </div>

            <div className='space-y-2 pl-6'>
              <Label htmlFor='defaultBillingPeriod'>Billing Period</Label>
              <Select
                value={settings.defaultBillingPeriod}
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                  setSettings({ ...settings, defaultBillingPeriod: value })
                }
              >
                <SelectTrigger id='defaultBillingPeriod'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='daily'>Daily</SelectItem>
                  <SelectItem value='weekly'>Weekly</SelectItem>
                  <SelectItem value='monthly'>Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2 pl-6'>
              <Label htmlFor='defaultAlertThreshold'>Alert Threshold (%)</Label>
              <Input
                id='defaultAlertThreshold'
                type='number'
                value={settings.defaultAlertThreshold}
                onChange={e =>
                  setSettings({
                    ...settings,
                    defaultAlertThreshold: parseInt(e.target.value) || 80,
                  })
                }
                min='0'
                max='100'
              />
            </div>
          </div>

          {/* General Settings */}
          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <Settings className='h-4 w-4 text-muted-foreground' />
              <Label className='text-base font-semibold'>General Settings</Label>
            </div>

            <div className='space-y-3 pl-6'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='autoEnable'
                  checked={settings.autoEnableNewOrchestrators}
                  onCheckedChange={checked =>
                    setSettings({
                      ...settings,
                      autoEnableNewOrchestrators: !!checked,
                    })
                  }
                />
                <div className='flex-1'>
                  <label
                    htmlFor='autoEnable'
                    className='text-sm font-medium cursor-pointer'
                  >
                    Auto-enable new orchestrators
                  </label>
                  <p className='text-xs text-muted-foreground'>
                    New orchestrators will be enabled immediately
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-2'>
                <Checkbox
                  id='requireApproval'
                  checked={settings.requireApprovalForTasks}
                  onCheckedChange={checked =>
                    setSettings({
                      ...settings,
                      requireApprovalForTasks: !!checked,
                    })
                  }
                />
                <div className='flex-1'>
                  <label
                    htmlFor='requireApproval'
                    className='text-sm font-medium cursor-pointer'
                  >
                    Require approval for tasks
                  </label>
                  <p className='text-xs text-muted-foreground'>
                    Orchestrators must get approval before executing tasks
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Permission Defaults */}
          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <Shield className='h-4 w-4 text-muted-foreground' />
              <Label className='text-base font-semibold'>Default Permissions</Label>
            </div>

            <div className='space-y-3 pl-6'>
              {[
                { id: 'orchestrator.use', label: 'Use Orchestrator' },
                { id: 'orchestrator.configure', label: 'Configure Settings' },
                { id: 'orchestrator.view_analytics', label: 'View Analytics' },
              ].map(perm => (
                <div key={perm.id} className='flex items-center gap-2'>
                  <Checkbox
                    id={perm.id}
                    checked={settings.defaultPermissions.includes(perm.id)}
                    onCheckedChange={checked => {
                      if (checked) {
                        setSettings({
                          ...settings,
                          defaultPermissions: [...settings.defaultPermissions, perm.id],
                        });
                      } else {
                        setSettings({
                          ...settings,
                          defaultPermissions: settings.defaultPermissions.filter(
                            p => p !== perm.id,
                          ),
                        });
                      }
                    }}
                  />
                  <label
                    htmlFor={perm.id}
                    className='text-sm font-medium cursor-pointer'
                  >
                    {perm.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Defaults'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
