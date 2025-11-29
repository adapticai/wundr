'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    showOnlineStatus: true,
    loginAlerts: true,
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [sessions] = useState<Session[]>([
    {
      id: '1',
      device: 'Chrome on macOS',
      location: 'San Francisco, CA',
      lastActive: 'Active now',
      current: true,
    },
    {
      id: '2',
      device: 'Firefox on Windows',
      location: 'New York, NY',
      lastActive: '2 days ago',
      current: false,
    },
    {
      id: '3',
      device: 'Safari on iPhone',
      location: 'Los Angeles, CA',
      lastActive: '1 week ago',
      current: false,
    },
  ]);

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = typeof settings[key] === 'boolean' ? !settings[key] : settings[key];

    setSettings((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      const response = await fetch('/api/user/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update security setting');
      }

      toast({
        title: 'Success',
        description: 'Security setting updated',
      });
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
      const response = await fetch('/api/user/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update security setting');
      }

      toast({
        title: 'Success',
        description: 'Security setting updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/user/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      // Refresh sessions list after revoking
      window.location.reload();
    } catch (error) {
      // Handle error silently or with toast notification
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      const response = await fetch('/api/user/sessions/revoke-all', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke all sessions');
      }

      // Refresh page after revoking all sessions
      window.location.reload();
    } catch (error) {
      // Handle error silently or with toast notification
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account security and privacy settings.
        </p>
      </div>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="secondary"
            onClick={() => setShowPasswordModal(true)}
          >
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="two-factor">Enable 2FA</Label>
              <p className="text-sm text-muted-foreground">
                Require a verification code when signing in
              </p>
            </div>
            <Switch
              id="two-factor"
              checked={settings.twoFactorEnabled}
              onCheckedChange={() => handleToggle('twoFactorEnabled')}
            />
          </div>

          {settings.twoFactorEnabled && (
            <div className="rounded-lg bg-muted/50 p-4 border border-muted">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Two-factor authentication is enabled
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your account is protected with an authenticator app.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                  Reconfigure 2FA
                </Button>
                <span className="text-xs text-muted-foreground">|</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-destructive hover:text-destructive/90"
                >
                  Disable 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Session Settings</CardTitle>
          <CardDescription>
            Control how your sessions behave.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="session-timeout">Session timeout</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sign out after inactivity
              </p>
            </div>
            <Select
              value={settings.sessionTimeout}
              onValueChange={(value) => handleSelectChange('sessionTimeout', value)}
            >
              <SelectTrigger id="session-timeout" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="login-alerts">Login alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone signs in to your account
              </p>
            </div>
            <Switch
              id="login-alerts"
              checked={settings.loginAlerts}
              onCheckedChange={() => handleToggle('loginAlerts')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active Sessions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Devices where you&apos;re currently signed in.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRevokeAllSessions}
            className="text-sm text-destructive hover:underline"
          >
            Sign out all other sessions
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <DeviceIcon />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {session.device}
                    {session.current && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.location} · {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.id)}
                  className="text-sm text-destructive hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Control your privacy settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="online-status">Show online status</Label>
              <p className="text-sm text-muted-foreground">
                Let others see when you&apos;re online
              </p>
            </div>
            <Switch
              id="online-status"
              checked={settings.showOnlineStatus}
              onCheckedChange={() => handleToggle('showOnlineStatus')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Irreversible actions that affect your account.
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Delete account</span>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and a new password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                type="password"
                id="currentPassword"
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                type="password"
                id="newPassword"
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                type="password"
                id="confirmPassword"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeviceIcon() {
  return (
    <svg
      className="h-5 w-5 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
