'use client';

import { useState } from 'react';

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState({
    // Email notifications
    emailNotifications: true,
    emailDigest: 'daily' as 'none' | 'daily' | 'weekly',
    emailMentions: true,
    emailVPUpdates: true,
    emailWorkflowAlerts: true,

    // Push notifications
    pushNotifications: true,
    pushMentions: true,
    pushDirectMessages: true,
    pushWorkflowAlerts: true,

    // In-app notifications
    inAppNotifications: true,
    inAppSounds: false,
    inAppDesktopAlerts: true,

    // Quiet hours
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
    }));
  };

  const handleSelectChange = (key: keyof typeof settings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure how and when you receive notifications from Neolith.
        </p>
      </div>

      {/* Email Notifications */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Email Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control what email notifications you receive.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Email notifications</span>
              <p className="text-xs text-muted-foreground">Receive email notifications</p>
            </div>
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={() => handleToggle('emailNotifications')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Email digest</span>
              <p className="text-xs text-muted-foreground">Receive a summary of activity</p>
            </div>
            <select
              value={settings.emailDigest}
              onChange={(e) => handleSelectChange('emailDigest', e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="none">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Mentions</span>
              <p className="text-xs text-muted-foreground">When someone mentions you</p>
            </div>
            <input
              type="checkbox"
              checked={settings.emailMentions}
              onChange={() => handleToggle('emailMentions')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">VP updates</span>
              <p className="text-xs text-muted-foreground">Updates from your VPs</p>
            </div>
            <input
              type="checkbox"
              checked={settings.emailVPUpdates}
              onChange={() => handleToggle('emailVPUpdates')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Workflow alerts</span>
              <p className="text-xs text-muted-foreground">Notifications about workflow executions</p>
            </div>
            <input
              type="checkbox"
              checked={settings.emailWorkflowAlerts}
              onChange={() => handleToggle('emailWorkflowAlerts')}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* Push Notifications */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Push Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure browser and mobile push notifications.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Push notifications</span>
              <p className="text-xs text-muted-foreground">Enable push notifications</p>
            </div>
            <input
              type="checkbox"
              checked={settings.pushNotifications}
              onChange={() => handleToggle('pushNotifications')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Mentions</span>
              <p className="text-xs text-muted-foreground">When someone mentions you</p>
            </div>
            <input
              type="checkbox"
              checked={settings.pushMentions}
              onChange={() => handleToggle('pushMentions')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Direct messages</span>
              <p className="text-xs text-muted-foreground">When you receive a direct message</p>
            </div>
            <input
              type="checkbox"
              checked={settings.pushDirectMessages}
              onChange={() => handleToggle('pushDirectMessages')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Workflow alerts</span>
              <p className="text-xs text-muted-foreground">Critical workflow notifications</p>
            </div>
            <input
              type="checkbox"
              checked={settings.pushWorkflowAlerts}
              onChange={() => handleToggle('pushWorkflowAlerts')}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* In-App Notifications */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">In-App Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure notifications within the Neolith interface.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">In-app notifications</span>
              <p className="text-xs text-muted-foreground">Show notifications in the app</p>
            </div>
            <input
              type="checkbox"
              checked={settings.inAppNotifications}
              onChange={() => handleToggle('inAppNotifications')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Notification sounds</span>
              <p className="text-xs text-muted-foreground">Play sounds for notifications</p>
            </div>
            <input
              type="checkbox"
              checked={settings.inAppSounds}
              onChange={() => handleToggle('inAppSounds')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Desktop alerts</span>
              <p className="text-xs text-muted-foreground">Show desktop notification alerts</p>
            </div>
            <input
              type="checkbox"
              checked={settings.inAppDesktopAlerts}
              onChange={() => handleToggle('inAppDesktopAlerts')}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Quiet Hours</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set times when you don&apos;t want to be disturbed.
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium">Enable quiet hours</span>
              <p className="text-xs text-muted-foreground">Pause notifications during set times</p>
            </div>
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled}
              onChange={() => handleToggle('quietHoursEnabled')}
              className="h-5 w-5 accent-primary"
            />
          </label>

          {settings.quietHoursEnabled && (
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="quietStart" className="block text-xs text-muted-foreground mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  id="quietStart"
                  value={settings.quietHoursStart}
                  onChange={(e) => handleSelectChange('quietHoursStart', e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="quietEnd" className="block text-xs text-muted-foreground mb-1">
                  End time
                </label>
                <input
                  type="time"
                  id="quietEnd"
                  value={settings.quietHoursEnd}
                  onChange={(e) => handleSelectChange('quietHoursEnd', e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-95 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
