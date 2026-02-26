/**
 * Connected Apps Settings Component
 * @module components/settings/connected-apps
 *
 * Comprehensive connected applications management with:
 * - Third-party app connections (OAuth)
 * - Permission management
 * - Access token & API key management
 * - Webhook configuration
 * - Calendar & file storage integrations
 * - Activity logging
 * - Security warnings
 */
'use client';

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Key,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Unlink,
  Webhook,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type {
  IntegrationConfig,
  IntegrationProvider,
  WebhookConfig,
} from '@/types/integration';

// =============================================================================
// Types
// =============================================================================

interface PersonalAPIKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

interface AppPermission {
  id: string;
  name: string;
  description: string;
  granted: boolean;
  required: boolean;
}

interface ActivityLogEntry {
  id: string;
  appName: string;
  action: string;
  description: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

// =============================================================================
// Main Component
// =============================================================================

export interface ConnectedAppsProps {
  workspaceId: string;
  integrations: IntegrationConfig[];
  webhooks: WebhookConfig[];
  onConnectApp: (provider: IntegrationProvider) => Promise<void>;
  onDisconnectApp: (integrationId: string) => Promise<void>;
  onRefreshConnection: (integrationId: string) => Promise<void>;
  className?: string;
}

export function ConnectedApps({
  workspaceId,
  integrations,
  webhooks,
  onConnectApp,
  onDisconnectApp,
  onRefreshConnection,
  className,
}: ConnectedAppsProps) {
  const { toast } = useToast();
  const [selectedApp, setSelectedApp] = useState<IntegrationConfig | null>(
    null
  );
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showAPIKeyDialog, setShowAPIKeyDialog] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [apiKeys, setApiKeys] = useState<PersonalAPIKey[]>([]);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  useEffect(() => {
    const loadApiKeys = async () => {
      setIsLoadingApiKeys(true);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`);
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data.apiKeys ?? []);
        }
      } catch {
        // silent — empty state shown
      } finally {
        setIsLoadingApiKeys(false);
      }
    };

    const loadActivityLog = async () => {
      setIsLoadingActivity(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/integrations/activity`
        );
        if (res.ok) {
          const data = await res.json();
          setActivityLog(data.activity ?? []);
        }
      } catch {
        // silent — empty state shown
      } finally {
        setIsLoadingActivity(false);
      }
    };

    void loadApiKeys();
    void loadActivityLog();
  }, [workspaceId]);

  const handleDisconnect = useCallback(
    async (integration: IntegrationConfig) => {
      setIsLoading(true);
      try {
        await onDisconnectApp(integration.id);
        toast({
          title: 'App Disconnected',
          description: `${integration.name} has been disconnected from your account.`,
        });
        setSelectedApp(null);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to disconnect app',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onDisconnectApp, toast]
  );

  const handleRefresh = useCallback(
    async (integration: IntegrationConfig) => {
      setIsLoading(true);
      try {
        await onRefreshConnection(integration.id);
        toast({
          title: 'Connection Refreshed',
          description: `${integration.name} connection has been updated.`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to refresh connection',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onRefreshConnection, toast]
  );

  // Group integrations by category
  const calendarApps = integrations.filter(i =>
    ['google_drive', 'microsoft_outlook'].includes(i.provider)
  );
  const storageApps = integrations.filter(i =>
    ['dropbox', 'google_drive'].includes(i.provider)
  );
  const communicationApps = integrations.filter(i =>
    ['slack', 'teams', 'discord'].includes(i.provider)
  );
  const otherApps = integrations.filter(
    i =>
      ![...calendarApps, ...storageApps, ...communicationApps].some(
        app => app.id === i.id
      )
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Security Warning Banner */}
      <Alert
        variant='destructive'
        className='border-orange-500/50 bg-orange-500/10'
      >
        <AlertTriangle className='h-4 w-4 text-orange-600' />
        <AlertTitle className='text-orange-600'>Security Notice</AlertTitle>
        <AlertDescription className='text-orange-600/90'>
          Connected apps have access to your data. Only connect trusted
          applications and review permissions regularly. Revoke access
          immediately if you suspect unauthorized activity.
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs defaultValue='apps' className='space-y-6'>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='apps'>
            <LinkIcon className='h-4 w-4 mr-2' />
            Connected Apps
          </TabsTrigger>
          <TabsTrigger value='api-keys'>
            <Key className='h-4 w-4 mr-2' />
            API Keys
          </TabsTrigger>
          <TabsTrigger value='webhooks'>
            <Webhook className='h-4 w-4 mr-2' />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value='activity'>
            <Clock className='h-4 w-4 mr-2' />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Connected Apps Tab */}
        <TabsContent value='apps' className='space-y-6'>
          {/* Action Bar */}
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>Connected Applications</h3>
              <p className='text-sm text-muted-foreground'>
                Manage third-party apps with access to your account
              </p>
            </div>
            <Button onClick={() => setShowConnectDialog(true)}>
              <Plus className='h-4 w-4 mr-2' />
              Connect App
            </Button>
          </div>

          {/* Calendar Integrations */}
          {calendarApps.length > 0 && (
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Calendar className='h-5 w-5 text-muted-foreground' />
                  <CardTitle className='text-base'>
                    Calendar Integrations
                  </CardTitle>
                </div>
                <CardDescription>
                  Sync your calendar events and availability
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {calendarApps.map(app => (
                  <AppConnectionCard
                    key={app.id}
                    integration={app}
                    onViewDetails={setSelectedApp}
                    onDisconnect={handleDisconnect}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* File Storage */}
          {storageApps.length > 0 && (
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <FileText className='h-5 w-5 text-muted-foreground' />
                  <CardTitle className='text-base'>File Storage</CardTitle>
                </div>
                <CardDescription>
                  Connect cloud storage services for file sharing
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {storageApps.map(app => (
                  <AppConnectionCard
                    key={app.id}
                    integration={app}
                    onViewDetails={setSelectedApp}
                    onDisconnect={handleDisconnect}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Communication Apps */}
          {communicationApps.length > 0 && (
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <MessageSquare className='h-5 w-5 text-muted-foreground' />
                  <CardTitle className='text-base'>Communication</CardTitle>
                </div>
                <CardDescription>
                  Integrate with messaging and collaboration tools
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {communicationApps.map(app => (
                  <AppConnectionCard
                    key={app.id}
                    integration={app}
                    onViewDetails={setSelectedApp}
                    onDisconnect={handleDisconnect}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Other Apps */}
          {otherApps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Other Integrations</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {otherApps.map(app => (
                  <AppConnectionCard
                    key={app.id}
                    integration={app}
                    onViewDetails={setSelectedApp}
                    onDisconnect={handleDisconnect}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {integrations.length === 0 && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12'>
                <LinkIcon className='h-12 w-12 text-muted-foreground/50 mb-4' />
                <h3 className='font-medium text-foreground mb-2'>
                  No Connected Apps
                </h3>
                <p className='text-sm text-muted-foreground mb-4'>
                  Connect third-party apps to extend functionality
                </p>
                <Button onClick={() => setShowConnectDialog(true)}>
                  <Plus className='h-4 w-4 mr-2' />
                  Connect Your First App
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value='api-keys' className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>Personal API Keys</h3>
              <p className='text-sm text-muted-foreground'>
                Generate API keys for programmatic access
              </p>
            </div>
            <Button onClick={() => setShowAPIKeyDialog(true)}>
              <Plus className='h-4 w-4 mr-2' />
              Generate Key
            </Button>
          </div>

          <Alert>
            <Shield className='h-4 w-4' />
            <AlertTitle>Keep Your Keys Secure</AlertTitle>
            <AlertDescription>
              API keys provide full access to your account. Never share them
              publicly or commit them to version control. Rotate keys regularly
              and revoke unused keys immediately.
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className='p-0'>
              {isLoadingApiKeys ? (
                <div className='flex items-center justify-center py-12'>
                  <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12'>
                  <Key className='h-12 w-12 text-muted-foreground/50 mb-4' />
                  <h3 className='font-medium text-foreground mb-2'>
                    No API Keys
                  </h3>
                  <p className='text-sm text-muted-foreground mb-4'>
                    Generate your first API key to get started
                  </p>
                  <Button onClick={() => setShowAPIKeyDialog(true)}>
                    <Plus className='h-4 w-4 mr-2' />
                    Generate API Key
                  </Button>
                </div>
              ) : (
                <div className='divide-y'>
                  {apiKeys.map(key => (
                    <APIKeyCard key={key.id} apiKey={key} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value='webhooks' className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold'>Personal Webhooks</h3>
              <p className='text-sm text-muted-foreground'>
                Configure webhooks for personal automations
              </p>
            </div>
            <Button onClick={() => setShowWebhookDialog(true)}>
              <Plus className='h-4 w-4 mr-2' />
              Create Webhook
            </Button>
          </div>

          <Card>
            <CardContent className='p-0'>
              {webhooks.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12'>
                  <Webhook className='h-12 w-12 text-muted-foreground/50 mb-4' />
                  <h3 className='font-medium text-foreground mb-2'>
                    No Webhooks Configured
                  </h3>
                  <p className='text-sm text-muted-foreground mb-4'>
                    Create webhooks to receive real-time notifications
                  </p>
                  <Button onClick={() => setShowWebhookDialog(true)}>
                    <Plus className='h-4 w-4 mr-2' />
                    Create Webhook
                  </Button>
                </div>
              ) : (
                <div className='divide-y'>
                  {webhooks.map(webhook => (
                    <WebhookCard key={webhook.id} webhook={webhook} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value='activity' className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold'>Activity Log</h3>
            <p className='text-sm text-muted-foreground'>
              Recent interactions with connected apps
            </p>
          </div>

          <Card>
            <CardContent className='p-0'>
              <ScrollArea className='h-[500px]'>
                {isLoadingActivity ? (
                  <div className='flex items-center justify-center py-12'>
                    <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
                  </div>
                ) : activityLog.length === 0 ? (
                  <div className='flex flex-col items-center justify-center py-12'>
                    <Clock className='h-12 w-12 text-muted-foreground/50 mb-4' />
                    <h3 className='font-medium text-foreground mb-2'>
                      No Activity
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      Activity from connected apps will appear here
                    </p>
                  </div>
                ) : (
                  <div className='divide-y'>
                    {activityLog.map(entry => (
                      <ActivityLogCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* App Details Dialog */}
      {selectedApp && (
        <AppDetailsDialog
          integration={selectedApp}
          onClose={() => setSelectedApp(null)}
          onDisconnect={() => handleDisconnect(selectedApp)}
          onRefresh={() => handleRefresh(selectedApp)}
        />
      )}

      {/* Connect App Dialog */}
      <ConnectAppDialog
        isOpen={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        onConnect={onConnectApp}
      />

      {/* API Key Dialog */}
      <CreateAPIKeyDialog
        isOpen={showAPIKeyDialog}
        onClose={() => setShowAPIKeyDialog(false)}
        workspaceId={workspaceId}
        onCreated={async () => {
          const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`);
          if (res.ok) {
            const data = await res.json();
            setApiKeys(data.apiKeys ?? []);
          }
        }}
      />

      {/* Webhook Dialog */}
      <CreateWebhookDialog
        isOpen={showWebhookDialog}
        onClose={() => setShowWebhookDialog(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

interface AppConnectionCardProps {
  integration: IntegrationConfig;
  onViewDetails: (integration: IntegrationConfig) => void;
  onDisconnect: (integration: IntegrationConfig) => void;
  onRefresh: (integration: IntegrationConfig) => void;
  isLoading: boolean;
}

function AppConnectionCard({
  integration,
  onViewDetails,
  onDisconnect,
  onRefresh,
  isLoading,
}: AppConnectionCardProps) {
  const statusConfig = {
    active: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-500/10',
      label: 'Connected',
    },
    error: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-500/10',
      label: 'Error',
    },
    inactive: {
      icon: AlertTriangle,
      color: 'text-gray-600',
      bg: 'bg-gray-500/10',
      label: 'Inactive',
    },
    pending: {
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-500/10',
      label: 'Pending',
    },
  };

  const status = statusConfig[integration.status];
  const StatusIcon = status.icon;

  return (
    <div className='flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors'>
      <div className='flex items-center gap-4 flex-1 min-w-0'>
        <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0'>
          <span className='text-sm font-bold'>
            {integration.provider.substring(0, 2).toUpperCase()}
          </span>
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-1'>
            <h4 className='font-medium text-foreground truncate'>
              {integration.name}
            </h4>
            <Badge
              variant='outline'
              className={cn('shrink-0', status.bg, status.color)}
            >
              <StatusIcon className='h-3 w-3 mr-1' />
              {status.label}
            </Badge>
          </div>
          {integration.lastSyncAt && (
            <p className='text-xs text-muted-foreground'>
              Last synced{' '}
              {new Date(integration.lastSyncAt).toLocaleDateString()}
            </p>
          )}
          {integration.errorMessage && (
            <p className='text-xs text-red-600 mt-1'>
              {integration.errorMessage}
            </p>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' disabled={isLoading}>
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <MoreVertical className='h-4 w-4' />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => onViewDetails(integration)}>
            <Shield className='h-4 w-4 mr-2' />
            View Permissions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRefresh(integration)}>
            <RefreshCw className='h-4 w-4 mr-2' />
            Refresh Connection
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDisconnect(integration)}
            className='text-destructive focus:text-destructive'
          >
            <Unlink className='h-4 w-4 mr-2' />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface APIKeyCardProps {
  apiKey: PersonalAPIKey;
}

function APIKeyCard({ apiKey }: APIKeyCardProps) {
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(apiKey.prefix + '**********************');
    toast({
      title: 'Copied',
      description: 'API key prefix copied to clipboard',
    });
  }, [apiKey.prefix, toast]);

  const isExpiringSoon =
    apiKey.expiresAt &&
    new Date(apiKey.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className='p-4 hover:bg-accent/50 transition-colors'>
      <div className='flex items-start justify-between mb-3'>
        <div className='flex-1 min-w-0'>
          <h4 className='font-medium text-foreground mb-1'>{apiKey.name}</h4>
          <div className='flex items-center gap-2 mb-2'>
            <code className='text-xs font-mono bg-muted px-2 py-1 rounded'>
              {showKey
                ? apiKey.prefix + '**********************'
                : '•'.repeat(32)}
            </code>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOff className='h-3 w-3' />
              ) : (
                <Eye className='h-3 w-3' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={handleCopy}
            >
              <Copy className='h-3 w-3' />
            </Button>
          </div>
          <div className='flex flex-wrap gap-1 mb-2'>
            {apiKey.scopes.map(scope => (
              <Badge key={scope} variant='secondary' className='text-xs'>
                {scope}
              </Badge>
            ))}
          </div>
          <div className='flex items-center gap-4 text-xs text-muted-foreground'>
            <span>
              Created {new Date(apiKey.createdAt).toLocaleDateString()}
            </span>
            {apiKey.lastUsedAt && (
              <span>
                Last used {new Date(apiKey.lastUsedAt).toLocaleDateString()}
              </span>
            )}
            {apiKey.expiresAt && (
              <span
                className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}
              >
                Expires {new Date(apiKey.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon'>
              <MoreVertical className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem>
              <RefreshCw className='h-4 w-4 mr-2' />
              Regenerate
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className='h-4 w-4 mr-2' />
              Copy Full Key
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className='text-destructive focus:text-destructive'>
              <Trash2 className='h-4 w-4 mr-2' />
              Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isExpiringSoon && (
        <Alert variant='destructive' className='mt-2'>
          <AlertTriangle className='h-3 w-3' />
          <AlertDescription className='text-xs'>
            This key will expire soon. Generate a new key before it expires.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface WebhookCardProps {
  webhook: WebhookConfig;
}

function WebhookCard({ webhook }: WebhookCardProps) {
  const statusColors = {
    active: 'bg-green-500',
    inactive: 'bg-gray-500',
    disabled: 'bg-red-500',
  };

  return (
    <div className='p-4 hover:bg-accent/50 transition-colors'>
      <div className='flex items-start justify-between'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-2'>
            <div
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                statusColors[webhook.status]
              )}
            />
            <h4 className='font-medium text-foreground truncate'>
              {webhook.name}
            </h4>
          </div>
          <p className='text-sm text-muted-foreground truncate mb-2'>
            {webhook.url}
          </p>
          <div className='flex flex-wrap gap-1 mb-2'>
            {webhook.events.slice(0, 3).map(event => (
              <Badge key={event} variant='outline' className='text-xs'>
                {event}
              </Badge>
            ))}
            {webhook.events.length > 3 && (
              <Badge variant='outline' className='text-xs'>
                +{webhook.events.length - 3} more
              </Badge>
            )}
          </div>
          <div className='flex items-center gap-4 text-xs text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <CheckCircle2 className='h-3 w-3 text-green-600' />
              {webhook.successCount || 0} successful
            </span>
            {webhook.failureCount > 0 && (
              <span className='flex items-center gap-1 text-red-600'>
                <XCircle className='h-3 w-3' />
                {webhook.failureCount} failed
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon'>
              <MoreVertical className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem>
              <ExternalLink className='h-4 w-4 mr-2' />
              Test Webhook
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Clock className='h-4 w-4 mr-2' />
              View Deliveries
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className='text-destructive focus:text-destructive'>
              <Trash2 className='h-4 w-4 mr-2' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface ActivityLogCardProps {
  entry: ActivityLogEntry;
}

function ActivityLogCard({ entry }: ActivityLogCardProps) {
  const severityConfig = {
    info: { icon: CheckCircle2, color: 'text-blue-600' },
    warning: { icon: AlertTriangle, color: 'text-orange-600' },
    error: { icon: XCircle, color: 'text-red-600' },
  };

  const config = severityConfig[entry.severity];
  const SeverityIcon = config.icon;

  return (
    <div className='p-4 hover:bg-accent/50 transition-colors'>
      <div className='flex items-start gap-3'>
        <SeverityIcon className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)} />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center justify-between mb-1'>
            <h4 className='font-medium text-foreground'>{entry.appName}</h4>
            <span className='text-xs text-muted-foreground shrink-0'>
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          </div>
          <p className='text-sm text-muted-foreground mb-1'>{entry.action}</p>
          <p className='text-xs text-muted-foreground'>{entry.description}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Dialogs
// =============================================================================

interface AppDetailsDialogProps {
  integration: IntegrationConfig;
  onClose: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}

function AppDetailsDialog({
  integration,
  onClose,
  onDisconnect,
  onRefresh,
}: AppDetailsDialogProps) {
  const permissions: AppPermission[] = [
    {
      id: '1',
      name: 'Read Messages',
      description: 'Access to read your messages and conversations',
      granted: true,
      required: true,
    },
    {
      id: '2',
      name: 'Write Messages',
      description: 'Ability to send messages on your behalf',
      granted: true,
      required: true,
    },
    {
      id: '3',
      name: 'Read Channels',
      description: 'Access to view channel information',
      granted: true,
      required: false,
    },
    {
      id: '4',
      name: 'Manage Files',
      description: 'Upload and manage files in conversations',
      granted: false,
      required: false,
    },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted'>
              <span className='text-sm font-bold'>
                {integration.provider.substring(0, 2).toUpperCase()}
              </span>
            </div>
            {integration.name}
          </DialogTitle>
          <DialogDescription>{integration.description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className='flex-1 pr-4'>
          <div className='space-y-6'>
            {/* Connection Status */}
            <div>
              <h4 className='text-sm font-medium mb-3'>Connection Status</h4>
              <div className='grid gap-3'>
                <div className='flex items-center justify-between p-3 rounded-lg border'>
                  <span className='text-sm text-muted-foreground'>Status</span>
                  <Badge
                    variant={
                      integration.status === 'active'
                        ? 'default'
                        : 'destructive'
                    }
                  >
                    {integration.status}
                  </Badge>
                </div>
                <div className='flex items-center justify-between p-3 rounded-lg border'>
                  <span className='text-sm text-muted-foreground'>
                    Connected
                  </span>
                  <span className='text-sm font-medium'>
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {integration.lastSyncAt && (
                  <div className='flex items-center justify-between p-3 rounded-lg border'>
                    <span className='text-sm text-muted-foreground'>
                      Last Sync
                    </span>
                    <span className='text-sm font-medium'>
                      {new Date(integration.lastSyncAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Permissions */}
            <div>
              <h4 className='text-sm font-medium mb-3'>Permissions</h4>
              <div className='space-y-3'>
                {permissions.map(permission => (
                  <div
                    key={permission.id}
                    className='flex items-start gap-3 p-3 rounded-lg border'
                  >
                    <Switch
                      checked={permission.granted}
                      disabled={permission.required}
                      className='mt-1'
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <span className='text-sm font-medium'>
                          {permission.name}
                        </span>
                        {permission.required && (
                          <Badge variant='outline' className='text-xs'>
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {integration.errorMessage && (
              <>
                <Separator />
                <Alert variant='destructive'>
                  <AlertTriangle className='h-4 w-4' />
                  <AlertTitle>Connection Error</AlertTitle>
                  <AlertDescription>
                    {integration.errorMessage}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={onRefresh}>
            <RefreshCw className='h-4 w-4 mr-2' />
            Refresh Connection
          </Button>
          <Button variant='destructive' onClick={onDisconnect}>
            <Unlink className='h-4 w-4 mr-2' />
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConnectAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: IntegrationProvider) => Promise<void>;
}

function ConnectAppDialog({
  isOpen,
  onClose,
  onConnect,
}: ConnectAppDialogProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const availableApps: Array<{
    provider: IntegrationProvider;
    name: string;
    description: string;
    category: string;
  }> = [
    {
      provider: 'google_drive',
      name: 'Google Calendar',
      description: 'Sync your Google Calendar events',
      category: 'Calendar',
    },
    {
      provider: 'dropbox',
      name: 'Dropbox',
      description: 'Access files from Dropbox',
      category: 'Storage',
    },
    {
      provider: 'slack',
      name: 'Slack',
      description: 'Send notifications to Slack',
      category: 'Communication',
    },
    {
      provider: 'github',
      name: 'GitHub',
      description: 'Connect with GitHub repositories',
      category: 'Development',
    },
  ];

  const handleConnect = async (provider: IntegrationProvider) => {
    setIsConnecting(true);
    try {
      await onConnect(provider);
      toast({
        title: 'Connection Initiated',
        description: 'Please complete the authorization in the popup window.',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description:
          error instanceof Error ? error.message : 'Failed to connect app',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Connect Application</DialogTitle>
          <DialogDescription>
            Choose an application to connect to your account
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3 sm:grid-cols-2'>
          {availableApps.map(app => (
            <button
              key={app.provider}
              onClick={() => handleConnect(app.provider)}
              disabled={isConnecting}
              className='flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors disabled:opacity-50 text-left'
            >
              <div className='flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0'>
                <span className='text-sm font-bold'>
                  {app.provider.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 mb-1'>
                  <h4 className='font-medium text-foreground'>{app.name}</h4>
                  <Badge variant='outline' className='text-xs'>
                    {app.category}
                  </Badge>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {app.description}
                </p>
              </div>
              <ChevronRight className='h-5 w-5 text-muted-foreground shrink-0' />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CreateAPIKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated?: () => void;
}

function CreateAPIKeyDialog({
  isOpen,
  onClose,
  workspaceId,
  onCreated,
}: CreateAPIKeyDialogProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const { toast } = useToast();

  const availableScopes = [
    { id: 'read:messages', label: 'Read Messages', category: 'Messages' },
    { id: 'write:messages', label: 'Write Messages', category: 'Messages' },
    { id: 'read:channels', label: 'Read Channels', category: 'Channels' },
    { id: 'write:channels', label: 'Write Channels', category: 'Channels' },
    { id: 'read:users', label: 'Read Users', category: 'Users' },
    { id: 'admin', label: 'Admin Access', category: 'Administration' },
  ];

  const handleCreate = async () => {
    if (!name || selectedScopes.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and select at least one scope',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes: selectedScopes }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create API key');
      }

      const data = await res.json();
      setNewKey(data.key ?? null);
      onCreated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedScopes([]);
    setNewKey(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for programmatic access to your account
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          <div className='space-y-4 py-2'>
            <Alert>
              <Shield className='h-4 w-4' />
              <AlertTitle>API Key Generated</AlertTitle>
              <AlertDescription className='text-xs'>
                Copy your API key now. It will not be shown again.
              </AlertDescription>
            </Alert>
            <div className='rounded-lg border bg-muted p-3 font-mono text-sm break-all select-all'>
              {newKey}
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <div>
              <Label htmlFor='key-name'>Key Name</Label>
              <Input
                id='key-name'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='e.g., Development Key'
                className='mt-1'
              />
            </div>

            <div>
              <Label>Permissions</Label>
              <div className='mt-2 space-y-2 max-h-64 overflow-y-auto rounded-lg border p-3'>
                {availableScopes.map(scope => (
                  <div key={scope.id} className='flex items-start gap-2'>
                    <input
                      type='checkbox'
                      id={scope.id}
                      checked={selectedScopes.includes(scope.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, scope.id]);
                        } else {
                          setSelectedScopes(
                            selectedScopes.filter(s => s !== scope.id)
                          );
                        }
                      }}
                      className='mt-1 h-4 w-4 rounded'
                    />
                    <label htmlFor={scope.id} className='flex-1 cursor-pointer'>
                      <div className='font-medium text-sm'>{scope.label}</div>
                      <div className='text-xs text-muted-foreground'>
                        {scope.category}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <Shield className='h-4 w-4' />
              <AlertTitle>Security Notice</AlertTitle>
              <AlertDescription className='text-xs'>
                Your API key will only be shown once after creation. Store it in
                a secure location and never commit it to source control.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={handleClose}>
            {newKey ? 'Done' : 'Cancel'}
          </Button>
          {!newKey && (
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Generating...
                </>
              ) : (
                'Generate Key'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateWebhookDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated?: () => void;
}

function CreateWebhookDialog({
  isOpen,
  onClose,
  workspaceId,
  onCreated,
}: CreateWebhookDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name || !url) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name and endpoint URL',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/integrations/webhooks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, url, description }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create webhook');
      }

      toast({
        title: 'Webhook Created',
        description: 'Your webhook has been configured successfully.',
      });
      onCreated?.();
      setName('');
      setUrl('');
      setDescription('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create webhook',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Configure a new webhook for real-time notifications
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div>
            <Label htmlFor='webhook-name'>Webhook Name</Label>
            <Input
              id='webhook-name'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g., My Automation'
              className='mt-1'
            />
          </div>

          <div>
            <Label htmlFor='webhook-url'>Endpoint URL</Label>
            <Input
              id='webhook-url'
              type='url'
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder='https://example.com/webhook'
              className='mt-1'
            />
          </div>

          <div>
            <Label htmlFor='webhook-description'>Description (optional)</Label>
            <Textarea
              id='webhook-description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='Describe what this webhook does...'
              rows={3}
              className='mt-1'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating...
              </>
            ) : (
              'Create Webhook'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
