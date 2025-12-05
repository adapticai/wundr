'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { usePageHeader } from '@/contexts/page-header-context';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type IntegrationProvider =
  | 'SLACK'
  | 'GITHUB'
  | 'GITLAB'
  | 'JIRA'
  | 'LINEAR'
  | 'NOTION'
  | 'DISCORD';

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ERROR';

type WebhookStatus = 'ACTIVE' | 'INACTIVE' | 'FAILED';

interface Integration {
  id: string;
  name: string;
  description: string | null;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  connectedAt: string | null;
  createdAt: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: WebhookStatus;
  createdAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const INTEGRATION_PROVIDERS = [
  {
    id: 'SLACK' as const,
    name: 'Slack',
    description: 'Connect your Slack workspace for notifications and commands',
    icon: '💬',
    color: 'bg-purple-500',
    oauthEnabled: true,
  },
  {
    id: 'GITHUB' as const,
    name: 'GitHub',
    description: 'Integrate with GitHub repositories for issue tracking',
    icon: '🐙',
    color: 'bg-gray-900',
    oauthEnabled: true,
  },
  {
    id: 'GITLAB' as const,
    name: 'GitLab',
    description: 'Connect GitLab for CI/CD and repository management',
    icon: '🦊',
    color: 'bg-orange-600',
    oauthEnabled: true,
  },
  {
    id: 'JIRA' as const,
    name: 'Jira',
    description: 'Sync tasks and issues with Atlassian Jira',
    icon: '📋',
    color: 'bg-blue-600',
    oauthEnabled: false,
  },
  {
    id: 'LINEAR' as const,
    name: 'Linear',
    description: 'Streamline issue tracking with Linear',
    icon: '⚡',
    color: 'bg-indigo-600',
    oauthEnabled: true,
  },
  {
    id: 'NOTION' as const,
    name: 'Notion',
    description: 'Connect Notion workspaces for documentation sync',
    icon: '📝',
    color: 'bg-black',
    oauthEnabled: true,
  },
  {
    id: 'DISCORD' as const,
    name: 'Discord',
    description: 'Send notifications to Discord channels',
    icon: '🎮',
    color: 'bg-indigo-500',
    oauthEnabled: true,
  },
];

const WEBHOOK_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'message.created',
  'channel.created',
  'member.joined',
  'member.left',
];

export default function AdminIntegrationsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('integrations');

  // Modals
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<IntegrationProvider | null>(null);
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null);

  // Form states
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    expiresInDays: 90,
  });
  const [configForm, setConfigForm] = useState({
    apiKey: '',
    apiSecret: '',
    webhookUrl: '',
  });

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Integrations',
      'Connect third-party services and manage webhooks',
    );
  }, [setPageHeader]);

  // Fetch data
  useEffect(() => {
    fetchIntegrations();
    fetchWebhooks();
    fetchApiKeys();
  }, [workspaceSlug]);

  const fetchIntegrations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations`,
      );
      if (!response.ok) throw new Error('Failed to fetch integrations');
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/webhooks`,
      );
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/api-keys`,
      );
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  // Integration actions
  const handleConnectOAuth = async (provider: IntegrationProvider) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/oauth/${provider.toLowerCase()}`,
        { method: 'POST' },
      );
      if (!response.ok) throw new Error('Failed to initiate OAuth');
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting integration:', error);
      toast.error('Failed to connect integration');
    }
  };

  const handleConnectManual = async () => {
    if (!selectedProvider) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            name: INTEGRATION_PROVIDERS.find(p => p.id === selectedProvider)
              ?.name,
            providerConfig: configForm,
          }),
        },
      );

      if (!response.ok) throw new Error('Failed to connect integration');
      const data = await response.json();

      toast.success('Integration connected successfully');
      setShowConfigModal(false);
      setConfigForm({ apiKey: '', apiSecret: '', webhookUrl: '' });
      fetchIntegrations();
    } catch (error) {
      console.error('Error connecting integration:', error);
      toast.error('Failed to connect integration');
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/${integrationId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Failed to disconnect');
      toast.success('Integration disconnected');
      fetchIntegrations();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const handleTestIntegration = async (integrationId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/${integrationId}/test`,
        { method: 'POST' },
      );
      if (!response.ok) throw new Error('Test failed');
      const data = await response.json();
      toast.success(data.message || 'Integration test successful');
    } catch (error) {
      console.error('Error testing integration:', error);
      toast.error('Integration test failed');
    }
  };

  const handleSyncIntegration = async (integrationId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/${integrationId}/sync`,
        { method: 'POST' },
      );
      if (!response.ok) throw new Error('Sync failed');
      toast.success('Sync started successfully');
      fetchIntegrations();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Sync failed');
    }
  };

  const handleToggleSync = async (
    integrationId: string,
    enabled: boolean,
  ) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/${integrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncEnabled: enabled }),
        },
      );
      if (!response.ok) throw new Error('Failed to update');
      toast.success(`Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
      fetchIntegrations();
    } catch (error) {
      console.error('Error toggling sync:', error);
      toast.error('Failed to update sync setting');
    }
  };

  // Webhook actions
  const handleCreateWebhook = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/webhooks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookForm),
        },
      );
      if (!response.ok) throw new Error('Failed to create webhook');
      const data = await response.json();
      toast.success(`Webhook created. Secret: ${data.secret}`);
      setShowWebhookModal(false);
      setWebhookForm({ name: '', url: '', events: [] });
      fetchWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/webhooks/${webhookId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Failed to delete webhook');
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/webhooks/${webhookId}/test`,
        { method: 'POST' },
      );
      if (!response.ok) throw new Error('Test failed');
      toast.success('Test webhook sent successfully');
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Webhook test failed');
    }
  };

  // API Key actions
  const handleCreateApiKey = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/api-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiKeyForm),
        },
      );
      if (!response.ok) throw new Error('Failed to create API key');
      const data = await response.json();
      toast.success(`API Key created: ${data.key}`);
      setShowApiKeyModal(false);
      setApiKeyForm({ name: '', expiresInDays: 90 });
      fetchApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/integrations/api-keys/${keyId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Failed to revoke API key');
      toast.success('API key revoked');
      fetchApiKeys();
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  const connectedIntegrations = integrations.filter(
    i => i.status === 'ACTIVE',
  );
  const availableProviders = INTEGRATION_PROVIDERS.filter(
    p => !integrations.some(i => i.provider === p.id),
  );

  return (
    <div className='space-y-6'>
      {/* Stats Overview */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Connected Integrations
            </CardTitle>
            <PlugIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{connectedIntegrations.length}</div>
            <p className='text-xs text-muted-foreground'>
              {availableProviders.length} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Webhooks</CardTitle>
            <WebhookIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {webhooks.filter(w => w.status === 'ACTIVE').length}
            </div>
            <p className='text-xs text-muted-foreground'>
              {webhooks.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>API Keys</CardTitle>
            <KeyIcon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{apiKeys.length}</div>
            <p className='text-xs text-muted-foreground'>Active keys</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='integrations'>Integrations</TabsTrigger>
          <TabsTrigger value='webhooks'>Webhooks</TabsTrigger>
          <TabsTrigger value='api-keys'>API Keys</TabsTrigger>
          <TabsTrigger value='health'>Health Monitor</TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value='integrations' className='space-y-6'>
          {/* Connected Integrations */}
          {connectedIntegrations.length > 0 && (
            <div>
              <h3 className='mb-4 text-lg font-semibold'>
                Connected Integrations
              </h3>
              <div className='grid gap-4 md:grid-cols-2'>
                {connectedIntegrations.map(integration => {
                  const provider = INTEGRATION_PROVIDERS.find(
                    p => p.id === integration.provider,
                  );
                  return (
                    <Card key={integration.id}>
                      <CardHeader>
                        <div className='flex items-start justify-between'>
                          <div className='flex items-center gap-3'>
                            <div
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-lg text-xl',
                                provider?.color,
                              )}
                            >
                              {provider?.icon}
                            </div>
                            <div>
                              <CardTitle className='text-base'>
                                {integration.name}
                              </CardTitle>
                              <CardDescription>
                                {integration.description || provider?.description}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant={
                              integration.status === 'ACTIVE'
                                ? 'default'
                                : 'destructive'
                            }
                          >
                            {integration.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <div className='flex items-center justify-between'>
                          <Label htmlFor={`sync-${integration.id}`}>
                            Auto-sync
                          </Label>
                          <Switch
                            id={`sync-${integration.id}`}
                            checked={integration.syncEnabled}
                            onCheckedChange={enabled =>
                              handleToggleSync(integration.id, enabled)
                            }
                          />
                        </div>

                        {integration.lastSyncAt && (
                          <p className='text-xs text-muted-foreground'>
                            Last synced:{' '}
                            {new Date(integration.lastSyncAt).toLocaleString()}
                          </p>
                        )}

                        {integration.syncError && (
                          <p className='text-xs text-destructive'>
                            Error: {integration.syncError}
                          </p>
                        )}

                        <div className='flex gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleTestIntegration(integration.id)}
                          >
                            Test
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleSyncIntegration(integration.id)}
                          >
                            Sync Now
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setShowConfigModal(true);
                            }}
                          >
                            Configure
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            onClick={() => handleDisconnect(integration.id)}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Integrations */}
          {availableProviders.length > 0 && (
            <div>
              <h3 className='mb-4 text-lg font-semibold'>
                Available Integrations
              </h3>
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {availableProviders.map(provider => (
                  <Card key={provider.id}>
                    <CardHeader>
                      <div className='flex items-center gap-3'>
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg text-xl',
                            provider.color,
                          )}
                        >
                          {provider.icon}
                        </div>
                        <div>
                          <CardTitle className='text-base'>
                            {provider.name}
                          </CardTitle>
                        </div>
                      </div>
                      <CardDescription>{provider.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className='w-full'
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          if (provider.oauthEnabled) {
                            handleConnectOAuth(provider.id);
                          } else {
                            setShowConfigModal(true);
                          }
                        }}
                      >
                        Connect {provider.name}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value='webhooks' className='space-y-4'>
          <div className='flex justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>Webhooks</h3>
              <p className='text-sm text-muted-foreground'>
                Configure outgoing webhooks for event notifications
              </p>
            </div>
            <Button onClick={() => setShowWebhookModal(true)}>
              Create Webhook
            </Button>
          </div>

          <div className='space-y-4'>
            {webhooks.map(webhook => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div>
                      <CardTitle className='text-base'>{webhook.name}</CardTitle>
                      <CardDescription className='font-mono text-xs'>
                        {webhook.url}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        webhook.status === 'ACTIVE' ? 'default' : 'destructive'
                      }
                    >
                      {webhook.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div>
                    <Label className='text-xs text-muted-foreground'>
                      Events
                    </Label>
                    <div className='mt-1 flex flex-wrap gap-1'>
                      {webhook.events.map(event => (
                        <Badge key={event} variant='outline'>
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleTestWebhook(webhook.id)}
                    >
                      Test
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => handleDeleteWebhook(webhook.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value='api-keys' className='space-y-4'>
          <div className='flex justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>API Keys</h3>
              <p className='text-sm text-muted-foreground'>
                Generate API keys for programmatic access
              </p>
            </div>
            <Button onClick={() => setShowApiKeyModal(true)}>
              Generate API Key
            </Button>
          </div>

          <div className='space-y-4'>
            {apiKeys.map(key => (
              <Card key={key.id}>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div>
                      <CardTitle className='text-base'>{key.name}</CardTitle>
                      <CardDescription className='font-mono text-xs'>
                        {key.prefix}...
                      </CardDescription>
                    </div>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => handleRevokeApiKey(key.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='space-y-1 text-sm'>
                    {key.lastUsed && (
                      <p className='text-muted-foreground'>
                        Last used: {new Date(key.lastUsed).toLocaleString()}
                      </p>
                    )}
                    {key.expiresAt && (
                      <p className='text-muted-foreground'>
                        Expires: {new Date(key.expiresAt).toLocaleString()}
                      </p>
                    )}
                    <p className='text-muted-foreground'>
                      Created: {new Date(key.createdAt).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Health Monitor Tab */}
        <TabsContent value='health' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Integration Health</CardTitle>
              <CardDescription>
                Real-time status of all connected integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {connectedIntegrations.map(integration => {
                  const provider = INTEGRATION_PROVIDERS.find(
                    p => p.id === integration.provider,
                  );
                  const isHealthy = integration.status === 'ACTIVE' && !integration.syncError;

                  return (
                    <div
                      key={integration.id}
                      className='flex items-center justify-between rounded-lg border p-4'
                    >
                      <div className='flex items-center gap-3'>
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            isHealthy ? 'bg-green-500' : 'bg-red-500',
                          )}
                        />
                        <div>
                          <p className='font-medium'>{integration.name}</p>
                          <p className='text-sm text-muted-foreground'>
                            {provider?.name}
                          </p>
                        </div>
                      </div>
                      <div className='text-right text-sm'>
                        <p className='font-medium'>
                          {isHealthy ? 'Healthy' : 'Unhealthy'}
                        </p>
                        {integration.lastSyncAt && (
                          <p className='text-muted-foreground'>
                            Last sync:{' '}
                            {new Date(integration.lastSyncAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Webhook Modal */}
      <Dialog open={showWebhookModal} onOpenChange={setShowWebhookModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive event notifications
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='webhook-name'>Name</Label>
              <Input
                id='webhook-name'
                value={webhookForm.name}
                onChange={e =>
                  setWebhookForm({ ...webhookForm, name: e.target.value })
                }
                placeholder='Production webhook'
              />
            </div>
            <div>
              <Label htmlFor='webhook-url'>URL</Label>
              <Input
                id='webhook-url'
                value={webhookForm.url}
                onChange={e =>
                  setWebhookForm({ ...webhookForm, url: e.target.value })
                }
                placeholder='https://api.example.com/webhook'
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className='mt-2 space-y-2'>
                {WEBHOOK_EVENTS.map(event => (
                  <label
                    key={event}
                    className='flex items-center gap-2 text-sm'
                  >
                    <input
                      type='checkbox'
                      checked={webhookForm.events.includes(event)}
                      onChange={e => {
                        const events = e.target.checked
                          ? [...webhookForm.events, event]
                          : webhookForm.events.filter(ev => ev !== event);
                        setWebhookForm({ ...webhookForm, events });
                      }}
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowWebhookModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWebhook}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='apikey-name'>Name</Label>
              <Input
                id='apikey-name'
                value={apiKeyForm.name}
                onChange={e =>
                  setApiKeyForm({ ...apiKeyForm, name: e.target.value })
                }
                placeholder='Production API Key'
              />
            </div>
            <div>
              <Label htmlFor='apikey-expires'>Expires in (days)</Label>
              <Input
                id='apikey-expires'
                type='number'
                value={apiKeyForm.expiresInDays}
                onChange={e =>
                  setApiKeyForm({
                    ...apiKeyForm,
                    expiresInDays: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowApiKeyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApiKey}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Integration Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Integration</DialogTitle>
            <DialogDescription>
              Enter your integration credentials
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='config-apikey'>API Key</Label>
              <Input
                id='config-apikey'
                type='password'
                value={configForm.apiKey}
                onChange={e =>
                  setConfigForm({ ...configForm, apiKey: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor='config-apisecret'>API Secret</Label>
              <Input
                id='config-apisecret'
                type='password'
                value={configForm.apiSecret}
                onChange={e =>
                  setConfigForm({ ...configForm, apiSecret: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor='config-webhook'>Webhook URL (optional)</Label>
              <Input
                id='config-webhook'
                value={configForm.webhookUrl}
                onChange={e =>
                  setConfigForm({ ...configForm, webhookUrl: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnectManual}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Icons
function PlugIcon({ className }: { className?: string }) {
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
      <path d='M12 22v-5' />
      <path d='M9 8V2' />
      <path d='M15 8V2' />
      <path d='M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z' />
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
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
      <path d='M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2' />
      <path d='m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06' />
      <path d='m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8' />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
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
      <circle cx='7.5' cy='15.5' r='5.5' />
      <path d='m21 2-9.6 9.6' />
      <path d='m15.5 7.5 3 3L22 7l-3-3' />
    </svg>
  );
}
