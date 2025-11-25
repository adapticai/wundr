'use client';

import { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { INTEGRATION_PROVIDERS } from '@/types/integration';

import { IntegrationCard, IntegrationCardSkeleton } from './integration-card';

import type { IntegrationConfig, IntegrationProvider, IntegrationStatus } from '@/types/integration';

/**
 * Props for the IntegrationList component
 */
export interface IntegrationListProps {
  /** Array of integration configurations to display */
  integrations: IntegrationConfig[];
  /** Loading state for the list */
  isLoading?: boolean;
  /** Callback fired when testing an integration */
  onTest: (integration: IntegrationConfig) => void;
  /** Callback fired when syncing an integration */
  onSync: (integration: IntegrationConfig) => void;
  /** Callback to open integration settings */
  onSettings: (integration: IntegrationConfig) => void;
  /** Callback to disconnect an integration */
  onDisconnect: (integration: IntegrationConfig) => void;
  /** Callback to open the add integration dialog */
  onAddNew?: () => void;
  /** Additional CSS class names */
  className?: string;
}

type ViewMode = 'grid' | 'list';

export function IntegrationList({
  integrations,
  isLoading = false,
  onTest,
  onSync,
  onSettings,
  onDisconnect,
  onAddNew,
  className,
}: IntegrationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<IntegrationProvider | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IntegrationStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Get unique providers from integrations for filter options
  const availableProviders = useMemo(() => {
    const providers = new Set(integrations.map((i) => i.provider));
    return Array.from(providers);
  }, [integrations]);

  // Filter integrations
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          integration.name.toLowerCase().includes(query) ||
          integration.description?.toLowerCase().includes(query) ||
          INTEGRATION_PROVIDERS[integration.provider].name.toLowerCase().includes(query);
        if (!matchesSearch) {
return false;
}
      }

      // Provider filter
      if (providerFilter !== 'all' && integration.provider !== providerFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && integration.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [integrations, searchQuery, providerFilter, statusFilter]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setProviderFilter('all');
    setStatusFilter('all');
  }, []);

  const hasFilters = searchQuery.trim() || providerFilter !== 'all' || statusFilter !== 'all';

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Filters Skeleton */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-10 flex-1 min-w-[200px] animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded-md bg-muted" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <IntegrationCardSkeleton key={i} />
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
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Provider Filter */}
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value as IntegrationProvider | 'all')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Filter by provider"
        >
          <option value="all">All Providers</option>
          {availableProviders.map((provider) => (
            <option key={provider} value={provider}>
              {INTEGRATION_PROVIDERS[provider].name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IntegrationStatus | 'all')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
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
            Add Integration
          </button>
        )}
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {filteredIntegrations.length} of {integrations.length} integrations
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

      {/* Integration Grid/List */}
      {filteredIntegrations.length === 0 ? (
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
          {filteredIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onTest={() => onTest(integration)}
              onSync={() => onSync(integration)}
              onSettings={() => onSettings(integration)}
              onDisconnect={() => onDisconnect(integration)}
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
      <IntegrationEmptyIcon className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {hasFilters ? 'No integrations found' : 'No integrations yet'}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your filters to find what you are looking for.'
          : 'Connect your first integration to get started.'}
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
            Add Integration
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
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function IntegrationEmptyIcon({ className }: { className?: string }) {
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
      <path d="M14 4a2 2 0 0 1 2-2" />
      <path d="M16 4a2 2 0 0 1 2 2" />
      <path d="M18 6v2" />
      <path d="M6 6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
      <path d="M6 12H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
      <path d="M18 12h2a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
      <path d="M10 20v2" />
      <path d="M14 20v2" />
    </svg>
  );
}
