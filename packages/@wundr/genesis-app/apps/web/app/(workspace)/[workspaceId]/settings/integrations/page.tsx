'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  useIntegrations,
  useIntegrationMutations,
  useWebhooks,
} from '@/hooks/use-integrations';
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

type Tab = 'integrations' | 'webhooks';

const TABS: { id: Tab; label: string }[] = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'webhooks', label: 'Webhooks' },
];

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.workspaceId as string;

  const [activeTab, setActiveTab] = useState<Tab>('integrations');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);

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
        // Redirect to OAuth provider
        window.location.href = result.authUrl;
      }
    },
    [workspaceId, initiateOAuth],
  );

  const handleCreateWebhook = useCallback(
    async (input: CreateWebhookInput) => {
      const result = await createWebhook(input);
      if (result) {
        setShowWebhookForm(false);
        refetchWebhooks();
      }
    },
    [createWebhook, refetchWebhooks],
  );

  const isLoading = activeTab === 'integrations' ? integrationsLoading : webhooksLoading;
  const error = activeTab === 'integrations' ? integrationsError : webhooksError;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header with Breadcrumb */}
      <div className="flex h-14 items-center gap-4 border-b px-6">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Settings</span>
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Integrations</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b px-6">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative py-4 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error.message}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : activeTab === 'integrations' ? (
          <IntegrationsTab
            integrations={integrations}
            onConnect={() => setShowConnectModal(true)}
            onSelect={setSelectedIntegration}
          />
        ) : (
          <WebhooksTab
            webhooks={webhooks}
            onCreate={() => setShowWebhookForm(true)}
            onSelect={setSelectedWebhook}
          />
        )}
      </div>

      {/* Connect Integration Modal */}
      {showConnectModal && (
        <IntegrationConnectModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          onConnect={handleConnectIntegration}
          isLoading={oauthLoading}
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
// Integrations Tab
// =============================================================================

interface IntegrationsTabProps {
  integrations: IntegrationConfig[];
  onConnect: () => void;
  onSelect: (integration: IntegrationConfig) => void;
}

function IntegrationsTab({ integrations, onConnect, onSelect }: IntegrationsTabProps) {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Connected Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Manage your connected apps and services
          </p>
        </div>
        <button
          type="button"
          onClick={onConnect}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Integration
        </button>
      </div>

      {integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <IntegrationIcon className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-medium text-foreground">No integrations connected</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your first integration to get started
          </p>
          <button
            type="button"
            onClick={onConnect}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Connect Integration
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onClick={() => onSelect(integration)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface IntegrationCardProps {
  integration: IntegrationConfig;
  onClick: () => void;
}

function IntegrationCard({ integration, onClick }: IntegrationCardProps) {
  const providerInfo = INTEGRATION_PROVIDERS[integration.provider];
  const statusConfig = INTEGRATION_STATUS_CONFIG[integration.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold">
        {providerInfo?.icon || integration.provider.substring(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium text-foreground">{integration.name}</h3>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color,
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {providerInfo?.name || integration.provider}
        </p>
        {integration.lastSyncAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last synced: {new Date(integration.lastSyncAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

// =============================================================================
// Webhooks Tab
// =============================================================================

interface WebhooksTabProps {
  webhooks: WebhookConfig[];
  onCreate: () => void;
  onSelect: (webhook: WebhookConfig) => void;
}

function WebhooksTab({ webhooks, onCreate, onSelect }: WebhooksTabProps) {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Send real-time notifications to external services
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon className="h-4 w-4" />
          Create Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <WebhookIcon className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-medium text-foreground">No webhooks configured</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first webhook to send events to external services
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              onClick={() => onSelect(webhook)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WebhookCardProps {
  webhook: WebhookConfig;
  onClick: () => void;
}

function WebhookCard({ webhook, onClick }: WebhookCardProps) {
  const statusColor =
    webhook.status === 'active'
      ? 'bg-green-500'
      : webhook.status === 'disabled'
        ? 'bg-red-500'
        : 'bg-gray-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
    >
      <div className={cn('h-3 w-3 shrink-0 rounded-full', statusColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium text-foreground">{webhook.name}</h3>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{webhook.url}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {webhook.events.slice(0, 3).map((event) => (
            <span
              key={event}
              className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {event}
            </span>
          ))}
          {webhook.events.length > 3 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              +{webhook.events.length - 3} more
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        {webhook.failureCount > 0 && (
          <p className="text-sm text-destructive">{webhook.failureCount} failures</p>
        )}
        {webhook.lastDeliveryAt && (
          <p className="text-xs text-muted-foreground">
            Last delivery: {new Date(webhook.lastDeliveryAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
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
}

function IntegrationConnectModal({
  isOpen,
  onClose,
  onConnect,
  isLoading,
}: IntegrationConnectModalProps) {
  const providers = Object.entries(INTEGRATION_PROVIDERS) as [IntegrationProvider, { name: string; description: string; icon: string }][];

  if (!isOpen) {
return null;
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Connect Integration</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 max-h-96 overflow-y-auto">
          {providers.map(([id, info]) => (
            <button
              key={id}
              type="button"
              onClick={() => onConnect(id)}
              disabled={isLoading}
              className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold">
                {info.icon}
              </div>
              <div>
                <h3 className="font-medium text-foreground">{info.name}</h3>
                <p className="text-sm text-muted-foreground">{info.description}</p>
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

function WebhookFormModal({ isOpen, onClose, onSubmit }: WebhookFormModalProps) {
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
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  if (!isOpen) {
return null;
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Webhook</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="webhook-name" className="block text-sm font-medium text-foreground mb-1">
              Name
            </label>
            <input
              id="webhook-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Webhook"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="webhook-url" className="block text-sm font-medium text-foreground mb-1">
              Endpoint URL
            </label>
            <input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label
              htmlFor="webhook-description"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Description (optional)
            </label>
            <textarea
              id="webhook-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this webhook for?"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Events</label>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-3">
              {(Object.entries(WEBHOOK_EVENTS) as [WebhookEventType, { label: string; description: string }][]).map(
                ([event, info]) => (
                  <label key={event} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">{info.label}</span>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </label>
                ),
              )}
            </div>
            {selectedEvents.length === 0 && (
              <p className="mt-1 text-xs text-destructive">Select at least one event</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || !url || selectedEvents.length === 0 || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

function IntegrationDetailModal({ integration, onClose, onUpdate }: IntegrationDetailModalProps) {
  const providerInfo = INTEGRATION_PROVIDERS[integration.provider];
  const statusConfig = INTEGRATION_STATUS_CONFIG[integration.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-sm font-bold">
              {providerInfo?.icon || integration.provider.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{integration.name}</h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  statusConfig.bgColor,
                  statusConfig.color,
                )}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Provider</h3>
            <p className="text-foreground">{providerInfo?.name || integration.provider}</p>
          </div>

          {integration.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
              <p className="text-foreground">{integration.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
            <p className="text-foreground">{new Date(integration.createdAt).toLocaleString()}</p>
          </div>

          {integration.lastSyncAt && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Last Synced</h3>
              <p className="text-foreground">{new Date(integration.lastSyncAt).toLocaleString()}</p>
            </div>
          )}

          {integration.errorMessage && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <h3 className="text-sm font-medium text-destructive">Error</h3>
              <p className="text-sm text-destructive">{integration.errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onUpdate}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

interface WebhookDetailModalProps {
  webhook: WebhookConfig;
  onClose: () => void;
  onUpdate: () => void;
}

function WebhookDetailModal({ webhook, onClose, onUpdate }: WebhookDetailModalProps) {
  const [showSecret, setShowSecret] = useState(false);

  const statusColor =
    webhook.status === 'active'
      ? 'text-green-600 bg-green-500/10'
      : webhook.status === 'disabled'
        ? 'text-red-600 bg-red-500/10'
        : 'text-gray-600 bg-gray-500/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{webhook.name}</h2>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColor)}>
              {webhook.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Endpoint URL</h3>
            <p className="text-foreground break-all">{webhook.url}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Signing Secret</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-2 py-1 text-sm font-mono">
                {showSecret ? webhook.secret : '*'.repeat(32)}
              </code>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {showSecret ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Subscribed Events</h3>
            <div className="flex flex-wrap gap-1">
              {webhook.events.map((event) => (
                <span key={event} className="rounded bg-muted px-2 py-1 text-xs text-foreground">
                  {event}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Success Count</h3>
              <p className="text-foreground">{webhook.successCount || 0}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Failure Count</h3>
              <p className={webhook.failureCount > 0 ? 'text-destructive' : 'text-foreground'}>
                {webhook.failureCount}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
            <p className="text-foreground">{new Date(webhook.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onUpdate}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Webhook
          </button>
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
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IntegrationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
      <path d="m6 17 3.13-5.78c.53-.97.43-2.17-.26-3.03A4 4 0 0 1 8 4a4 4 0 0 1 6.86 2" />
      <path d="m12 6 3.13 5.73c.53.98 1.58 1.57 2.68 1.54 1.82-.05 3.5 1.23 3.95 3A4 4 0 0 1 18 20" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}
