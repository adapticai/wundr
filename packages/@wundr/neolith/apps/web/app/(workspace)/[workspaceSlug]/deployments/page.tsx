'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { usePageHeader } from '@/contexts/page-header-context';

import {
  DeploymentCard,
  DeploymentCardSkeleton,
} from '@/components/deployments/deployment-card';
import { CreateDeploymentModal } from '@/components/deployments/create-deployment-modal';
import { DeploymentLogsPanel } from '@/components/deployments/deployment-logs-panel';
import { useDeployments, useDeploymentLogs } from '@/hooks/use-deployments';

import type {
  DeploymentEnvironment,
  CreateDeploymentInput,
} from '@/types/deployment';

export default function DeploymentsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Deployments',
      'Monitor and manage your deployed services and agents'
    );
  }, [setPageHeader]);

  const [environment, setEnvironment] = useState<DeploymentEnvironment | 'all'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null);

  const { deployments, isLoading, error, createDeployment, mutate } =
    useDeployments(workspaceSlug, {
      environment: environment === 'all' ? undefined : environment,
      search: searchQuery || undefined,
    });

  const { logs, isLoading: isLogsLoading } = useDeploymentLogs(
    workspaceSlug,
    selectedDeploymentId ?? '',
    {
      limit: 200,
    }
  );

  const handleCreateDeployment = async (input: CreateDeploymentInput) => {
    const deployment = await createDeployment(input);
    if (deployment) {
      setIsCreateModalOpen(false);
      mutate();
    }
  };

  const handleViewLogs = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
  };

  const handleRestart = async (deploymentId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/deployments/${deploymentId}/restart`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to restart deployment');
      }

      mutate();
    } catch (error) {
      console.error('Failed to restart deployment:', error);
      alert('Failed to restart deployment. Please try again.');
    }
  };

  const handleStop = async (deploymentId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/deployments/${deploymentId}/stop`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to stop deployment');
      }

      mutate();
    } catch (error) {
      console.error('Failed to stop deployment:', error);
      alert('Failed to stop deployment. Please try again.');
    }
  };

  const handleDelete = async (deploymentId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this deployment? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/deployments/${deploymentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete deployment');
      }

      mutate();
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      alert('Failed to delete deployment. Please try again.');
    }
  };

  // Group all deployments by environment for stats (before client-side filtering)
  const stats = {
    total: deployments.length,
    production: deployments.filter(d => d.environment === 'production').length,
    staging: deployments.filter(d => d.environment === 'staging').length,
    development: deployments.filter(d => d.environment === 'development')
      .length,
    running: deployments.filter(d => d.status === 'running').length,
  };

  // Client-side filtering is no longer needed as API handles it
  const filteredDeployments = deployments;

  return (
    <div className='space-y-6'>
      {/* Action Button */}
      <div className='flex justify-end'>
        <button
          type='button'
          onClick={() => setIsCreateModalOpen(true)}
          className='flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <PlusIcon className='h-4 w-4' />
          New Deployment
        </button>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Total</p>
          <p className='mt-1 text-2xl font-semibold'>{stats.total}</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Running</p>
          <p className='mt-1 text-2xl font-semibold text-green-600'>
            {stats.running}
          </p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Production</p>
          <p className='mt-1 text-2xl font-semibold'>{stats.production}</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Staging</p>
          <p className='mt-1 text-2xl font-semibold'>{stats.staging}</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <p className='text-sm text-muted-foreground'>Development</p>
          <p className='mt-1 text-2xl font-semibold'>{stats.development}</p>
        </div>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setEnvironment('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              environment === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All
          </button>
          <button
            type='button'
            onClick={() => setEnvironment('production')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              environment === 'production'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Production
          </button>
          <button
            type='button'
            onClick={() => setEnvironment('staging')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              environment === 'staging'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Staging
          </button>
          <button
            type='button'
            onClick={() => setEnvironment('development')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              environment === 'development'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Development
          </button>
        </div>

        <div className='relative'>
          <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder='Search deployments...'
            className='w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm sm:w-64'
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-start gap-3'>
            <svg
              className='h-5 w-5 flex-shrink-0 text-red-600'
              viewBox='0 0 20 20'
              fill='currentColor'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                clipRule='evenodd'
              />
            </svg>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-red-800'>
                Failed to load deployments
              </h3>
              <p className='mt-1 text-sm text-red-700'>{error.message}</p>
            </div>
            <button
              type='button'
              onClick={() => mutate()}
              className='text-sm font-medium text-red-600 hover:text-red-500'
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Deployments Grid */}
      {!error && isLoading ? (
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          {Array.from({ length: 4 }, (_, i) => (
            <DeploymentCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      ) : !error && filteredDeployments.length === 0 ? (
        <div className='rounded-lg border bg-card p-8 text-center'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
            <DeployIcon className='h-6 w-6 text-muted-foreground' />
          </div>
          <h3 className='mt-4 text-lg font-medium'>No deployments found</h3>
          <p className='mt-2 text-sm text-muted-foreground'>
            {environment !== 'all'
              ? `No deployments in ${environment} environment.`
              : 'Get started by creating your first deployment.'}
          </p>
          {environment === 'all' && (
            <button
              type='button'
              onClick={() => setIsCreateModalOpen(true)}
              className='mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'
            >
              Create Deployment
            </button>
          )}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          {filteredDeployments.map(deployment => (
            <DeploymentCard
              key={deployment.id}
              deployment={deployment}
              onViewLogs={() => handleViewLogs(deployment.id)}
              onRestart={() => handleRestart(deployment.id)}
              onStop={() => handleStop(deployment.id)}
              onDelete={() => handleDelete(deployment.id)}
            />
          ))}
        </div>
      )}

      {/* Create Deployment Modal */}
      <CreateDeploymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateDeployment}
      />

      {/* Logs Panel */}
      {selectedDeploymentId && (
        <div className='fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4'>
          <div className='h-[600px] w-full max-w-3xl'>
            <DeploymentLogsPanel
              deploymentId={selectedDeploymentId}
              logs={logs}
              isLoading={isLogsLoading}
              onClose={() => {
                setSelectedDeploymentId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <line x1='12' y1='5' x2='12' y2='19' />
      <line x1='5' y1='12' x2='19' y2='12' />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.35-4.35' />
    </svg>
  );
}

function DeployIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' />
    </svg>
  );
}
