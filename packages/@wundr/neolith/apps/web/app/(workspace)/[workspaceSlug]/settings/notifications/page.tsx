'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  useNotificationSettings,
  usePushNotifications,
} from '@/hooks/use-notifications';
import type { NotificationType } from '@/types/notification';
import { Mail, Shield, Loader2 } from 'lucide-react';

const NOTIFICATION_TYPE_LABELS: Record<
  NotificationType,
  { label: string; description: string }
> = {
  message: {
    label: 'Direct Messages',
    description: 'New messages in direct conversations',
  },
  mention: {
    label: 'Mentions',
    description: 'When someone mentions you in a message',
  },
  reaction: {
    label: 'Reactions',
    description: 'When someone reacts to your message',
  },
  thread_reply: {
    label: 'Thread Replies',
    description: 'New replies to threads you are in',
  },
  channel_invite: {
    label: 'Channel Invites',
    description: 'Invitations to join channels',
  },
  call_incoming: {
    label: 'Incoming Calls',
    description: 'When someone calls you',
  },
  call_missed: {
    label: 'Missed Calls',
    description: 'Notifications about missed calls',
  },
  orchestrator_update: {
    label: 'Orchestrator Updates',
    description: 'Updates from your Orchestrators',
  },
  system: {
    label: 'System Notifications',
    description: 'Important system announcements',
  },
};

const DIGEST_FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant' },
  { value: 'hourly', label: 'Hourly digest' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
  { value: 'never', label: 'Never' },
];

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

export default function NotificationsSettingsPage() {
  const { toast } = useToast();
  const {
    settings,
    isLoading,
    updateSettings,
    unmuteChannel,
    sendTestNotification,
  } = useNotificationSettings();

  const {
    isSupported: pushSupported,
    isEnabled: pushEnabled,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePushNotifications();

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ]);

  // Email preferences state
  const [isLoadingEmailPrefs, setIsLoadingEmailPrefs] = useState(true);
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState({
    marketingEmails: true,
    notificationEmails: true,
    digestEmails: 'daily' as 'none' | 'daily' | 'weekly',
    securityEmails: true,
  });

  const handleToggleEnabled = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ enabled: !settings.enabled });
  }, [settings, updateSettings]);

  const handleToggleDoNotDisturb = useCallback(() => {
    setDoNotDisturb(!doNotDisturb);
    toast({
      title: doNotDisturb
        ? 'Do Not Disturb disabled'
        : 'Do Not Disturb enabled',
      description: doNotDisturb
        ? 'You will now receive notifications'
        : 'Notifications are paused',
    });
  }, [doNotDisturb, toast]);

  const handleToggleSound = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ sound: !settings.sound });
  }, [settings, updateSettings]);

  const handleToggleDesktop = useCallback(async () => {
    if (!settings) return;

    if (!settings.desktop && !pushEnabled) {
      const granted = await requestPermission();
      if (granted) {
        await subscribeToPush();
        await updateSettings({ desktop: true });
      }
    } else if (settings.desktop) {
      await unsubscribeFromPush();
      await updateSettings({ desktop: false });
    } else {
      await subscribeToPush();
      await updateSettings({ desktop: true });
    }
  }, [
    settings,
    updateSettings,
    pushEnabled,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
  ]);

  const handleToggleMobile = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ mobile: !settings.mobile });
  }, [settings, updateSettings]);

  const handleToggleEmail = useCallback(async () => {
    if (!settings) return;
    await updateSettings({ email: !settings.email });
  }, [settings, updateSettings]);

  const handleDigestChange = useCallback(
    async (value: string) => {
      if (!settings) return;
      await updateSettings({
        digestFrequency: value as typeof settings.digestFrequency,
      });
    },
    [updateSettings, settings]
  );

  const handleQuietHoursToggle = useCallback(async () => {
    if (!settings) return;
    await updateSettings({
      quietHours: {
        ...settings.quietHours,
        enabled: !settings.quietHours.enabled,
      },
    });
  }, [settings, updateSettings]);

  const handleQuietHoursChange = useCallback(
    async (field: 'start' | 'end', value: string) => {
      if (!settings?.quietHours) return;
      await updateSettings({
        quietHours: {
          ...settings.quietHours,
          [field]: value,
        },
      });
    },
    [settings, updateSettings]
  );

  const handleTypeToggle = useCallback(
    async (
      type: NotificationType,
      channel: 'enabled' | 'sound' | 'desktop'
    ) => {
      if (!settings) return;

      const currentPrefs = settings.preferences[type];
      await updateSettings({
        preferences: {
          ...settings.preferences,
          [type]: {
            ...currentPrefs,
            [channel]: !currentPrefs[channel],
          },
        },
      });
    },
    [settings, updateSettings]
  );

  const handleTestNotification = useCallback(async () => {
    setIsSendingTest(true);
    try {
      await sendTestNotification();
      toast({
        title: 'Test notification sent',
        description: 'Check your notification channels',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
  }, [sendTestNotification, toast]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Fetch email preferences
  useEffect(() => {
    const fetchEmailPreferences = async () => {
      try {
        setIsLoadingEmailPrefs(true);
        const response = await fetch('/api/users/me/email-preferences');

        if (!response.ok) {
          throw new Error('Failed to fetch email preferences');
        }

        const result = await response.json();
        setEmailPreferences(result.data);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to load email preferences',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingEmailPrefs(false);
      }
    };

    fetchEmailPreferences();
  }, [toast]);

  const handleEmailPrefToggle = (key: keyof typeof emailPreferences) => {
    // Security emails cannot be disabled
    if (key === 'securityEmails') {
      toast({
        title: 'Cannot disable security emails',
        description:
          'Security emails are required for account safety and cannot be turned off.',
        variant: 'destructive',
      });
      return;
    }

    setEmailPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleEmailDigestChange = (value: 'none' | 'daily' | 'weekly') => {
    setEmailPreferences(prev => ({
      ...prev,
      digestEmails: value,
    }));
  };

  const handleSaveEmailPreferences = async () => {
    setIsSavingEmailPrefs(true);
    try {
      const response = await fetch('/api/users/me/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPreferences),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || 'Failed to update email preferences'
        );
      }

      toast({
        title: 'Success',
        description: 'Email preferences updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update email preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEmailPrefs(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <p className='text-muted-foreground'>
          Failed to load notification settings
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Notification Settings</h1>
        <p className='mt-1 text-muted-foreground'>
          Configure how and when you receive notifications from Neolith.
        </p>
      </div>

      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Global Controls</CardTitle>
          <CardDescription>
            Master controls for all notifications
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='master-toggle'>All notifications</Label>
              <p className='text-sm text-muted-foreground'>
                Turn all notifications on or off
              </p>
            </div>
            <Switch
              id='master-toggle'
              checked={settings.enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='dnd-toggle'>Do Not Disturb</Label>
              <p className='text-sm text-muted-foreground'>
                Temporarily pause all notifications
              </p>
            </div>
            <Switch
              id='dnd-toggle'
              checked={doNotDisturb}
              onCheckedChange={handleToggleDoNotDisturb}
              disabled={!settings.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='in-app' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='in-app'>In-App</TabsTrigger>
              <TabsTrigger value='email'>Email</TabsTrigger>
              <TabsTrigger value='push'>Push/Mobile</TabsTrigger>
            </TabsList>

            <TabsContent value='in-app' className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='in-app-sound'>Notification sounds</Label>
                  <p className='text-sm text-muted-foreground'>
                    Play sounds for new notifications
                  </p>
                </div>
                <Switch
                  id='in-app-sound'
                  checked={settings.sound}
                  onCheckedChange={handleToggleSound}
                  disabled={!settings.enabled}
                />
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='in-app-desktop'>Desktop popups</Label>
                  <p className='text-sm text-muted-foreground'>
                    Show desktop notification alerts
                  </p>
                </div>
                <Switch
                  id='in-app-desktop'
                  checked={settings.desktop}
                  onCheckedChange={handleToggleDesktop}
                  disabled={!settings.enabled || !pushSupported}
                />
              </div>
            </TabsContent>

            <TabsContent value='email' className='space-y-6'>
              {/* Email Notifications Toggle */}
              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label htmlFor='email-enabled'>Email notifications</Label>
                  <p className='text-sm text-muted-foreground'>
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id='email-enabled'
                  checked={settings.email}
                  onCheckedChange={handleToggleEmail}
                  disabled={!settings.enabled}
                />
              </div>

              {isLoadingEmailPrefs ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                </div>
              ) : (
                <>
                  {/* Marketing Communications */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <Mail className='h-4 w-4 text-muted-foreground' />
                      <h3 className='font-medium'>Marketing Communications</h3>
                    </div>
                    <div className='space-y-3 pl-6'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <Label
                            htmlFor='marketing-emails'
                            className='font-normal'
                          >
                            Product updates and tips
                          </Label>
                          <p className='text-sm text-muted-foreground'>
                            Stay informed about new features, improvements, and
                            helpful tips
                          </p>
                        </div>
                        <Switch
                          id='marketing-emails'
                          checked={emailPreferences.marketingEmails}
                          onCheckedChange={() =>
                            handleEmailPrefToggle('marketingEmails')
                          }
                          disabled={!settings.enabled || !settings.email}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Activity Notifications */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <Mail className='h-4 w-4 text-muted-foreground' />
                      <h3 className='font-medium'>Activity Notifications</h3>
                    </div>
                    <div className='space-y-3 pl-6'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <Label
                            htmlFor='notification-emails'
                            className='font-normal'
                          >
                            Mentions and messages
                          </Label>
                          <p className='text-sm text-muted-foreground'>
                            Get notified via email when someone mentions you or
                            sends you a message
                          </p>
                        </div>
                        <Switch
                          id='notification-emails'
                          checked={emailPreferences.notificationEmails}
                          onCheckedChange={() =>
                            handleEmailPrefToggle('notificationEmails')
                          }
                          disabled={!settings.enabled || !settings.email}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Frequency */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <Mail className='h-4 w-4 text-muted-foreground' />
                      <h3 className='font-medium'>Email Frequency</h3>
                    </div>
                    <div className='space-y-3 pl-6'>
                      <div className='space-y-2'>
                        <Label htmlFor='activity-digest'>Activity digest</Label>
                        <Select
                          value={emailPreferences.digestEmails}
                          onValueChange={handleEmailDigestChange}
                          disabled={!settings.enabled || !settings.email}
                        >
                          <SelectTrigger id='activity-digest'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='none'>Never</SelectItem>
                            <SelectItem value='daily'>Daily summary</SelectItem>
                            <SelectItem value='weekly'>
                              Weekly summary
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className='text-sm text-muted-foreground'>
                          How often to receive activity summaries in your
                          workspaces
                        </p>
                      </div>

                      <div className='space-y-2'>
                        <Label htmlFor='notification-batching'>
                          Notification emails
                        </Label>
                        <Select
                          value={settings.digestFrequency}
                          onValueChange={handleDigestChange}
                          disabled={!settings.enabled || !settings.email}
                        >
                          <SelectTrigger id='notification-batching'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DIGEST_FREQUENCY_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className='text-sm text-muted-foreground'>
                          Send notification emails instantly or batched
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Security & Transactional Emails */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                      <Shield className='h-4 w-4 text-muted-foreground' />
                      <h3 className='font-medium'>
                        Security & Transactional Emails
                      </h3>
                    </div>
                    <div className='space-y-3 pl-6'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <Label
                            htmlFor='security-emails'
                            className='font-normal'
                          >
                            Security alerts
                          </Label>
                          <p className='text-sm text-muted-foreground'>
                            Password changes, new logins, and other
                            security-related notifications
                          </p>
                        </div>
                        <Switch
                          id='security-emails'
                          checked={emailPreferences.securityEmails}
                          disabled
                          className='opacity-50 cursor-not-allowed'
                        />
                      </div>
                      <div className='rounded-md bg-muted p-3'>
                        <p className='text-sm text-muted-foreground'>
                          Security emails are always enabled to protect your
                          account. This includes password resets, account
                          changes, and security alerts.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className='flex justify-end pt-2'>
                    <Button
                      onClick={handleSaveEmailPreferences}
                      disabled={isSavingEmailPrefs || !settings.enabled}
                    >
                      {isSavingEmailPrefs ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Saving...
                        </>
                      ) : (
                        'Save Email Preferences'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value='push' className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='mobile-enabled'>
                    Mobile push notifications
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Receive push notifications on mobile devices
                  </p>
                </div>
                <Switch
                  id='mobile-enabled'
                  checked={settings.mobile}
                  onCheckedChange={handleToggleMobile}
                  disabled={!settings.enabled}
                />
              </div>

              {!pushSupported && (
                <div className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                  Push notifications are not supported in this browser
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Configure notifications for each type of activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className='text-center'>In-App</TableHead>
                <TableHead className='text-center'>Email</TableHead>
                <TableHead className='text-center'>Push</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                Object.entries(NOTIFICATION_TYPE_LABELS) as [
                  NotificationType,
                  (typeof NOTIFICATION_TYPE_LABELS)[NotificationType],
                ][]
              ).map(([type, config]) => (
                <TableRow key={type}>
                  <TableCell>
                    <div>
                      <p className='font-medium'>{config.label}</p>
                      <p className='text-sm text-muted-foreground'>
                        {config.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className='text-center'>
                    <Switch
                      checked={
                        settings.preferences[type].enabled && settings.desktop
                      }
                      onCheckedChange={() => handleTypeToggle(type, 'enabled')}
                      disabled={!settings.enabled || !settings.desktop}
                    />
                  </TableCell>
                  <TableCell className='text-center'>
                    <Switch
                      checked={
                        settings.preferences[type].enabled && settings.email
                      }
                      onCheckedChange={() => handleTypeToggle(type, 'enabled')}
                      disabled={!settings.enabled || !settings.email}
                    />
                  </TableCell>
                  <TableCell className='text-center'>
                    <Switch
                      checked={
                        settings.preferences[type].desktop && settings.mobile
                      }
                      onCheckedChange={() => handleTypeToggle(type, 'desktop')}
                      disabled={!settings.enabled || !settings.mobile}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Set times when you don&apos;t want to be disturbed
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='quiet-hours'>Enable quiet hours</Label>
              <p className='text-sm text-muted-foreground'>
                Pause notifications during set times
              </p>
            </div>
            <Switch
              id='quiet-hours'
              checked={settings.quietHours.enabled}
              onCheckedChange={handleQuietHoursToggle}
              disabled={!settings.enabled}
            />
          </div>

          {settings.quietHours.enabled && (
            <>
              <div className='flex items-center gap-4 pt-2'>
                <div className='flex-1 space-y-2'>
                  <Label htmlFor='quiet-start'>Start time</Label>
                  <Input
                    type='time'
                    id='quiet-start'
                    value={settings.quietHours.start}
                    onChange={e =>
                      handleQuietHoursChange('start', e.target.value)
                    }
                    disabled={!settings.enabled}
                  />
                </div>
                <div className='flex-1 space-y-2'>
                  <Label htmlFor='quiet-end'>End time</Label>
                  <Input
                    type='time'
                    id='quiet-end'
                    value={settings.quietHours.end}
                    onChange={e =>
                      handleQuietHoursChange('end', e.target.value)
                    }
                    disabled={!settings.enabled}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Active days</Label>
                <div className='flex gap-2'>
                  {DAYS_OF_WEEK.map(day => (
                    <Button
                      key={day.value}
                      type='button'
                      variant={
                        selectedDays.includes(day.value) ? 'default' : 'outline'
                      }
                      size='sm'
                      onClick={() => toggleDay(day.value)}
                      disabled={!settings.enabled}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className='text-sm text-muted-foreground'>
                  Select which days quiet hours apply
                </p>
              </div>

              <div className='flex items-center justify-between rounded-md border p-3'>
                <div className='space-y-0.5'>
                  <Label>Override for urgent notifications</Label>
                  <p className='text-sm text-muted-foreground'>
                    Allow critical notifications during quiet hours
                  </p>
                </div>
                <Switch defaultChecked disabled={!settings.enabled} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Channel-Specific Settings */}
      {settings.mutedChannels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Muted Channels</CardTitle>
            <CardDescription>
              You won&apos;t receive notifications from these channels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {settings.mutedChannels.map(channelId => (
                <div
                  key={channelId}
                  className='flex items-center justify-between rounded-md border p-3'
                >
                  <span className='text-sm font-medium'>
                    Channel: {channelId}
                  </span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => unmuteChannel(channelId)}
                  >
                    Unmute
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Notification */}
      <Card>
        <CardHeader>
          <CardTitle>Test Notification</CardTitle>
          <CardDescription>
            Send a test notification to verify your settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type='button'
            onClick={handleTestNotification}
            disabled={!settings.enabled || isSendingTest}
          >
            {isSendingTest ? 'Sending...' : 'Send Test Notification'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
