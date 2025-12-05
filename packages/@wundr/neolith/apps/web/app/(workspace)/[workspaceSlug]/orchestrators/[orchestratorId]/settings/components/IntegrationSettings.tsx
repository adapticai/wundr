'use client';

/**
 * Integration Settings Component
 *
 * Configure third-party integrations and webhooks for the orchestrator.
 */

import {
  Plus,
  X,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Settings2,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { INTEGRATION_PROVIDERS } from '@/types/integration';

import type {
  IntegrationConfig,
  IntegrationProvider,
} from '@/types/integration';

interface IntegrationSettingsProps {
  config: any;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}

export function IntegrationSettings({
  config,
  onSave,
  disabled,
}: IntegrationSettingsProps) {
  const params = useParams();
  const { toast } = useToast();
  const workspaceSlug = params.workspaceSlug as string;

  const [webhookUrls, setWebhookUrls] = useState<string[]>(
    (config?.webhookUrls as string[]) || [],
  );
  const [newWebhook, setNewWebhook] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Integration state
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  const [enabledIntegrations, setEnabledIntegrations] = useState<Set<string>>(
    new Set((config?.integrationConfig?.enabled as string[]) || []),
  );

  // Fetch workspace integrations
  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        setIsLoadingIntegrations(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/integrations?status=ACTIVE`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch integrations');
        }

        const data = await response.json();
        setIntegrations(data.integrations || []);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load workspace integrations',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingIntegrations(false);
      }
    };

    if (workspaceSlug) {
      fetchIntegrations();
    }
  }, [workspaceSlug, toast]);

  const addWebhook = () => {
    try {
      // Validate URL
      new URL(newWebhook);
      if (!webhookUrls.includes(newWebhook)) {
        setWebhookUrls([...webhookUrls, newWebhook]);
        setNewWebhook('');
      }
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid webhook URL',
        variant: 'destructive',
      });
    }
  };

  const removeWebhook = (url: string) => {
    setWebhookUrls(webhookUrls.filter(w => w !== url));
  };

  const toggleIntegration = (integrationId: string) => {
    const newEnabled = new Set(enabledIntegrations);
    if (newEnabled.has(integrationId)) {
      newEnabled.delete(integrationId);
    } else {
      newEnabled.add(integrationId);
    }
    setEnabledIntegrations(newEnabled);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        webhookUrls,
        integrationConfig: {
          enabled: Array.from(enabledIntegrations),
        },
      });
      toast({
        title: 'Settings Saved',
        description: 'Integration settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save integration settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Third-Party Integrations</CardTitle>
          <CardDescription>
            Enable or disable workspace integrations for this orchestrator.
            Integrations are configured at the workspace level.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {isLoadingIntegrations ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : integrations.length > 0 ? (
            <div className='max-h-[400px] overflow-y-auto pr-4'>
              <div className='space-y-3'>
                {integrations.map(integration => {
                  const provider = INTEGRATION_PROVIDERS[
                    integration.provider.toLowerCase() as IntegrationProvider
                  ] || {
                    name: integration.provider,
                    description: '',
                    icon: 'CU',
                  };
                  const isEnabled = enabledIntegrations.has(integration.id);

                  return (
                    <div
                      key={integration.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-4 transition-colors',
                        isEnabled
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border bg-background',
                      )}
                    >
                      <div className='flex items-center gap-3 flex-1 min-w-0'>
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold',
                            isEnabled
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {provider.icon}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2'>
                            <p className='font-medium text-sm truncate'>
                              {integration.name}
                            </p>
                            {integration.status === 'active' ? (
                              <Badge
                                variant='outline'
                                className='text-xs bg-green-500/10 text-green-600 border-green-500/20'
                              >
                                <Check className='h-3 w-3 mr-1' />
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant='outline'
                                className='text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                              >
                                <AlertCircle className='h-3 w-3 mr-1' />
                                {integration.status}
                              </Badge>
                            )}
                          </div>
                          <p className='text-xs text-muted-foreground truncate'>
                            {provider.name}
                            {integration.description &&
                              ` - ${integration.description}`}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleIntegration(integration.id)}
                        disabled={disabled || integration.status !== 'active'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className='text-center py-12 space-y-3'>
              <div className='flex justify-center'>
                <div className='rounded-full bg-muted p-3'>
                  <Settings2 className='h-6 w-6 text-muted-foreground' />
                </div>
              </div>
              <div>
                <p className='text-sm font-medium'>No Integrations Available</p>
                <p className='text-sm text-muted-foreground mt-1'>
                  Connect integrations in workspace settings to use them with
                  this orchestrator.
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() =>
                  window.open(
                    `/${workspaceSlug}/settings/integrations`,
                    '_blank',
                  )
                }
              >
                <ExternalLink className='h-4 w-4 mr-2' />
                Manage Workspace Integrations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Notifications</CardTitle>
          <CardDescription>
            Configure webhook endpoints to receive notifications about
            orchestrator activities
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='webhook-url'>Webhook URLs</Label>
            <p className='text-sm text-muted-foreground mb-2'>
              Add webhook endpoints to receive POST requests for events
            </p>
            <div className='flex gap-2'>
              <Input
                id='webhook-url'
                value={newWebhook}
                onChange={e => setNewWebhook(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addWebhook();
                  }
                }}
                placeholder='https://your-endpoint.com/webhook'
                disabled={disabled}
                type='url'
              />
              <Button
                type='button'
                onClick={addWebhook}
                disabled={disabled || !newWebhook}
              >
                <Plus className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {webhookUrls.length > 0 ? (
            <div className='space-y-2'>
              {webhookUrls.map(url => (
                <div
                  key={url}
                  className='flex items-center justify-between border rounded-lg p-3'
                >
                  <div className='flex items-center gap-2 flex-1 min-w-0'>
                    <ExternalLink className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                    <span className='text-sm font-mono truncate'>{url}</span>
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => removeWebhook(url)}
                    disabled={disabled}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-8 text-muted-foreground text-sm'>
              No webhooks configured
            </div>
          )}

          <div className='border-t pt-4'>
            <Label>Available Events</Label>
            <div className='flex flex-wrap gap-2 mt-2'>
              <Badge variant='outline'>message.created</Badge>
              <Badge variant='outline'>task.assigned</Badge>
              <Badge variant='outline'>task.completed</Badge>
              <Badge variant='outline'>workflow.executed</Badge>
              <Badge variant='outline'>error.occurred</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button type='submit' disabled={disabled || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
