'use client';

import { Workflow as WorkflowLucideIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import {
  useWorkflows,
  useWorkflowTemplates,
  useWorkflowExecutions,
  useWorkflowBuilder,
} from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import {
  WORKFLOW_STATUS_CONFIG,
  TRIGGER_TYPE_CONFIG,
  ACTION_TYPE_CONFIG,
  EXECUTION_STATUS_CONFIG,
  TEMPLATE_CATEGORY_CONFIG,
} from '@/types/workflow';

import type {
  Workflow,
  WorkflowStatus,
  WorkflowTemplate,
  WorkflowTemplateCategory,
  CreateWorkflowInput,
  TriggerConfig,
  ActionConfig,
} from '@/types/workflow';

// =============================================================================
// Main Page Component
// =============================================================================

export default function WorkflowsPage() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;

  // State
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyWorkflowId, setHistoryWorkflowId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Hooks
  const { workflows, isLoading, error, createWorkflow, mutate } = useWorkflows(workspaceId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { templates, isLoading: templatesLoading } = useWorkflowTemplates(workspaceId);

  // Stats
  const workflowStats = useMemo(() => {
    const stats = { all: 0, active: 0, inactive: 0, draft: 0, error: 0 };
    workflows.forEach((wf) => {
      stats.all++;
      stats[wf.status]++;
    });
    return stats;
  }, [workflows]);

  // Handlers
  const handleCreateWorkflow = useCallback(
    async (input: CreateWorkflowInput) => {
      const workflow = await createWorkflow(input);
      if (workflow) {
        setShowBuilder(false);
        setShowTemplates(false);
        mutate();
      }
    },
    [createWorkflow, mutate],
  );

  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setShowBuilder(true);
  }, []);

  const handleViewHistory = useCallback((workflowId: string) => {
    setHistoryWorkflowId(workflowId);
    setShowHistory(true);
  }, []);

  const handleCloseBuilder = useCallback(() => {
    setShowBuilder(false);
    setSelectedWorkflow(null);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setShowHistory(false);
    setHistoryWorkflowId(null);
  }, []);

  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    // Create temporary workflow object from template for UI builder
    // Note: createdBy will be set by API from session when actually saved
    setSelectedWorkflow({
      id: '',
      workspaceId,
      name: template.name,
      description: template.description,
      status: 'draft',
      trigger: { ...template.trigger, type: template.trigger.type },
      actions: template.actions.map((a, i) => ({ ...a, id: `temp_${i}`, order: i })),
      variables: template.variables?.map((v) => ({ ...v, source: 'custom' as const })) ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: '', // Temporary - API sets from session.user.id on save
      runCount: 0,
      errorCount: 0,
    });
    setShowTemplates(false);
    setShowBuilder(true);
  }, [workspaceId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Automate tasks and processes with custom workflows
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <TemplateIcon className="h-4 w-4" />
            Templates
          </button>
          <button
            type="button"
            onClick={() => setShowBuilder(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            Create Workflow
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {(['all', 'active', 'inactive', 'draft'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                statusFilter === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tab === 'all' ? 'All' : WORKFLOW_STATUS_CONFIG[tab].label}
              <span
                className={cn(
                  'ml-2 rounded-full px-2 py-0.5 text-xs',
                  statusFilter === tab
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {workflowStats[tab]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertIcon className="h-5 w-5" />
            <p className="text-sm font-medium">Failed to load workflows</p>
          </div>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error.message}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkflowCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && workflows.length === 0 && (
        <EmptyState
          icon={WorkflowLucideIcon}
          title={statusFilter === 'all' ? 'No Workflows Yet' : `No ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Workflows`}
          description={
            statusFilter === 'all'
              ? 'Automate your processes by creating custom workflows. Start from scratch or choose from our templates.'
              : 'No workflows match this status. Try changing filters or create a new workflow.'
          }
          action={{
            label: 'Create Workflow',
            onClick: () => setShowBuilder(true),
          }}
          secondaryAction={
            statusFilter === 'all'
              ? {
                  label: 'Browse Templates',
                  onClick: () => setShowTemplates(true),
                  variant: 'outline' as const,
                }
              : undefined
          }
        />
      )}

      {/* Workflow Grid */}
      {!isLoading && !error && workflows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onEdit={handleEditWorkflow}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      )}

      {/* Workflow Builder Modal */}
      {showBuilder && (
        <WorkflowBuilderModal
          workflow={selectedWorkflow}
          onClose={handleCloseBuilder}
          onSave={handleCreateWorkflow}
        />
      )}

      {/* Template Selection Modal */}
      {showTemplates && (
        <TemplateSelectionModal
          templates={templates}
          isLoading={templatesLoading}
          onClose={() => setShowTemplates(false)}
          onSelect={handleSelectTemplate}
        />
      )}

      {/* Execution History Drawer */}
      {showHistory && historyWorkflowId && (
        <ExecutionHistoryDrawer
          workflowId={historyWorkflowId}
          onClose={handleCloseHistory}
        />
      )}
    </div>
  );
}

// =============================================================================
// Workflow Card Component
// =============================================================================

interface WorkflowCardProps {
  workflow: Workflow;
  onEdit: (workflow: Workflow) => void;
  onViewHistory: (workflowId: string) => void;
}

function WorkflowCard({ workflow, onEdit, onViewHistory }: WorkflowCardProps) {
  const statusConfig = WORKFLOW_STATUS_CONFIG[workflow.status];
  const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{workflow.name}</h3>
          {workflow.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {workflow.description}
            </p>
          )}
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            statusConfig.bgColor,
            statusConfig.color,
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <TriggerIcon className="h-4 w-4" />
          <span>{triggerConfig?.label ?? workflow.trigger.type}</span>
        </div>
        <div className="flex items-center gap-1">
          <ActionIcon className="h-4 w-4" />
          <span>{workflow.actions.length} actions</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {workflow.runCount} runs
          {workflow.errorCount > 0 && (
            <span className="text-red-600"> ({workflow.errorCount} errors)</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onViewHistory(workflow.id)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            History
          </button>
          <button
            type="button"
            onClick={() => onEdit(workflow)}
            className="text-xs text-primary hover:text-primary/80"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="mt-2 h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="mt-4 flex gap-4">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
      <div className="mt-3 flex justify-between border-t border-border pt-3">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
    </div>
  );
}

// =============================================================================
// Workflow Builder Modal
// =============================================================================

interface WorkflowBuilderModalProps {
  workflow: Workflow | null;
  onClose: () => void;
  onSave: (input: CreateWorkflowInput) => Promise<void>;
}

function WorkflowBuilderModal({ workflow, onClose, onSave }: WorkflowBuilderModalProps) {
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const {
    trigger,
    actions,
    variables,
    errors,
    setTrigger,
    addAction,
    updateAction,
    removeAction,
    validate,
  } = useWorkflowBuilder(workflow ?? undefined);

  const handleSave = async () => {
    if (!validate()) {
return;
}
    if (!trigger) {
return;
}
    if (!name.trim()) {
return;
}

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        actions: actions.map(({ id: _id, ...rest }) => rest),
        variables: variables.map(({ source: _source, ...rest }) => rest),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-background p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-xl font-semibold">
            {workflow?.id ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 hover:bg-accent"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label htmlFor="wf-name" className="block text-sm font-medium">
                Name
              </label>
              <input
                id="wf-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Workflow"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="wf-desc" className="block text-sm font-medium">
                Description (optional)
              </label>
              <textarea
                id="wf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this workflow does..."
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Trigger Section */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-4 font-semibold">Trigger</h3>
            {errors.trigger && (
              <p className="mb-2 text-sm text-red-600">{errors.trigger}</p>
            )}
            <TriggerSelector
              value={trigger}
              onChange={setTrigger}
            />
          </div>

          {/* Actions Section */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-4 font-semibold">Actions</h3>
            {errors.actions && (
              <p className="mb-2 text-sm text-red-600">{errors.actions}</p>
            )}
            <ActionList
              actions={actions}
              onUpdate={updateAction}
              onRemove={removeAction}
            />
            <button
              type="button"
              onClick={() =>
                addAction({
                  type: 'send_message',
                  config: { message: '' },
                })
              }
              className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
            >
              <PlusIcon className="h-4 w-4" />
              Add Action
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Trigger Selector
// =============================================================================

interface TriggerSelectorProps {
  value: TriggerConfig | null;
  onChange: (trigger: TriggerConfig) => void;
}

function TriggerSelector({ value, onChange }: TriggerSelectorProps) {
  const triggerTypes = Object.entries(TRIGGER_TYPE_CONFIG);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {triggerTypes.map(([type, config]) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange({ type: type as TriggerConfig['type'] })}
          className={cn(
            'rounded-lg border p-3 text-left transition-colors hover:border-primary',
            value?.type === type
              ? 'border-primary bg-primary/5'
              : 'border-border',
          )}
        >
          <p className="font-medium text-sm">{config.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Action List
// =============================================================================

interface ActionListProps {
  actions: ActionConfig[];
  onUpdate: (id: string, config: Partial<ActionConfig>) => void;
  onRemove: (id: string) => void;
}

function ActionList({ actions, onUpdate, onRemove }: ActionListProps) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No actions added yet. Add an action to define what happens when this workflow runs.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((action, index) => (
        <div
          key={action.id}
          className="flex items-center gap-3 rounded-lg border border-border p-3"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {index + 1}
          </span>
          <div className="flex-1">
            <select
              value={action.type}
              onChange={(e) =>
                onUpdate(action.id, {
                  type: e.target.value as ActionConfig['type'],
                  config: {},
                })
              }
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => onRemove(action.id)}
            className="text-muted-foreground hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Template Selection Modal
// =============================================================================

interface TemplateSelectionModalProps {
  templates: WorkflowTemplate[];
  isLoading: boolean;
  onClose: () => void;
  onSelect: (template: WorkflowTemplate) => void;
}

function TemplateSelectionModal({
  templates,
  isLoading,
  onClose,
  onSelect,
}: TemplateSelectionModalProps) {
  const [categoryFilter, setCategoryFilter] = useState<WorkflowTemplateCategory | 'all'>('all');

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') {
return templates;
}
    return templates.filter((t) => t.category === categoryFilter);
  }, [templates, categoryFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-xl font-semibold">Choose a Template</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 hover:bg-accent"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition-colors',
              categoryFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80',
            )}
          >
            All
          </button>
          {Object.entries(TEMPLATE_CATEGORY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key as WorkflowTemplateCategory)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                categoryFilter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80',
              )}
            >
              {config.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No templates found in this category.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template)}
                  className="rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Execution History Drawer
// =============================================================================

interface ExecutionHistoryDrawerProps {
  workflowId: string;
  onClose: () => void;
}

function ExecutionHistoryDrawer({ workflowId, onClose }: ExecutionHistoryDrawerProps) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { executions, isLoading, hasMore, loadMore, cancelExecution } =
    useWorkflowExecutions(workspaceId, workflowId, { limit: 20 });

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-xl">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold">Execution History</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 hover:bg-accent"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && executions.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No executions yet. This workflow hasn&apos;t been triggered.
          </p>
        ) : (
          <div className="space-y-3">
            {executions.map((exec) => {
              const statusConfig = EXECUTION_STATUS_CONFIG[exec.status];
              return (
                <div key={exec.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        statusConfig.bgColor,
                        statusConfig.color,
                      )}
                    >
                      {statusConfig.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(exec.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <p>
                      Actions: {exec.actionResults.filter((a) => a.status === 'completed').length}/
                      {exec.actionResults.length} completed
                    </p>
                    {exec.duration && (
                      <p className="text-muted-foreground">Duration: {exec.duration}ms</p>
                    )}
                  </div>
                  {exec.status === 'running' && (
                    <button
                      type="button"
                      onClick={() => cancelExecution(exec.id)}
                      className="mt-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  )}
                  {exec.error && (
                    <p className="mt-2 text-xs text-red-600">{exec.error}</p>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                className="w-full rounded-md border border-border py-2 text-sm hover:bg-accent"
              >
                Load More
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
