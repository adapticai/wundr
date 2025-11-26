'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

import { DeploymentCard, DeploymentCardSkeleton } from '@/components/deployments/deployment-card';
import { CreateDeploymentModal } from '@/components/deployments/create-deployment-modal';
import { DeploymentLogsPanel } from '@/components/deployments/deployment-logs-panel';
import { useDeployments, useDeploymentLogs } from '@/hooks/use-deployments';

import type { DeploymentEnvironment, CreateDeploymentInput } from '@/types/deployment';

export default function DeploymentsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [environment, setEnvironment] = useState<DeploymentEnvironment | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);

  const { deployments, isLoading, createDeployment, mutate } = useDeployments(workspaceId, {
    environment: environment === 'all' ? undefined : environment,
    search: searchQuery || undefined,
  });

  const {
    logs,
    isLoading: isLogsLoading,
  } = useDeploymentLogs(workspaceId, selectedDeploymentId ?? '', {
    limit: 200,
  });

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
    console.log('Restart deployment:', deploymentId);
    // In production, would call API endpoint
    await new Promise((resolve) => setTimeout(resolve, 1000));
    mutate();
  };

  const handleStop = async (deploymentId: string) => {
    console.log('Stop deployment:', deploymentId);
    // In production, would call API endpoint
    await new Promise((resolve) => setTimeout(resolve, 500));
    mutate();
  };

  const handleDelete = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to delete this deployment?')) {
      return;
    }
    console.log('Delete deployment:', deploymentId);
    // In production, would call API endpoint
    await new Promise((resolve) => setTimeout(resolve, 500));
    mutate();
  };

  const filteredDeployments = deployments.filter((d) => {
    if (environment !== 'all' && d.environment !== environment) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group deployments by environment for stats
  const stats = {
    total: deployments.length,
    production: deployments.filter((d) => d.environment === 'production').length,
    staging: deployments.filter((d) => d.environment === 'staging').length,
    development: deployments.filter((d) => d.environment === 'development').length,
    running: deployments.filter((d) => d.status === 'running').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deployments</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor and manage your deployed services and agents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="h-4 w-4" />
          New Deployment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Running</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">{stats.running}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Production</p>
          <p className="mt-1 text-2xl font-semibold">{stats.production}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Staging</p>
          <p className="mt-1 text-2xl font-semibold">{stats.staging}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Development</p>
          <p className="mt-1 text-2xl font-semibold">{stats.development}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button
            type="button"
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
            type="button"
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
            type="button"
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
            type="button"
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

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deployments..."
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm sm:w-64"
          />
        </div>
      </div>

      {/* Deployments Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <DeploymentCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredDeployments.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <DeployIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No deployments found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {environment !== 'all'
              ? `No deployments in ${environment} environment.`
              : 'Get started by creating your first deployment.'}
          </p>
          {environment === 'all' && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create Deployment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredDeployments.map((deployment) => (
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
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4">
          <div className="h-[600px] w-full max-w-3xl">
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
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function DeployIcon({ className }: { className?: string }) {
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
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
