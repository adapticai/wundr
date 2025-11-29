'use client';

import { useState, useCallback } from 'react';

import {
  useNotificationSettings,
  usePushNotifications,
} from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

import type { NotificationType, NotificationSettings } from '@/types/notification';

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; description: string }> = {
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

export default function NotificationSettingsPage() {
  const {
    settings,
    isLoading,
    updateSettings,
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

  const handleToggleEnabled = useCallback(async () => {
    if (!settings) {
return;
}
    await updateSettings({ enabled: !settings.enabled });
  }, [settings, updateSettings]);

  const handleToggleSound = useCallback(async () => {
    if (!settings) {
return;
}
    await updateSettings({ sound: !settings.sound });
  }, [settings, updateSettings]);

  const handleToggleDesktop = useCallback(async () => {
    if (!settings) {
return;
}

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
  }, [settings, updateSettings, pushEnabled, requestPermission, subscribeToPush, unsubscribeFromPush]);

  const handleDigestChange = useCallback(async (value: string) => {
    await updateSettings({ digestFrequency: value as NotificationSettings['digestFrequency'] });
  }, [updateSettings]);

  const handleQuietHoursToggle = useCallback(async () => {
    if (!settings) {
return;
}
    await updateSettings({
      quietHours: {
        ...settings.quietHours,
        enabled: !settings.quietHours.enabled,
      },
    });
  }, [settings, updateSettings]);

  const handleQuietHoursChange = useCallback(async (field: 'start' | 'end', value: string) => {
    if (!settings) {
return;
}
    await updateSettings({
      quietHours: {
        ...settings.quietHours,
        [field]: value,
      },
    });
  }, [settings, updateSettings]);

  const handleTypeToggle = useCallback(async (type: NotificationType, field: 'enabled' | 'sound' | 'desktop') => {
    if (!settings) {
return;
}

    const currentPrefs = settings.preferences[type];
    await updateSettings({
      preferences: {
        ...settings.preferences,
        [type]: {
          ...currentPrefs,
          [field]: !currentPrefs[field],
        },
      },
    });
  }, [settings, updateSettings]);

  const handleTestNotification = useCallback(async () => {
    setIsSendingTest(true);
    try {
      await sendTestNotification();
    } finally {
      setIsSendingTest(false);
    }
  }, [sendTestNotification]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      {/* Global Settings */}
      <section className="mb-8 space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Global Settings</h2>

        <ToggleRow
          label="Enable notifications"
          description="Turn all notifications on or off"
          checked={settings.enabled}
          onChange={handleToggleEnabled}
        />

        <ToggleRow
          label="Sound"
          description="Play a sound for new notifications"
          checked={settings.sound}
          onChange={handleToggleSound}
          disabled={!settings.enabled}
        />

        <ToggleRow
          label="Desktop notifications"
          description={
            !pushSupported
              ? 'Not supported in this browser'
              : 'Show notifications on your desktop'
          }
          checked={settings.desktop}
          onChange={handleToggleDesktop}
          disabled={!settings.enabled || !pushSupported}
        />
      </section>

      {/* Digest Settings */}
      <section className="mb-8 space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Email Digest</h2>
        <p className="text-sm text-muted-foreground">
          Receive a summary of notifications via email
        </p>

        <div className="mt-4">
          <label htmlFor="digest-frequency" className="sr-only">
            Digest frequency
          </label>
          <select
            id="digest-frequency"
            value={settings.digestFrequency}
            onChange={(e) => handleDigestChange(e.target.value)}
            disabled={!settings.enabled}
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {DIGEST_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Quiet Hours */}
      <section className="mb-8 space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Quiet Hours</h2>
        <p className="text-sm text-muted-foreground">
          Mute notifications during specific hours
        </p>

        <ToggleRow
          label="Enable quiet hours"
          description="Pause notifications during set times"
          checked={settings.quietHours.enabled}
          onChange={handleQuietHoursToggle}
          disabled={!settings.enabled}
        />

        {settings.quietHours.enabled && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="quiet-start" className="mb-1 block text-sm font-medium">
                Start time
              </label>
              <input
                type="time"
                id="quiet-start"
                value={settings.quietHours.start}
                onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                disabled={!settings.enabled}
                className={cn(
                  'w-full rounded-md border bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="quiet-end" className="mb-1 block text-sm font-medium">
                End time
              </label>
              <input
                type="time"
                id="quiet-end"
                value={settings.quietHours.end}
                onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                disabled={!settings.enabled}
                className={cn(
                  'w-full rounded-md border bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
            </div>
          </div>
        )}
      </section>

      {/* Notification Type Preferences */}
      <section className="mb-8 space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Notification Types</h2>
        <p className="text-sm text-muted-foreground">
          Configure notifications for each type of activity
        </p>

        <div className="mt-4 divide-y">
          {(Object.entries(NOTIFICATION_TYPE_LABELS) as [NotificationType, typeof NOTIFICATION_TYPE_LABELS[NotificationType]][]).map(
            ([type, config]) => (
              <div key={type} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.preferences[type].enabled}
                        onChange={() => handleTypeToggle(type, 'enabled')}
                        disabled={!settings.enabled}
                        className="rounded border-stone-300"
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.preferences[type].sound}
                        onChange={() => handleTypeToggle(type, 'sound')}
                        disabled={!settings.enabled || !settings.preferences[type].enabled}
                        className="rounded border-stone-300"
                      />
                      Sound
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.preferences[type].desktop}
                        onChange={() => handleTypeToggle(type, 'desktop')}
                        disabled={!settings.enabled || !settings.preferences[type].enabled}
                        className="rounded border-stone-300"
                      />
                      Desktop
                    </label>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Muted Channels */}
      {settings.mutedChannels.length > 0 && (
        <section className="mb-8 space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Muted Channels</h2>
          <p className="text-sm text-muted-foreground">
            You won&apos;t receive notifications from these channels
          </p>

          <div className="mt-4 space-y-2">
            {settings.mutedChannels.map((channelId) => (
              <div
                key={channelId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">Channel: {channelId}</span>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Test Notification */}
      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Test Notification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a test notification to verify your settings
        </p>

        <button
          type="button"
          onClick={handleTestNotification}
          disabled={!settings.enabled || isSendingTest}
          className={cn(
            'mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSendingTest ? 'Sending...' : 'Send Test Notification'}
        </button>
      </section>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full',
            'bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
            'translate-y-0.5',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
