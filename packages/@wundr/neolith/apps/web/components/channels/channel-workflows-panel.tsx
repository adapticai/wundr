'use client';

import { useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { WORKFLOW_STATUS_CONFIG, TRIGGER_TYPE_CONFIG } from '@/types/workflow';
import { useWorkflows, useWorkflow, useWorkflowExecutions } from '@/hooks/use-workflows';
import { ExecutionHistory } from '@/components/workflows/execution-history';

import type { Workflow, TriggerConfig, CreateWorkflowInput, WorkflowExecution } from '@/types/workflow';

export interface ChannelWorkflowsPanelProps {
  channelId: string;
  channelName: string;
  workspaceId: string;
  className?: string;
}

type QuickWorkflowType = 'notify_on_mention' | 'auto_reply' | 'reaction_trigger';

const CHANNEL_TRIGGER_TYPES = ['message', 'reaction', 'mention'] as const;

const QUICK_WORKFLOW_TEMPLATES = {
  notify_on_mention: {
    name: 'Notify on @channel',
    description: 'Send notification when someone uses @channel mention',
    icon: 'bell',
  },
  auto_reply: {
    name: 'Auto-reply to Keywords',
    description: 'Automatically reply when specific keywords are detected',
    icon: 'message',
  },
  reaction_trigger: {
    name: 'Reaction Alert',
    description: 'Trigger action when specific reaction is added',
    icon: 'smile',
  },
} as const;

export function ChannelWorkflowsPanel({
  channelId,
  channelName,
  workspaceId,
  className,
}: ChannelWorkflowsPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // Fetch all workflows for this workspace
  const { workflows, isLoading: isLoadingWorkflows, mutate } = useWorkflows(workspaceId);

  // Filter workflows that are associated with this channel
  const channelWorkflows = useMemo(() => {
    return workflows.filter(workflow => {
      const trigger = workflow.trigger;

      // Check if trigger is channel-specific
      if (trigger.type === 'message' && 'message' in trigger) {
        const channelIds = trigger.message?.channelIds;
        return channelIds?.includes(channelId);
      }

      if (trigger.type === 'reaction' && 'reaction' in trigger) {
        const channelIds = trigger.reaction?.channelIds;
        return channelIds?.includes(channelId);
      }

      if (trigger.type === 'mention' && 'mention' in trigger) {
        // Mentions can be workspace-wide or channel-specific
        // For now, show all mention workflows as they could apply
        return true;
      }

      return false;
    });
  }, [workflows, channelId]);

  // Fetch execution history for selected workflow
  const { executions, isLoading: isLoadingExecutions } = useWorkflowExecutions(
    workspaceId,
    selectedWorkflowId || '',
    { limit: 10 }
  );

  const handleToggleWorkflow = useCallback(async (workflow: Workflow) => {
    const { workflow: updatedWorkflow, activateWorkflow, deactivateWorkflow } = useWorkflow(
      workspaceId,
      workflow.id
    );

    if (workflow.status === 'active') {
      await deactivateWorkflow();
    } else {
      await activateWorkflow();
    }

    mutate();
  }, [workspaceId, mutate]);

  const handleCreateQuickWorkflow = useCallback(async (type: QuickWorkflowType) => {
    let workflowInput: CreateWorkflowInput | null = null;

    switch (type) {
      case 'notify_on_mention':
        workflowInput = {
          name: `Notify on @channel in #${channelName}`,
          description: 'Send notification when @channel is mentioned',
          trigger: {
            type: 'mention',
            mention: {
              orchestratorIds: [],
            },
          } as TriggerConfig,
          actions: [
            {
              type: 'send_message',
              order: 0,
              config: {
                channelId: channelId,
                message: '@channel was mentioned by {{trigger.user.name}}',
              },
            },
          ],
        };
        break;

      case 'auto_reply':
        workflowInput = {
          name: `Auto-reply in #${channelName}`,
          description: 'Automatically reply to messages with specific keywords',
          trigger: {
            type: 'keyword',
            keyword: {
              keywords: ['help', 'support'],
              matchType: 'contains',
            },
          } as TriggerConfig,
          actions: [
            {
              type: 'send_message',
              order: 0,
              config: {
                channelId: channelId,
                message: 'Thanks for reaching out! Someone will assist you shortly.',
              },
            },
          ],
        };
        break;

      case 'reaction_trigger':
        workflowInput = {
          name: `Reaction alert in #${channelName}`,
          description: 'Trigger action when specific reaction is added',
          trigger: {
            type: 'reaction',
            reaction: {
              emoji: '🚨',
              channelIds: [channelId],
            },
          } as TriggerConfig,
          actions: [
            {
              type: 'send_message',
              order: 0,
              config: {
                channelId: channelId,
                message: 'Alert: {{trigger.message.content}} was marked with 🚨',
              },
            },
          ],
        };
        break;
    }

    if (workflowInput) {
      // Navigate to workflow builder with pre-filled data
      router.push(`/${workspaceId}/workflows/new?template=${type}&channelId=${channelId}`);
    }

    setShowQuickCreate(false);
  }, [channelId, channelName, workspaceId, router]);

  const handleViewFullBuilder = useCallback(() => {
    router.push(`/${workspaceId}/workflows/new?channelId=${channelId}`);
  }, [workspaceId, channelId, router]);

  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    router.push(`/${workspaceId}/workflows/${workflow.id}/edit`);
  }, [workspaceId, router]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div>
          <h2 className='font-semibold text-foreground'>Channel Workflows</h2>
          <p className='text-xs text-muted-foreground'>
            Automate actions in #{channelName}
          </p>
        </div>
        <button
          type='button'
          onClick={() => setShowQuickCreate(!showQuickCreate)}
          className='rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <PlusIcon className='mr-1.5 inline h-4 w-4' />
          New Workflow
        </button>
      </div>

      {/* Tabs */}
      <div className='flex border-b'>
        <button
          type='button'
          onClick={() => setActiveTab('active')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'active'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Active Workflows ({channelWorkflows.filter(w => w.status === 'active').length})
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'history'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Execution History
        </button>
      </div>

      {/* Quick Create Modal */}
      {showQuickCreate && (
        <div className='border-b bg-muted/30 p-4'>
          <h3 className='mb-3 text-sm font-medium text-foreground'>
            Quick Create Workflow
          </h3>
          <div className='space-y-2'>
            {Object.entries(QUICK_WORKFLOW_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                type='button'
                onClick={() => handleCreateQuickWorkflow(key as QuickWorkflowType)}
                className='flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent'
              >
                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
                  <TemplateIcon type={template.icon} className='h-4 w-4 text-primary' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium text-foreground'>{template.name}</p>
                  <p className='text-xs text-muted-foreground'>{template.description}</p>
                </div>
                <ChevronRightIcon className='h-5 w-5 shrink-0 text-muted-foreground' />
              </button>
            ))}
            <button
              type='button'
              onClick={handleViewFullBuilder}
              className='flex w-full items-center justify-center gap-2 rounded-md border border-dashed bg-background p-3 text-sm font-medium text-primary transition-colors hover:bg-accent'
            >
              <SettingsIcon className='h-4 w-4' />
              Use Full Workflow Builder
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4'>
        {activeTab === 'active' && (
          <div className='space-y-3'>
            {isLoadingWorkflows ? (
              // Loading skeleton
              <div className='space-y-3'>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className='h-24 animate-pulse rounded-lg bg-muted' />
                ))}
              </div>
            ) : channelWorkflows.length === 0 ? (
              // Empty state
              <div className='flex flex-col items-center justify-center py-12'>
                <WorkflowEmptyIcon className='h-12 w-12 text-muted-foreground' />
                <h3 className='mt-4 text-sm font-semibold text-foreground'>
                  No workflows configured
                </h3>
                <p className='mt-2 max-w-sm text-center text-xs text-muted-foreground'>
                  Create your first workflow to automate actions in this channel.
                </p>
                <button
                  type='button'
                  onClick={() => setShowQuickCreate(true)}
                  className='mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                >
                  Create Workflow
                </button>
              </div>
            ) : (
              // Workflow list
              channelWorkflows.map(workflow => (
                <WorkflowListItem
                  key={workflow.id}
                  workflow={workflow}
                  onToggle={() => handleToggleWorkflow(workflow)}
                  onEdit={() => handleEditWorkflow(workflow)}
                  onViewHistory={() => {
                    setSelectedWorkflowId(workflow.id);
                    setActiveTab('history');
                  }}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className='space-y-4'>
            {selectedWorkflowId ? (
              <>
                <div className='flex items-center justify-between'>
                  <button
                    type='button'
                    onClick={() => setSelectedWorkflowId(null)}
                    className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
                  >
                    <ChevronLeftIcon className='h-4 w-4' />
                    Back to all workflows
                  </button>
                </div>
                <ExecutionHistory
                  executions={executions}
                  isLoading={isLoadingExecutions}
                />
              </>
            ) : (
              <div className='space-y-3'>
                <p className='text-sm text-muted-foreground'>
                  Select a workflow to view its execution history
                </p>
                {channelWorkflows.map(workflow => (
                  <button
                    key={workflow.id}
                    type='button'
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    className='flex w-full items-center justify-between rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent'
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium text-foreground'>
                        {workflow.name}
                      </p>
                      <p className='mt-0.5 text-xs text-muted-foreground'>
                        {workflow.runCount} executions • Last run:{' '}
                        {workflow.lastRunAt
                          ? new Date(workflow.lastRunAt).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                    <ChevronRightIcon className='h-5 w-5 shrink-0 text-muted-foreground' />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkflowListItemProps {
  workflow: Workflow;
  onToggle: () => void;
  onEdit: () => void;
  onViewHistory: () => void;
}

function WorkflowListItem({
  workflow,
  onToggle,
  onEdit,
  onViewHistory,
}: WorkflowListItemProps) {
  const [isToggling, setIsToggling] = useState(false);
  const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggle();
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className='rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm'>
      <div className='flex items-start justify-between'>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <h3 className='truncate text-sm font-semibold text-foreground'>
              {workflow.name}
            </h3>
            <WorkflowStatusBadge status={workflow.status} />
          </div>
          {workflow.description && (
            <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
              {workflow.description}
            </p>
          )}
          <div className='mt-2 flex items-center gap-3 text-xs text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <TriggerIcon type={workflow.trigger.type} className='h-3.5 w-3.5' />
              {triggerConfig.label}
            </span>
            <span>•</span>
            <span>{workflow.actions.length} actions</span>
            {workflow.runCount > 0 && (
              <>
                <span>•</span>
                <span>{workflow.runCount} runs</span>
              </>
            )}
          </div>
        </div>

        {/* Toggle Switch */}
        <div className='ml-4 flex shrink-0 items-center gap-2'>
          <button
            type='button'
            role='switch'
            aria-checked={workflow.status === 'active'}
            onClick={handleToggle}
            disabled={isToggling || workflow.status === 'draft'}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              workflow.status === 'active' ? 'bg-primary' : 'bg-muted',
              (isToggling || workflow.status === 'draft') && 'cursor-not-allowed opacity-50'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform',
                workflow.status === 'active' ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className='mt-3 flex items-center gap-2 border-t pt-3'>
        <button
          type='button'
          onClick={onEdit}
          className='flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent'
        >
          <EditIcon className='h-3.5 w-3.5' />
          Edit
        </button>
        <button
          type='button'
          onClick={onViewHistory}
          className='flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent'
        >
          <HistoryIcon className='h-3.5 w-3.5' />
          History
        </button>
        {workflow.errorCount > 0 && (
          <span className='ml-auto flex items-center gap-1 text-xs text-destructive'>
            <ErrorIcon className='h-3.5 w-3.5' />
            {workflow.errorCount} errors
          </span>
        )}
      </div>
    </div>
  );
}

interface WorkflowStatusBadgeProps {
  status: Workflow['status'];
}

function WorkflowStatusBadge({ status }: WorkflowStatusBadgeProps) {
  const config = WORKFLOW_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color
      )}
    >
      {status === 'active' && (
        <span className='relative flex h-2 w-2'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-emerald-500' />
        </span>
      )}
      {config.label}
    </span>
  );
}

interface TriggerIconProps {
  type: string;
  className?: string;
}

function TriggerIcon({ type, className }: TriggerIconProps) {
  const icons: Record<string, React.ReactNode> = {
    message: (
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
        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
      </svg>
    ),
    reaction: (
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
        <circle cx='12' cy='12' r='10' />
        <path d='M8 14s1.5 2 4 2 4-2 4-2' />
        <line x1='9' y1='9' x2='9.01' y2='9' />
        <line x1='15' y1='9' x2='15.01' y2='9' />
      </svg>
    ),
    mention: (
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
        <circle cx='12' cy='12' r='4' />
        <path d='M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94' />
      </svg>
    ),
    keyword: (
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
        <path d='M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z' />
        <path d='M7 7h.01' />
      </svg>
    ),
  };

  return <>{icons[type] || icons.message}</>;
}

interface TemplateIconProps {
  type: string;
  className?: string;
}

function TemplateIcon({ type, className }: TemplateIconProps) {
  const icons: Record<string, React.ReactNode> = {
    bell: (
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
        <path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
        <path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
      </svg>
    ),
    message: (
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
        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
      </svg>
    ),
    smile: (
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
        <circle cx='12' cy='12' r='10' />
        <path d='M8 14s1.5 2 4 2 4-2 4-2' />
        <line x1='9' y1='9' x2='9.01' y2='9' />
        <line x1='15' y1='9' x2='15.01' y2='9' />
      </svg>
    ),
  };

  return <>{icons[type] || icons.bell}</>;
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

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d='m9 18 6-6-6-6' />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
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
      <path d='m15 18-6-6 6-6' />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
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
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
      <circle cx='12' cy='12' r='3' />
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
      <path d='m15 5 4 4' />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='10' />
      <line x1='12' y1='8' x2='12' y2='12' />
      <line x1='12' y1='16' x2='12.01' y2='16' />
    </svg>
  );
}

function WorkflowEmptyIcon({ className }: { className?: string }) {
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
      <path d='M3 3v18h18' />
      <path d='m19 9-5 5-4-4-3 3' />
    </svg>
  );
}
