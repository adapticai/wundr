'use client';

import {
  Bell,
  BellOff,
  Calendar,
  Eye,
  EyeOff,
  Hash,
  LayoutList,
  Layout,
  CalendarDays,
  Info,
  Loader2,
  MessageSquare,
  Star,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface WorkspaceSettings {
  displayNameOverride?: string | null;
  defaultChannelId?: string | null;
  mutedUntil?: string | null;
  sidebarCollapsed?: {
    channels?: boolean;
    dms?: boolean;
    starred?: boolean;
  };
  channelOrder?: string[];
  statusMessage?: string | null;
  autoJoinChannels?: string[];
  defaultTaskView?: 'list' | 'board' | 'calendar';
  calendarSyncEnabled?: boolean;
  mutedChannelSchedules?: Array<{
    channelId: string;
    schedule: {
      days: number[];
      startTime: string;
      endTime: string;
    };
  }>;
}

interface Channel {
  id: string;
  name: string;
  type: string;
}

const DISPLAY_NAME_LIMIT = 32;
const STATUS_MESSAGE_LIMIT = 100;
const TASK_VIEW_OPTIONS = [
  { value: 'list', label: 'List View', icon: LayoutList },
  { value: 'board', label: 'Board View', icon: Layout },
  { value: 'calendar', label: 'Calendar View', icon: CalendarDays },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export default function WorkspacePreferencesPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>({
    sidebarCollapsed: {},
    autoJoinChannels: [],
    mutedChannelSchedules: [],
  });

  // Load settings and channels
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load workspace settings
        const settingsRes = await fetch(
          `/api/workspaces/${workspaceSlug}/settings/user`
        );
        if (settingsRes.ok) {
          const { data } = await settingsRes.json();
          setSettings({
            ...data,
            sidebarCollapsed: data.sidebarCollapsed || {},
            autoJoinChannels: data.autoJoinChannels || [],
            mutedChannelSchedules: data.mutedChannelSchedules || [],
          });
        }

        // Load channels
        const channelsRes = await fetch(
          `/api/workspaces/${workspaceSlug}/channels`
        );
        if (channelsRes.ok) {
          const { data } = await channelsRes.json();
          setChannels(data || []);
        }
      } catch (error) {
        console.error('Failed to load workspace settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load workspace settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [workspaceSlug, toast]);

  // Auto-save with debounce
  const saveSettings = useCallback(
    async (updates: Partial<WorkspaceSettings>) => {
      try {
        setIsSaving(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/settings/user`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

        const { data } = await response.json();
        setSettings(prev => ({ ...prev, ...data }));
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to save settings',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [workspaceSlug, toast]
  );

  const handleFieldChange = useCallback(
    (field: keyof WorkspaceSettings, value: unknown) => {
      setSettings(prev => {
        const updated = { ...prev, [field]: value };
        saveSettings({ [field]: value });
        return updated;
      });
    },
    [saveSettings]
  );

  const toggleSidebarSection = useCallback(
    (section: 'channels' | 'dms' | 'starred') => {
      const newCollapsed = {
        ...settings.sidebarCollapsed,
        [section]: !settings.sidebarCollapsed?.[section],
      };
      handleFieldChange('sidebarCollapsed', newCollapsed);
    },
    [settings.sidebarCollapsed, handleFieldChange]
  );

  const toggleAutoJoinChannel = useCallback(
    (channelId: string) => {
      const current = settings.autoJoinChannels || [];
      const updated = current.includes(channelId)
        ? current.filter(id => id !== channelId)
        : [...current, channelId];
      handleFieldChange('autoJoinChannels', updated);
    },
    [settings.autoJoinChannels, handleFieldChange]
  );

  const muteWorkspace = useCallback(
    (durationHours: number) => {
      const newMutedUntil = new Date(
        Date.now() + durationHours * 60 * 60 * 1000
      ).toISOString();
      handleFieldChange('mutedUntil', newMutedUntil);
    },
    [handleFieldChange]
  );

  const unmuteWorkspace = useCallback(() => {
    handleFieldChange('mutedUntil', null);
  }, [handleFieldChange]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Workspace Preferences</h1>
        <p className='mt-1 text-muted-foreground'>
          Customize your experience in this workspace
        </p>
      </div>

      {/* Display & Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Display & Identity</CardTitle>
          <CardDescription>
            Override your display settings for this workspace
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Display Name Override */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='display-name-override'>
                Display Name Override
              </Label>
              <span
                className={`text-xs ${
                  (settings.displayNameOverride?.length || 0) >
                  DISPLAY_NAME_LIMIT
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {settings.displayNameOverride?.length || 0}/{DISPLAY_NAME_LIMIT}
              </span>
            </div>
            <Input
              id='display-name-override'
              type='text'
              placeholder='Leave empty to use your global display name'
              value={settings.displayNameOverride || ''}
              onChange={e => {
                const value = e.target.value.slice(0, DISPLAY_NAME_LIMIT);
                handleFieldChange('displayNameOverride', value || null);
              }}
              maxLength={DISPLAY_NAME_LIMIT}
            />
            <p className='text-xs text-muted-foreground'>
              Use a different name in this workspace (e.g., "Johnny
              [Engineering]")
            </p>
          </div>

          {/* Workspace Status Message */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='status-message'>Workspace Status Message</Label>
              <span
                className={`text-xs ${
                  (settings.statusMessage?.length || 0) > STATUS_MESSAGE_LIMIT
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {settings.statusMessage?.length || 0}/{STATUS_MESSAGE_LIMIT}
              </span>
            </div>
            <Textarea
              id='status-message'
              placeholder='Set a status specific to this workspace'
              value={settings.statusMessage || ''}
              onChange={e => {
                const value = e.target.value.slice(0, STATUS_MESSAGE_LIMIT);
                handleFieldChange('statusMessage', value || null);
              }}
              maxLength={STATUS_MESSAGE_LIMIT}
              rows={2}
            />
            <p className='text-xs text-muted-foreground'>
              This status will only show in this workspace
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Channel Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Preferences</CardTitle>
          <CardDescription>
            Configure your default channel and auto-join settings
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Default Channel */}
          <div className='space-y-2'>
            <Label htmlFor='default-channel'>Default Channel</Label>
            <Select
              value={settings.defaultChannelId || ''}
              onValueChange={value =>
                handleFieldChange('defaultChannelId', value || null)
              }
            >
              <SelectTrigger id='default-channel'>
                <SelectValue placeholder='Select a default channel' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>None</SelectItem>
                {channels.map(channel => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              Channel to open when you enter this workspace
            </p>
          </div>

          {/* Auto-join Channels */}
          <div className='space-y-3'>
            <Label>Auto-join Channels</Label>
            <p className='text-xs text-muted-foreground'>
              Automatically join these channels when they're created
            </p>
            <div className='space-y-2'>
              {channels.slice(0, 10).map(channel => (
                <div
                  key={channel.id}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div className='flex items-center gap-3'>
                    <span className='font-medium'>#{channel.name}</span>
                    <span className='text-xs text-muted-foreground'>
                      {channel.type}
                    </span>
                  </div>
                  <Switch
                    checked={settings.autoJoinChannels?.includes(channel.id)}
                    onCheckedChange={() => toggleAutoJoinChannel(channel.id)}
                  />
                </div>
              ))}
              {channels.length === 0 && (
                <p className='text-sm text-muted-foreground'>
                  No channels available
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Notifications</CardTitle>
          <CardDescription>
            Control notifications for this workspace
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Mute Workspace */}
          <div className='rounded-lg border p-4 space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                {settings.mutedUntil ? (
                  <BellOff className='h-5 w-5 text-muted-foreground' />
                ) : (
                  <Bell className='h-5 w-5 text-muted-foreground' />
                )}
                <div>
                  <p className='font-medium'>Mute Workspace</p>
                  <p className='text-xs text-muted-foreground'>
                    {settings.mutedUntil
                      ? `Muted until ${new Date(settings.mutedUntil).toLocaleString()}`
                      : 'Temporarily disable all notifications from this workspace'}
                  </p>
                </div>
              </div>
              {settings.mutedUntil && (
                <button
                  type='button'
                  onClick={unmuteWorkspace}
                  className='text-sm text-primary hover:underline'
                >
                  Unmute
                </button>
              )}
            </div>
            {!settings.mutedUntil && (
              <div className='flex flex-wrap gap-2 pt-1'>
                {[
                  { label: '30 minutes', hours: 0.5 },
                  { label: '1 hour', hours: 1 },
                  { label: '4 hours', hours: 4 },
                  { label: '24 hours', hours: 24 },
                  { label: 'Until I turn it on', hours: 24 * 365 },
                ].map(option => (
                  <button
                    key={option.label}
                    type='button'
                    onClick={() => muteWorkspace(option.hours)}
                    className='rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent'
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Sidebar Layout</CardTitle>
          <CardDescription>
            Customize which sidebar sections are expanded by default
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-3'>
            {[
              {
                key: 'starred' as const,
                label: 'Starred Items',
                icon: <Star className='h-4 w-4 text-muted-foreground' />,
              },
              {
                key: 'channels' as const,
                label: 'Channels',
                icon: <Hash className='h-4 w-4 text-muted-foreground' />,
              },
              {
                key: 'dms' as const,
                label: 'Direct Messages',
                icon: (
                  <MessageSquare className='h-4 w-4 text-muted-foreground' />
                ),
              },
            ].map(section => (
              <div
                key={section.key}
                className='flex items-center justify-between rounded-lg border p-3'
              >
                <div className='flex items-center gap-3'>
                  {section.icon}
                  <span className='font-medium'>{section.label}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {settings.sidebarCollapsed?.[section.key]
                      ? 'Collapsed'
                      : 'Expanded'}
                  </span>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => toggleSidebarSection(section.key)}
                  >
                    {settings.sidebarCollapsed?.[section.key] ? (
                      <Eye className='h-4 w-4' />
                    ) : (
                      <EyeOff className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task & Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks & Calendar</CardTitle>
          <CardDescription>
            Configure how you view and sync tasks in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Default Task View */}
          <div className='space-y-3'>
            <Label>Default Task View</Label>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
              {TASK_VIEW_OPTIONS.map(option => {
                const Icon = option.icon;
                const isSelected = settings.defaultTaskView === option.value;
                return (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() =>
                      handleFieldChange('defaultTaskView', option.value)
                    }
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                      isSelected
                        ? 'border-primary bg-accent'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Calendar Sync */}
          <div className='flex items-center justify-between rounded-lg border p-4'>
            <div className='flex items-center gap-3'>
              <Calendar className='h-5 w-5 text-muted-foreground' />
              <div>
                <p className='font-medium'>Calendar Sync</p>
                <p className='text-xs text-muted-foreground'>
                  Sync workspace tasks with your calendar
                </p>
              </div>
            </div>
            <Switch
              checked={settings.calendarSyncEnabled}
              onCheckedChange={value =>
                handleFieldChange('calendarSyncEnabled', value)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-save Indicator */}
      <div className='flex items-center justify-center gap-2 rounded-md bg-muted/50 p-3'>
        {isSaving ? (
          <>
            <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
            <p className='text-xs text-muted-foreground'>Saving changes...</p>
          </>
        ) : (
          <>
            <Info className='h-4 w-4 text-muted-foreground' />
            <p className='text-xs text-muted-foreground'>
              Changes are saved automatically
            </p>
          </>
        )}
      </div>
    </div>
  );
}
