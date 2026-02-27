'use client';

import { useParams } from 'next/navigation';
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
  const { toast } = useToast();
  const workspaceSlug = params?.workspaceSlug as string;

  // Fetch integrations and webhooks
  const {
    integrations,
    isLoading: integrationsLoading,
    error: integrationsError,
    refetch: refetchIntegrations,
  } = useIntegrations(workspaceSlug);

  const {
    webhooks,
    isLoading: webhooksLoading,
    error: webhooksError,
  } = useWebhooks(workspaceSlug);

  const { initiateOAuth } = useIntegrationMutations();

  // Connect a new app via OAuth
  const handleConnectApp = useCallback(
    async (provider: IntegrationProvider) => {
      try {
        const result = await initiateOAuth(workspaceSlug, provider);
        if (result?.authUrl) {
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
    [workspaceSlug, initiateOAuth, toast]
  );

  // Disconnect an app
  const handleDisconnectApp = useCallback(
    async (integrationId: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/integrations/${integrationId}`,
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
    [workspaceSlug, refetchIntegrations, toast]
  );

  // Refresh an app connection
  const handleRefreshConnection = useCallback(
    async (integrationId: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/integrations/${integrationId}/sync`,
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
    [workspaceSlug, refetchIntegrations, toast]
  );

  const isLoading = integrationsLoading || webhooksLoading;
  const error = integrationsError || webhooksError;

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-24'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center py-24'>
        <div className='text-center'>
          <h3 className='text-lg font-semibold text-foreground mb-2'>
            Failed to Load Connected Apps
          </h3>
          <p className='text-sm text-muted-foreground mb-4'>{error.message}</p>
          <p className='text-xs text-muted-foreground'>
            Please refresh the page or contact support if the problem persists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Connected Apps</h1>
        <p className='text-muted-foreground'>
          Manage third-party applications, personal API keys, and webhooks.
        </p>
      </div>

      <ConnectedApps
        workspaceId={workspaceSlug}
        integrations={integrations}
        webhooks={webhooks}
        onConnectApp={handleConnectApp}
        onDisconnectApp={handleDisconnectApp}
        onRefreshConnection={handleRefreshConnection}
      />
    </div>
  );
}
