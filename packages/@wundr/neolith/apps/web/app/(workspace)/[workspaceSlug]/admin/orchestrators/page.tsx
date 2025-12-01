'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Filter } from 'lucide-react';

import { usePageHeader } from '@/contexts/page-header-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { OrchestratorCardAdmin } from '@/components/admin/orchestrators/orchestrator-card';
import { useOrchestrators } from '@/hooks/use-orchestrator';
import type {
  OrchestratorFilters,
  OrchestratorStatus,
} from '@/types/orchestrator';

export default function AdminOrchestratorsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  const [filters, setFilters] = useState<OrchestratorFilters>({});
  const [searchQuery, setSearchQuery] = useState('');

  const { orchestrators, isLoading, error, refetch } = useOrchestrators(
    workspaceSlug,
    filters
  );

  useEffect(() => {
    setPageHeader(
      'Orchestrator Management',
      'Manage and monitor all workspace orchestrators'
    );
  }, [setPageHeader]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setFilters(prev => ({ ...prev, search: value || undefined }));
  }, []);

  const handleStatusFilter = useCallback((value: string) => {
    setFilters(prev => ({
      ...prev,
      status: value ? (value as OrchestratorStatus) : undefined,
    }));
  }, []);

  const handleConfigure = useCallback(
    (id: string) => {
      router.push(`/${workspaceSlug}/admin/orchestrators/${id}`);
    },
    [router, workspaceSlug]
  );

  const handleAddNew = useCallback(() => {
    router.push(`/${workspaceSlug}/orchestrators/new`);
  }, [router, workspaceSlug]);

  const stats = {
    total: orchestrators.length,
    online: orchestrators.filter(o => o.status === 'ONLINE').length,
    offline: orchestrators.filter(o => o.status === 'OFFLINE').length,
    busy: orchestrators.filter(o => o.status === 'BUSY').length,
  };

  return (
    <div className='space-y-6'>
      {/* Stats Overview */}
      <div className='grid gap-4 md:grid-cols-4'>
        <StatCard label='Total Orchestrators' value={stats.total} />
        <StatCard label='Online' value={stats.online} color='text-green-600' />
        <StatCard label='Busy' value={stats.busy} color='text-yellow-600' />
        <StatCard label='Offline' value={stats.offline} color='text-gray-600' />
      </div>

      {/* Filters and Actions */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-1 gap-2'>
          <div className='relative flex-1 max-w-sm'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search orchestrators...'
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select onValueChange={handleStatusFilter}>
            <SelectTrigger className='w-[180px]'>
              <Filter className='h-4 w-4 mr-2' />
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=''>All Statuses</SelectItem>
              <SelectItem value='ONLINE'>Online</SelectItem>
              <SelectItem value='OFFLINE'>Offline</SelectItem>
              <SelectItem value='BUSY'>Busy</SelectItem>
              <SelectItem value='AWAY'>Away</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className='h-4 w-4 mr-2' />
          New Orchestrator
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <p className='text-sm text-red-800'>
            Failed to load orchestrators: {error.message}
          </p>
          <Button
            variant='outline'
            size='sm'
            onClick={refetch}
            className='mt-2'
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className='animate-pulse rounded-lg border bg-card p-6'
            >
              <div className='space-y-4'>
                <div className='h-12 w-12 rounded-lg bg-muted' />
                <div className='h-4 w-3/4 rounded bg-muted' />
                <div className='h-4 w-1/2 rounded bg-muted' />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && orchestrators.length === 0 && (
        <EmptyState
          icon={Plus}
          title='No Orchestrators Found'
          description='Get started by creating your first orchestrator to manage workspace operations.'
          action={{
            label: 'Create Orchestrator',
            onClick: handleAddNew,
          }}
        />
      )}

      {/* Orchestrators Grid */}
      {!isLoading && !error && orchestrators.length > 0 && (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {orchestrators.map(orchestrator => (
            <OrchestratorCardAdmin
              key={orchestrator.id}
              orchestrator={orchestrator}
              workspaceSlug={workspaceSlug}
              onConfigure={handleConfigure}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-foreground',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className='rounded-lg border bg-card p-6'>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}
