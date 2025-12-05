/**
 * Orchestrators List Page
 *
 * Displays all orchestrators (Orchestrators) in the workspace with
 * filtering, search, and creation capabilities.
 *
 * @module app/(workspace)/[workspaceId]/orchestrators/page
 */
'use client';

import { Users, Plus, X, Search, AlertCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { CreateOrchestratorDialog } from '@/components/orchestrator/create-orchestrator-dialog';
import {
  OrchestratorCard,
  OrchestratorCardSkeleton,
} from '@/components/orchestrator/orchestrator-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  useOrchestrators,
  useOrchestratorMutations,
} from '@/hooks/use-orchestrator';
import { cn } from '@/lib/utils';
import {
  ORCHESTRATOR_DISCIPLINES,
  ORCHESTRATOR_STATUS_CONFIG,
} from '@/types/orchestrator';

import type {
  Orchestrator,
  OrchestratorFilters,
  OrchestratorStatus,
  CreateOrchestratorInput,
} from '@/types/orchestrator';

export default function OrchestratorsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Orchestrators',
      'AI-powered orchestrators managing your workspace operations',
    );
  }, [setPageHeader]);

  // State
  const [filters, setFilters] = useState<OrchestratorFilters>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Hooks
  const {
    orchestrators,
    isLoading,
    error,
    refetch,
    totalCount,
    filteredCount,
  } = useOrchestrators(workspaceSlug, filters);
  const {
    createOrchestrator,
    toggleOrchestratorStatus,
    isLoading: isMutating,
  } = useOrchestratorMutations();

  // Keyboard shortcut for search focus (Cmd/Ctrl+K)
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

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the filter update (300ms)
    debounceTimerRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value || undefined }));
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setFilters(prev => ({ ...prev, search: undefined }));
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  const handleDisciplineChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, discipline: value || undefined }));
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setFilters(prev => ({
      ...prev,
      status: (value as OrchestratorStatus) || undefined,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCreateOrchestrator = useCallback(
    async (input: CreateOrchestratorInput) => {
      await createOrchestrator(input);
      refetch();
    },
    [createOrchestrator, refetch],
  );

  const handleToggleStatus = useCallback(
    async (orchestrator: Orchestrator) => {
      await toggleOrchestratorStatus(orchestrator.id, orchestrator.status);
      refetch();
    },
    [toggleOrchestratorStatus, refetch],
  );

  const handleEditWithAI = useCallback(
    (orchestrator: Orchestrator) => {
      router.push(`/${workspaceSlug}/orchestrators/${orchestrator.id}/edit`);
    },
    [router, workspaceSlug],
  );

  const handleNewOrchestrator = useCallback(() => {
    router.push(`/${workspaceSlug}/orchestrators/new`);
  }, [router, workspaceSlug]);

  // Compute active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) {
      count++;
    }
    if (filters.discipline) {
      count++;
    }
    if (filters.status) {
      count++;
    }
    return count;
  }, [filters]);

  // Highlight matching text helper
  const highlightText = useCallback(
    (text: string | null | undefined) => {
      if (!text || !filters.search) {
        return text || '';
      }

      const searchTerm = filters.search.toLowerCase();
      const parts = text.split(new RegExp(`(${filters.search})`, 'gi'));

      return parts.map((part, index) => {
        if (part.toLowerCase() === searchTerm) {
          return (
            <mark key={index} className='bg-yellow-200 dark:bg-yellow-900/50'>
              {part}
            </mark>
          );
        }
        return part;
      });
    },
    [filters.search],
  );

  // Group Orchestrators by status for stats
  const orchestratorStats = useMemo(() => {
    const stats = { online: 0, offline: 0, busy: 0, away: 0 };
    orchestrators.forEach(orchestrator => {
      if (orchestrator.status === 'ONLINE') {
        stats.online++;
      } else if (orchestrator.status === 'OFFLINE') {
        stats.offline++;
      } else if (orchestrator.status === 'BUSY') {
        stats.busy++;
      } else if (orchestrator.status === 'AWAY') {
        stats.away++;
      }
    });
    return stats;
  }, [orchestrators]);

  return (
    <div className='p-6 space-y-6'>
      {/* Action Buttons */}
      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          onClick={handleNewOrchestrator}
          className='inline-flex items-center gap-2'
        >
          <Plus className='h-4 w-4' />
          New Orchestrator
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => setIsCreateDialogOpen(true)}
          className='inline-flex items-center gap-2'
        >
          <Plus className='h-4 w-4' />
          Quick Create
        </Button>
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard
          label='Online'
          value={orchestratorStats.online}
          color='text-green-600'
          bgColor='bg-green-50'
        />
        <StatCard
          label='Offline'
          value={orchestratorStats.offline}
          color='text-gray-600'
          bgColor='bg-gray-50'
        />
        <StatCard
          label='Busy'
          value={orchestratorStats.busy}
          color='text-yellow-600'
          bgColor='bg-yellow-50'
        />
        <StatCard
          label='Away'
          value={orchestratorStats.away}
          color='text-orange-600'
          bgColor='bg-orange-50'
        />
      </div>

      {/* Filters */}
      <div className='rounded-lg border bg-card p-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          {/* Search */}
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <input
              ref={searchInputRef}
              type='text'
              placeholder='Search orchestrators by name, description... (⌘K)'
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              className='w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            />
            {searchInput && (
              <button
                type='button'
                onClick={handleClearSearch}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                aria-label='Clear search'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>

          {/* Discipline Filter */}
          <select
            value={filters.discipline || ''}
            onChange={e => handleDisciplineChange(e.target.value)}
            className='rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value=''>All Disciplines</option>
            {ORCHESTRATOR_DISCIPLINES.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || ''}
            onChange={e => handleStatusChange(e.target.value)}
            className='rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          >
            <option value=''>All Status</option>
            {Object.entries(ORCHESTRATOR_STATUS_CONFIG).map(
              ([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              ),
            )}
          </select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              type='button'
              onClick={handleClearFilters}
              className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
              Clear ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className='mt-3 text-sm text-muted-foreground'>
          {activeFiltersCount > 0 ? (
            <>
              Showing {filteredCount} of {totalCount} orchestrators
            </>
          ) : (
            <>{totalCount} orchestrators total</>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-center gap-2 text-red-800'>
            <AlertCircle className='h-5 w-5' />
            <p className='text-sm font-medium'>Failed to load orchestrators</p>
          </div>
          <p className='mt-1 text-sm text-red-600'>{error.message}</p>
          <button
            type='button'
            onClick={refetch}
            className='mt-2 text-sm font-medium text-red-800 hover:text-red-900'
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <OrchestratorCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && orchestrators.length === 0 && (
        <EmptyState
          icon={Users}
          title={
            activeFiltersCount > 0
              ? filters.search
                ? `No orchestrators matching "${filters.search}"`
                : 'No Orchestrators Found'
              : 'No Orchestrators Yet'
          }
          description={
            activeFiltersCount > 0
              ? filters.search
                ? 'No orchestrators match your search query. Try different keywords or check your filters.'
                : "Try adjusting your filters to find what you're looking for. No orchestrators match your current criteria."
              : 'Get started by creating your first orchestrator. Use the conversational wizard to define an AI-powered agent that can manage tasks and workflows.'
          }
          action={
            activeFiltersCount > 0
              ? {
                  label: 'Clear Filters',
                  onClick: handleClearFilters,
                  variant: 'outline' as const,
                }
              : {
                  label: 'Create Your First Orchestrator',
                  onClick: handleNewOrchestrator,
                }
          }
        />
      )}

      {/* Orchestrators Grid */}
      {!isLoading && !error && orchestrators.length > 0 && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {orchestrators.map(orchestrator => (
            <OrchestratorCard
              key={orchestrator.id}
              orchestrator={orchestrator}
              workspaceId={workspaceSlug}
              onToggleStatus={handleToggleStatus}
              onEditWithAI={handleEditWithAI}
              highlightText={highlightText}
            />
          ))}
        </div>
      )}

      {/* Quick Create Dialog (for users who prefer form-based creation) */}
      <CreateOrchestratorDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateOrchestrator}
        isLoading={isMutating}
      />
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={cn('rounded-lg border p-4', bgColor)}>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}
