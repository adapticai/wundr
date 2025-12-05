'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';

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

interface BudgetSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orchestratorId: string | null;
  workspaceSlug: string;
  onSuccess?: () => void;
}

export function BudgetSettingsDialog({
  open,
  onOpenChange,
  orchestratorId,
  workspaceSlug,
  onSuccess,
}: BudgetSettingsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [currentUsage, setCurrentUsage] = useState<number>(0);

  useEffect(() => {
    if (open && orchestratorId) {
      fetchBudgetSettings();
    }
  }, [open, orchestratorId]);

  const fetchBudgetSettings = async () => {
    if (!orchestratorId) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/${orchestratorId}/budget`,
      );

      if (response.ok) {
        const data = await response.json();
        setBudgetLimit(data.budgetLimit?.toString() || '');
        setBillingPeriod(data.billingPeriod || 'monthly');
        setAlertThreshold(data.alertThreshold?.toString() || '80');
        setCurrentUsage(data.currentUsage || 0);
      }
    } catch (error) {
      console.error('Failed to fetch budget settings:', error);
    }
  };

  const handleSave = async () => {
    if (!orchestratorId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/orchestrators/${orchestratorId}/budget`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budgetLimit: parseFloat(budgetLimit) || 0,
            billingPeriod,
            alertThreshold: parseInt(alertThreshold) || 80,
          }),
        },
      );

      if (!response.ok) throw new Error('Failed to update budget settings');

      toast({
        title: 'Success',
        description: 'Budget settings updated successfully',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update budget settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const usagePercent = budgetLimit
    ? (currentUsage / parseFloat(budgetLimit)) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Budget Settings</DialogTitle>
          <DialogDescription>
            Set budget limits and alerts for this orchestrator
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Current Usage */}
          <div className='rounded-lg border p-4 bg-muted/50'>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center gap-2'>
                <TrendingUp className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm font-medium'>Current Usage</span>
              </div>
              <span className='text-2xl font-bold'>
                ${currentUsage.toFixed(2)}
              </span>
            </div>
            {budgetLimit && (
              <div className='space-y-2'>
                <div className='flex justify-between text-sm text-muted-foreground'>
                  <span>{usagePercent.toFixed(1)}% of budget</span>
                  <span>${budgetLimit}</span>
                </div>
                <div className='h-2 bg-muted rounded-full overflow-hidden'>
                  <div
                    className={`h-full transition-all ${
                      usagePercent > 90
                        ? 'bg-red-500'
                        : usagePercent > 80
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Budget Limit */}
          <div className='space-y-2'>
            <Label htmlFor='budgetLimit'>Budget Limit</Label>
            <div className='relative'>
              <DollarSign className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='budgetLimit'
                type='number'
                placeholder='1000'
                value={budgetLimit}
                onChange={e => setBudgetLimit(e.target.value)}
                className='pl-9'
                min='0'
                step='0.01'
              />
            </div>
            <p className='text-sm text-muted-foreground'>
              Maximum spend allowed per billing period
            </p>
          </div>

          {/* Billing Period */}
          <div className='space-y-2'>
            <Label htmlFor='billingPeriod'>Billing Period</Label>
            <Select value={billingPeriod} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setBillingPeriod(value)}>
              <SelectTrigger id='billingPeriod'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='daily'>Daily</SelectItem>
                <SelectItem value='weekly'>Weekly</SelectItem>
                <SelectItem value='monthly'>Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alert Threshold */}
          <div className='space-y-2'>
            <Label htmlFor='alertThreshold'>Alert Threshold (%)</Label>
            <Input
              id='alertThreshold'
              type='number'
              placeholder='80'
              value={alertThreshold}
              onChange={e => setAlertThreshold(e.target.value)}
              min='0'
              max='100'
            />
            <p className='text-sm text-muted-foreground'>
              Get notified when usage exceeds this percentage
            </p>
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
