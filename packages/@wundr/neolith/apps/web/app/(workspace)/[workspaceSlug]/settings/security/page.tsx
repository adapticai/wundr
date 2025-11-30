'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { PasswordSection } from '@/components/settings/security/PasswordSection';
import { TwoFactorSection } from '@/components/settings/security/TwoFactorSection';
import { SessionsList, type Session } from '@/components/settings/security/SessionsList';
import { DangerZone } from '@/components/settings/security/DangerZone';
import { Shield, Eye, Bell, Chrome, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SecuritySettingsPage() {
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    showOnlineStatus: true,
    showTypingIndicators: true,
    showReadReceipts: true,
    loginAlerts: true,
  });

  const [sessions] = useState<Session[]>([
    {
      id: '1',
      device: 'Chrome on macOS',
      browser: 'Chrome',
      os: 'macOS',
      location: 'San Francisco, CA',
      lastActive: 'Active now',
      current: true,
      deviceType: 'desktop',
    },
    {
      id: '2',
      device: 'Firefox on Windows',
      browser: 'Firefox',
      os: 'Windows',
      location: 'New York, NY',
      lastActive: '2 days ago',
      current: false,
      deviceType: 'desktop',
    },
    {
      id: '3',
      device: 'Safari on iPhone',
      browser: 'Safari',
      os: 'iOS',
      location: 'Los Angeles, CA',
      lastActive: '1 week ago',
      current: false,
      deviceType: 'mobile',
    },
  ]);

  const [connectedAccounts] = useState([
    { provider: 'google', email: 'user@gmail.com', connected: true },
    { provider: 'github', username: 'user123', connected: true },
  ]);

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = !settings[key];

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

      toast({
        title: 'Session revoked',
        description: 'The session has been signed out',
      });

      // Refresh sessions list after revoking
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke session',
        variant: 'destructive',
      });
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

      toast({
        title: 'Sessions revoked',
        description: 'All other sessions have been signed out',
      });

      // Refresh page after revoking all sessions
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke sessions',
        variant: 'destructive',
      });
    }
  };

  const handlePasswordChange = async (currentPassword: string, newPassword: string) => {
    const response = await fetch('/api/user/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update password');
    }
  };

  const handleDeleteAccount = async () => {
    const response = await fetch('/api/user/account', {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete account');
    }

    // Redirect to login or home page
    window.location.href = '/';
  };

  const handleDisconnectSocial = async (provider: string) => {
    try {
      const response = await fetch(`/api/user/social/${provider}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect account');
      }

      toast({
        title: 'Account disconnected',
        description: `Your ${provider} account has been disconnected`,
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect account',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account security and privacy settings
        </p>
      </div>

      {/* Password & Authentication Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Password & Authentication</CardTitle>
          </div>
          <CardDescription>
            Manage your password and authentication methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PasswordSection onPasswordChange={handlePasswordChange} />

          <Separator />

          <TwoFactorSection
            enabled={settings.twoFactorEnabled}
            onToggle={() => handleToggle('twoFactorEnabled')}
          />

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Connected Social Accounts</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Sign in with these accounts instead of using your password
              </p>
            </div>

            <div className="space-y-3">
              {connectedAccounts.map((account) => (
                <div
                  key={account.provider}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {account.provider === 'google' && <Chrome className="h-5 w-5" />}
                      {account.provider === 'github' && <Github className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{account.provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {'email' in account ? account.email : account.username}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnectSocial(account.provider)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Sessions</CardTitle>
          </div>
          <CardDescription>
            Manage and monitor your active sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList
            sessions={sessions}
            onRevokeSession={handleRevokeSession}
            onRevokeAllSessions={handleRevokeAllSessions}
          />
        </CardContent>
      </Card>

      {/* Privacy Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <CardTitle>Privacy</CardTitle>
          </div>
          <CardDescription>
            Control what others can see about your activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="online-status">Show online status</Label>
              <p className="text-sm text-muted-foreground">
                Let others see when you're online
              </p>
            </div>
            <Switch
              id="online-status"
              checked={settings.showOnlineStatus}
              onCheckedChange={() => handleToggle('showOnlineStatus')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="typing-indicators">Show typing indicators</Label>
              <p className="text-sm text-muted-foreground">
                Let others see when you're typing a message
              </p>
            </div>
            <Switch
              id="typing-indicators"
              checked={settings.showTypingIndicators}
              onCheckedChange={() => handleToggle('showTypingIndicators')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="read-receipts">Show read receipts</Label>
              <p className="text-sm text-muted-foreground">
                Let others see when you've read their messages
              </p>
            </div>
            <Switch
              id="read-receipts"
              checked={settings.showReadReceipts}
              onCheckedChange={() => handleToggle('showReadReceipts')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Account Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Account Security</CardTitle>
          </div>
          <CardDescription>
            Configure security alerts and session behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="session-timeout">Session timeout</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sign out after period of inactivity
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
        </CardContent>
      </Card>

      {/* Danger Zone Section */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone onDeleteAccount={handleDeleteAccount} />
        </CardContent>
      </Card>
    </div>
  );
}
