'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { ConnectedApps } from '@/components/settings/connected-apps';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  useIntegrationMutations,
  useIntegrations,
  useWebhooks,
} from '@/hooks/use-integrations';
import { useToast } from '@/hooks/use-toast';

import type { IntegrationProvider } from '@/types/integration';

export default function ConnectedAppsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const workspaceId = params?.workspaceSlug as string;

  // Fetch integrations and webhooks
  const {
    integrations,
    isLoading: integrationsLoading,
    error: integrationsError,
    refetch: refetchIntegrations,
  } = useIntegrations(workspaceId);

  const {
    webhooks,
    isLoading: webhooksLoading,
    error: webhooksError,
  } = useWebhooks(workspaceId);

  const { initiateOAuth } = useIntegrationMutations();

  // Connect a new app via OAuth
  const handleConnectApp = useCallback(
    async (provider: IntegrationProvider) => {
      try {
        const result = await initiateOAuth(workspaceId, provider);
        if (result?.authUrl) {
          // Redirect to OAuth provider
          window.location.href = result.authUrl;
        }
      } catch (error) {
        toast({
          title: 'Connection Failed',
          description:
            error instanceof Error ? error.message : 'Failed to connect app',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [workspaceId, initiateOAuth, toast]
  );

  // Disconnect an app
  const handleDisconnectApp = useCallback(
    async (integrationId: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/integrations/${integrationId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to disconnect app');
        }

        await refetchIntegrations();
      } catch (error) {
        toast({
          title: 'Disconnection Failed',
          description:
            error instanceof Error ? error.message : 'Failed to disconnect app',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [workspaceId, refetchIntegrations, toast]
  );

  // Refresh an app connection
  const handleRefreshConnection = useCallback(
    async (integrationId: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/integrations/${integrationId}/sync`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to refresh connection');
        }

        await refetchIntegrations();
      } catch (error) {
        toast({
          title: 'Refresh Failed',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to refresh connection',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [workspaceId, refetchIntegrations, toast]
  );

  const isLoading = integrationsLoading || webhooksLoading;
  const error = integrationsError || webhooksError;

  if (isLoading) {
    return (
      <div className='flex h-[calc(100vh-4rem)] items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex h-[calc(100vh-4rem)] items-center justify-center'>
        <div className='text-center'>
          <h3 className='text-lg font-semibold text-foreground mb-2'>
            Failed to Load Apps
          </h3>
          <p className='text-sm text-muted-foreground mb-4'>{error.message}</p>
          <button
            onClick={() => router.push(`/${workspaceId}/settings`)}
            className='text-sm text-primary hover:underline'
          >
            Return to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-[calc(100vh-4rem)] flex-col'>
      {/* Header */}
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2 text-sm mb-2'>
          <button
            onClick={() => router.push(`/${workspaceId}/settings`)}
            className='text-muted-foreground hover:text-foreground'
          >
            Settings
          </button>
          <span className='text-muted-foreground'>/</span>
          <span className='font-medium text-foreground'>Connected Apps</span>
        </div>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Connected Apps</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Manage third-party applications, API keys, and webhooks
          </p>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto'>
        <div className='mx-auto max-w-6xl p-6'>
          <ConnectedApps
            workspaceId={workspaceId}
            integrations={integrations}
            webhooks={webhooks}
            onConnectApp={handleConnectApp}
            onDisconnectApp={handleDisconnectApp}
            onRefreshConnection={handleRefreshConnection}
          />
        </div>
      </div>
    </div>
  );
}
