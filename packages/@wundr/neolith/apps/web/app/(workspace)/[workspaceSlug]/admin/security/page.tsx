'use client';

import {
  Shield,
  Lock,
  Key,
  AlertTriangle,
  Globe,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays: number;
  preventReuse: number;
}

interface IPRestrictions {
  allowlist: string[];
  blocklist: string[];
  enabled: boolean;
}

interface LoginAttempts {
  maxAttempts: number;
  lockoutDuration: number;
  resetAfter: number;
  notifyOnLockout: boolean;
}

interface SecurityAlerts {
  newDeviceLogin: boolean;
  failedLoginAttempts: boolean;
  roleChanges: boolean;
  apiKeyCreated: boolean;
  apiKeyRevoked: boolean;
  securitySettingsChanged: boolean;
  unusualActivity: boolean;
  dataExport: boolean;
  alertEmail?: string;
  alertSlackWebhook?: string;
}

interface ApiKey {
  id: string;
  apiKey: string;
  hostname: string | null;
  version: string | null;
  capabilities: string[];
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export default function AdminSecurityPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Password Policy State
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>({
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    expiryDays: 90,
    preventReuse: 5,
  });

  // 2FA State
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  // Session Timeout State
  const [sessionTimeout, setSessionTimeout] = useState(30);

  // IP Restrictions State
  const [ipRestrictions, setIpRestrictions] = useState<IPRestrictions>({
    allowlist: [],
    blocklist: [],
    enabled: false,
  });
  const [allowlistInput, setAllowlistInput] = useState('');
  const [blocklistInput, setBlocklistInput] = useState('');

  // Login Attempts State
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempts>({
    maxAttempts: 5,
    lockoutDuration: 30,
    resetAfter: 60,
    notifyOnLockout: true,
  });

  // OAuth/SSO State
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoProvider, setSsoProvider] = useState<string>('');
  const [ssoConfig, setSsoConfig] = useState({
    clientId: '',
    clientSecret: '',
    domain: '',
  });

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKeyValue, setNewApiKeyValue] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Security Alerts State
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlerts>({
    newDeviceLogin: true,
    failedLoginAttempts: true,
    roleChanges: true,
    apiKeyCreated: true,
    apiKeyRevoked: true,
    securitySettingsChanged: true,
    unusualActivity: false,
    dataExport: true,
  });

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Security Settings',
      'Configure comprehensive security policies and controls'
    );
  }, [setPageHeader]);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);

        // Load password policy
        const passwordPolicyRes = await fetch(
          `/api/workspaces/${workspaceSlug}/security/password-policy`
        );
        if (passwordPolicyRes.ok) {
          const data = await passwordPolicyRes.json();
          setPasswordPolicy(data.passwordPolicy);
        }

        // Load workspace settings for 2FA and SSO
        const settingsRes = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings`
        );
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setTwoFactorRequired(data.settings?.twoFactorRequired || false);
          setSessionTimeout(data.settings?.sessionTimeout || 30);
          setSsoEnabled(data.settings?.ssoEnabled || false);
          setSsoProvider(data.settings?.ssoProvider || '');
        }

        // Load IP restrictions
        const ipRes = await fetch(
          `/api/workspaces/${workspaceSlug}/security/ip-allowlist`
        );
        if (ipRes.ok) {
          const data = await ipRes.json();
          setIpRestrictions(data.ipRestrictions);
          setAllowlistInput(data.ipRestrictions.allowlist.join('\n'));
          setBlocklistInput(data.ipRestrictions.blocklist.join('\n'));
        }

        // Load login attempts
        const loginRes = await fetch(
          `/api/workspaces/${workspaceSlug}/security/login-attempts`
        );
        if (loginRes.ok) {
          const data = await loginRes.json();
          setLoginAttempts(data.loginAttempts);
        }

        // Load API keys
        const apiKeysRes = await fetch(
          `/api/workspaces/${workspaceSlug}/security/api-keys`
        );
        if (apiKeysRes.ok) {
          const data = await apiKeysRes.json();
          setApiKeys(data.apiKeys);
        }

        // Load security alerts
        const alertsRes = await fetch(
          `/api/workspaces/${workspaceSlug}/security/alerts`
        );
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          setSecurityAlerts(data.securityAlerts);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load security settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [workspaceSlug, toast]);

  const savePasswordPolicy = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/security/password-policy`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(passwordPolicy),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: 'Password policy updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update password policy',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, passwordPolicy, toast]);

  const save2FASettings = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twoFactorRequired }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: '2FA settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update 2FA settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, twoFactorRequired, toast]);

  const saveSessionTimeout = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionTimeout }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: 'Session timeout updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update session timeout',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, sessionTimeout, toast]);

  const saveIPRestrictions = useCallback(async () => {
    try {
      setIsSaving(true);
      const allowlist = allowlistInput
        .split('\n')
        .map(ip => ip.trim())
        .filter(Boolean);
      const blocklist = blocklistInput
        .split('\n')
        .map(ip => ip.trim())
        .filter(Boolean);

      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/security/ip-allowlist`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowlist,
            blocklist,
            enabled: ipRestrictions.enabled,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      setIpRestrictions({
        allowlist,
        blocklist,
        enabled: ipRestrictions.enabled,
      });
      toast({
        title: 'Success',
        description: 'IP restrictions updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update IP restrictions',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    workspaceSlug,
    allowlistInput,
    blocklistInput,
    ipRestrictions.enabled,
    toast,
  ]);

  const saveLoginAttempts = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/security/login-attempts`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginAttempts),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: 'Login attempt limits updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update login attempt limits',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, loginAttempts, toast]);

  const saveSSOSettings = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ssoEnabled,
            ssoProvider,
            ssoConfig,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: 'SSO settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update SSO settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, ssoEnabled, ssoProvider, ssoConfig, toast]);

  const createApiKey = useCallback(async () => {
    if (!newApiKeyName) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/security/api-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newApiKeyName,
            expiresInDays: 365,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to create');
      }

      const data = await res.json();
      setNewApiKeyValue(data.apiKey);
      setNewApiKeyName('');

      // Reload API keys
      const apiKeysRes = await fetch(
        `/api/workspaces/${workspaceSlug}/security/api-keys`
      );
      if (apiKeysRes.ok) {
        const keysData = await apiKeysRes.json();
        setApiKeys(keysData.apiKeys);
      }

      toast({
        title: 'Success',
        description: 'API key created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, newApiKeyName, toast]);

  const deleteApiKey = useCallback(
    async (keyId: string) => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceSlug}/security/api-keys/${keyId}`,
          {
            method: 'DELETE',
          }
        );

        if (!res.ok) {
          throw new Error('Failed to delete');
        }

        setApiKeys(prev => prev.filter(k => k.id !== keyId));
        toast({
          title: 'Success',
          description: 'API key revoked successfully',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to revoke API key',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast]
  );

  const copyToClipboard = useCallback(
    (text: string, keyId: string) => {
      navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard',
      });
    },
    [toast]
  );

  const saveSecurityAlerts = useCallback(async () => {
    try {
      setIsSaving(true);
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/security/alerts`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(securityAlerts),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: 'Security alerts updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update security alerts',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, securityAlerts, toast]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <Tabs defaultValue='authentication' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='authentication'>Authentication</TabsTrigger>
          <TabsTrigger value='access-control'>Access Control</TabsTrigger>
          <TabsTrigger value='api-keys'>API Keys</TabsTrigger>
          <TabsTrigger value='alerts'>Security Alerts</TabsTrigger>
        </TabsList>

        {/* Authentication Tab */}
        <TabsContent value='authentication' className='space-y-6'>
          {/* Password Policy */}
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Lock className='h-5 w-5 text-primary' />
                <CardTitle>Password Policy</CardTitle>
              </div>
              <CardDescription>
                Configure password requirements for all workspace members
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div>
                  <Label htmlFor='minLength'>Minimum Length</Label>
                  <Select
                    value={passwordPolicy.minLength.toString()}
                    onValueChange={value =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        minLength: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id='minLength' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='8'>8 characters</SelectItem>
                      <SelectItem value='12'>
                        12 characters (recommended)
                      </SelectItem>
                      <SelectItem value='16'>16 characters</SelectItem>
                      <SelectItem value='20'>20 characters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex items-center justify-between'>
                  <Label htmlFor='requireUppercase'>
                    Require uppercase letters
                  </Label>
                  <Switch
                    id='requireUppercase'
                    checked={passwordPolicy.requireUppercase}
                    onCheckedChange={checked =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        requireUppercase: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label htmlFor='requireLowercase'>
                    Require lowercase letters
                  </Label>
                  <Switch
                    id='requireLowercase'
                    checked={passwordPolicy.requireLowercase}
                    onCheckedChange={checked =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        requireLowercase: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label htmlFor='requireNumbers'>Require numbers</Label>
                  <Switch
                    id='requireNumbers'
                    checked={passwordPolicy.requireNumbers}
                    onCheckedChange={checked =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        requireNumbers: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label htmlFor='requireSpecialChars'>
                    Require special characters
                  </Label>
                  <Switch
                    id='requireSpecialChars'
                    checked={passwordPolicy.requireSpecialChars}
                    onCheckedChange={checked =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        requireSpecialChars: checked,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor='expiryDays'>Password Expiry (days)</Label>
                  <Select
                    value={passwordPolicy.expiryDays.toString()}
                    onValueChange={value =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        expiryDays: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id='expiryDays' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='0'>Never</SelectItem>
                      <SelectItem value='30'>30 days</SelectItem>
                      <SelectItem value='60'>60 days</SelectItem>
                      <SelectItem value='90'>90 days (recommended)</SelectItem>
                      <SelectItem value='180'>180 days</SelectItem>
                      <SelectItem value='365'>1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor='preventReuse'>Prevent password reuse</Label>
                  <Select
                    value={passwordPolicy.preventReuse.toString()}
                    onValueChange={value =>
                      setPasswordPolicy({
                        ...passwordPolicy,
                        preventReuse: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id='preventReuse' className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='0'>Disabled</SelectItem>
                      <SelectItem value='3'>Last 3 passwords</SelectItem>
                      <SelectItem value='5'>
                        Last 5 passwords (recommended)
                      </SelectItem>
                      <SelectItem value='10'>Last 10 passwords</SelectItem>
                      <SelectItem value='24'>Last 24 passwords</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='flex justify-end'>
                <Button onClick={savePasswordPolicy} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Password Policy'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2FA Settings */}
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Shield className='h-5 w-5 text-primary' />
                <CardTitle>Two-Factor Authentication</CardTitle>
              </div>
              <CardDescription>
                Require all workspace members to enable 2FA
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label>Require 2FA for all members</Label>
                  <p className='text-sm text-muted-foreground'>
                    Members must enable 2FA to access the workspace
                  </p>
                </div>
                <Switch
                  checked={twoFactorRequired}
                  onCheckedChange={setTwoFactorRequired}
                />
              </div>

              <div className='flex justify-end'>
                <Button onClick={save2FASettings} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save 2FA Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Session Timeout */}
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Clock className='h-5 w-5 text-primary' />
                <CardTitle>Session Timeout</CardTitle>
              </div>
              <CardDescription>
                Configure automatic session expiration
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div>
                <Label htmlFor='sessionTimeout'>Session Timeout (days)</Label>
                <Select
                  value={sessionTimeout.toString()}
                  onValueChange={value => setSessionTimeout(parseInt(value))}
                >
                  <SelectTrigger id='sessionTimeout' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='1'>1 day</SelectItem>
                    <SelectItem value='7'>7 days</SelectItem>
                    <SelectItem value='14'>14 days</SelectItem>
                    <SelectItem value='30'>30 days (default)</SelectItem>
                    <SelectItem value='60'>60 days</SelectItem>
                    <SelectItem value='90'>90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='flex justify-end'>
                <Button onClick={saveSessionTimeout} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Session Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* OAuth/SSO Configuration */}
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Key className='h-5 w-5 text-primary' />
                <CardTitle>OAuth/SSO Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure single sign-on for enterprise authentication
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label>Enable SSO</Label>
                  <p className='text-sm text-muted-foreground'>
                    Require SSO authentication for all members
                  </p>
                </div>
                <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
              </div>

              {ssoEnabled && (
                <div className='space-y-4'>
                  <div>
                    <Label htmlFor='ssoProvider'>SSO Provider</Label>
                    <Select value={ssoProvider} onValueChange={setSsoProvider}>
                      <SelectTrigger id='ssoProvider' className='w-full'>
                        <SelectValue placeholder='Select provider' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='okta'>Okta</SelectItem>
                        <SelectItem value='azure'>Azure AD</SelectItem>
                        <SelectItem value='google'>Google Workspace</SelectItem>
                        <SelectItem value='saml'>Generic SAML 2.0</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor='clientId'>Client ID</Label>
                    <Input
                      id='clientId'
                      value={ssoConfig.clientId}
                      onChange={e =>
                        setSsoConfig({ ...ssoConfig, clientId: e.target.value })
                      }
                      placeholder='Enter client ID'
                    />
                  </div>

                  <div>
                    <Label htmlFor='clientSecret'>Client Secret</Label>
                    <Input
                      id='clientSecret'
                      type='password'
                      value={ssoConfig.clientSecret}
                      onChange={e =>
                        setSsoConfig({
                          ...ssoConfig,
                          clientSecret: e.target.value,
                        })
                      }
                      placeholder='Enter client secret'
                    />
                  </div>

                  <div>
                    <Label htmlFor='domain'>Domain</Label>
                    <Input
                      id='domain'
                      value={ssoConfig.domain}
                      onChange={e =>
                        setSsoConfig({ ...ssoConfig, domain: e.target.value })
                      }
                      placeholder='example.okta.com'
                    />
                  </div>
                </div>
              )}

              <div className='flex justify-end'>
                <Button onClick={saveSSOSettings} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save SSO Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Control Tab */}
        <TabsContent value='access-control' className='space-y-6'>
          {/* IP Allowlist/Blocklist */}
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Globe className='h-5 w-5 text-primary' />
                <CardTitle>IP Allowlist & Blocklist</CardTitle>
              </div>
              <CardDescription>
                Restrict access based on IP addresses
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label>Enable IP restrictions</Label>
                  <p className='text-sm text-muted-foreground'>
                    Enforce IP-based access controls
                  </p>
                </div>
                <Switch
                  checked={ipRestrictions.enabled}
                  onCheckedChange={checked =>
                    setIpRestrictions({ ...ipRestrictions, enabled: checked })
                  }
                />
              </div>

              {ipRestrictions.enabled && (
                <div className='space-y-4'>
                  <div>
                    <Label htmlFor='allowlist'>IP Allowlist</Label>
                    <p className='text-sm text-muted-foreground mb-2'>
                      Enter one IP address per line (e.g., 192.168.1.1 or
                      10.0.0.0/24)
                    </p>
                    <Textarea
                      id='allowlist'
                      value={allowlistInput}
                      onChange={e => setAllowlistInput(e.target.value)}
                      placeholder='192.168.1.1&#10;10.0.0.0/24'
                      rows={5}
                    />
                  </div>

                  <div>
                    <Label htmlFor='blocklist'>IP Blocklist</Label>
                    <p className='text-sm text-muted-foreground mb-2'>
                      Enter one IP address per line to block
                    </p>
                    <Textarea
                      id='blocklist'
                      value={blocklistInput}
                      onChange={e => setBlocklistInput(e.target.value)}
                      placeholder='203.0.113.0/24&#10;198.51.100.50'
                      rows={5}
                    />
                  </div>
                </div>
              )}

              <div className='flex justify-end'>
                <Button onClick={saveIPRestrictions} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save IP Restrictions'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Login Attempt Limits */}
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <AlertTriangle className='h-5 w-5 text-primary' />
                <CardTitle>Login Attempt Limits</CardTitle>
              </div>
              <CardDescription>
                Configure account lockout policies
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div>
                <Label htmlFor='maxAttempts'>Maximum Failed Attempts</Label>
                <Select
                  value={loginAttempts.maxAttempts.toString()}
                  onValueChange={value =>
                    setLoginAttempts({
                      ...loginAttempts,
                      maxAttempts: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id='maxAttempts' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='3'>3 attempts</SelectItem>
                    <SelectItem value='5'>5 attempts (recommended)</SelectItem>
                    <SelectItem value='10'>10 attempts</SelectItem>
                    <SelectItem value='20'>20 attempts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor='lockoutDuration'>
                  Lockout Duration (minutes)
                </Label>
                <Select
                  value={loginAttempts.lockoutDuration.toString()}
                  onValueChange={value =>
                    setLoginAttempts({
                      ...loginAttempts,
                      lockoutDuration: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id='lockoutDuration' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='15'>15 minutes</SelectItem>
                    <SelectItem value='30'>30 minutes (recommended)</SelectItem>
                    <SelectItem value='60'>1 hour</SelectItem>
                    <SelectItem value='120'>2 hours</SelectItem>
                    <SelectItem value='1440'>24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor='resetAfter'>
                  Reset Counter After (minutes)
                </Label>
                <Select
                  value={loginAttempts.resetAfter.toString()}
                  onValueChange={value =>
                    setLoginAttempts({
                      ...loginAttempts,
                      resetAfter: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id='resetAfter' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='30'>30 minutes</SelectItem>
                    <SelectItem value='60'>1 hour (recommended)</SelectItem>
                    <SelectItem value='120'>2 hours</SelectItem>
                    <SelectItem value='1440'>24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label>Notify on lockout</Label>
                  <p className='text-sm text-muted-foreground'>
                    Send email notification when account is locked
                  </p>
                </div>
                <Switch
                  checked={loginAttempts.notifyOnLockout}
                  onCheckedChange={checked =>
                    setLoginAttempts({
                      ...loginAttempts,
                      notifyOnLockout: checked,
                    })
                  }
                />
              </div>

              <div className='flex justify-end'>
                <Button onClick={saveLoginAttempts} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Login Limits'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value='api-keys' className='space-y-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Key className='h-5 w-5 text-primary' />
                <CardTitle>Workspace API Keys</CardTitle>
              </div>
              <CardDescription>
                Manage API keys for programmatic access to the workspace
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Create New API Key */}
              <div className='space-y-4 rounded-lg border p-4'>
                <h3 className='font-medium'>Create New API Key</h3>
                <div className='flex gap-4'>
                  <Input
                    placeholder='API key name (e.g., Production Bot)'
                    value={newApiKeyName}
                    onChange={e => setNewApiKeyName(e.target.value)}
                    className='flex-1'
                  />
                  <Button
                    onClick={createApiKey}
                    disabled={isSaving || !newApiKeyName}
                  >
                    Create Key
                  </Button>
                </div>

                {newApiKeyValue && (
                  <div className='rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/10'>
                    <p className='font-medium text-yellow-800 dark:text-yellow-200 mb-2'>
                      Save this API key securely - it will not be shown again!
                    </p>
                    <div className='flex items-center gap-2'>
                      <code className='flex-1 rounded bg-yellow-100 px-3 py-2 text-sm dark:bg-yellow-900/20'>
                        {newApiKeyValue}
                      </code>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => copyToClipboard(newApiKeyValue, 'new')}
                      >
                        {copiedKeyId === 'new' ? (
                          <Check className='h-4 w-4' />
                        ) : (
                          <Copy className='h-4 w-4' />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing API Keys */}
              <div className='space-y-3'>
                <h3 className='font-medium'>
                  Workspace API Keys{' '}
                  {apiKeys.length > 0 && (
                    <span className='ml-1 text-sm font-normal text-muted-foreground'>
                      ({apiKeys.filter(k => k.isActive).length} active)
                    </span>
                  )}
                </h3>
                {apiKeys.length === 0 ? (
                  <p className='py-4 text-center text-sm text-muted-foreground'>
                    No API keys created yet. Create one above to get started.
                  </p>
                ) : (
                  <div className='space-y-2'>
                    {apiKeys.map(key => (
                      <div
                        key={key.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-4',
                          !key.isActive && 'opacity-50'
                        )}
                      >
                        <div className='flex-1'>
                          <div className='flex items-center gap-2'>
                            <code className='text-sm font-mono'>
                              {key.apiKey}...
                            </code>
                            {!key.isActive && (
                              <span className='rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-200'>
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className='text-sm text-muted-foreground mt-1'>
                            Created:{' '}
                            {new Date(key.createdAt).toLocaleDateString()}
                            {key.lastUsedAt &&
                              ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                            {key.expiresAt &&
                              ` • Expires: ${new Date(key.expiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => deleteApiKey(key.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Alerts Tab */}
        <TabsContent value='alerts' className='space-y-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <AlertTriangle className='h-5 w-5 text-primary' />
                <CardTitle>Security Alerts Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure when and how to receive security alerts
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <h3 className='font-medium'>Alert Triggers</h3>

                <div className='flex items-center justify-between'>
                  <Label>New device login</Label>
                  <Switch
                    checked={securityAlerts.newDeviceLogin}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        newDeviceLogin: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>Failed login attempts</Label>
                  <Switch
                    checked={securityAlerts.failedLoginAttempts}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        failedLoginAttempts: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>Role changes</Label>
                  <Switch
                    checked={securityAlerts.roleChanges}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        roleChanges: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>API key created</Label>
                  <Switch
                    checked={securityAlerts.apiKeyCreated}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        apiKeyCreated: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>API key revoked</Label>
                  <Switch
                    checked={securityAlerts.apiKeyRevoked}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        apiKeyRevoked: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>Security settings changed</Label>
                  <Switch
                    checked={securityAlerts.securitySettingsChanged}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        securitySettingsChanged: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>Unusual activity detected</Label>
                  <Switch
                    checked={securityAlerts.unusualActivity}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        unusualActivity: checked,
                      })
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <Label>Data export requested</Label>
                  <Switch
                    checked={securityAlerts.dataExport}
                    onCheckedChange={checked =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        dataExport: checked,
                      })
                    }
                  />
                </div>
              </div>

              <div className='space-y-4 border-t pt-6'>
                <h3 className='font-medium'>Alert Channels</h3>

                <div>
                  <Label htmlFor='alertEmail'>Alert Email Address</Label>
                  <Input
                    id='alertEmail'
                    type='email'
                    placeholder='security@example.com'
                    value={securityAlerts.alertEmail || ''}
                    onChange={e =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        alertEmail: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor='alertSlackWebhook'>
                    Slack Webhook URL (optional)
                  </Label>
                  <Input
                    id='alertSlackWebhook'
                    placeholder='https://hooks.slack.com/services/...'
                    value={securityAlerts.alertSlackWebhook || ''}
                    onChange={e =>
                      setSecurityAlerts({
                        ...securityAlerts,
                        alertSlackWebhook: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className='flex justify-end'>
                <Button onClick={saveSecurityAlerts} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Alert Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
