/**
 * Workflow Edit Page
 * @module app/(workspace)/[workspaceSlug]/workflows/[workflowId]/edit
 */
'use client';

import {
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle,
  Workflow as WorkflowIcon,
  Layout,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WorkflowCanvas } from '@/components/workflows/workflow-canvas';
import { WorkflowPreview } from '@/components/workflows/workflow-preview';
import { usePageHeader } from '@/contexts/page-header-context';
import { useWorkflow } from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import {
  TRIGGER_TYPE_CONFIG,
  ACTION_TYPE_CONFIG,
} from '@/types/workflow';

import type {
  ActionConfig,
  TriggerConfig,
  UpdateWorkflowInput,
  ActionId,
} from '@/types/workflow';

// =============================================================================
// Main Edit Page Component
// =============================================================================

export default function WorkflowEditPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = (params?.workspaceSlug ?? '') as string;
  const workflowId = (params?.workflowId ?? '') as string;
  const { setPageHeader } = usePageHeader();

  // Hooks
  const {
    workflow,
    isLoading: workflowLoading,
    error: workflowError,
    updateWorkflow,
  } = useWorkflow(workspaceSlug, workflowId);

  // Local state for editing
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<TriggerConfig | null>(null);
  const [actions, setActions] = useState<ActionConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'canvas'>('canvas');

  // Initialize state from workflow
  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || '');
      setTrigger(workflow.trigger);
      setActions([...workflow.actions]);
      setPageHeader('Edit Workflow', workflow.name);
    }
  }, [workflow, setPageHeader]);

  // Track changes
  useEffect(() => {
    if (!workflow) {
      return;
    }
    const changed =
      name !== workflow.name ||
      description !== (workflow.description || '') ||
      JSON.stringify(trigger) !== JSON.stringify(workflow.trigger) ||
      JSON.stringify(actions) !== JSON.stringify(workflow.actions);
    setHasChanges(changed);
  }, [name, description, trigger, actions, workflow]);

  // Handlers
  const handleSave = useCallback(async () => {
    if (!trigger) {
      setError('A trigger is required');
      return;
    }

    if (actions.length === 0) {
      setError('At least one action is required');
      return;
    }

    if (!name.trim()) {
      setError('Workflow name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData: UpdateWorkflowInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        actions: actions.map((action, index) => ({
          ...action,
          order: index,
        })),
      };

      const updated = await updateWorkflow(updateData);

      if (updated) {
        router.push(`/${workspaceSlug}/workflows/${workflowId}`);
      } else {
        setError('Failed to update workflow');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update workflow';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    description,
    trigger,
    actions,
    updateWorkflow,
    router,
    workspaceSlug,
    workflowId,
  ]);

  const handleCancel = useCallback(() => {
    if (
      hasChanges &&
      !confirm('You have unsaved changes. Are you sure you want to leave?')
    ) {
      return;
    }
    router.push(`/${workspaceSlug}/workflows/${workflowId}`);
  }, [hasChanges, router, workspaceSlug, workflowId]);

  const handleAddAction = useCallback(() => {
    const newAction: ActionConfig = {
      id: `action_${Date.now()}_${crypto.randomUUID().slice(0, 8)}` as ActionId,
      type: 'send_message',
      order: actions.length,
      config: {
        channelId: '',
        message: '',
      },
    } as ActionConfig;
    setActions([...actions, newAction]);
  }, [actions]);

  const handleRemoveAction = useCallback(
    (actionId: string) => {
      const updatedActions = actions
        .filter(a => a.id !== actionId)
        .map((a, index) => ({ ...a, order: index }));
      setActions(updatedActions);
    },
    [actions],
  );

  const handleUpdateAction = useCallback(
    (actionId: string, updates: Partial<ActionConfig>) => {
      const updatedActions = actions.map(a =>
        a.id === actionId ? ({ ...a, ...updates } as ActionConfig) : a,
      );
      setActions(updatedActions);
    },
    [actions],
  );

  const handleMoveAction = useCallback(
    (actionId: string, direction: 'up' | 'down') => {
      const index = actions.findIndex(a => a.id === actionId);
      if (index === -1) {
        return;
      }

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= actions.length) {
        return;
      }

      const reordered = [...actions];
      [reordered[index], reordered[newIndex]] = [
        reordered[newIndex],
        reordered[index],
      ];
      const withOrder = reordered.map((a, i) => ({ ...a, order: i }));
      setActions(withOrder);
    },
    [actions],
  );

  // Loading State
  if (workflowLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='h-9 w-9 animate-pulse rounded-md bg-muted' />
            <div className='h-8 w-48 animate-pulse rounded bg-muted' />
          </div>
          <div className='flex gap-2'>
            <div className='h-9 w-24 animate-pulse rounded-md bg-muted' />
            <div className='h-9 w-24 animate-pulse rounded-md bg-muted' />
          </div>
        </div>
        <div className='space-y-4'>
          <div className='h-32 animate-pulse rounded-lg bg-muted' />
          <div className='h-48 animate-pulse rounded-lg bg-muted' />
        </div>
      </div>
    );
  }

  // Error State
  if (workflowError || !workflow) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <Link
            href={`/${workspaceSlug}/workflows`}
            className='rounded-md p-2 hover:bg-accent'
            aria-label='Back to workflows list'
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <h1 className='text-2xl font-bold'>Workflow Not Found</h1>
        </div>
        <div
          className='rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20'
          role='alert'
        >
          <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
            <AlertCircle className='h-5 w-5' aria-hidden='true' />
            <p className='font-medium'>
              {workflowError?.message || 'Workflow not found'}
            </p>
          </div>
          <p className='mt-2 text-sm text-red-600 dark:text-red-300'>
            The workflow you&apos;re trying to edit doesn&apos;t exist or you
            don&apos;t have permission to edit it.
          </p>
          <Link
            href={`/${workspaceSlug}/workflows`}
            className='mt-4 inline-block text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200'
          >
            Back to Workflows
          </Link>
        </div>
      </div>
    );
  }

  // Canvas Mode - Full screen visual editor
  if (viewMode === 'canvas') {
    return (
      <div className='h-screen'>
        {error && (
          <div className='border-b border-red-200 bg-red-50 px-6 py-3 dark:border-red-800 dark:bg-red-900/20'>
            <p className='text-sm text-red-700 dark:text-red-300'>{error}</p>
          </div>
        )}
        <WorkflowCanvas
          workflow={workflow}
          onSave={async (workflowInput) => {
            setName(workflowInput.name);
            setDescription(workflowInput.description || '');
            setTrigger(workflowInput.trigger);
            setActions(workflowInput.actions as ActionConfig[]);
            await handleSave();
          }}
          onCancel={() => {
            if (
              hasChanges &&
              !confirm('You have unsaved changes. Are you sure you want to leave?')
            ) {
              return;
            }
            router.push(`/${workspaceSlug}/workflows/${workflowId}`);
          }}
          isLoading={isSaving}
        />
        {/* View Mode Toggle - Fixed position */}
        <div className='fixed bottom-6 left-6 z-50'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => setViewMode('form')}
            className='shadow-lg'
          >
            <Layout className='mr-2 h-4 w-4' />
            Switch to Form View
          </Button>
        </div>
      </div>
    );
  }

  // Preview Mode
  if (showPreview && trigger) {
    return (
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => setShowPreview(false)}
              className='rounded-md p-2 hover:bg-accent'
              aria-label='Back to editing'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <h1 className='text-2xl font-bold'>Preview Workflow</h1>
          </div>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowPreview(false)}
            >
              Back to Edit
            </Button>
            <Button
              type='button'
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className='rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'
            role='alert'
          >
            <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
              <AlertCircle className='h-4 w-4' />
              <p className='text-sm font-medium'>{error}</p>
            </div>
          </div>
        )}

        {/* Preview */}
        <WorkflowPreview
          name={name}
          description={description}
          trigger={trigger}
          actions={actions}
        />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Link
            href={`/${workspaceSlug}/workflows/${workflowId}`}
            className='rounded-md p-2 hover:bg-accent'
            aria-label='Back to workflow details'
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <h1 className='text-2xl font-bold'>Edit Workflow</h1>
          {hasChanges && (
            <span className='rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'>
              Unsaved Changes
            </span>
          )}
        </div>

        {/* Actions */}
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setViewMode('canvas')}
          >
            <WorkflowIcon className='mr-2 h-4 w-4' />
            Canvas View
          </Button>
          <Button type='button' variant='ghost' onClick={handleCancel}>
            <X className='mr-2 h-4 w-4' />
            Cancel
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => setShowPreview(true)}
            disabled={!trigger}
          >
            Preview
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            <Save className='mr-2 h-4 w-4' />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className='rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'
          role='alert'
        >
          <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
            <AlertCircle className='h-4 w-4' />
            <p className='text-sm font-medium'>{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Edit Form */}
        <div className='space-y-6 lg:col-span-2'>
          {/* Basic Info */}
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Basic Information</h2>
            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='workflow-name'
                  className='block text-sm font-medium text-foreground'
                >
                  Name *
                </label>
                <input
                  id='workflow-name'
                  type='text'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  placeholder='My Workflow'
                  required
                />
              </div>
              <div>
                <label
                  htmlFor='workflow-description'
                  className='block text-sm font-medium text-foreground'
                >
                  Description
                </label>
                <Textarea
                  id='workflow-description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className='mt-1'
                  placeholder='Describe what this workflow does...'
                />
              </div>
            </div>
          </div>

          {/* Trigger Section */}
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Trigger *</h2>
            {trigger ? (
              <TriggerEditor
                trigger={trigger}
                onChange={setTrigger}
                onRemove={() => setTrigger(null)}
              />
            ) : (
              <div className='text-center text-sm text-muted-foreground'>
                <p>No trigger configured</p>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  onClick={() =>
                    setTrigger({
                      type: 'message',
                      message: { channelIds: [], userIds: [] },
                    })
                  }
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Add Trigger
                </Button>
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className='rounded-lg border bg-card p-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-semibold'>
                Actions * ({actions.length})
              </h2>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleAddAction}
              >
                <Plus className='mr-2 h-4 w-4' />
                Add Action
              </Button>
            </div>

            {actions.length === 0 ? (
              <div className='py-8 text-center text-sm text-muted-foreground'>
                <p>No actions configured yet.</p>
                <p className='mt-1'>Add at least one action to continue.</p>
              </div>
            ) : (
              <div className='space-y-3'>
                {actions.map((action, index) => (
                  <ActionEditor
                    key={action.id}
                    action={action}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === actions.length - 1}
                    onUpdate={updates => handleUpdateAction(action.id, updates)}
                    onRemove={() => handleRemoveAction(action.id)}
                    onMoveUp={() => handleMoveAction(action.id, 'up')}
                    onMoveDown={() => handleMoveAction(action.id, 'down')}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Help & Tips */}
        <div className='space-y-6'>
          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Quick Tips</h2>
            <div className='space-y-3 text-sm'>
              <div className='flex items-start gap-2'>
                <CheckCircle className='mt-0.5 h-4 w-4 shrink-0 text-green-600' />
                <p className='text-muted-foreground'>
                  Use the preview button to see how your workflow will look
                </p>
              </div>
              <div className='flex items-start gap-2'>
                <CheckCircle className='mt-0.5 h-4 w-4 shrink-0 text-green-600' />
                <p className='text-muted-foreground'>
                  Actions execute in order from top to bottom
                </p>
              </div>
              <div className='flex items-start gap-2'>
                <CheckCircle className='mt-0.5 h-4 w-4 shrink-0 text-green-600' />
                <p className='text-muted-foreground'>
                  Configure error handling for critical actions
                </p>
              </div>
              <div className='flex items-start gap-2'>
                <CheckCircle className='mt-0.5 h-4 w-4 shrink-0 text-green-600' />
                <p className='text-muted-foreground'>
                  Test your workflow after making changes
                </p>
              </div>
            </div>
          </div>

          <div className='rounded-lg border bg-card p-6'>
            <h2 className='mb-4 text-lg font-semibold'>Original Workflow</h2>
            <div className='space-y-3 text-sm'>
              <div>
                <p className='text-muted-foreground'>Created</p>
                <p className='font-medium'>
                  {new Date(workflow.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Last Updated</p>
                <p className='font-medium'>
                  {new Date(workflow.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className='text-muted-foreground'>Status</p>
                <p className='font-medium capitalize'>{workflow.status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Trigger Editor Component
// =============================================================================

interface TriggerEditorProps {
  trigger: TriggerConfig;
  onChange: (trigger: TriggerConfig) => void;
  onRemove: () => void;
}

function TriggerEditor({ trigger, onChange, onRemove }: TriggerEditorProps) {
  const triggerConfig = TRIGGER_TYPE_CONFIG[trigger.type];

  return (
    <div className='rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20'>
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='rounded-md bg-blue-500/20 p-2'>
            <TriggerIcon className='h-5 w-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <h3 className='font-medium'>{triggerConfig.label}</h3>
            <p className='text-sm text-muted-foreground'>
              {triggerConfig.description}
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={onRemove}
          className='rounded-md p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
          aria-label='Remove trigger'
        >
          <Trash2 className='h-4 w-4' />
        </button>
      </div>

      {/* Trigger type selector */}
      <div className='mt-4'>
        <label className='block text-sm font-medium text-foreground'>
          Trigger Type
        </label>
        <select
          value={trigger.type}
          onChange={e => {
            const newType = e.target.value as TriggerConfig['type'];
            // Create a new trigger config based on type
            let newTrigger: TriggerConfig;
            switch (newType) {
              case 'schedule':
                newTrigger = {
                  type: 'schedule',
                  schedule: { cron: '0 9 * * *' },
                };
                break;
              case 'message':
                newTrigger = {
                  type: 'message',
                  message: { channelIds: [], userIds: [] },
                };
                break;
              case 'keyword':
                newTrigger = {
                  type: 'keyword',
                  keyword: { keywords: [], matchType: 'contains' },
                };
                break;
              case 'webhook':
                newTrigger = { type: 'webhook', webhook: {} };
                break;
              default:
                newTrigger = { type: newType } as TriggerConfig;
            }
            onChange(newTrigger);
          }}
          className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
        >
          {Object.entries(TRIGGER_TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// =============================================================================
// Action Editor Component
// =============================================================================

interface ActionEditorProps {
  action: ActionConfig;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updates: Partial<ActionConfig>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ActionEditor({
  action,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ActionEditorProps) {
  const actionConfig = ACTION_TYPE_CONFIG[action.type];

  return (
    <div className='rounded-lg border border-border bg-muted/50 p-4'>
      <div className='flex items-start gap-3'>
        {/* Order controls */}
        <div className='flex flex-col gap-1'>
          <button
            type='button'
            onClick={onMoveUp}
            disabled={isFirst}
            className='rounded p-1 hover:bg-accent disabled:opacity-30'
            aria-label='Move up'
          >
            <GripVertical className='h-4 w-4' />
          </button>
          <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground'>
            {index + 1}
          </span>
          <button
            type='button'
            onClick={onMoveDown}
            disabled={isLast}
            className='rounded p-1 hover:bg-accent disabled:opacity-30'
            aria-label='Move down'
          >
            <GripVertical className='h-4 w-4' />
          </button>
        </div>

        {/* Action content */}
        <div className='flex-1 space-y-3'>
          <div className='flex items-center justify-between'>
            <h3 className='font-medium'>{actionConfig.label}</h3>
            <button
              type='button'
              onClick={onRemove}
              className='rounded-md p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
              aria-label='Remove action'
            >
              <Trash2 className='h-4 w-4' />
            </button>
          </div>

          {/* Action type selector */}
          <div>
            <label className='block text-xs font-medium text-muted-foreground'>
              Action Type
            </label>
            <select
              value={action.type}
              onChange={e => {
                const newType = e.target.value as ActionConfig['type'];
                // Create default config based on action type
                let defaultConfig: Record<string, unknown> = {};
                if (newType === 'send_message') {
                  defaultConfig = { channelId: '', message: '' };
                } else if (newType === 'send_dm') {
                  defaultConfig = { userId: '', message: '' };
                } else if (newType === 'create_channel') {
                  defaultConfig = { channelName: '', channelType: 'public' };
                } else if (newType === 'http_request') {
                  defaultConfig = { url: '', method: 'GET' };
                }
                onUpdate({ type: newType, config: defaultConfig } as Partial<ActionConfig>);
              }}
              className='mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            >
              {Object.entries(ACTION_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Simple config display - In a real implementation, this would be type-specific editors */}
          <div className='rounded-md bg-background/50 p-3'>
            <p className='text-xs text-muted-foreground'>
              {actionConfig.description}
            </p>
            <p className='mt-2 text-xs italic text-muted-foreground'>
              Configuration details: {JSON.stringify(action.config).slice(0, 100)}
              {JSON.stringify(action.config).length > 100 ? '...' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2' />
    </svg>
  );
}
