'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function NotificationsSettingsPage() {
  const { toast } = useToast();
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

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = typeof settings[key] === 'boolean' ? !settings[key] : settings[key];

    setSettings((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification setting');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });

      // Revert on error
      setSettings((prev) => ({
        ...prev,
        [key]: !newValue,
      }));
    }
  };

  const handleSelectChange = async (key: keyof typeof settings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification setting');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });
    }
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
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Control what email notifications you receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email notifications</Label>
              <p className="text-sm text-muted-foreground">Receive email notifications</p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle('emailNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-digest">Email digest</Label>
              <p className="text-sm text-muted-foreground">Receive a summary of activity</p>
            </div>
            <Select
              value={settings.emailDigest}
              onValueChange={(value) => handleSelectChange('emailDigest', value)}
            >
              <SelectTrigger id="email-digest" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-mentions">Mentions</Label>
              <p className="text-sm text-muted-foreground">When someone mentions you</p>
            </div>
            <Switch
              id="email-mentions"
              checked={settings.emailMentions}
              onCheckedChange={() => handleToggle('emailMentions')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-vp-updates">Orchestrator updates</Label>
              <p className="text-sm text-muted-foreground">Updates from your Orchestrators</p>
            </div>
            <Switch
              id="email-vp-updates"
              checked={settings.emailVPUpdates}
              onCheckedChange={() => handleToggle('emailVPUpdates')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-workflow-alerts">Workflow alerts</Label>
              <p className="text-sm text-muted-foreground">Notifications about workflow executions</p>
            </div>
            <Switch
              id="email-workflow-alerts"
              checked={settings.emailWorkflowAlerts}
              onCheckedChange={() => handleToggle('emailWorkflowAlerts')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>
            Configure browser and mobile push notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Push notifications</Label>
              <p className="text-sm text-muted-foreground">Enable push notifications</p>
            </div>
            <Switch
              id="push-notifications"
              checked={settings.pushNotifications}
              onCheckedChange={() => handleToggle('pushNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-mentions">Mentions</Label>
              <p className="text-sm text-muted-foreground">When someone mentions you</p>
            </div>
            <Switch
              id="push-mentions"
              checked={settings.pushMentions}
              onCheckedChange={() => handleToggle('pushMentions')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-dm">Direct messages</Label>
              <p className="text-sm text-muted-foreground">When you receive a direct message</p>
            </div>
            <Switch
              id="push-dm"
              checked={settings.pushDirectMessages}
              onCheckedChange={() => handleToggle('pushDirectMessages')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-workflow-alerts">Workflow alerts</Label>
              <p className="text-sm text-muted-foreground">Critical workflow notifications</p>
            </div>
            <Switch
              id="push-workflow-alerts"
              checked={settings.pushWorkflowAlerts}
              onCheckedChange={() => handleToggle('pushWorkflowAlerts')}
            />
          </div>
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>In-App Notifications</CardTitle>
          <CardDescription>
            Configure notifications within the Neolith interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-notifications">In-app notifications</Label>
              <p className="text-sm text-muted-foreground">Show notifications in the app</p>
            </div>
            <Switch
              id="in-app-notifications"
              checked={settings.inAppNotifications}
              onCheckedChange={() => handleToggle('inAppNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-sounds">Notification sounds</Label>
              <p className="text-sm text-muted-foreground">Play sounds for notifications</p>
            </div>
            <Switch
              id="in-app-sounds"
              checked={settings.inAppSounds}
              onCheckedChange={() => handleToggle('inAppSounds')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-desktop-alerts">Desktop alerts</Label>
              <p className="text-sm text-muted-foreground">Show desktop notification alerts</p>
            </div>
            <Switch
              id="in-app-desktop-alerts"
              checked={settings.inAppDesktopAlerts}
              onCheckedChange={() => handleToggle('inAppDesktopAlerts')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Set times when you don&apos;t want to be disturbed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours">Enable quiet hours</Label>
              <p className="text-sm text-muted-foreground">Pause notifications during set times</p>
            </div>
            <Switch
              id="quiet-hours"
              checked={settings.quietHoursEnabled}
              onCheckedChange={() => handleToggle('quietHoursEnabled')}
            />
          </div>

          {settings.quietHoursEnabled && (
            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="quiet-start">Start time</Label>
                <Input
                  type="time"
                  id="quiet-start"
                  value={settings.quietHoursStart}
                  onChange={(e) => handleSelectChange('quietHoursStart', e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="quiet-end">End time</Label>
                <Input
                  type="time"
                  id="quiet-end"
                  value={settings.quietHoursEnd}
                  onChange={(e) => handleSelectChange('quietHoursEnd', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
