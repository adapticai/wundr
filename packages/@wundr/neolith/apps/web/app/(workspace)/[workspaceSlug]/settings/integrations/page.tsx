'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';
import {
  useIntegrations,
  useIntegrationMutations,
  useWebhooks,
} from '@/hooks/use-integrations';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUS_CONFIG,
  WEBHOOK_EVENTS,
} from '@/types/integration';

import type {
  IntegrationConfig,
  IntegrationProvider,
  WebhookConfig,
  CreateWebhookInput,
  WebhookEventType,
} from '@/types/integration';

// OAuth providers that are personal accounts
const OAUTH_PROVIDERS: IntegrationProvider[] = [
  'google_drive',
  'github',
  'gitlab',
];

// App-based integrations
const APP_PROVIDERS: IntegrationProvider[] = [
  'slack',
  'discord',
  'teams',
  'jira',
  'notion',
  'linear',
  'asana',
  'trello',
  'dropbox',
  'zapier',
];

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.workspaceSlug as string;
  const { toast } = useToast();

  const [showConnectAccountModal, setShowConnectAccountModal] = useState(false);
  const [showInstallAppModal, setShowInstallAppModal] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationConfig | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(
    null
  );
  const [showAllWebhooks, setShowAllWebhooks] = useState(false);

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
    createWebhook,
    refetch: refetchWebhooks,
  } = useWebhooks(workspaceId);

  const { initiateOAuth, isLoading: oauthLoading } = useIntegrationMutations();

  const handleBack = useCallback(() => {
    router.push(`/${workspaceId}/settings`);
  }, [router, workspaceId]);

  const handleConnectIntegration = useCallback(
    async (provider: IntegrationProvider) => {
      const result = await initiateOAuth(workspaceId, provider);
      if (result?.authUrl) {
        window.location.href = result.authUrl;
      }
    },
    [workspaceId, initiateOAuth]
  );

  const handleCreateWebhook = useCallback(
    async (input: CreateWebhookInput) => {
      const result = await createWebhook(input);
      if (result) {
        setShowWebhookForm(false);
        refetchWebhooks();
      }
    },
    [createWebhook, refetchWebhooks]
  );

  // Separate integrations by type
  const connectedAccounts = integrations.filter(i =>
    OAUTH_PROVIDERS.includes(i.provider)
  );
  const installedApps = integrations.filter(i =>
    APP_PROVIDERS.includes(i.provider)
  );

  const isLoading = integrationsLoading || webhooksLoading;
  const error = integrationsError || webhooksError;

  return (
    <div className='flex h-[calc(100vh-4rem)] flex-col'>
      {/* Header with Breadcrumb */}
      <div className='flex h-14 items-center gap-4 border-b px-6'>
        <button
          type='button'
          onClick={handleBack}
          className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
          aria-label='Go back'
        >
          <BackIcon className='h-5 w-5' />
        </button>
        <div className='flex items-center gap-2 text-sm'>
          <span className='text-muted-foreground'>Settings</span>
          <ChevronRightIcon className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium text-foreground'>Integrations</span>
        </div>
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto'>
        <div className='mx-auto max-w-5xl space-y-8'>
          {error && (
            <div className='rounded-md border border-destructive/50 bg-destructive/10 p-4'>
              <p className='text-sm text-destructive'>{error.message}</p>
            </div>
          )}

          {isLoading ? (
            <div className='flex h-64 items-center justify-center'>
              <LoadingSpinner size='lg' />
            </div>
          ) : (
            <>
              {/* Connected Accounts Section */}
              <section>
                <div className='mb-4 flex items-end justify-between'>
                  <div>
                    <h2 className='text-lg font-semibold text-foreground'>
                      Connected Accounts
                    </h2>
                    <p className='text-sm text-muted-foreground'>
                      Personal OAuth connections for accessing your data
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowConnectAccountModal(true)}
                    className='flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                  >
                    <PlusIcon className='h-4 w-4' />
                    Connect Account
                  </button>
                </div>

                {connectedAccounts.length === 0 ? (
                  <Card>
                    <CardContent className='flex flex-col items-center justify-center py-12'>
                      <UserIcon className='h-12 w-12 text-muted-foreground/50' />
                      <h3 className='mt-4 font-medium text-foreground'>
                        No accounts connected
                      </h3>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        Connect your Google, GitHub, or GitLab account
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className='space-y-2'>
                    {connectedAccounts.map(integration => (
                      <AccountCard
                        key={integration.id}
                        integration={integration}
                        onClick={() => setSelectedIntegration(integration)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              {/* Installed Apps Section */}
              <section>
                <div className='mb-4 flex items-end justify-between'>
                  <div>
                    <h2 className='text-lg font-semibold text-foreground'>
                      Installed Apps
                    </h2>
                    <p className='text-sm text-muted-foreground'>
                      Third-party applications connected to your workspace
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowInstallAppModal(true)}
                    className='flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent'
                  >
                    <GridIcon className='h-4 w-4' />
                    Browse Apps
                  </button>
                </div>

                {installedApps.length === 0 ? (
                  <Card>
                    <CardContent className='flex flex-col items-center justify-center py-12'>
                      <IntegrationIcon className='h-12 w-12 text-muted-foreground/50' />
                      <h3 className='mt-4 font-medium text-foreground'>
                        No apps installed
                      </h3>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        Install apps to extend your workspace functionality
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className='grid gap-4 sm:grid-cols-2'>
                    {installedApps.map(integration => (
                      <AppCard
                        key={integration.id}
                        integration={integration}
                        onClick={() => setSelectedIntegration(integration)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              {/* Webhooks Section */}
              <section>
                <div className='mb-4 flex items-end justify-between'>
                  <div>
                    <h2 className='text-lg font-semibold text-foreground'>
                      Webhooks
                    </h2>
                    <p className='text-sm text-muted-foreground'>
                      Send real-time event notifications to external services
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowWebhookForm(true)}
                    className='flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                  >
                    <PlusIcon className='h-4 w-4' />
                    Create Webhook
                  </button>
                </div>

                {webhooks.length === 0 ? (
                  <Card>
                    <CardContent className='flex flex-col items-center justify-center py-12'>
                      <WebhookIcon className='h-12 w-12 text-muted-foreground/50' />
                      <h3 className='mt-4 font-medium text-foreground'>
                        No webhooks configured
                      </h3>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        Create a webhook to receive real-time event
                        notifications in your external services
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className='space-y-2'>
                    {(showAllWebhooks ? webhooks : webhooks.slice(0, 5)).map(
                      webhook => (
                        <WebhookListItem
                          key={webhook.id}
                          webhook={webhook}
                          onClick={() => setSelectedWebhook(webhook)}
                        />
                      )
                    )}
                    {webhooks.length > 5 && (
                      <button
                        type='button'
                        onClick={() => setShowAllWebhooks(prev => !prev)}
                        className='w-full rounded-md border border-dashed py-2 text-sm text-muted-foreground hover:bg-accent'
                      >
                        {showAllWebhooks
                          ? 'Show fewer webhooks'
                          : `View all ${webhooks.length} webhooks`}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Developer Settings Section */}
              <section>
                <Accordion type='single' collapsible>
                  <AccordionItem value='developer'>
                    <AccordionTrigger className='text-lg font-semibold'>
                      <div className='flex items-center gap-2'>
                        <CodeIcon className='h-5 w-5' />
                        Developer Settings
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className='space-y-6 pt-2'>
                        <div>
                          <h3 className='mb-2 text-sm font-medium text-foreground'>
                            Personal Access Tokens
                          </h3>
                          <p className='mb-4 text-sm text-muted-foreground'>
                            Use personal access tokens to authenticate API
                            requests from scripts, CI pipelines, or external
                            tools. Tokens have the same permissions as your
                            account.
                          </p>
                          <Card>
                            <CardContent className='flex flex-col items-center justify-center py-8 text-center'>
                              <KeyIcon className='h-10 w-10 text-muted-foreground/50' />
                              <h4 className='mt-3 font-medium text-foreground'>
                                No tokens created yet
                              </h4>
                              <p className='mt-1 text-sm text-muted-foreground'>
                                Generate a token to start using the API
                              </p>
                              <button
                                type='button'
                                onClick={() =>
                                  router.push(
                                    `/${workspaceId}/settings/advanced`
                                  )
                                }
                                className='mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent'
                              >
                                Manage API Tokens
                              </button>
                            </CardContent>
                          </Card>
                        </div>

                        <Separator />

                        <div>
                          <h3 className='mb-2 text-sm font-medium text-foreground'>
                            API Documentation
                          </h3>
                          <p className='mb-3 text-sm text-muted-foreground'>
                            Explore the REST API reference, authentication
                            guides, and integration examples.
                          </p>
                          <a
                            href='https://docs.adaptic.ai/api'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center gap-2 text-sm text-primary hover:underline'
                          >
                            View API Documentation
                            <ExternalLinkIcon className='h-4 w-4' />
                          </a>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Connect Account Modal */}
      {showConnectAccountModal && (
        <IntegrationConnectModal
          isOpen={showConnectAccountModal}
          onClose={() => setShowConnectAccountModal(false)}
          onConnect={handleConnectIntegration}
          isLoading={oauthLoading}
          providers={OAUTH_PROVIDERS}
          title='Connect Account'
        />
      )}

      {/* Install App Modal */}
      {showInstallAppModal && (
        <IntegrationConnectModal
          isOpen={showInstallAppModal}
          onClose={() => setShowInstallAppModal(false)}
          onConnect={handleConnectIntegration}
          isLoading={oauthLoading}
          providers={APP_PROVIDERS}
          title='Browse Apps'
        />
      )}

      {/* Create Webhook Modal */}
      {showWebhookForm && (
        <WebhookFormModal
          isOpen={showWebhookForm}
          onClose={() => setShowWebhookForm(false)}
          onSubmit={handleCreateWebhook}
        />
      )}

      {/* Integration Detail Modal */}
      {selectedIntegration && (
        <IntegrationDetailModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onUpdate={() => {
            setSelectedIntegration(null);
            refetchIntegrations();
          }}
        />
      )}

      {/* Webhook Detail Modal */}
      {selectedWebhook && (
        <WebhookDetailModal
          webhook={selectedWebhook}
          workspaceId={workspaceId}
          onClose={() => setSelectedWebhook(null)}
          onUpdate={() => {
            setSelectedWebhook(null);
            refetchWebhooks();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Card Components
// =============================================================================

interface AccountCardProps {
  integration: IntegrationConfig;
  onClick: () => void;
}

function AccountCard({ integration, onClick }: AccountCardProps) {
  const providerInfo = INTEGRATION_PROVIDERS[integration.provider];
  const statusConfig = INTEGRATION_STATUS_CONFIG[integration.status];

  return (
    <div className='flex w-full items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50'>
      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-bold'>
        {providerInfo?.icon ||
          integration.provider.substring(0, 2).toUpperCase()}
      </div>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <h3 className='font-medium text-foreground'>
            {providerInfo?.name || integration.provider}
          </h3>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <p className='mt-0.5 text-sm text-muted-foreground'>
          {integration.name}
        </p>
        {integration.lastSyncAt && (
          <p className='mt-1 text-xs text-muted-foreground'>
            Last synced {new Date(integration.lastSyncAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <button
        type='button'
        onClick={onClick}
        className='rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent'
      >
        Manage
      </button>
    </div>
  );
}

interface AppCardProps {
  integration: IntegrationConfig;
  onClick: () => void;
}

function AppCard({ integration, onClick }: AppCardProps) {
  const providerInfo = INTEGRATION_PROVIDERS[integration.provider];
  const statusConfig = INTEGRATION_STATUS_CONFIG[integration.status];

  return (
    <button
      type='button'
      onClick={onClick}
      className='flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50'
    >
      <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold'>
        {providerInfo?.icon ||
          integration.provider.substring(0, 2).toUpperCase()}
      </div>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <h3 className='truncate font-medium text-foreground'>
            {integration.name}
          </h3>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          {providerInfo?.name || integration.provider}
        </p>
        {integration.lastSyncAt && (
          <p className='mt-1 text-xs text-muted-foreground'>
            Last synced: {new Date(integration.lastSyncAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <ChevronRightIcon className='h-5 w-5 shrink-0 text-muted-foreground' />
    </button>
  );
}

interface WebhookListItemProps {
  webhook: WebhookConfig;
  onClick: () => void;
}

function WebhookListItem({ webhook, onClick }: WebhookListItemProps) {
  const statusColor =
    webhook.status === 'active'
      ? 'bg-green-500'
      : webhook.status === 'disabled'
        ? 'bg-red-500'
        : 'bg-gray-500';

  return (
    <button
      type='button'
      onClick={onClick}
      className='flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50'
    >
      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', statusColor)} />
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <h3 className='truncate font-medium text-foreground'>
            {webhook.name}
          </h3>
        </div>
        <p className='mt-1 truncate text-sm text-muted-foreground'>
          {webhook.url}
        </p>
        <div className='mt-2 flex flex-wrap gap-1'>
          {webhook.events.slice(0, 2).map(event => (
            <span
              key={event}
              className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'
            >
              {event}
            </span>
          ))}
          {webhook.events.length > 2 && (
            <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>
              +{webhook.events.length - 2} more
            </span>
          )}
        </div>
      </div>
      <div className='text-right'>
        {webhook.failureCount > 0 ? (
          <p className='text-sm text-destructive'>
            {webhook.failureCount} failures
          </p>
        ) : (
          <p className='text-sm text-green-600'>
            {webhook.successCount} delivered
          </p>
        )}
      </div>
      <ChevronRightIcon className='h-5 w-5 shrink-0 text-muted-foreground' />
    </button>
  );
}

// =============================================================================
// Modals
// =============================================================================

interface IntegrationConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: IntegrationProvider) => void;
  isLoading: boolean;
  providers: IntegrationProvider[];
  title: string;
}

function IntegrationConnectModal({
  isOpen,
  onClose,
  onConnect,
  isLoading,
  providers,
  title,
}: IntegrationConnectModalProps) {
  if (!isOpen) {
    return null;
  }

  const providerEntries = providers.map(
    id => [id, INTEGRATION_PROVIDERS[id]] as const
  );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={onClose} />
      <div className='relative z-10 w-full max-w-2xl rounded-lg bg-background p-6 shadow-xl'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold'>{title}</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        <div className='grid gap-3 sm:grid-cols-2 max-h-96 overflow-y-auto'>
          {providerEntries.map(([id, info]) => (
            <button
              key={id}
              type='button'
              onClick={() => onConnect(id)}
              disabled={isLoading}
              className='flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 disabled:opacity-50'
            >
              <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold'>
                {info.icon}
              </div>
              <div>
                <h3 className='font-medium text-foreground'>{info.name}</h3>
                <p className='text-sm text-muted-foreground'>
                  {info.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface WebhookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateWebhookInput) => void;
}

function WebhookFormModal({
  isOpen,
  onClose,
  onSubmit,
}: WebhookFormModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || selectedEvents.length === 0) {
      return;
    }

    setIsSubmitting(true);
    await onSubmit({
      name,
      url,
      description: description || undefined,
      events: selectedEvents,
    });
    setIsSubmitting(false);
  };

  const toggleEvent = (event: WebhookEventType) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={onClose} />
      <div className='relative z-10 w-full max-w-xl rounded-lg bg-background p-6 shadow-xl'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold'>Create Webhook</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label
              htmlFor='webhook-name'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Name
            </label>
            <input
              id='webhook-name'
              type='text'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='My Webhook'
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              required
            />
          </div>

          <div>
            <label
              htmlFor='webhook-url'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Endpoint URL
            </label>
            <input
              id='webhook-url'
              type='url'
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder='https://example.com/webhook'
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              required
            />
          </div>

          <div>
            <label
              htmlFor='webhook-description'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Description (optional)
            </label>
            <textarea
              id='webhook-description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='What is this webhook for?'
              rows={2}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              Events
            </label>
            <div className='max-h-48 overflow-y-auto space-y-2 rounded-md border p-3'>
              {(
                Object.entries(WEBHOOK_EVENTS) as [
                  WebhookEventType,
                  { label: string; description: string },
                ][]
              ).map(([event, info]) => (
                <label
                  key={event}
                  className='flex items-start gap-2 cursor-pointer'
                >
                  <input
                    type='checkbox'
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className='mt-0.5 h-4 w-4 rounded border-gray-300'
                  />
                  <div>
                    <span className='text-sm font-medium text-foreground'>
                      {info.label}
                    </span>
                    <p className='text-xs text-muted-foreground'>
                      {info.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            {selectedEvents.length === 0 && (
              <p className='mt-1 text-xs text-destructive'>
                Select at least one event
              </p>
            )}
          </div>

          <div className='flex justify-end gap-2 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={
                !name || !url || selectedEvents.length === 0 || isSubmitting
              }
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
            >
              {isSubmitting ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface IntegrationDetailModalProps {
  integration: IntegrationConfig;
  onClose: () => void;
  onUpdate: () => void;
}

function IntegrationDetailModal({
  integration,
  onClose,
  onUpdate,
}: IntegrationDetailModalProps) {
  const providerInfo = INTEGRATION_PROVIDERS[integration.provider];
  const statusConfig = INTEGRATION_STATUS_CONFIG[integration.status];
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const { toast } = useToast();

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${integration.id}/integrations/${integration.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error('Failed to disconnect integration');
      }
      toast({
        title: 'Integration disconnected',
        description: `${providerInfo?.name ?? integration.name} has been disconnected.`,
      });
      onUpdate();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={onClose} />
      <div className='relative z-10 w-full max-w-lg rounded-lg bg-background p-6 shadow-xl'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold'>
              {providerInfo?.icon ||
                integration.provider.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className='text-lg font-semibold'>{integration.name}</h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  statusConfig.bgColor,
                  statusConfig.color
                )}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <h3 className='text-sm font-medium text-muted-foreground'>
              Provider
            </h3>
            <p className='text-foreground'>
              {providerInfo?.name || integration.provider}
            </p>
          </div>

          {integration.description && (
            <div>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Description
              </h3>
              <p className='text-foreground'>{integration.description}</p>
            </div>
          )}

          <div>
            <h3 className='text-sm font-medium text-muted-foreground'>
              Connected
            </h3>
            <p className='text-foreground'>
              {new Date(integration.createdAt).toLocaleString()}
            </p>
          </div>

          {integration.lastSyncAt && (
            <div>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Last Synced
              </h3>
              <p className='text-foreground'>
                {new Date(integration.lastSyncAt).toLocaleString()}
              </p>
            </div>
          )}

          {integration.errorMessage && (
            <div className='rounded-md border border-destructive/50 bg-destructive/10 p-3'>
              <h3 className='text-sm font-medium text-destructive'>
                Connection Error
              </h3>
              <p className='mt-1 text-sm text-destructive'>
                {integration.errorMessage}
              </p>
            </div>
          )}

          {confirmDisconnect && (
            <div className='rounded-md border border-destructive/50 bg-destructive/10 p-3'>
              <p className='text-sm font-medium text-destructive'>
                Disconnect {providerInfo?.name ?? integration.name}?
              </p>
              <p className='mt-1 text-sm text-destructive/80'>
                This will remove the integration and revoke all associated
                permissions. This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        <div className='flex justify-end gap-2 mt-6'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
          >
            Cancel
          </button>
          {confirmDisconnect ? (
            <button
              type='button'
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className='rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50'
            >
              {isDisconnecting ? 'Disconnecting...' : 'Confirm Disconnect'}
            </button>
          ) : (
            <button
              type='button'
              onClick={() => setConfirmDisconnect(true)}
              className='rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90'
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface WebhookDetailModalProps {
  webhook: WebhookConfig;
  workspaceId: string;
  onClose: () => void;
  onUpdate: () => void;
}

function WebhookDetailModal({
  webhook,
  workspaceId,
  onClose,
  onUpdate,
}: WebhookDetailModalProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const statusStyles: Record<string, string> = {
    active: 'text-green-600 bg-green-500/10',
    inactive: 'text-gray-600 bg-gray-500/10',
    disabled: 'text-red-600 bg-red-500/10',
  };
  const statusLabels: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    disabled: 'Disabled',
  };
  const statusColor =
    statusStyles[webhook.status] ?? 'text-gray-600 bg-gray-500/10';
  const statusLabel = statusLabels[webhook.status] ?? webhook.status;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/webhooks/${webhook.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }
      toast({
        title: 'Webhook deleted',
        description: `"${webhook.name}" has been removed.`,
      });
      onUpdate();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete webhook. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={onClose} />
      <div className='relative z-10 w-full max-w-lg rounded-lg bg-background p-6 shadow-xl'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-lg font-semibold'>{webhook.name}</h2>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                statusColor
              )}
            >
              {statusLabel}
            </span>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <h3 className='text-sm font-medium text-muted-foreground'>
              Endpoint URL
            </h3>
            <p className='text-foreground break-all'>{webhook.url}</p>
          </div>

          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-1'>
              Signing Secret
            </h3>
            <p className='mb-1 text-xs text-muted-foreground'>
              Use this secret to verify that incoming requests originate from
              this webhook.
            </p>
            <div className='flex items-center gap-2'>
              <code className='flex-1 rounded bg-muted px-2 py-1 text-sm font-mono'>
                {showSecret ? webhook.secret : '•'.repeat(32)}
              </code>
              <button
                type='button'
                onClick={() => setShowSecret(!showSecret)}
                aria-label={showSecret ? 'Hide secret' : 'Reveal secret'}
                className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
              >
                {showSecret ? (
                  <EyeOffIcon className='h-4 w-4' />
                ) : (
                  <EyeIcon className='h-4 w-4' />
                )}
              </button>
            </div>
          </div>

          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-2'>
              Subscribed Events
            </h3>
            <div className='flex flex-wrap gap-1'>
              {webhook.events.map(event => (
                <span
                  key={event}
                  className='rounded bg-muted px-2 py-1 text-xs text-foreground'
                >
                  {event}
                </span>
              ))}
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Successful Deliveries
              </h3>
              <p className='text-foreground'>{webhook.successCount || 0}</p>
            </div>
            <div>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Failed Deliveries
              </h3>
              <p
                className={
                  webhook.failureCount > 0
                    ? 'text-destructive'
                    : 'text-foreground'
                }
              >
                {webhook.failureCount}
              </p>
            </div>
          </div>

          {webhook.lastDeliveryAt && (
            <div>
              <h3 className='text-sm font-medium text-muted-foreground'>
                Last Delivery
              </h3>
              <p className='text-foreground'>
                {new Date(webhook.lastDeliveryAt).toLocaleString()}
              </p>
            </div>
          )}

          <div>
            <h3 className='text-sm font-medium text-muted-foreground'>
              Created
            </h3>
            <p className='text-foreground'>
              {new Date(webhook.createdAt).toLocaleString()}
            </p>
          </div>

          {confirmDelete && (
            <div className='rounded-md border border-destructive/50 bg-destructive/10 p-3'>
              <p className='text-sm font-medium text-destructive'>
                Delete this webhook?
              </p>
              <p className='mt-1 text-sm text-destructive/80'>
                All delivery history will be permanently removed. This cannot be
                undone.
              </p>
            </div>
          )}
        </div>

        <div className='flex justify-end gap-2 mt-6'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
          >
            Cancel
          </button>
          {confirmDelete ? (
            <button
              type='button'
              onClick={handleDelete}
              disabled={isDeleting}
              className='rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50'
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          ) : (
            <button
              type='button'
              onClick={() => setConfirmDelete(true)}
              className='rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Webhook
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m15 18-6-6 6-6' />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m9 18 6-6-6-6' />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M12 5v14' />
      <path d='M5 12h14' />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function IntegrationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z' />
      <path d='m9 12 2 2 4-4' />
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2' />
      <path d='m6 17 3.13-5.78c.53-.97.43-2.17-.26-3.03A4 4 0 0 1 8 4a4 4 0 0 1 6.86 2' />
      <path d='m12 6 3.13 5.73c.53.98 1.58 1.57 2.68 1.54 1.82-.05 3.5 1.23 3.95 3A4 4 0 0 1 18 20' />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M9.88 9.88a3 3 0 1 0 4.24 4.24' />
      <path d='M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' />
      <path d='M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' />
      <line x1='2' x2='22' y1='2' y2='22' />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='3' y='3' width='7' height='7' />
      <rect x='14' y='3' width='7' height='7' />
      <rect x='14' y='14' width='7' height='7' />
      <rect x='3' y='14' width='7' height='7' />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polyline points='16 18 22 12 16 6' />
      <polyline points='8 6 2 12 8 18' />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
      <polyline points='15 3 21 3 21 9' />
      <line x1='10' y1='14' x2='21' y2='3' />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='7.5' cy='15.5' r='5.5' />
      <path d='m21 2-9.6 9.6' />
      <path d='m15.5 7.5 3 3L22 7l-3-3' />
    </svg>
  );
}
