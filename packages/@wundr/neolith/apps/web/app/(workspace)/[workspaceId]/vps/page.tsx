'use client';

import { Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { CreateVPDialog } from '@/components/vp/create-vp-dialog';
import { VPCard, VPCardSkeleton } from '@/components/vp/vp-card';
import { useVPs, useVPMutations } from '@/hooks/use-vp';
import { cn } from '@/lib/utils';
import { VP_DISCIPLINES, VP_STATUS_CONFIG } from '@/types/vp';

import type { VP, VPFilters, VPStatus, CreateVPInput } from '@/types/vp';


export default function VPsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // State
  const [filters, setFilters] = useState<VPFilters>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Hooks
  const { vps, isLoading, error, refetch, totalCount, filteredCount } = useVPs(workspaceId, filters);
  const { createVP, toggleVPStatus, isLoading: isMutating } = useVPMutations();

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined }));
  }, []);

  const handleDisciplineChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, discipline: value || undefined }));
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, status: (value as VPStatus) || undefined }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCreateVP = useCallback(
    async (input: CreateVPInput) => {
      await createVP(input);
      refetch();
    },
    [createVP, refetch],
  );

  const handleToggleStatus = useCallback(
    async (vp: VP) => {
      await toggleVPStatus(vp.id, vp.status);
      refetch();
    },
    [toggleVPStatus, refetch],
  );

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

  // Group VPs by status for stats
  const vpStats = useMemo(() => {
    const stats = { online: 0, offline: 0, busy: 0, away: 0 };
    vps.forEach((vp) => {
      if (vp.status === 'ONLINE') {
        stats.online++;
      } else if (vp.status === 'OFFLINE') {
        stats.offline++;
      } else if (vp.status === 'BUSY') {
        stats.busy++;
      } else if (vp.status === 'AWAY') {
        stats.away++;
      }
    });
    return stats;
  }, [vps]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Virtual Persons</h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization&apos;s AI-powered virtual persons
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="h-4 w-4" />
          Create VP
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Online"
          value={vpStats.online}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          label="Offline"
          value={vpStats.offline}
          color="text-gray-600"
          bgColor="bg-gray-50"
        />
        <StatCard
          label="Busy"
          value={vpStats.busy}
          color="text-yellow-600"
          bgColor="bg-yellow-50"
        />
        <StatCard
          label="Away"
          value={vpStats.away}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search VPs by name, discipline..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Discipline Filter */}
          <select
            value={filters.discipline || ''}
            onChange={(e) => handleDisciplineChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Disciplines</option>
            {VP_DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || ''}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Status</option>
            {Object.entries(VP_STATUS_CONFIG).map(([status, config]) => (
              <option key={status} value={status}>
                {config.label}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
              Clear ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="mt-3 text-sm text-muted-foreground">
          {activeFiltersCount > 0 ? (
            <>
              Showing {filteredCount} of {totalCount} VPs
            </>
          ) : (
            <>{totalCount} VPs total</>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertIcon className="h-5 w-5" />
            <p className="text-sm font-medium">Failed to load VPs</p>
          </div>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-2 text-sm font-medium text-red-800 hover:text-red-900"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <VPCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && vps.length === 0 && (
        <EmptyState
          icon={Users}
          title={activeFiltersCount > 0 ? 'No VPs Found' : 'No Virtual Persons Yet'}
          description={
            activeFiltersCount > 0
              ? 'Try adjusting your filters to find what you\'re looking for. No VPs match your current criteria.'
              : 'Get started by creating your first Virtual Person. VPs are AI-powered team members that can help automate tasks and workflows.'
          }
          action={
            activeFiltersCount > 0
              ? {
                  label: 'Clear Filters',
                  onClick: handleClearFilters,
                  variant: 'outline' as const,
                }
              : {
                  label: 'Create Your First VP',
                  onClick: () => setIsCreateDialogOpen(true),
                }
          }
        />
      )}

      {/* VP Grid */}
      {!isLoading && !error && vps.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vps.map((vp) => (
            <VPCard
              key={vp.id}
              vp={vp}
              workspaceId={workspaceId}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Create VP Dialog */}
      <CreateVPDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateVP}
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
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}

// Icons
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
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

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
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

