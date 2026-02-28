'use client';

import { Plus, Search, Sparkles, AlertCircle, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { CreateDeploymentModal } from '@/components/deployments/create-deployment-modal';
import {
  DeploymentCard,
  DeploymentCardSkeleton,
} from '@/components/deployments/deployment-card';
import { DeploymentLogsPanel } from '@/components/deployments/deployment-logs-panel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { usePageHeader } from '@/contexts/page-header-context';
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    setActionError(null);
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
      setActionError('Failed to restart deployment. Please try again.');
    }
  };

  const handleStop = async (deploymentId: string) => {
    setActionError(null);
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
      setActionError('Failed to stop deployment. Please try again.');
    }
  };

  const handleDelete = (deploymentId: string) => {
    setDeleteTargetId(deploymentId);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setActionError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/deployments/${deleteTargetId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete deployment');
      }

      setDeleteTargetId(null);
      mutate();
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      setDeleteTargetId(null);
      setActionError('Failed to delete deployment. Please try again.');
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
    <div className='p-4 md:p-6 space-y-6'>
      {/* Page Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Deployments</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Monitor and manage your deployed services and agents
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          New Deployment
        </Button>
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
          {(['all', 'production', 'staging', 'development'] as const).map(
            env => (
              <Button
                key={env}
                type='button'
                variant={environment === env ? 'default' : 'outline'}
                size='sm'
                onClick={() => setEnvironment(env)}
              >
                {env.charAt(0).toUpperCase() + env.slice(1)}
              </Button>
            )
          )}
        </div>

        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder='Search deployments...'
            className='pl-9 w-full sm:w-64'
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Failed to load deployments</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>{error.message}</span>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => mutate()}
              className='ml-4 shrink-0'
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Deployments Grid */}
      {!error && isLoading ? (
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          {Array.from({ length: 4 }, (_, i) => (
            <DeploymentCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      ) : !error && filteredDeployments.length === 0 ? (
        <div className='rounded-lg border bg-card'>
          <EmptyState
            icon={Sparkles}
            title='No deployments found'
            description={
              environment !== 'all'
                ? `No deployments exist in the ${environment} environment.`
                : 'Deploy your first service or agent to get started.'
            }
            action={
              environment === 'all'
                ? {
                    label: 'Create Deployment',
                    onClick: () => setIsCreateModalOpen(true),
                  }
                : undefined
            }
          />
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

      {/* Action Error */}
      {actionError && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription className='flex items-center justify-between'>
            <span>{actionError}</span>
            <Button
              variant='ghost'
              size='icon'
              className='ml-2 h-5 w-5 shrink-0'
              onClick={() => setActionError(null)}
            >
              <X className='h-3 w-3' />
              <span className='sr-only'>Dismiss</span>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={open => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deployment? This action
              cannot be undone and any running services will be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
