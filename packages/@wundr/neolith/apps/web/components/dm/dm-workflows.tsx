'use client';

import { format } from 'date-fns';
import {
  Play,
  Pause,
  Clock,
  MessageSquare,
  Bell,
  Zap,
  ChevronRight,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Workflow, WorkflowExecution } from '@/types/workflow';

interface DMWorkflowsProps {
  channelId: string;
  workspaceSlug: string;
  currentUserId: string;
}

const triggerIcons = {
  schedule: Clock,
  message: MessageSquare,
  keyword: MessageSquare,
  channel_join: Bell,
  channel_leave: Bell,
  user_join: Bell,
  reaction: Bell,
  mention: Bell,
  webhook: Zap,
};

const statusConfig = {
  active: {
    label: 'Active',
    color:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
  },
  draft: {
    label: 'Draft',
    color:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  error: {
    label: 'Error',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

export function DMWorkflowsTab({
  channelId,
  workspaceSlug,
  currentUserId,
}: DMWorkflowsProps) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [reminderText, setReminderText] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load workflows related to this DM
  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows?search=${channelId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }

      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, [channelId, workspaceSlug]);

  // Load recent workflow executions
  const loadExecutions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows/executions?channelId=${channelId}&limit=5`
      );

      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  }, [channelId, workspaceSlug]);

  useEffect(() => {
    loadWorkflows();
    loadExecutions();
  }, [loadWorkflows, loadExecutions]);

  // Toggle workflow active/inactive
  const handleToggleWorkflow = async (
    workflowId: string,
    currentStatus: string
  ) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows/${workflowId}/${action}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} workflow`);
      }

      setWorkflows(prev =>
        prev.map(w =>
          w.id === workflowId ? { ...w, status: newStatus as any } : w
        )
      );
      toast.success(
        `Workflow ${newStatus === 'active' ? 'activated' : 'deactivated'}`
      );
    } catch (error) {
      console.error(`Failed to ${action} workflow:`, error);
      toast.error(`Failed to ${action} workflow`);
    }
  };

  // Create a simple reminder workflow
  const handleCreateReminder = async () => {
    if (!reminderText.trim()) {
      toast.error('Please enter reminder text');
      return;
    }

    try {
      setIsCreating(true);

      let workflowData: any;

      if (selectedTemplate === 'reminder') {
        workflowData = {
          name: `Reminder: ${reminderText}`,
          description: 'Simple reminder workflow',
          trigger: {
            type: 'schedule',
            schedule: {
              cron: '0 9 * * *', // Daily at 9 AM
            },
          },
          actions: [
            {
              type: 'send_message',
              order: 1,
              config: {
                channelId,
                message: `Reminder: ${reminderText}`,
              },
            },
          ],
          status: 'DRAFT',
        };
      } else if (selectedTemplate === 'keyword') {
        workflowData = {
          name: `Keyword Alert: ${reminderText}`,
          description: 'Alert when keyword is mentioned',
          trigger: {
            type: 'keyword',
            keyword: {
              keywords: [reminderText],
              matchType: 'contains',
            },
          },
          actions: [
            {
              type: 'send_dm',
              order: 1,
              config: {
                userId: currentUserId,
                message: `Keyword "${reminderText}" was mentioned in the conversation`,
              },
            },
          ],
          status: 'DRAFT',
        };
      }

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflowData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create workflow');
      }

      const { workflow } = await response.json();
      setWorkflows(prev => [workflow, ...prev]);
      setIsDialogOpen(false);
      setReminderText('');
      setSelectedTemplate('');
      toast.success('Workflow created successfully');
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast.error('Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };

  // Navigate to workflow builder
  const handleOpenWorkflowBuilder = () => {
    router.push(`/${workspaceSlug}/workflows/new?channelId=${channelId}`);
  };

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col p-4'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='font-semibold text-lg'>Workflows</h2>
        <div className='flex gap-2'>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size='sm' variant='outline'>
                <Plus className='mr-2 h-4 w-4' />
                Quick Workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Quick Workflow</DialogTitle>
              </DialogHeader>
              <div className='space-y-4 py-4'>
                <div className='space-y-2'>
                  <Label htmlFor='template'>Template</Label>
                  <Select
                    value={selectedTemplate}
                    onValueChange={setSelectedTemplate}
                  >
                    <SelectTrigger id='template'>
                      <SelectValue placeholder='Select a template...' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='reminder'>Daily Reminder</SelectItem>
                      <SelectItem value='keyword'>Keyword Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedTemplate && (
                  <div className='space-y-2'>
                    <Label htmlFor='reminder-text'>
                      {selectedTemplate === 'reminder'
                        ? 'Reminder Message'
                        : 'Keyword to Watch'}
                    </Label>
                    <Input
                      id='reminder-text'
                      placeholder={
                        selectedTemplate === 'reminder'
                          ? 'Enter reminder message...'
                          : 'Enter keyword...'
                      }
                      value={reminderText}
                      onChange={e => setReminderText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleCreateReminder();
                        }
                      }}
                    />
                  </div>
                )}
                <Button
                  onClick={handleCreateReminder}
                  disabled={
                    isCreating || !selectedTemplate || !reminderText.trim()
                  }
                  className='w-full'
                >
                  {isCreating ? 'Creating...' : 'Create Workflow'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size='sm' onClick={handleOpenWorkflowBuilder}>
            <ExternalLink className='mr-2 h-4 w-4' />
            Open Builder
          </Button>
        </div>
      </div>

      <div className='flex-1 space-y-6 overflow-y-auto'>
        {/* Active Workflows */}
        {workflows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                Active Workflows (
                {workflows.filter(w => w.status === 'active').length})
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {workflows.map(workflow => {
                const TriggerIcon =
                  triggerIcons[
                    workflow.trigger.type as keyof typeof triggerIcons
                  ] || Zap;

                return (
                  <div
                    key={workflow.id}
                    className='flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50'
                  >
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10'>
                      <TriggerIcon className='h-4 w-4 text-primary' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex-1 min-w-0'>
                          <p className='font-medium text-sm'>{workflow.name}</p>
                          {workflow.description && (
                            <p className='mt-1 text-muted-foreground text-xs'>
                              {workflow.description}
                            </p>
                          )}
                        </div>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() =>
                            handleToggleWorkflow(workflow.id, workflow.status)
                          }
                          className='h-8 w-8 p-0'
                        >
                          {workflow.status === 'active' ? (
                            <Pause className='h-4 w-4' />
                          ) : (
                            <Play className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                      <div className='mt-2 flex flex-wrap items-center gap-2'>
                        <Badge
                          className={
                            statusConfig[
                              workflow.status as keyof typeof statusConfig
                            ]?.color || statusConfig.draft.color
                          }
                        >
                          {statusConfig[
                            workflow.status as keyof typeof statusConfig
                          ]?.label || 'Draft'}
                        </Badge>
                        <span className='text-muted-foreground text-xs'>
                          {workflow.actions.length}{' '}
                          {workflow.actions.length === 1 ? 'action' : 'actions'}
                        </span>
                        {workflow.lastRunAt && (
                          <span className='text-muted-foreground text-xs'>
                            Last run:{' '}
                            {format(
                              new Date(workflow.lastRunAt),
                              'MMM d, h:mm a'
                            )}
                          </span>
                        )}
                        {workflow.runCount > 0 && (
                          <span className='text-muted-foreground text-xs'>
                            {workflow.runCount}{' '}
                            {workflow.runCount === 1 ? 'run' : 'runs'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Executions */}
        {executions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {executions.map(execution => {
                const workflow = workflows.find(
                  w => w.id === execution.workflowId
                );

                const executionStatusConfig = {
                  pending: {
                    label: 'Pending',
                    color: 'bg-blue-100 text-blue-700',
                  },
                  running: {
                    label: 'Running',
                    color: 'bg-indigo-100 text-indigo-700',
                  },
                  completed: {
                    label: 'Completed',
                    color: 'bg-green-100 text-green-700',
                  },
                  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
                  cancelled: {
                    label: 'Cancelled',
                    color: 'bg-gray-100 text-gray-700',
                  },
                };

                return (
                  <div
                    key={execution.id}
                    className='flex items-center gap-3 rounded-md border p-3'
                  >
                    <ChevronRight className='h-4 w-4 text-muted-foreground' />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-sm'>
                        {workflow?.name || 'Unknown Workflow'}
                      </p>
                      <div className='mt-1 flex items-center gap-2'>
                        <Badge
                          className={
                            executionStatusConfig[execution.status].color
                          }
                        >
                          {executionStatusConfig[execution.status].label}
                        </Badge>
                        <span className='text-muted-foreground text-xs'>
                          {format(
                            new Date(execution.startedAt),
                            'MMM d, h:mm a'
                          )}
                        </span>
                        {execution.duration && (
                          <span className='text-muted-foreground text-xs'>
                            {(execution.duration / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {workflows.length === 0 && (
          <Card className='p-12 text-center'>
            <Zap className='mx-auto mb-4 h-12 w-12 text-muted-foreground' />
            <h3 className='mb-2 font-semibold text-lg'>No workflows yet</h3>
            <p className='mb-4 text-muted-foreground text-sm'>
              Create automated workflows to streamline your conversations
            </p>
            <div className='flex justify-center gap-2'>
              <Button onClick={() => setIsDialogOpen(true)}>
                Create Quick Workflow
              </Button>
              <Button variant='outline' onClick={handleOpenWorkflowBuilder}>
                Open Workflow Builder
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
