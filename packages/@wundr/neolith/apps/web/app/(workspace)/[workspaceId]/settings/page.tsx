'use client';

import { useState } from 'react';

import { ThemeToggleLarge } from '@/components/layout/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    avatar: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
    mentionAlerts: true,
    vpUpdates: true,
  });

  const [accountSettings, setAccountSettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    showOnlineStatus: true,
  });

  const handleProfileSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handleNotificationToggle = (key: keyof typeof notificationSettings) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAccountToggle = (key: keyof typeof accountSettings) => {
    if (key === 'sessionTimeout') {
      return;
    }
    setAccountSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your personal information and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileData.avatar} alt={profileData.name} />
              <AvatarFallback className="text-lg">
                {profileData.name
                  ? profileData.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                  : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>Change Avatar</span>
                </Button>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setProfileData((prev) => ({
                        ...prev,
                        avatar: reader.result as string,
                      }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG or GIF. Max size 2MB.
              </p>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={profileData.name}
              onChange={(e) =>
                setProfileData((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={profileData.email}
              onChange={(e) =>
                setProfileData((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Your email is used for account recovery and notifications
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleProfileSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize how the interface looks and feels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">Theme</Label>
            <ThemeToggleLarge />
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Your theme preference is automatically saved and will persist across
              sessions
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Control how and when you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={notificationSettings.emailNotifications}
                onCheckedChange={() =>
                  handleNotificationToggle('emailNotifications')
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications on your devices
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={notificationSettings.pushNotifications}
                onCheckedChange={() =>
                  handleNotificationToggle('pushNotifications')
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-digest">Weekly Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Get a weekly summary of activity
                </p>
              </div>
              <Switch
                id="weekly-digest"
                checked={notificationSettings.weeklyDigest}
                onCheckedChange={() => handleNotificationToggle('weeklyDigest')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mention-alerts">Mention Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone mentions you
                </p>
              </div>
              <Switch
                id="mention-alerts"
                checked={notificationSettings.mentionAlerts}
                onCheckedChange={() => handleNotificationToggle('mentionAlerts')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="vp-updates">VP Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Notifications from Virtual Professionals
                </p>
              </div>
              <Switch
                id="vp-updates"
                checked={notificationSettings.vpUpdates}
                onCheckedChange={() => handleNotificationToggle('vpUpdates')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>
            Manage your account security and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch
                id="two-factor"
                checked={accountSettings.twoFactorEnabled}
                onCheckedChange={() => handleAccountToggle('twoFactorEnabled')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="online-status">Show Online Status</Label>
                <p className="text-sm text-muted-foreground">
                  Let others see when you are online
                </p>
              </div>
              <Switch
                id="online-status"
                checked={accountSettings.showOnlineStatus}
                onCheckedChange={() => handleAccountToggle('showOnlineStatus')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                min="5"
                max="120"
                value={accountSettings.sessionTimeout}
                onChange={(e) =>
                  setAccountSettings((prev) => ({
                    ...prev,
                    sessionTimeout: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Automatically log out after this period of inactivity
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-6 border-t border-destructive/20">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-destructive">
                  Danger Zone
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Irreversible actions that affect your account
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Links */}
      <Card>
        <CardHeader>
          <CardTitle>More Settings</CardTitle>
          <CardDescription>
            Access additional configuration options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="./settings/profile">Advanced Profile Settings</a>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="./settings/integrations">Integration Settings</a>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="../user-settings/notifications">
                Detailed Notification Settings
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading skeleton component
function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
