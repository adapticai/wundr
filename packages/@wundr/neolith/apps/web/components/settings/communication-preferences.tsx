'use client';

import { useCallback, useState } from 'react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface ChannelConfig {
  channel: 'email' | 'sms' | 'whatsapp' | 'voice' | 'slack' | 'internal';
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  connected: boolean;
  address?: string;
  notificationLevel: 'all' | 'mentions' | 'urgent' | 'none';
}

const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    channel: 'internal',
    label: 'Internal Chat',
    description: 'Wundr platform messages',
    icon: '💬',
    enabled: true,
    connected: true,
    notificationLevel: 'all',
  },
  {
    channel: 'email',
    label: 'Email',
    description: 'Send and receive emails',
    icon: '📧',
    enabled: false,
    connected: false,
    notificationLevel: 'mentions',
  },
  {
    channel: 'sms',
    label: 'SMS',
    description: 'Text messages via Twilio',
    icon: '📱',
    enabled: false,
    connected: false,
    notificationLevel: 'urgent',
  },
  {
    channel: 'whatsapp',
    label: 'WhatsApp',
    description: 'WhatsApp Business messages',
    icon: '💚',
    enabled: false,
    connected: false,
    notificationLevel: 'mentions',
  },
  {
    channel: 'voice',
    label: 'Voice Calls',
    description: 'Phone calls via Twilio',
    icon: '📞',
    enabled: false,
    connected: false,
    notificationLevel: 'urgent',
  },
  {
    channel: 'slack',
    label: 'Slack',
    description: 'Slack workspace integration',
    icon: '🔗',
    enabled: false,
    connected: false,
    notificationLevel: 'all',
  },
];

const NOTIFICATION_LEVELS: {
  value: ChannelConfig['notificationLevel'];
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'mentions', label: 'Mentions Only' },
  { value: 'urgent', label: 'Urgent Only' },
  { value: 'none', label: 'None' },
];

const PROVISION_CHANNELS = new Set<ChannelConfig['channel']>([
  'email',
  'sms',
  'voice',
]);

export interface CommunicationPreferencesProps {
  orchestratorId: string;
  initialPreferences?: ChannelConfig[];
}

export function CommunicationPreferences({
  orchestratorId,
  initialPreferences,
}: CommunicationPreferencesProps) {
  const [channels, setChannels] = useState<ChannelConfig[]>(
    initialPreferences ?? DEFAULT_CHANNELS
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [provisioning, setProvisioning] = useState<string | null>(null);

  const enabledChannels = channels.filter(c => c.enabled);

  const updateChannel = useCallback(
    (id: ChannelConfig['channel'], patch: Partial<ChannelConfig>) => {
      setChannels(prev =>
        prev.map(c => (c.channel === id ? { ...c, ...patch } : c))
      );
      setSaveSuccess(false);
    },
    []
  );

  const moveChannel = useCallback(
    (id: ChannelConfig['channel'], dir: 'up' | 'down') => {
      setChannels(prev => {
        const enabled = prev.filter(c => c.enabled);
        const idx = enabled.findIndex(c => c.channel === id);
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= enabled.length) return prev;
        const next = [...prev];
        const aPos = next.findIndex(c => c.channel === enabled[idx].channel);
        const bPos = next.findIndex(
          c => c.channel === enabled[swapIdx].channel
        );
        [next[aPos], next[bPos]] = [next[bPos], next[aPos]];
        return next;
      });
      setSaveSuccess(false);
    },
    []
  );

  const handleProvision = useCallback(
    async (ch: ChannelConfig) => {
      setProvisioning(ch.channel);
      setSaveError(null);
      try {
        const endpoint =
          ch.channel === 'email' ? 'provision-email' : 'provision-phone';
        const res = await fetch(
          `/api/orchestrators/${orchestratorId}/${endpoint}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        const result = await res.json();
        if (!res.ok)
          throw new Error(
            result.message ?? result.error ?? 'Provisioning failed'
          );
        updateChannel(ch.channel, {
          connected: true,
          address: result.address ?? result.email ?? result.phoneNumber,
        });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setProvisioning(null);
      }
    },
    [orchestratorId, updateChannel]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/communications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orchestratorId, channels }),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(
          result.message ?? result.error ?? 'Failed to save preferences'
        );
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [orchestratorId, channels]);

  return (
    <div className='space-y-6'>
      {saveError && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className='rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-600'>
          Preferences saved successfully.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Communication Channels</CardTitle>
          <CardDescription>
            Configure channels and notification levels for this agent.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-1'>
          {channels.map((config, index) => (
            <div key={config.channel}>
              <div className='flex items-start justify-between rounded-lg px-1 py-3'>
                <div className='flex items-start gap-3'>
                  <span className='mt-0.5 text-lg leading-none'>
                    {config.icon}
                  </span>
                  <div className='space-y-1'>
                    <div className='flex items-center gap-2'>
                      <p className='text-sm font-medium leading-none'>
                        {config.label}
                      </p>
                      {config.connected ? (
                        <Badge
                          variant='outline'
                          className='border-green-500 text-green-600 text-xs'
                        >
                          Connected
                        </Badge>
                      ) : (
                        <Badge
                          variant='outline'
                          className='text-muted-foreground text-xs'
                        >
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {config.description}
                    </p>
                    {config.address && (
                      <p className='text-xs font-medium text-foreground'>
                        {config.address}
                      </p>
                    )}
                    {!config.connected &&
                      PROVISION_CHANNELS.has(config.channel) && (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          className='mt-1 h-7 text-xs'
                          disabled={provisioning === config.channel}
                          onClick={() => handleProvision(config)}
                        >
                          {provisioning === config.channel
                            ? 'Provisioning...'
                            : config.channel === 'email'
                              ? 'Provision Email'
                              : 'Provision Phone'}
                        </Button>
                      )}
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  {config.enabled && (
                    <Select
                      value={config.notificationLevel}
                      onValueChange={v =>
                        updateChannel(config.channel, {
                          notificationLevel:
                            v as ChannelConfig['notificationLevel'],
                        })
                      }
                    >
                      <SelectTrigger className='h-8 w-36 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTIFICATION_LEVELS.map(({ value, label }) => (
                          <SelectItem
                            key={value}
                            value={value}
                            className='text-xs'
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={enabled =>
                      updateChannel(config.channel, { enabled })
                    }
                    disabled={config.channel === 'internal'}
                    aria-label={`Toggle ${config.label}`}
                  />
                </div>
              </div>
              {index < channels.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      {enabledChannels.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Channel Priority</CardTitle>
            <CardDescription>
              Reorder enabled channels by preference. Higher channels are tried
              first.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {enabledChannels.map((config, idx) => (
              <div
                key={config.channel}
                className='flex items-center justify-between rounded-md border px-3 py-2'
              >
                <div className='flex items-center gap-2'>
                  <span className='w-5 text-center text-sm font-medium text-muted-foreground'>
                    {idx + 1}
                  </span>
                  <span className='text-base leading-none'>{config.icon}</span>
                  <span className='text-sm font-medium'>{config.label}</span>
                </div>
                <div className='flex gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='h-7 w-7 p-0 text-xs'
                    disabled={idx === 0}
                    onClick={() => moveChannel(config.channel, 'up')}
                    aria-label={`Move ${config.label} up`}
                  >
                    ↑
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='h-7 w-7 p-0 text-xs'
                    disabled={idx === enabledChannels.length - 1}
                    onClick={() => moveChannel(config.channel, 'down')}
                    aria-label={`Move ${config.label} down`}
                  >
                    ↓
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={isSaving} className='min-w-32'>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
