'use client';

import {
  Workflow as WorkflowLucideIcon,
  Search,
  LayoutGrid,
  List,
  Filter,
  MoreVertical,
  Copy,
  Trash2,
  Power,
  PowerOff,
  Archive,
  Download,
  ChevronDown,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageHeader } from '@/contexts/page-header-context';
import { useWorkflows, useWorkflowTemplates } from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import {
  WORKFLOW_STATUS_CONFIG,
  TRIGGER_TYPE_CONFIG,
  TEMPLATE_CATEGORY_CONFIG,
} from '@/types/workflow';

import type {
  Workflow,
  WorkflowStatus,
  WorkflowTemplate,
  WorkflowTemplateCategory,
  TriggerType,
} from '@/types/workflow';

// =============================================================================
// Types
// =============================================================================

type ViewMode = 'grid' | 'table';
type SortField = 'name' | 'status' | 'lastRun' | 'runCount' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// =============================================================================
// Main Page Component
// =============================================================================

export default function WorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = (params?.workspaceSlug ?? '') as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('Workflows', 'Automate tasks and processes');
  }, [setPageHeader]);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>(
    'all'
  );
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<
    TriggerType | 'all'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<
    WorkflowTemplateCategory | 'all'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(
    new Set()
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { workflows, isLoading, error, createWorkflow, mutate } = useWorkflows(
    workspaceSlug,
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
    }
  );
  const { templates, isLoading: templatesLoading } =
    useWorkflowTemplates(workspaceSlug);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut (Cmd/Ctrl+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter and sort workflows
  const filteredAndSortedWorkflows = useMemo(() => {
    let filtered = workflows;

    // Apply trigger type filter
    if (triggerTypeFilter !== 'all') {
      filtered = filtered.filter(wf => wf.trigger.type === triggerTypeFilter);
    }

    // Apply search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(workflow => {
        // Search by name
        if (workflow.name.toLowerCase().includes(query)) {
          return true;
        }
        // Search by description
        if (workflow.description?.toLowerCase().includes(query)) {
          return true;
        }
        // Search by trigger type
        const triggerLabel =
          TRIGGER_TYPE_CONFIG[workflow.trigger.type]?.label.toLowerCase();
        if (triggerLabel?.includes(query)) {
          return true;
        }
        return false;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastRun':
          const aLastRun = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
          const bLastRun = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
          comparison = aLastRun - bLastRun;
          break;
        case 'runCount':
          comparison = a.runCount - b.runCount;
          break;
        case 'createdAt':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [
    workflows,
    triggerTypeFilter,
    debouncedSearchQuery,
    sortField,
    sortOrder,
  ]);

  // Stats
  const workflowStats = useMemo(() => {
    const stats = { all: 0, active: 0, inactive: 0, draft: 0, archived: 0 };
    workflows.forEach(wf => {
      stats.all++;
      stats[wf.status]++;
    });
    return stats;
  }, [workflows]);

  // Handlers
  const handleEditWorkflow = useCallback(
    (workflow: Workflow) => {
      router.push(`/${workspaceSlug}/workflows/${workflow.id}/edit`);
    },
    [router, workspaceSlug]
  );

  const handleViewHistory = useCallback(
    (workflowId: string) => {
      router.push(`/${workspaceSlug}/workflows/${workflowId}/history`);
    },
    [router, workspaceSlug]
  );

  const handleSelectTemplate = useCallback(() => {
    setShowTemplates(false);
    router.push(`/${workspaceSlug}/workflows/new`);
  }, [router, workspaceSlug]);

  // Bulk operation handlers
  const handleSelectAll = useCallback(() => {
    if (selectedWorkflows.size === filteredAndSortedWorkflows.length) {
      setSelectedWorkflows(new Set());
    } else {
      setSelectedWorkflows(
        new Set(filteredAndSortedWorkflows.map(wf => wf.id))
      );
    }
  }, [filteredAndSortedWorkflows, selectedWorkflows.size]);

  const handleSelectWorkflow = useCallback(
    (workflowId: string) => {
      const newSelection = new Set(selectedWorkflows);
      if (newSelection.has(workflowId)) {
        newSelection.delete(workflowId);
      } else {
        newSelection.add(workflowId);
      }
      setSelectedWorkflows(newSelection);
    },
    [selectedWorkflows]
  );

  const handleBulkActivate = useCallback(async () => {
    // TODO: Implement bulk activate API call
    console.log('Activating workflows:', Array.from(selectedWorkflows));
    setSelectedWorkflows(new Set());
    mutate();
  }, [selectedWorkflows, mutate]);

  const handleBulkDeactivate = useCallback(async () => {
    // TODO: Implement bulk deactivate API call
    console.log('Deactivating workflows:', Array.from(selectedWorkflows));
    setSelectedWorkflows(new Set());
    mutate();
  }, [selectedWorkflows, mutate]);

  const handleBulkArchive = useCallback(async () => {
    // TODO: Implement bulk archive API call
    console.log('Archiving workflows:', Array.from(selectedWorkflows));
    setSelectedWorkflows(new Set());
    mutate();
  }, [selectedWorkflows, mutate]);

  const handleBulkDelete = useCallback(async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedWorkflows.size} workflow(s)?`
      )
    ) {
      return;
    }
    // TODO: Implement bulk delete API call
    console.log('Deleting workflows:', Array.from(selectedWorkflows));
    setSelectedWorkflows(new Set());
    mutate();
  }, [selectedWorkflows, mutate]);

  // Quick action handlers
  const handleDuplicate = useCallback(
    async (workflow: Workflow) => {
      // TODO: Implement duplicate API call
      console.log('Duplicating workflow:', workflow.id);
      mutate();
    },
    [mutate]
  );

  const handleToggleActive = useCallback(
    async (workflow: Workflow) => {
      const newStatus = workflow.status === 'active' ? 'inactive' : 'active';
      // TODO: Implement update status API call
      console.log(`Setting workflow ${workflow.id} to ${newStatus}`);
      mutate();
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (workflow: Workflow) => {
      if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) {
        return;
      }
      // TODO: Implement delete API call
      console.log('Deleting workflow:', workflow.id);
      mutate();
    },
    [mutate]
  );

  const handleArchive = useCallback(
    async (workflow: Workflow) => {
      // TODO: Implement archive API call
      console.log('Archiving workflow:', workflow.id);
      mutate();
    },
    [mutate]
  );

  const handleExport = useCallback((workflow: Workflow) => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  // Toggle sort
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField, sortOrder]
  );

  return (
    <div className='space-y-6'>
      {/* Search and Toolbar */}
      <div className='flex flex-col gap-4'>
        <div className='flex items-center gap-3'>
          <div className='relative flex-1'>
            <Search
              className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
              aria-hidden='true'
            />
            <input
              ref={searchInputRef}
              type='text'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder='Search workflows by name, description, or trigger type... (⌘K)'
              className='w-full rounded-md border border-input bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              aria-label='Search workflows'
            />
            {searchQuery && (
              <button
                type='button'
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                aria-label='Clear search'
              >
                <XIcon className='h-4 w-4' />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className='flex items-center gap-1 rounded-md border border-border p-1'>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('grid')}
              className='h-8 w-8 p-0'
              aria-label='Grid view'
            >
              <LayoutGrid className='h-4 w-4' />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('table')}
              className='h-8 w-8 p-0'
              aria-label='Table view'
            >
              <List className='h-4 w-4' />
            </Button>
          </div>

          <Button
            variant='outline'
            onClick={() => setShowTemplates(true)}
            aria-label='Browse workflow templates'
          >
            <TemplateIcon className='h-4 w-4' aria-hidden='true' />
            Templates
          </Button>
          <Button
            onClick={() => router.push(`/${workspaceSlug}/workflows/new`)}
            aria-label='Create new workflow'
          >
            <PlusIcon className='h-4 w-4' aria-hidden='true' />
            Create Workflow
          </Button>
        </div>

        {/* Filters and Sorting */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {/* Trigger Type Filter */}
            <Select
              value={triggerTypeFilter}
              onValueChange={value =>
                setTriggerTypeFilter(value as TriggerType | 'all')
              }
            >
              <SelectTrigger className='w-[180px]'>
                <Filter className='mr-2 h-4 w-4' />
                <SelectValue placeholder='Trigger Type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Triggers</SelectItem>
                {Object.entries(TRIGGER_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sortField}
              onValueChange={value => setSortField(value as SortField)}
            >
              <SelectTrigger className='w-[160px]'>
                <ArrowUpDown className='mr-2 h-4 w-4' />
                <SelectValue placeholder='Sort by' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='name'>Name</SelectItem>
                <SelectItem value='status'>Status</SelectItem>
                <SelectItem value='lastRun'>Last Run</SelectItem>
                <SelectItem value='runCount'>Run Count</SelectItem>
                <SelectItem value='createdAt'>Created Date</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant='ghost'
              size='sm'
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className='h-9 px-3'
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedWorkflows.size > 0 && (
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted-foreground'>
                {selectedWorkflows.size} selected
              </span>
              <Button variant='outline' size='sm' onClick={handleBulkActivate}>
                <Power className='mr-2 h-4 w-4' />
                Activate
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleBulkDeactivate}
              >
                <PowerOff className='mr-2 h-4 w-4' />
                Deactivate
              </Button>
              <Button variant='outline' size='sm' onClick={handleBulkArchive}>
                <Archive className='mr-2 h-4 w-4' />
                Archive
              </Button>
              <Button
                variant='destructive'
                size='sm'
                onClick={handleBulkDelete}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className='border-b border-border'>
        <nav
          className='-mb-px flex space-x-8'
          role='tablist'
          aria-label='Workflow status filter'
        >
          {(['all', 'active', 'inactive', 'draft'] as const).map(tab => (
            <button
              key={tab}
              type='button'
              role='tab'
              aria-selected={statusFilter === tab}
              aria-controls={`${tab}-workflows-panel`}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                statusFilter === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {tab === 'all' ? 'All' : WORKFLOW_STATUS_CONFIG[tab].label}
              <span
                className={cn(
                  'ml-2 rounded-full px-2 py-0.5 text-xs',
                  statusFilter === tab
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
                aria-label={`${workflowStats[tab]} workflows`}
              >
                {workflowStats[tab]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Error State */}
      {error && (
        <div
          className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'
          role='alert'
          aria-live='assertive'
        >
          <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
            <AlertIcon className='h-5 w-5' aria-hidden='true' />
            <p className='text-sm font-medium'>Failed to load workflows</p>
          </div>
          <p className='mt-1 text-sm text-red-600 dark:text-red-300'>
            {error.message}
          </p>
          <button
            type='button'
            onClick={() => mutate()}
            className='mt-2 text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200'
            aria-label='Retry loading workflows'
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
          role='status'
          aria-label='Loading workflows'
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkflowCardSkeleton key={i} />
          ))}
          <span className='sr-only'>Loading workflows...</span>
        </div>
      )}

      {/* Empty State - No workflows at all */}
      {!isLoading && !error && workflows.length === 0 && (
        <EmptyState
          icon={WorkflowLucideIcon}
          title={
            statusFilter === 'all'
              ? 'No Workflows Yet'
              : `No ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Workflows`
          }
          description={
            statusFilter === 'all'
              ? 'Automate your processes by creating custom workflows. Start from scratch or choose from our templates.'
              : 'No workflows match this status. Try changing filters or create a new workflow.'
          }
          action={{
            label: 'Create Workflow',
            onClick: () => router.push(`/${workspaceSlug}/workflows/new`),
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

      {/* Empty State - No search results */}
      {!isLoading &&
        !error &&
        workflows.length > 0 &&
        filteredAndSortedWorkflows.length === 0 && (
          <EmptyState
            icon={Search}
            title='No Workflows Found'
            description={
              'No workflows match your filters. Try adjusting your search or filters.'
            }
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('');
                setTriggerTypeFilter('all');
                setStatusFilter('all');
              },
              variant: 'outline' as const,
            }}
          />
        )}

      {/* Workflow Grid View */}
      {!isLoading &&
        !error &&
        filteredAndSortedWorkflows.length > 0 &&
        viewMode === 'grid' && (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {filteredAndSortedWorkflows.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                selected={selectedWorkflows.has(workflow.id)}
                onSelect={handleSelectWorkflow}
                onEdit={handleEditWorkflow}
                onViewHistory={handleViewHistory}
                onDuplicate={handleDuplicate}
                onToggleActive={handleToggleActive}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>
        )}

      {/* Workflow Table View */}
      {!isLoading &&
        !error &&
        filteredAndSortedWorkflows.length > 0 &&
        viewMode === 'table' && (
          <WorkflowTable
            workflows={filteredAndSortedWorkflows}
            selectedWorkflows={selectedWorkflows}
            onSelectAll={handleSelectAll}
            onSelectWorkflow={handleSelectWorkflow}
            onEdit={handleEditWorkflow}
            onViewHistory={handleViewHistory}
            onDuplicate={handleDuplicate}
            onToggleActive={handleToggleActive}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onExport={handleExport}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
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
    </div>
  );
}

// =============================================================================
// Workflow Card Component
// =============================================================================

interface WorkflowCardProps {
  workflow: Workflow;
  selected: boolean;
  onSelect: (workflowId: string) => void;
  onEdit: (workflow: Workflow) => void;
  onViewHistory: (workflowId: string) => void;
  onDuplicate: (workflow: Workflow) => void;
  onToggleActive: (workflow: Workflow) => void;
  onArchive: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
  onExport: (workflow: Workflow) => void;
}

function WorkflowCard({
  workflow,
  selected,
  onSelect,
  onEdit,
  onViewHistory,
  onDuplicate,
  onToggleActive,
  onArchive,
  onDelete,
  onExport,
}: WorkflowCardProps) {
  const statusConfig = WORKFLOW_STATUS_CONFIG[workflow.status];
  const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start gap-3'>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(workflow.id)}
            className='mt-1'
            aria-label={`Select ${workflow.name}`}
          />
          <div className='flex-1 min-w-0'>
            <div className='flex items-start justify-between gap-2'>
              <h3 className='font-semibold text-foreground truncate'>
                {workflow.name}
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-8 p-0'
                    aria-label='Workflow actions'
                  >
                    <MoreVertical className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => onEdit(workflow)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                    <Copy className='mr-2 h-4 w-4' />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleActive(workflow)}>
                    {workflow.status === 'active' ? (
                      <>
                        <PowerOff className='mr-2 h-4 w-4' />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Power className='mr-2 h-4 w-4' />
                        Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport(workflow)}>
                    <Download className='mr-2 h-4 w-4' />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onArchive(workflow)}>
                    <Archive className='mr-2 h-4 w-4' />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(workflow)}
                    className='text-red-600'
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {workflow.description && (
              <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                {workflow.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Badge
            variant='outline'
            className={cn(statusConfig.bgColor, statusConfig.color)}
          >
            {statusConfig.label}
          </Badge>
        </div>

        <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
          <div className='flex items-center gap-1'>
            <TriggerIcon className='h-4 w-4' />
            <span>{triggerConfig?.label ?? workflow.trigger.type}</span>
          </div>
          <div className='flex items-center gap-1'>
            <ActionIcon className='h-4 w-4' />
            <span>{workflow.actions.length} actions</span>
          </div>
        </div>

        <div className='flex items-center justify-between border-t border-border pt-3 text-xs'>
          <div className='flex items-center gap-3 text-muted-foreground'>
            <div className='flex items-center gap-1'>
              <Activity className='h-3 w-3' />
              <span>{workflow.runCount} runs</span>
            </div>
            {workflow.errorCount > 0 && (
              <div className='flex items-center gap-1 text-red-600'>
                <XCircle className='h-3 w-3' />
                <span>{workflow.errorCount} errors</span>
              </div>
            )}
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onViewHistory(workflow.id)}
            className='h-6 px-2 text-xs'
          >
            <Clock className='mr-1 h-3 w-3' />
            History
          </Button>
        </div>

        {workflow.lastRunAt && (
          <div className='text-xs text-muted-foreground'>
            Last run:{' '}
            {new Date(workflow.lastRunAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowCardSkeleton() {
  return (
    <div className='animate-pulse rounded-lg border bg-card p-4'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='h-5 w-32 rounded bg-muted' />
          <div className='mt-2 h-4 w-48 rounded bg-muted' />
        </div>
        <div className='h-5 w-16 rounded-full bg-muted' />
      </div>
      <div className='mt-4 flex gap-4'>
        <div className='h-4 w-20 rounded bg-muted' />
        <div className='h-4 w-20 rounded bg-muted' />
      </div>
      <div className='mt-3 flex justify-between border-t border-border pt-3'>
        <div className='h-3 w-16 rounded bg-muted' />
        <div className='h-3 w-12 rounded bg-muted' />
      </div>
    </div>
  );
}

// =============================================================================
// Workflow Table Component
// =============================================================================

interface WorkflowTableProps {
  workflows: Workflow[];
  selectedWorkflows: Set<string>;
  onSelectAll: () => void;
  onSelectWorkflow: (workflowId: string) => void;
  onEdit: (workflow: Workflow) => void;
  onViewHistory: (workflowId: string) => void;
  onDuplicate: (workflow: Workflow) => void;
  onToggleActive: (workflow: Workflow) => void;
  onArchive: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
  onExport: (workflow: Workflow) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

function WorkflowTable({
  workflows,
  selectedWorkflows,
  onSelectAll,
  onSelectWorkflow,
  onEdit,
  onViewHistory,
  onDuplicate,
  onToggleActive,
  onArchive,
  onDelete,
  onExport,
  sortField,
  sortOrder,
  onSort,
}: WorkflowTableProps) {
  const allSelected =
    workflows.length > 0 && selectedWorkflows.size === workflows.length;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className='ml-2 h-4 w-4 opacity-30' />;
    }
    return sortOrder === 'asc' ? (
      <ChevronDown className='ml-2 h-4 w-4 rotate-180' />
    ) : (
      <ChevronDown className='ml-2 h-4 w-4' />
    );
  };

  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-[50px]'>
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label='Select all workflows'
              />
            </TableHead>
            <TableHead
              className='cursor-pointer select-none'
              onClick={() => onSort('name')}
            >
              <div className='flex items-center'>
                Name
                <SortIcon field='name' />
              </div>
            </TableHead>
            <TableHead
              className='cursor-pointer select-none'
              onClick={() => onSort('status')}
            >
              <div className='flex items-center'>
                Status
                <SortIcon field='status' />
              </div>
            </TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
            <TableHead
              className='cursor-pointer select-none text-right'
              onClick={() => onSort('runCount')}
            >
              <div className='flex items-center justify-end'>
                Runs
                <SortIcon field='runCount' />
              </div>
            </TableHead>
            <TableHead
              className='cursor-pointer select-none'
              onClick={() => onSort('lastRun')}
            >
              <div className='flex items-center'>
                Last Run
                <SortIcon field='lastRun' />
              </div>
            </TableHead>
            <TableHead className='w-[100px]'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map(workflow => {
            const statusConfig = WORKFLOW_STATUS_CONFIG[workflow.status];
            const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];
            const isSelected = selectedWorkflows.has(workflow.id);

            return (
              <TableRow
                key={workflow.id}
                className={cn(isSelected && 'bg-muted/50')}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelectWorkflow(workflow.id)}
                    aria-label={`Select ${workflow.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className='max-w-[300px]'>
                    <div className='font-medium truncate'>{workflow.name}</div>
                    {workflow.description && (
                      <div className='text-sm text-muted-foreground truncate'>
                        {workflow.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant='outline'
                    className={cn(statusConfig.bgColor, statusConfig.color)}
                  >
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-1 text-sm'>
                    <TriggerIcon className='h-4 w-4' />
                    <span>{triggerConfig?.label ?? workflow.trigger.type}</span>
                  </div>
                </TableCell>
                <TableCell className='text-right'>
                  {workflow.actions.length}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex flex-col items-end gap-1'>
                    <div className='flex items-center gap-1'>
                      <CheckCircle2 className='h-3 w-3 text-green-600' />
                      <span>{workflow.runCount}</span>
                    </div>
                    {workflow.errorCount > 0 && (
                      <div className='flex items-center gap-1 text-red-600'>
                        <XCircle className='h-3 w-3' />
                        <span>{workflow.errorCount}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='text-sm text-muted-foreground'>
                    {workflow.lastRunAt
                      ? new Date(workflow.lastRunAt).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )
                      : 'Never'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => onViewHistory(workflow.id)}
                      className='h-8 w-8 p-0'
                      aria-label='View history'
                    >
                      <Clock className='h-4 w-4' />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0'
                          aria-label='More actions'
                        >
                          <MoreVertical className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => onEdit(workflow)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                          <Copy className='mr-2 h-4 w-4' />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleActive(workflow)}
                        >
                          {workflow.status === 'active' ? (
                            <>
                              <PowerOff className='mr-2 h-4 w-4' />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className='mr-2 h-4 w-4' />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport(workflow)}>
                          <Download className='mr-2 h-4 w-4' />
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onArchive(workflow)}>
                          <Archive className='mr-2 h-4 w-4' />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(workflow)}
                          className='text-red-600'
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================================================
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
  const [categoryFilter, setCategoryFilter] = useState<
    WorkflowTemplateCategory | 'all'
  >('all');

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') {
      return templates;
    }
    return templates.filter(t => t.category === categoryFilter);
  }, [templates, categoryFilter]);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background p-6'>
        <div className='flex items-center justify-between border-b border-border pb-4'>
          <h2 className='text-xl font-semibold'>Choose a Template</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-2 hover:bg-accent'
          >
            <XIcon className='h-5 w-5' />
          </button>
        </div>

        {/* Category Filter */}
        <div className='mt-4 flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition-colors',
              categoryFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            All
          </button>
          {Object.entries(TEMPLATE_CATEGORY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              type='button'
              onClick={() => setCategoryFilter(key as WorkflowTemplateCategory)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                categoryFilter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {config.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className='mt-6'>
          {isLoading ? (
            <div className='grid gap-4 sm:grid-cols-2'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className='h-32 animate-pulse rounded-lg bg-muted'
                />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className='py-8 text-center text-muted-foreground'>
              No templates found in this category.
            </p>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2'>
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  type='button'
                  onClick={() => onSelect(template)}
                  className='rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5'
                >
                  <h3 className='font-semibold'>{template.name}</h3>
                  <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                    {template.description}
                  </p>
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {template.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className='rounded-full bg-muted px-2 py-0.5 text-xs'
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
// Icons
// =============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M5 12h14M12 5v14' />
    </svg>
  );
}

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <rect x='3' y='3' width='18' height='18' rx='2' />
      <path d='M3 9h18M9 21V9' />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='12' />
      <line x1='12' x2='12.01' y1='16' y2='16' />
    </svg>
  );
}

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

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <polyline points='9 11 12 14 22 4' />
      <path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M18 6 6 18M6 6l12 12' />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <polyline points='3 6 5 6 21 6' />
      <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
    </svg>
  );
}
