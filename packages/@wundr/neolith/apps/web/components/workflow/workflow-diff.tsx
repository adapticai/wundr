'use client';

import {
  Plus,
  Minus,
  Edit,
  ArrowRight,
  Code2,
  FileText,
  Settings,
  GitCommit,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { WorkflowVersion } from './version-history';
import type { Workflow, ActionConfig, WorkflowVariable } from '@/types/workflow';

/**
 * Diff operation types
 */
export type DiffOperation = 'added' | 'removed' | 'modified' | 'unchanged';

/**
 * Generic diff item
 */
export interface DiffItem<T = unknown> {
  operation: DiffOperation;
  oldValue?: T;
  newValue?: T;
  path: string;
  label: string;
}

/**
 * Workflow diff result
 */
export interface WorkflowDiffResult {
  metadata: DiffItem[];
  trigger: DiffItem[];
  actions: DiffItem<ActionConfig>[];
  variables: DiffItem<WorkflowVariable>[];
  hasChanges: boolean;
}

/**
 * Props for WorkflowDiff component
 */
export interface WorkflowDiffProps {
  oldVersion: WorkflowVersion;
  newVersion: WorkflowVersion;
  className?: string;
}

/**
 * Diff operation colors
 */
const DIFF_COLORS: Record<DiffOperation, { bg: string; border: string; text: string }> = {
  added: {
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-l-4 border-l-green-500',
    text: 'text-green-700 dark:text-green-400',
  },
  removed: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-l-4 border-l-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
  modified: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-l-4 border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
  },
  unchanged: {
    bg: 'bg-muted/30',
    border: 'border-l-4 border-l-gray-300 dark:border-l-gray-700',
    text: 'text-muted-foreground',
  },
};

/**
 * Diff operation icons
 */
const DIFF_ICONS: Record<DiffOperation, React.ComponentType<{ className?: string }>> = {
  added: Plus,
  removed: Minus,
  modified: Edit,
  unchanged: GitCommit,
};

/**
 * Deep compare two values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
return true;
}
  if (a == null || b == null) {
return false;
}
  if (typeof a !== 'object' || typeof b !== 'object') {
return false;
}

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) {
return false;
}

  for (const key of keysA) {
    if (!keysB.includes(key)) {
return false;
}
    if (!deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    )) {
      return false;
    }
  }

  return true;
}

/**
 * Generate workflow diff
 */
function generateWorkflowDiff(
  oldWorkflow: Workflow,
  newWorkflow: Workflow,
): WorkflowDiffResult {
  const metadata: DiffItem[] = [];
  const trigger: DiffItem[] = [];
  const actions: DiffItem<ActionConfig>[] = [];
  const variables: DiffItem<WorkflowVariable>[] = [];

  // Compare metadata
  if (oldWorkflow.name !== newWorkflow.name) {
    metadata.push({
      operation: 'modified',
      oldValue: oldWorkflow.name,
      newValue: newWorkflow.name,
      path: 'name',
      label: 'Workflow Name',
    });
  }

  if (oldWorkflow.description !== newWorkflow.description) {
    metadata.push({
      operation: 'modified',
      oldValue: oldWorkflow.description,
      newValue: newWorkflow.description,
      path: 'description',
      label: 'Description',
    });
  }

  if (oldWorkflow.status !== newWorkflow.status) {
    metadata.push({
      operation: 'modified',
      oldValue: oldWorkflow.status,
      newValue: newWorkflow.status,
      path: 'status',
      label: 'Status',
    });
  }

  // Compare trigger
  if (!deepEqual(oldWorkflow.trigger, newWorkflow.trigger)) {
    trigger.push({
      operation: 'modified',
      oldValue: oldWorkflow.trigger,
      newValue: newWorkflow.trigger,
      path: 'trigger',
      label: 'Trigger Configuration',
    });
  }

  // Compare actions
  const oldActionMap = new Map(oldWorkflow.actions.map(a => [a.id, a]));
  const newActionMap = new Map(newWorkflow.actions.map(a => [a.id, a]));

  // Find removed and modified actions
  for (const [id, oldAction] of oldActionMap) {
    const newAction = newActionMap.get(id);
    if (!newAction) {
      actions.push({
        operation: 'removed',
        oldValue: oldAction,
        path: `actions.${id}`,
        label: `Action: ${oldAction.type}`,
      });
    } else if (!deepEqual(oldAction, newAction)) {
      actions.push({
        operation: 'modified',
        oldValue: oldAction,
        newValue: newAction,
        path: `actions.${id}`,
        label: `Action: ${newAction.type}`,
      });
    }
  }

  // Find added actions
  for (const [id, newAction] of newActionMap) {
    if (!oldActionMap.has(id)) {
      actions.push({
        operation: 'added',
        newValue: newAction,
        path: `actions.${id}`,
        label: `Action: ${newAction.type}`,
      });
    }
  }

  // Sort actions by order
  actions.sort((a, b) => {
    const orderA = a.newValue?.order ?? a.oldValue?.order ?? 0;
    const orderB = b.newValue?.order ?? b.oldValue?.order ?? 0;
    return orderA - orderB;
  });

  // Compare variables
  const oldVarMap = new Map((oldWorkflow.variables || []).map(v => [v.name, v]));
  const newVarMap = new Map((newWorkflow.variables || []).map(v => [v.name, v]));

  // Find removed and modified variables
  for (const [name, oldVar] of oldVarMap) {
    const newVar = newVarMap.get(name);
    if (!newVar) {
      variables.push({
        operation: 'removed',
        oldValue: oldVar,
        path: `variables.${name}`,
        label: `Variable: ${name}`,
      });
    } else if (!deepEqual(oldVar, newVar)) {
      variables.push({
        operation: 'modified',
        oldValue: oldVar,
        newValue: newVar,
        path: `variables.${name}`,
        label: `Variable: ${name}`,
      });
    }
  }

  // Find added variables
  for (const [name, newVar] of newVarMap) {
    if (!oldVarMap.has(name)) {
      variables.push({
        operation: 'added',
        newValue: newVar,
        path: `variables.${name}`,
        label: `Variable: ${name}`,
      });
    }
  }

  const hasChanges =
    metadata.length > 0 ||
    trigger.length > 0 ||
    actions.length > 0 ||
    variables.length > 0;

  return { metadata, trigger, actions, variables, hasChanges };
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
return 'null';
}
  if (typeof value === 'string') {
return value;
}
  if (typeof value === 'number' || typeof value === 'boolean') {
return String(value);
}
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Diff item display component
 */
function DiffItemDisplay({ item }: { item: DiffItem }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const colors = DIFF_COLORS[item.operation];
  const Icon = DIFF_ICONS[item.operation];

  const hasDetails = item.operation === 'modified' && item.oldValue !== undefined && item.newValue !== undefined;

  return (
    <div className={cn('rounded-lg p-4', colors.bg, colors.border)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', colors.text)} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('font-medium text-sm', colors.text)}>
                  {item.label}
                </span>
                <Badge variant="outline" className="text-xs capitalize">
                  {item.operation}
                </Badge>
              </div>
              <code className="text-xs text-muted-foreground block">
                {item.path}
              </code>
            </div>
            {hasDetails && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Quick summary for non-modified items */}
          {item.operation === 'added' && item.newValue !== undefined && !isExpanded ? (
            <div className="text-sm text-muted-foreground">
              <pre className="font-mono text-xs overflow-x-auto">
                {formatValue(item.newValue)}
              </pre>
            </div>
          ) : null}

          {item.operation === 'removed' && item.oldValue !== undefined && !isExpanded ? (
            <div className="text-sm text-muted-foreground line-through">
              <pre className="font-mono text-xs overflow-x-auto">
                {formatValue(item.oldValue)}
              </pre>
            </div>
          ) : null}

          {/* Expanded details */}
          {isExpanded && hasDetails && (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Before</Badge>
                  <span className="text-xs text-muted-foreground">
                    Previous Version
                  </span>
                </div>
                <div className="rounded-md bg-background/50 p-3 border">
                  <pre className="font-mono text-xs overflow-x-auto text-muted-foreground">
                    {formatValue(item.oldValue)}
                  </pre>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">After</Badge>
                  <span className="text-xs text-muted-foreground">
                    Current Version
                  </span>
                </div>
                <div className="rounded-md bg-background/50 p-3 border">
                  <pre className="font-mono text-xs overflow-x-auto">
                    {formatValue(item.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Diff section component
 */
function DiffSection({
  title,
  icon: Icon,
  items,
  emptyMessage,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: DiffItem[];
  emptyMessage: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const stats = React.useMemo(() => {
    return {
      added: items.filter(i => i.operation === 'added').length,
      removed: items.filter(i => i.operation === 'removed').length,
      modified: items.filter(i => i.operation === 'modified').length,
    };
  }, [items]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full group"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
            {items.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                {stats.added > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                    <Plus className="h-3 w-3" />
                    {stats.added}
                  </Badge>
                )}
                {stats.removed > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                    <Minus className="h-3 w-3" />
                    {stats.removed}
                  </Badge>
                )}
                {stats.modified > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                    <Edit className="h-3 w-3" />
                    {stats.modified}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {emptyMessage}
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <DiffItemDisplay key={`${item.path}-${index}`} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Workflow diff viewer component
 */
export function WorkflowDiff({
  oldVersion,
  newVersion,
  className,
}: WorkflowDiffProps) {
  const diff = React.useMemo(
    () => generateWorkflowDiff(oldVersion.workflow, newVersion.workflow),
    [oldVersion, newVersion],
  );

  const totalChanges = React.useMemo(() => {
    return (
      diff.metadata.length +
      diff.trigger.length +
      diff.actions.length +
      diff.variables.length
    );
  }, [diff]);

  if (!diff.hasChanges) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <GitCommit className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">
          No Changes Detected
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          These versions are identical
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {totalChanges}
              </div>
              <div className="text-xs text-muted-foreground">
                Total Changes
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {diff.actions.filter(a => a.operation === 'added').length +
                  diff.variables.filter(v => v.operation === 'added').length}
              </div>
              <div className="text-xs text-muted-foreground">
                Added Items
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {diff.actions.filter(a => a.operation === 'removed').length +
                  diff.variables.filter(v => v.operation === 'removed').length}
              </div>
              <div className="text-xs text-muted-foreground">
                Removed Items
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {diff.metadata.length +
                  diff.trigger.length +
                  diff.actions.filter(a => a.operation === 'modified').length +
                  diff.variables.filter(v => v.operation === 'modified').length}
              </div>
              <div className="text-xs text-muted-foreground">
                Modified Items
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diff sections */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All Changes
            {totalChanges > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {totalChanges}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="metadata">
            Metadata
            {diff.metadata.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {diff.metadata.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trigger">
            Trigger
            {diff.trigger.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {diff.trigger.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="actions">
            Actions
            {diff.actions.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {diff.actions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="variables">
            Variables
            {diff.variables.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {diff.variables.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          <DiffSection
            title="Metadata"
            icon={FileText}
            items={diff.metadata}
            emptyMessage="No metadata changes"
          />
          <DiffSection
            title="Trigger"
            icon={Settings}
            items={diff.trigger}
            emptyMessage="No trigger changes"
          />
          <DiffSection
            title="Actions"
            icon={GitCommit}
            items={diff.actions}
            emptyMessage="No action changes"
          />
          <DiffSection
            title="Variables"
            icon={Code2}
            items={diff.variables}
            emptyMessage="No variable changes"
          />
        </TabsContent>

        <TabsContent value="metadata" className="space-y-4 mt-6">
          <DiffSection
            title="Metadata"
            icon={FileText}
            items={diff.metadata}
            emptyMessage="No metadata changes"
          />
        </TabsContent>

        <TabsContent value="trigger" className="space-y-4 mt-6">
          <DiffSection
            title="Trigger"
            icon={Settings}
            items={diff.trigger}
            emptyMessage="No trigger changes"
          />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 mt-6">
          <DiffSection
            title="Actions"
            icon={GitCommit}
            items={diff.actions}
            emptyMessage="No action changes"
          />
        </TabsContent>

        <TabsContent value="variables" className="space-y-4 mt-6">
          <DiffSection
            title="Variables"
            icon={Code2}
            items={diff.variables}
            emptyMessage="No variable changes"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
