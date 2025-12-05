/**
 * Example Integration: Workflow Execution Monitor
 *
 * This file demonstrates how to integrate the ExecutionMonitor component
 * into a Next.js page with proper error handling, loading states, and
 * user feedback.
 */

'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

// Import required UI components for these examples
import { ExecutionMonitor } from '@/components/workflows';
import { useWorkflowExecutions } from '@/hooks';

interface WorkflowExecutionPageProps {
  params: {
    workspaceSlug: string;
    workflowId: string;
    executionId: string;
  };
}

/**
 * Example 1: Basic Integration
 * Simple page showing execution monitor with navigation
 */
export function BasicExecutionPage({ params }: WorkflowExecutionPageProps) {
  const router = useRouter();
  const { workspaceSlug, workflowId, executionId } = params;

  return (
    <div className='container max-w-5xl py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold'>Workflow Execution</h1>
          <p className='text-sm text-muted-foreground'>
            Monitor the progress of your workflow execution in real-time
          </p>
        </div>
        <Button
          variant='outline'
          onClick={() =>
            router.push(`/${workspaceSlug}/workflows/${workflowId}`)
          }
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Workflow
        </Button>
      </div>

      <Separator />

      {/* Execution Monitor */}
      <ExecutionMonitor
        workspaceId={workspaceSlug}
        workflowId={workflowId}
        executionId={executionId}
        enablePolling={true}
        onComplete={execution => {
          toast.success('Workflow completed successfully!', {
            description: `Execution ID: ${execution.id}`,
          });
        }}
        onCancel={() => {
          toast.info('Workflow execution cancelled');
          router.push(`/${workspaceSlug}/workflows/${workflowId}/history`);
        }}
      />
    </div>
  );
}

/**
 * Example 2: Advanced Integration
 * Page with tabs showing execution details and logs
 */
export function AdvancedExecutionPage({ params }: WorkflowExecutionPageProps) {
  const router = useRouter();
  const { workspaceSlug, workflowId, executionId } = params;
  const [activeTab, setActiveTab] = useState<'monitor' | 'logs' | 'details'>(
    'monitor'
  );

  return (
    <div className='container max-w-6xl py-6 space-y-6'>
      {/* Header with Actions */}
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-bold'>Execution Monitor</h1>
            <Button
              variant='ghost'
              size='sm'
              onClick={() =>
                window.open(
                  `/${workspaceSlug}/workflows/${workflowId}`,
                  '_blank'
                )
              }
            >
              <ExternalLink className='h-4 w-4' />
            </Button>
          </div>
          <p className='text-sm text-muted-foreground'>
            Execution ID: {executionId}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() =>
              router.push(`/${workspaceSlug}/workflows/${workflowId}/history`)
            }
          >
            View History
          </Button>
          <Button
            variant='outline'
            onClick={() =>
              router.push(`/${workspaceSlug}/workflows/${workflowId}`)
            }
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-2 border-b'>
        <Button
          variant={activeTab === 'monitor' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('monitor')}
        >
          Monitor
        </Button>
        <Button
          variant={activeTab === 'logs' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </Button>
        <Button
          variant={activeTab === 'details' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('details')}
        >
          Details
        </Button>
      </div>

      {/* Content */}
      <div className='space-y-6'>
        {activeTab === 'monitor' && (
          <ExecutionMonitor
            workspaceId={workspaceSlug}
            workflowId={workflowId}
            executionId={executionId}
            enablePolling={true}
            enableSSE={false}
            onComplete={execution => {
              toast.success('Workflow completed!', {
                action: {
                  label: 'View Results',
                  onClick: () => setActiveTab('details'),
                },
              });
            }}
            onCancel={() => {
              toast.info('Execution cancelled');
            }}
          />
        )}

        {activeTab === 'logs' && (
          <Card>
            <CardHeader>
              <CardTitle>Execution Logs</CardTitle>
              <CardDescription>
                Detailed logs for this workflow execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground'>
                Logs view would go here...
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'details' && (
          <Card>
            <CardHeader>
              <CardTitle>Execution Details</CardTitle>
              <CardDescription>
                Complete metadata for this execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground'>
                Details view would go here...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Example 3: Modal Integration
 * Show execution monitor in a modal/dialog
 */
export function ExecutionModal({
  workspaceId,
  workflowId,
  executionId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  workflowId: string;
  executionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Workflow Execution</DialogTitle>
          <DialogDescription>
            Monitor your workflow execution in real-time
          </DialogDescription>
        </DialogHeader>

        <ExecutionMonitor
          workspaceId={workspaceId}
          workflowId={workflowId}
          executionId={executionId}
          enablePolling={true}
          onComplete={execution => {
            toast.success('Workflow completed!');
            setTimeout(() => onOpenChange(false), 2000);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 4: Embedded in Dashboard
 * Show multiple running executions in a dashboard
 */
export function ExecutionsDashboard({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const { executions } = useWorkflowExecutions(workspaceSlug, 'all', {
    status: 'running',
    limit: 5,
  });

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-xl font-semibold'>Running Executions</h2>
        <Button variant='outline' size='sm'>
          View All
        </Button>
      </div>

      {executions.length === 0 ? (
        <Card>
          <CardContent className='py-12'>
            <div className='text-center'>
              <p className='text-sm text-muted-foreground'>
                No workflows currently running
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {executions.map(execution => (
            <Card key={execution.id}>
              <CardHeader>
                <CardTitle className='text-base'>
                  Workflow: {execution.workflowId}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExecutionMonitor
                  workspaceId={workspaceSlug}
                  workflowId={execution.workflowId}
                  executionId={execution.id}
                  enablePolling={true}
                  className='border-0 p-0'
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: With Custom Actions
 * Integration with custom action buttons and notifications
 */
export function ExecutionPageWithActions({
  params,
}: WorkflowExecutionPageProps) {
  const router = useRouter();
  const { workspaceSlug, workflowId, executionId } = params;
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Export execution data
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/executions/${executionId}/export`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `execution-${executionId}.json`;
      a.click();
      toast.success('Execution data exported');
    } catch (error) {
      toast.error('Failed to export execution data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Execution URL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className='container max-w-5xl py-6 space-y-6'>
      {/* Header with Custom Actions */}
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold'>Workflow Execution</h1>
          <p className='text-sm text-muted-foreground'>ID: {executionId}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handleShare}>
            Share
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button variant='outline' size='sm' onClick={() => router.back()}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
        </div>
      </div>

      <Separator />

      {/* Execution Monitor with Custom Callbacks */}
      <ExecutionMonitor
        workspaceId={workspaceSlug}
        workflowId={workflowId}
        executionId={executionId}
        enablePolling={true}
        onComplete={execution => {
          // Custom completion handler
          toast.success('Workflow completed!', {
            description: `Completed in ${execution.duration}ms`,
            action: {
              label: 'View Results',
              onClick: () => {
                router.push(
                  `/${workspaceSlug}/workflows/${workflowId}/executions/${executionId}/results`
                );
              },
            },
          });

          // Optional: Auto-redirect after completion
          setTimeout(() => {
            router.push(`/${workspaceSlug}/workflows/${workflowId}/history`);
          }, 3000);
        }}
        onCancel={() => {
          toast.info('Execution cancelled', {
            action: {
              label: 'Undo',
              onClick: () => {
                // Implement undo logic if needed
              },
            },
          });
        }}
      />
    </div>
  );
}
