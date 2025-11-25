'use client';

import { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { WORKFLOW_STATUS_CONFIG, TRIGGER_TYPE_CONFIG } from '@/types/workflow';

import { WorkflowCard, WorkflowCardSkeleton } from './workflow-card';

import type { Workflow, WorkflowStatus, TriggerType } from '@/types/workflow';

export interface WorkflowListProps {
  workflows: Workflow[];
  isLoading?: boolean;
  onRun: (workflow: Workflow) => void;
  onEdit: (workflow: Workflow) => void;
  onToggle: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
  onAddNew?: () => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';

export function WorkflowList({
  workflows,
  isLoading = false,
  onRun,
  onEdit,
  onToggle,
  onDelete,
  onAddNew,
  className,
}: WorkflowListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Get unique trigger types from workflows for filter options
  const availableTriggers = useMemo(() => {
    const triggers = new Set(workflows.map((w) => w.trigger.type));
    return Array.from(triggers);
  }, [workflows]);

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          workflow.name.toLowerCase().includes(query) ||
          workflow.description?.toLowerCase().includes(query);
        if (!matchesSearch) {
return false;
}
      }

      // Status filter
      if (statusFilter !== 'all' && workflow.status !== statusFilter) {
        return false;
      }

      // Trigger filter
      if (triggerFilter !== 'all' && workflow.trigger.type !== triggerFilter) {
        return false;
      }

      return true;
    });
  }, [workflows, searchQuery, statusFilter, triggerFilter]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setTriggerFilter('all');
  }, []);

  const hasFilters = searchQuery.trim() || statusFilter !== 'all' || triggerFilter !== 'all';

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Filters Skeleton */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-10 flex-1 min-w-[200px] animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded-md bg-muted" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <WorkflowCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Search workflows"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkflowStatus | 'all')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          {Object.entries(WORKFLOW_STATUS_CONFIG).map(([status, config]) => (
            <option key={status} value={status}>
              {config.label}
            </option>
          ))}
        </select>

        {/* Trigger Filter */}
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value as TriggerType | 'all')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Filter by trigger type"
        >
          <option value="all">All Triggers</option>
          {availableTriggers.map((trigger) => (
            <option key={trigger} value={trigger}>
              {TRIGGER_TYPE_CONFIG[trigger].label}
            </option>
          ))}
        </select>

        {/* View Toggle */}
        <div className="flex rounded-md border border-input">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'px-3 py-2 text-sm transition-colors',
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <GridIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'px-3 py-2 text-sm transition-colors',
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Add New Button */}
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            Create Workflow
          </button>
        )}
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {filteredWorkflows.length} of {workflows.length} workflows
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Workflow Grid/List */}
      {filteredWorkflows.length === 0 ? (
        <EmptyState
          hasFilters={Boolean(hasFilters)}
          onClearFilters={clearFilters}
          onAddNew={onAddNew}
        />
      ) : (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-3',
          )}
        >
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onRun={() => onRun(workflow)}
              onEdit={() => onEdit(workflow)}
              onToggle={() => onToggle(workflow)}
              onDelete={() => onDelete(workflow)}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  onAddNew?: () => void;
}

function EmptyState({ hasFilters, onClearFilters, onAddNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12">
      <WorkflowEmptyIcon className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {hasFilters ? 'No workflows found' : 'No workflows yet'}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
        {hasFilters
          ? 'Try adjusting your filters to find what you are looking for.'
          : 'Create your first workflow to automate repetitive tasks and improve productivity.'}
      </p>
      <div className="mt-4 flex gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Clear filters
          </button>
        )}
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            Create Workflow
          </button>
        )}
      </div>
    </div>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function WorkflowEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
