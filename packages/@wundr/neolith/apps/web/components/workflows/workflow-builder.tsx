'use client';

import { useState, useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { useWorkflowBuilder } from '@/hooks/use-workflows';

import { ActionConfigPanel } from './action-config';
import { TriggerConfigPanel } from './trigger-config';
import { VariableInserter } from './variable-inserter';

import type {
  Workflow,
  TriggerConfig,
  ActionConfig,
  WorkflowVariable,
} from '@/types/workflow';

export interface WorkflowBuilderProps {
  workflow?: Partial<Workflow>;
  onSave: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'runCount' | 'errorCount'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

type BuilderMode = 'edit' | 'preview' | 'test';

export function WorkflowBuilder({
  workflow,
  onSave,
  onCancel,
  isLoading = false,
  className,
}: WorkflowBuilderProps) {
  // Use the useWorkflowBuilder hook for state management
  const {
    trigger,
    actions,
    variables,
    errors: builderErrors,
    setTrigger,
    addAction,
    updateAction,
    removeAction,
    reorderActions,
    validate,
    reset,
  } = useWorkflowBuilder(workflow);

  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [mode, setMode] = useState<BuilderMode>('edit');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showVariableInserter, setShowVariableInserter] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Combine form errors and builder errors
  const errors = { ...formErrors, ...builderErrors };

  // Reset builder when workflow changes
  useEffect(() => {
    if (workflow) {
      reset(workflow);
      setName(workflow.name || '');
      setDescription(workflow.description || '');
    }
  }, [workflow, reset]);

  // Get available variables from trigger
  const availableVariables = getAvailableVariables(trigger || { type: 'message' }, actions);

  const handleAddAction = useCallback(() => {
    addAction({
      type: 'send_message',
      config: {},
    });
  }, [addAction]);

  // Auto-select newly added action
  useEffect(() => {
    if (actions.length > 0 && !selectedActionId) {
      const lastAction = actions[actions.length - 1];
      setSelectedActionId(lastAction.id);
    }
  }, [actions.length]);

  const handleUpdateAction = useCallback((actionId: string, updates: Partial<ActionConfig>) => {
    updateAction(actionId, updates);
  }, [updateAction]);

  const handleDeleteAction = useCallback((actionId: string) => {
    removeAction(actionId);
    if (selectedActionId === actionId) {
      setSelectedActionId(null);
    }
  }, [removeAction, selectedActionId]);

  const handleReorderActions = useCallback((fromIndex: number, toIndex: number) => {
    const newActions = [...actions];
    const [moved] = newActions.splice(fromIndex, 1);
    newActions.splice(toIndex, 0, moved);
    // Update order property for all actions
    const reorderedActions = newActions.map((action, index) => ({
      ...action,
      order: index
    }));
    reorderActions(reorderedActions);
  }, [actions, reorderActions]);

  const handleSave = useCallback(() => {
    // Validate workflow name
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    setFormErrors(newErrors);

    // Validate using the hook's validate method
    if (!validate()) {
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Ensure trigger exists
    if (!trigger) {
      setFormErrors({ trigger: 'A trigger is required' });
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      status: workflow?.status || 'draft',
      workspaceId: workflow?.workspaceId || '',
      trigger,
      actions,
      variables: variables.length > 0 ? variables : undefined,
    });
  }, [name, description, trigger, actions, variables, workflow, onSave, validate]);

  const handleInsertVariable = useCallback((variableName: string) => {
    // This would be used when a text field is focused
    const textToCopy = `{{${variableName}}}`;
    navigator.clipboard.writeText(textToCopy);
    setShowVariableInserter(false);
  }, []);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">
            {workflow?.id ? 'Edit Workflow' : 'Create Workflow'}
          </h1>
          <div className="flex rounded-md border border-input">
            {(['edit', 'preview', 'test'] as BuilderMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading && <LoadingSpinner className="h-4 w-4" />}
            Save Workflow
          </button>
        </div>
      </div>

      {mode === 'edit' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Main Builder Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Workflow Info */}
            <div className="mb-6 space-y-4 rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Workflow Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="workflow-name"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="workflow-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    placeholder="Enter workflow name"
                    className={cn(
                      'w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                      errors.name ? 'border-red-500' : 'border-input',
                    )}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="workflow-description"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Description
                  </label>
                  <input
                    id="workflow-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter workflow description"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Trigger Section */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Trigger</h2>
                <button
                  type="button"
                  onClick={() => setShowVariableInserter(!showVariableInserter)}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <VariableIcon className="h-4 w-4" />
                  Variables
                </button>
              </div>
              <TriggerConfigPanel
                trigger={trigger || { type: 'message' }}
                onChange={setTrigger}
              />
            </div>

            {/* Flow Arrow */}
            <div className="mb-6 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="h-8 w-0.5 bg-border" />
                <ArrowDownIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            {/* Actions Section */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Actions
                  {errors.actions && (
                    <span className="ml-2 text-xs text-red-500">{errors.actions}</span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={handleAddAction}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Action
                </button>
              </div>

              {actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-8">
                  <ActionEmptyIcon className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No actions yet. Add an action to define what happens when the trigger fires.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAction}
                    className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add First Action
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {actions.map((action, index) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      index={index}
                      isSelected={selectedActionId === action.id}
                      onSelect={() => setSelectedActionId(action.id)}
                      onUpdate={(updates) => handleUpdateAction(action.id, updates)}
                      onDelete={() => handleDeleteAction(action.id)}
                      onMoveUp={() => index > 0 && handleReorderActions(index, index - 1)}
                      onMoveDown={() =>
                        index < actions.length - 1 && handleReorderActions(index, index + 1)
                      }
                      canMoveUp={index > 0}
                      canMoveDown={index < actions.length - 1}
                      availableVariables={availableVariables}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Action Config */}
          {selectedActionId && (
            <div className="w-96 shrink-0 overflow-auto border-l bg-muted/30 p-4">
              <ActionConfigPanel
                action={actions.find((a) => a.id === selectedActionId)!}
                onChange={(updates) => handleUpdateAction(selectedActionId, updates)}
                availableVariables={availableVariables}
                onClose={() => setSelectedActionId(null)}
              />
            </div>
          )}

          {/* Variable Inserter Sidebar */}
          {showVariableInserter && !selectedActionId && (
            <div className="w-80 shrink-0 overflow-auto border-l bg-muted/30 p-4">
              <VariableInserter
                variables={availableVariables}
                onInsert={handleInsertVariable}
                onClose={() => setShowVariableInserter(false)}
              />
            </div>
          )}
        </div>
      )}

      {mode === 'preview' && (
        <div className="flex-1 overflow-auto p-6">
          <WorkflowPreview
            name={name}
            description={description}
            trigger={trigger || { type: 'message' }}
            actions={actions}
          />
        </div>
      )}

      {mode === 'test' && (
        <div className="flex-1 overflow-auto p-6">
          <WorkflowTestMode
            name={name}
            trigger={trigger || { type: 'message' }}
            actions={actions}
          />
        </div>
      )}
    </div>
  );
}

interface ActionItemProps {
  action: ActionConfig;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ActionConfig>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  availableVariables: WorkflowVariable[];
}

function ActionItem({
  action,
  index,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: ActionItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card p-4 transition-all',
        isSelected ? 'border-primary shadow-sm' : 'hover:border-primary/50',
      )}
    >
      {/* Order Number */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {index + 1}
      </div>

      {/* Action Info */}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start text-left"
      >
        <span className="font-medium text-foreground">
          {action.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        {action.config.message && (
          <span className="mt-0.5 truncate text-sm text-muted-foreground max-w-full">
            {action.config.message.substring(0, 50)}
            {action.config.message.length > 50 && '...'}
          </span>
        )}
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
          aria-label="Delete action"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface WorkflowPreviewProps {
  name: string;
  description?: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
}

function WorkflowPreview({ name, description, trigger, actions }: WorkflowPreviewProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{name || 'Untitled Workflow'}</h2>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Workflow Flow</h3>

        {/* Trigger */}
        <div className="flex items-center gap-3 rounded-md bg-stone-500/10 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-500/20">
            <TriggerPreviewIcon className="h-5 w-5 text-stone-600 dark:text-stone-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">Trigger: {trigger.type.replace(/_/g, ' ')}</p>
            <p className="text-sm text-muted-foreground">
              When this happens, the workflow starts
            </p>
          </div>
        </div>

        {/* Flow Lines and Actions */}
        {actions.map((action, index) => (
          <div key={action.id}>
            <div className="ml-5 h-6 w-0.5 bg-border" />
            <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-sm font-semibold text-primary">{index + 1}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {action.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                {action.config.message && (
                  <p className="text-sm text-muted-foreground">
                    {action.config.message.substring(0, 100)}
                    {action.config.message.length > 100 && '...'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {actions.length === 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            No actions configured yet
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkflowTestModeProps {
  name: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
}

function WorkflowTestMode({ name, trigger, actions }: WorkflowTestModeProps) {
  const [testData, setTestData] = useState('{}');
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'running' | 'success' | 'error';
    output?: string;
  }>({ status: 'idle' });

  const handleTest = useCallback(() => {
    setTestResult({ status: 'running' });
    // Simulate test run
    setTimeout(() => {
      try {
        JSON.parse(testData);
        setTestResult({
          status: 'success',
          output: `Test completed successfully.\n\nWorkflow: ${name}\nTrigger: ${trigger.type}\nActions executed: ${actions.length}`,
        });
      } catch {
        setTestResult({
          status: 'error',
          output: 'Invalid JSON in test data',
        });
      }
    }, 1500);
  }, [name, trigger, actions, testData]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Test Workflow</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter sample trigger data to test your workflow without affecting real data.
        </p>

        <div className="mb-4">
          <label
            htmlFor="test-data"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Test Data (JSON)
          </label>
          <textarea
            id="test-data"
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder='{"message": "Test message", "user": {"name": "Test User"}}'
          />
        </div>

        <button
          type="button"
          onClick={handleTest}
          disabled={testResult.status === 'running'}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {testResult.status === 'running' ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              Running...
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4" />
              Run Test
            </>
          )}
        </button>
      </div>

      {testResult.status !== 'idle' && testResult.status !== 'running' && (
        <div
          className={cn(
            'rounded-lg border p-6',
            testResult.status === 'success'
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-red-500/50 bg-red-500/10',
          )}
        >
          <h3
            className={cn(
              'mb-2 text-sm font-semibold',
              testResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            {testResult.status === 'success' ? 'Test Passed' : 'Test Failed'}
          </h3>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
            {testResult.output}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper function to get available variables
function getAvailableVariables(
  trigger: TriggerConfig,
  actions: ActionConfig[],
): WorkflowVariable[] {
  const variables: WorkflowVariable[] = [];

  // Add trigger variables based on type
  const triggerVariables: Record<string, WorkflowVariable[]> = {
    message: [
      { name: 'trigger.message.content', type: 'string', source: 'trigger', description: 'Message content' },
      { name: 'trigger.message.author.name', type: 'string', source: 'trigger', description: 'Author name' },
      { name: 'trigger.message.author.id', type: 'string', source: 'trigger', description: 'Author ID' },
      { name: 'trigger.message.channel.name', type: 'string', source: 'trigger', description: 'Channel name' },
      { name: 'trigger.message.channel.id', type: 'string', source: 'trigger', description: 'Channel ID' },
      { name: 'trigger.message.timestamp', type: 'string', source: 'trigger', description: 'Message timestamp' },
    ],
    schedule: [
      { name: 'trigger.schedule.time', type: 'string', source: 'trigger', description: 'Scheduled time' },
      { name: 'trigger.schedule.date', type: 'string', source: 'trigger', description: 'Scheduled date' },
    ],
    user_join: [
      { name: 'trigger.user.name', type: 'string', source: 'trigger', description: 'User name' },
      { name: 'trigger.user.id', type: 'string', source: 'trigger', description: 'User ID' },
      { name: 'trigger.user.email', type: 'string', source: 'trigger', description: 'User email' },
    ],
    channel_join: [
      { name: 'trigger.user.name', type: 'string', source: 'trigger', description: 'User name' },
      { name: 'trigger.user.id', type: 'string', source: 'trigger', description: 'User ID' },
      { name: 'trigger.channel.name', type: 'string', source: 'trigger', description: 'Channel name' },
      { name: 'trigger.channel.id', type: 'string', source: 'trigger', description: 'Channel ID' },
    ],
    reaction: [
      { name: 'trigger.reaction.emoji', type: 'string', source: 'trigger', description: 'Reaction emoji' },
      { name: 'trigger.reaction.user.name', type: 'string', source: 'trigger', description: 'User who reacted' },
      { name: 'trigger.reaction.message.id', type: 'string', source: 'trigger', description: 'Message ID' },
    ],
    webhook: [
      { name: 'trigger.webhook.body', type: 'object', source: 'trigger', description: 'Webhook body' },
      { name: 'trigger.webhook.headers', type: 'object', source: 'trigger', description: 'Webhook headers' },
    ],
  };

  variables.push(...(triggerVariables[trigger.type] || []));

  // Add action output variables
  actions.forEach((action, index) => {
    if (action.type === 'http_request') {
      variables.push({
        name: `action${index + 1}.response.body`,
        type: 'object',
        source: 'action',
        description: `Response from action ${index + 1}`,
      });
      variables.push({
        name: `action${index + 1}.response.status`,
        type: 'number',
        source: 'action',
        description: `Status code from action ${index + 1}`,
      });
    }
  });

  return variables;
}

// Icons
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function VariableIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v-8a2 2 0 0 1 2-2h0" />
      <path d="m6 10 6 6" />
      <path d="m12 10-6 6" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ActionEmptyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TriggerPreviewIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
