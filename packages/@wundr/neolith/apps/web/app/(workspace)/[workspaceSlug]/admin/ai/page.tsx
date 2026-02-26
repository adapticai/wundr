'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

interface AISettings {
  defaultModel: string;
  tokenBudget: number;
  tokenUsage: number;
  autoSpawn: {
    enabled: boolean;
    maxAgentsPerDiscipline: number;
    triggers: {
      onMessage: boolean;
      onSchedule: boolean;
      onEscalation: boolean;
    };
  };
  trafficManager: {
    defaultRoutingMethod: string;
    escalationThreshold: string;
    enableContentAnalysis: boolean;
    maxRoutingLatency: number;
  };
  daemonConnection: {
    daemonUrl: string;
    apiSecret: string;
  };
  communicationDefaults: {
    notificationChannels: string[];
    quietHoursStart: string;
    quietHoursEnd: string;
  };
}

const DEFAULT_SETTINGS: AISettings = {
  defaultModel: 'claude-sonnet-4',
  tokenBudget: 1000000,
  tokenUsage: 0,
  autoSpawn: {
    enabled: false,
    maxAgentsPerDiscipline: 3,
    triggers: {
      onMessage: false,
      onSchedule: false,
      onEscalation: false,
    },
  },
  trafficManager: {
    defaultRoutingMethod: 'round-robin',
    escalationThreshold: 'medium',
    enableContentAnalysis: false,
    maxRoutingLatency: 500,
  },
  daemonConnection: {
    daemonUrl: '',
    apiSecret: '',
  },
  communicationDefaults: {
    notificationChannels: [],
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
};

const NOTIFICATION_CHANNELS = [
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'slack', label: 'Slack' },
  { id: 'internal', label: 'Internal' },
];

export default function AISettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    setPageHeader(
      'AI Organization Settings',
      'Configure AI models, budgets, and automation for your workspace'
    );
  }, [setPageHeader]);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/settings`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      const aiSettings = data?.workspace?.settings?.aiSettings;
      if (aiSettings) {
        setSettings(prev => ({ ...prev, ...aiSettings }));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiSettings: settings }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      toast({
        title: 'Saved',
        description: 'AI settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, settings, toast]);

  const handleTestConnection = useCallback(async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/settings/test-daemon`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            daemonUrl: settings.daemonConnection.daemonUrl,
            apiSecret: settings.daemonConnection.apiSecret,
          }),
        }
      );
      if (!response.ok) {
        throw new Error('Connection test failed');
      }
      toast({
        title: 'Connected',
        description: 'Daemon connection successful',
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not connect to daemon',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  }, [workspaceSlug, settings.daemonConnection, toast]);

  const toggleNotificationChannel = useCallback((channelId: string) => {
    setSettings(prev => {
      const channels = prev.communicationDefaults.notificationChannels;
      const updated = channels.includes(channelId)
        ? channels.filter(c => c !== channelId)
        : [...channels, channelId];
      return {
        ...prev,
        communicationDefaults: {
          ...prev.communicationDefaults,
          notificationChannels: updated,
        },
      };
    });
  }, []);

  const tokenBudgetPercent = Math.min(
    Math.round((settings.tokenUsage / settings.tokenBudget) * 100),
    100
  );

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <p className='text-muted-foreground'>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 1. Default AI Model */}
      <Card>
        <CardHeader>
          <CardTitle>Default AI Model</CardTitle>
          <CardDescription>
            The model used by default for all AI operations in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='max-w-sm'>
            <Label htmlFor='default-model'>Model</Label>
            <Select
              value={settings.defaultModel}
              onValueChange={value =>
                setSettings(prev => ({ ...prev, defaultModel: value }))
              }
            >
              <SelectTrigger id='default-model' className='mt-1.5'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='claude-opus-4'>Claude Opus 4</SelectItem>
                <SelectItem value='claude-sonnet-4'>Claude Sonnet 4</SelectItem>
                <SelectItem value='claude-haiku'>Claude Haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 2. Organization Token Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Token Budget</CardTitle>
          <CardDescription>
            Monthly token budget and current usage for the entire organization
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label>Monthly Budget</Label>
              <span className='text-sm font-medium'>
                {(settings.tokenBudget / 1000000).toFixed(1)}M tokens
              </span>
            </div>
            <Slider
              min={100000}
              max={10000000}
              step={100000}
              value={[settings.tokenBudget]}
              onValueChange={([value]) =>
                setSettings(prev => ({ ...prev, tokenBudget: value }))
              }
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>100K</span>
              <span>10M</span>
            </div>
          </div>
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>Current usage</span>
              <span className='font-medium'>
                {(settings.tokenUsage / 1000).toFixed(0)}K /{' '}
                {(settings.tokenBudget / 1000000).toFixed(1)}M tokens (
                {tokenBudgetPercent}%)
              </span>
            </div>
            <Progress value={tokenBudgetPercent} className='h-2' />
          </div>
        </CardContent>
      </Card>

      {/* 3. Auto-Spawn Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Spawn Configuration</CardTitle>
          <CardDescription>
            Control automatic agent spawning behaviour across the organization
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='flex items-center justify-between'>
            <div>
              <Label>Enable Auto-Spawn</Label>
              <p className='text-sm text-muted-foreground mt-0.5'>
                Automatically spawn agents based on triggers
              </p>
            </div>
            <Switch
              checked={settings.autoSpawn.enabled}
              onCheckedChange={checked =>
                setSettings(prev => ({
                  ...prev,
                  autoSpawn: { ...prev.autoSpawn, enabled: checked },
                }))
              }
            />
          </div>

          <div className='space-y-2'>
            <Label>Max Agents per Discipline</Label>
            <div className='flex items-center gap-3'>
              <Slider
                min={1}
                max={20}
                step={1}
                value={[settings.autoSpawn.maxAgentsPerDiscipline]}
                onValueChange={([value]) =>
                  setSettings(prev => ({
                    ...prev,
                    autoSpawn: {
                      ...prev.autoSpawn,
                      maxAgentsPerDiscipline: value,
                    },
                  }))
                }
                disabled={!settings.autoSpawn.enabled}
                className='flex-1'
              />
              <span className='text-sm font-medium w-6 text-right'>
                {settings.autoSpawn.maxAgentsPerDiscipline}
              </span>
            </div>
          </div>

          <div className='space-y-3'>
            <Label>Spawn Triggers</Label>
            <div className='space-y-2'>
              {(
                [
                  ['onMessage', 'On Message'],
                  ['onSchedule', 'On Schedule'],
                  ['onEscalation', 'On Escalation'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className='flex items-center gap-2'>
                  <Checkbox
                    id={`trigger-${key}`}
                    checked={settings.autoSpawn.triggers[key]}
                    disabled={!settings.autoSpawn.enabled}
                    onCheckedChange={checked =>
                      setSettings(prev => ({
                        ...prev,
                        autoSpawn: {
                          ...prev.autoSpawn,
                          triggers: {
                            ...prev.autoSpawn.triggers,
                            [key]: !!checked,
                          },
                        },
                      }))
                    }
                  />
                  <Label htmlFor={`trigger-${key}`} className='font-normal'>
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Traffic Manager Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Traffic Manager Defaults</CardTitle>
          <CardDescription>
            Default routing and escalation settings for AI traffic management
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='grid gap-5 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Default Routing Method</Label>
              <Select
                value={settings.trafficManager.defaultRoutingMethod}
                onValueChange={value =>
                  setSettings(prev => ({
                    ...prev,
                    trafficManager: {
                      ...prev.trafficManager,
                      defaultRoutingMethod: value,
                    },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='round-robin'>Round Robin</SelectItem>
                  <SelectItem value='least-loaded'>Least Loaded</SelectItem>
                  <SelectItem value='priority'>Priority</SelectItem>
                  <SelectItem value='random'>Random</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1.5'>
              <Label>Escalation Threshold Priority</Label>
              <Select
                value={settings.trafficManager.escalationThreshold}
                onValueChange={value =>
                  setSettings(prev => ({
                    ...prev,
                    trafficManager: {
                      ...prev.trafficManager,
                      escalationThreshold: value,
                    },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='low'>Low</SelectItem>
                  <SelectItem value='medium'>Medium</SelectItem>
                  <SelectItem value='high'>High</SelectItem>
                  <SelectItem value='critical'>Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='max-latency'>Max Routing Latency (ms)</Label>
            <Input
              id='max-latency'
              type='number'
              min={50}
              max={10000}
              value={settings.trafficManager.maxRoutingLatency}
              onChange={e =>
                setSettings(prev => ({
                  ...prev,
                  trafficManager: {
                    ...prev.trafficManager,
                    maxRoutingLatency: Number(e.target.value),
                  },
                }))
              }
              className='max-w-[200px]'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label>Enable Content Analysis</Label>
              <p className='text-sm text-muted-foreground mt-0.5'>
                Analyse message content to improve routing decisions
              </p>
            </div>
            <Switch
              checked={settings.trafficManager.enableContentAnalysis}
              onCheckedChange={checked =>
                setSettings(prev => ({
                  ...prev,
                  trafficManager: {
                    ...prev.trafficManager,
                    enableContentAnalysis: checked,
                  },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. Daemon Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Daemon Connection</CardTitle>
          <CardDescription>
            Configure the connection to your AI daemon service
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='daemon-url'>Daemon URL</Label>
            <Input
              id='daemon-url'
              type='text'
              placeholder='https://daemon.example.com'
              value={settings.daemonConnection.daemonUrl}
              onChange={e =>
                setSettings(prev => ({
                  ...prev,
                  daemonConnection: {
                    ...prev.daemonConnection,
                    daemonUrl: e.target.value,
                  },
                }))
              }
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='api-secret'>API Secret</Label>
            <Input
              id='api-secret'
              type='password'
              placeholder='Enter API secret'
              value={settings.daemonConnection.apiSecret}
              onChange={e =>
                setSettings(prev => ({
                  ...prev,
                  daemonConnection: {
                    ...prev.daemonConnection,
                    apiSecret: e.target.value,
                  },
                }))
              }
            />
          </div>

          <Button
            variant='outline'
            onClick={handleTestConnection}
            disabled={
              isTestingConnection ||
              !settings.daemonConnection.daemonUrl ||
              !settings.daemonConnection.apiSecret
            }
          >
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* 6. Communication Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Defaults</CardTitle>
          <CardDescription>
            Default notification channels and quiet hours for the organization
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='space-y-3'>
            <Label>Default Notification Channels</Label>
            <div className='flex flex-wrap gap-4'>
              {NOTIFICATION_CHANNELS.map(channel => (
                <div key={channel.id} className='flex items-center gap-2'>
                  <Checkbox
                    id={`channel-${channel.id}`}
                    checked={settings.communicationDefaults.notificationChannels.includes(
                      channel.id
                    )}
                    onCheckedChange={() =>
                      toggleNotificationChannel(channel.id)
                    }
                  />
                  <Label
                    htmlFor={`channel-${channel.id}`}
                    className='font-normal'
                  >
                    {channel.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='quiet-start'>Quiet Hours Start</Label>
              <Input
                id='quiet-start'
                type='time'
                value={settings.communicationDefaults.quietHoursStart}
                onChange={e =>
                  setSettings(prev => ({
                    ...prev,
                    communicationDefaults: {
                      ...prev.communicationDefaults,
                      quietHoursStart: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='quiet-end'>Quiet Hours End</Label>
              <Input
                id='quiet-end'
                type='time'
                value={settings.communicationDefaults.quietHoursEnd}
                onChange={e =>
                  setSettings(prev => ({
                    ...prev,
                    communicationDefaults: {
                      ...prev.communicationDefaults,
                      quietHoursEnd: e.target.value,
                    },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className='flex justify-end pb-6'>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
