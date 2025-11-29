'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Shield } from 'lucide-react';

interface EmailPreferences {
  marketingEmails: boolean;
  notificationEmails: boolean;
  digestEmails: 'none' | 'daily' | 'weekly';
  securityEmails: boolean;
}

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    marketingEmails: true,
    notificationEmails: true,
    digestEmails: 'daily',
    securityEmails: true,
  });

  useEffect(() => {
    fetchEmailPreferences();
  }, []);

  const fetchEmailPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/users/me/email-preferences');

      if (!response.ok) {
        throw new Error('Failed to fetch email preferences');
      }

      const result = await response.json();
      setPreferences(result.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load email preferences',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof Omit<EmailPreferences, 'digestEmails'>) => {
    // Security emails cannot be disabled
    if (key === 'securityEmails') {
      toast({
        title: 'Cannot disable security emails',
        description: 'Security emails are required for account safety and cannot be turned off.',
        variant: 'destructive',
      });
      return;
    }

    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDigestChange = (value: 'none' | 'daily' | 'weekly') => {
    setPreferences((prev) => ({
      ...prev,
      digestEmails: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update email preferences');
      }

      toast({
        title: 'Success',
        description: 'Email preferences updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update email preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Preferences</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your email notification preferences and control what emails you receive from Neolith.
        </p>
      </div>

      {/* Marketing Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Marketing Emails</CardTitle>
          </div>
          <CardDescription>
            Receive emails about product updates, new features, tips, and best practices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing-emails">Product updates and tips</Label>
              <p className="text-sm text-muted-foreground">
                Stay informed about new features, improvements, and helpful tips
              </p>
            </div>
            <Switch
              id="marketing-emails"
              checked={preferences.marketingEmails}
              onCheckedChange={() => handleToggle('marketingEmails')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Notification Emails</CardTitle>
          </div>
          <CardDescription>
            Receive emails when you are mentioned or receive messages in channels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notification-emails">Mentions and messages</Label>
              <p className="text-sm text-muted-foreground">
                Get notified via email when someone mentions you or sends you a message
              </p>
            </div>
            <Switch
              id="notification-emails"
              checked={preferences.notificationEmails}
              onCheckedChange={() => handleToggle('notificationEmails')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Digest Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Digest Emails</CardTitle>
          </div>
          <CardDescription>
            Receive periodic summaries of activity in your workspaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Digest frequency</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="digest-none" className="font-normal">
                    Never
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t send digest emails
                  </p>
                </div>
                <input
                  type="radio"
                  id="digest-none"
                  name="digest"
                  value="none"
                  checked={preferences.digestEmails === 'none'}
                  onChange={() => handleDigestChange('none')}
                  className="h-4 w-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="digest-daily" className="font-normal">
                    Daily
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a daily summary of activity
                  </p>
                </div>
                <input
                  type="radio"
                  id="digest-daily"
                  name="digest"
                  value="daily"
                  checked={preferences.digestEmails === 'daily'}
                  onChange={() => handleDigestChange('daily')}
                  className="h-4 w-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="digest-weekly" className="font-normal">
                    Weekly
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of activity
                  </p>
                </div>
                <input
                  type="radio"
                  id="digest-weekly"
                  name="digest"
                  value="weekly"
                  checked={preferences.digestEmails === 'weekly'}
                  onChange={() => handleDigestChange('weekly')}
                  className="h-4 w-4 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Security Emails</CardTitle>
          </div>
          <CardDescription>
            Important security notifications about your account. These emails cannot be disabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="security-emails">Security alerts</Label>
              <p className="text-sm text-muted-foreground">
                Password changes, new logins, and other security-related notifications
              </p>
            </div>
            <Switch
              id="security-emails"
              checked={preferences.securityEmails}
              disabled
              className="opacity-50 cursor-not-allowed"
            />
          </div>
          <div className="mt-4 rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              Security emails are always enabled to protect your account and keep you informed of important security events.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
