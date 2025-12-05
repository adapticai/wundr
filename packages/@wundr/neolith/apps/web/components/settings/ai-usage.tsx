'use client';

import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

interface AIUsageProps {
  userId: string;
  orchestratorId?: string;
  totalTokens: number;
  totalCost: number;
  usagePercentage: number;
  monthlyLimit: number;
  workspaceSlug: string;
}

export function AIUsage({
  userId,
  orchestratorId,
  totalTokens,
  totalCost,
  usagePercentage,
  monthlyLimit,
  workspaceSlug,
}: AIUsageProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getUsageColor = (): string => {
    if (usagePercentage >= 90) return 'text-red-600 dark:text-red-400';
    if (usagePercentage >= 75) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getUsageStatus = (): string => {
    if (usagePercentage >= 90) return 'Critical';
    if (usagePercentage >= 75) return 'High';
    if (usagePercentage >= 50) return 'Moderate';
    return 'Normal';
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/user/ai-settings/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('AI data exported successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to export data'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/ai-settings/history', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete history');
      }

      toast.success('AI conversation history deleted successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete history'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Current Month Usage */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>Current Month Usage</h3>
          <Badge variant={usagePercentage >= 75 ? 'destructive' : 'secondary'}>
            {getUsageStatus()}
          </Badge>
        </div>

        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Tokens Used</span>
            <span className={`font-semibold ${getUsageColor()}`}>
              {formatNumber(totalTokens)} / {formatNumber(monthlyLimit)}
            </span>
          </div>
          <Progress value={Math.min(usagePercentage, 100)} className='h-2' />
          <p className='text-xs text-muted-foreground'>
            {usagePercentage.toFixed(1)}% of monthly quota used
          </p>
        </div>

        <div className='grid grid-cols-2 gap-4 rounded-lg border p-4'>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Total Tokens</p>
            <p className='text-2xl font-bold'>{formatNumber(totalTokens)}</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Estimated Cost</p>
            <p className='text-2xl font-bold'>{formatCurrency(totalCost)}</p>
          </div>
        </div>
      </div>

      {/* Usage Breakdown */}
      {orchestratorId && (
        <div className='space-y-3'>
          <h3 className='text-lg font-semibold'>Usage Breakdown</h3>
          <div className='rounded-lg border p-4'>
            <p className='text-sm text-muted-foreground'>
              Detailed usage analytics and breakdowns by model, task type, and
              time period are available in your orchestrator dashboard.
            </p>
            <Button variant='link' className='mt-2 h-auto p-0' asChild>
              <a href={`/${workspaceSlug}/orchestrators/${orchestratorId}`}>
                View Orchestrator Dashboard
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Quota Management */}
      <div className='space-y-3'>
        <h3 className='text-lg font-semibold'>Quota Management</h3>
        <div className='rounded-lg border p-4'>
          <div className='space-y-2'>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Monthly Quota</span>
              <span className='font-medium'>
                {formatNumber(monthlyLimit)} tokens
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Remaining</span>
              <span className='font-medium'>
                {formatNumber(Math.max(0, monthlyLimit - totalTokens))} tokens
              </span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Reset Date</span>
              <span className='font-medium'>
                {new Date(
                  new Date().getFullYear(),
                  new Date().getMonth() + 1,
                  1
                ).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className='space-y-3'>
        <h3 className='text-lg font-semibold'>Data Management</h3>
        <div className='flex flex-col gap-3'>
          <Button
            variant='outline'
            className='w-full justify-start'
            onClick={handleExportData}
            disabled={isExporting}
          >
            <Download className='mr-2 h-4 w-4' />
            {isExporting ? 'Exporting...' : 'Export My AI Data'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='destructive' className='w-full justify-start'>
                <Trash2 className='mr-2 h-4 w-4' />
                Delete Conversation History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete AI Conversation History?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your AI conversation history
                  and context memory. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteHistory}
                  disabled={isDeleting}
                  className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                >
                  {isDeleting ? 'Deleting...' : 'Delete History'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <p className='text-xs text-muted-foreground'>
          Exported data includes conversation history, usage statistics, and
          preferences. Personal API keys are never included in exports.
        </p>
      </div>
    </div>
  );
}
