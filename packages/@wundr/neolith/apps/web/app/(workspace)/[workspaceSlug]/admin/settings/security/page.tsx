'use client';

import {
  ShieldCheck,
  Clock,
  Mail,
  Database,
  FileText,
  Code,
  AlertCircle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
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
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

/**
 * Security & Compliance Admin Settings Page
 *
 * Comprehensive security controls for workspace-wide policies including:
 * - Authentication requirements
 * - Session policies
 * - Domain & email restrictions
 * - Data & privacy settings
 * - Audit & compliance
 * - API & integrations security
 */
export default function SecurityCompliancePage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Security & Compliance',
      'Configure workspace security policies and compliance settings'
    );
  }, [setPageHeader]);

  const [settings, setSettings] = useState<Partial<SecuritySettings> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/security`
        );
        if (!response.ok) {
          throw new Error('Failed to load security settings');
        }
        const data = await response.json();
        setSettings(data.settings ?? data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load settings';
        setLoadError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [workspaceSlug]);

  const handleSave = useCallback(
    async (updates: Partial<SecuritySettings>) => {
      setIsSaving(true);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/security`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: 'Failed to save settings' }));
          throw new Error(error.message || 'Failed to save settings');
        }

        const data = await response.json();
        setSettings(prev => ({ ...prev, ...(data.settings ?? updates) }));

        toast({
          title: 'Settings saved',
          description: 'Security settings updated successfully',
        });
      } catch (err) {
        toast({
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to save settings',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [workspaceSlug, toast]
  );

  return (
    <div className='space-y-6'>
      {loadError && (
        <div className='flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive'>
          <AlertCircle className='h-4 w-4 flex-shrink-0' />
          <p className='text-sm'>{loadError}</p>
        </div>
      )}

      {/* Content */}
      <div className='space-y-6'>
        {isLoading ? (
          <SettingsSkeleton />
        ) : (
          <>
            <AuthenticationSection
              settings={settings}
              onSave={handleSave}
              isSaving={isSaving}
            />
            <SessionPoliciesSection
              settings={settings}
              onSave={handleSave}
              isSaving={isSaving}
            />
            <DomainEmailSection
              settings={settings}
              onSave={handleSave}
              isSaving={isSaving}
            />
            <DataPrivacySection
              settings={settings}
              onSave={handleSave}
              isSaving={isSaving}
            />
            <AuditComplianceSection
              settings={settings}
              onSave={handleSave}
              isSaving={isSaving}
            />
            <ApiIntegrationsSection
              settings={settings}
              onSave={handleSave}
              isSaving={isSaving}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Type definitions for security settings
type SsoProvider = 'okta' | 'azure' | 'google';
type ComplianceMode = 'none' | 'gdpr' | 'hipaa' | 'sox';

// Type guards
function isSsoProvider(value: string): value is SsoProvider {
  return ['okta', 'azure', 'google'].includes(value);
}

function isComplianceMode(value: string): value is ComplianceMode {
  return ['none', 'gdpr', 'hipaa', 'sox'].includes(value);
}

// Settings Types
interface SecuritySettings {
  // Authentication
  twoFactorRequired: boolean;
  ssoEnabled: boolean;
  ssoProvider?: SsoProvider | null;
  allowedAuthMethods: string[];

  // Session Policies
  sessionTimeout: number;
  requireReauthForSensitive: boolean;
  maxConcurrentSessions: number;

  // Domain & Email
  allowedEmailDomains: string[];
  blockedEmailDomains: string[];
  emailVerificationRequired: boolean;

  // Data & Privacy
  dataRetentionDays: number;
  messageEditWindow: number;
  messageDeleteWindow: number;
  fileRetentionDays: number;
  dataExportEnabled: boolean;

  // Audit & Compliance
  activityLogRetentionDays: number;
  auditLogsEnabled: boolean;
  complianceMode: ComplianceMode | null;

  // API & Integrations
  apiRateLimit: number;
  allowedOAuthScopes: string[];
  webhookSignatureRequired: boolean;
}

interface SettingsSectionProps {
  settings: Partial<SecuritySettings> | null;
  onSave: (updates: Partial<SecuritySettings>) => Promise<void>;
  isSaving: boolean;
}

// Authentication Requirements Section
function AuthenticationSection({
  settings,
  onSave,
  isSaving,
}: SettingsSectionProps) {
  const [twoFactorRequired, setTwoFactorRequired] = useState(
    settings?.twoFactorRequired ?? false
  );
  const [ssoEnabled, setSsoEnabled] = useState(settings?.ssoEnabled ?? false);
  const [ssoProvider, setSsoProvider] = useState(settings?.ssoProvider ?? null);
  const [allowedAuthMethods, setAllowedAuthMethods] = useState(
    settings?.allowedAuthMethods ?? ['email', 'google', 'github']
  );

  useEffect(() => {
    if (settings?.twoFactorRequired !== undefined) {
      setTwoFactorRequired(settings.twoFactorRequired);
    }
    if (settings?.ssoEnabled !== undefined) {
      setSsoEnabled(settings.ssoEnabled);
    }
    if (settings?.ssoProvider !== undefined) {
      setSsoProvider(settings.ssoProvider ?? null);
    }
    if (settings?.allowedAuthMethods !== undefined) {
      setAllowedAuthMethods(settings.allowedAuthMethods);
    }
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        twoFactorRequired,
        ssoEnabled,
        ssoProvider,
        allowedAuthMethods,
      });
    },
    [twoFactorRequired, ssoEnabled, ssoProvider, allowedAuthMethods, onSave]
  );

  const toggleAuthMethod = (method: string) => {
    setAllowedAuthMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  return (
    <form onSubmit={handleSubmit} className='rounded-lg border bg-card p-6'>
      <div className='mb-6 flex items-center gap-2'>
        <ShieldCheck className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Authentication Requirements
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Two-Factor Authentication */}
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Require Two-Factor Authentication
            </p>
            <p className='text-sm text-muted-foreground'>
              All workspace members must enable 2FA to access resources
            </p>
          </div>
          <Switch
            checked={twoFactorRequired}
            onCheckedChange={setTwoFactorRequired}
          />
        </div>

        {/* SSO */}
        <div className='border-t pt-6'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex-1'>
              <p className='font-medium text-foreground'>
                Enable Single Sign-On (SSO)
              </p>
              <p className='text-sm text-muted-foreground'>
                Require enterprise SSO for authentication
              </p>
            </div>
            <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
          </div>

          {ssoEnabled && (
            <div className='ml-6 mt-4 space-y-2'>
              <Label htmlFor='ssoProvider'>SSO Provider</Label>
              <Select
                value={ssoProvider ?? ''}
                onValueChange={value => {
                  if (value === '') {
                    setSsoProvider(null);
                  } else if (isSsoProvider(value)) {
                    setSsoProvider(value);
                  }
                }}
              >
                <SelectTrigger id='ssoProvider'>
                  <SelectValue placeholder='Select provider' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='okta'>Okta</SelectItem>
                  <SelectItem value='azure'>Azure AD</SelectItem>
                  <SelectItem value='google'>Google Workspace</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Allowed Authentication Methods */}
        <div className='border-t pt-6'>
          <p className='font-medium text-foreground mb-2'>
            Allowed Authentication Methods
          </p>
          <p className='text-sm text-muted-foreground mb-4'>
            Select which authentication methods members can use
          </p>
          <div className='space-y-3'>
            {['email', 'google', 'github', 'microsoft'].map(method => (
              <div key={method} className='flex items-center justify-between'>
                <Label
                  htmlFor={`auth-method-${method}`}
                  className='capitalize font-normal cursor-pointer'
                >
                  {method === 'email'
                    ? 'Email & Password'
                    : method === 'microsoft'
                      ? 'Microsoft'
                      : method.charAt(0).toUpperCase() + method.slice(1)}
                </Label>
                <Switch
                  id={`auth-method-${method}`}
                  checked={allowedAuthMethods.includes(method)}
                  onCheckedChange={() => toggleAuthMethod(method)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <Button type='submit' disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Authentication Settings'}
        </Button>
      </div>
    </form>
  );
}

// Session Policies Section
function SessionPoliciesSection({
  settings,
  onSave,
  isSaving,
}: SettingsSectionProps) {
  const [sessionTimeout, setSessionTimeout] = useState(
    settings?.sessionTimeout ?? 30
  );
  const [requireReauthForSensitive, setRequireReauthForSensitive] = useState(
    settings?.requireReauthForSensitive ?? true
  );
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(
    settings?.maxConcurrentSessions ?? 5
  );

  useEffect(() => {
    if (settings?.sessionTimeout !== undefined) {
      setSessionTimeout(settings.sessionTimeout);
    }
    if (settings?.requireReauthForSensitive !== undefined) {
      setRequireReauthForSensitive(settings.requireReauthForSensitive);
    }
    if (settings?.maxConcurrentSessions !== undefined) {
      setMaxConcurrentSessions(settings.maxConcurrentSessions);
    }
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        sessionTimeout,
        requireReauthForSensitive,
        maxConcurrentSessions,
      });
    },
    [sessionTimeout, requireReauthForSensitive, maxConcurrentSessions, onSave]
  );

  return (
    <form onSubmit={handleSubmit} className='rounded-lg border bg-card p-6'>
      <div className='mb-6 flex items-center gap-2'>
        <Clock className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Session Policies
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Session Timeout */}
        <div className='space-y-2'>
          <Label htmlFor='sessionTimeout'>Session Timeout Duration</Label>
          <p className='text-sm text-muted-foreground'>
            Automatically log out inactive users after this period
          </p>
          <Select
            value={sessionTimeout.toString()}
            onValueChange={value => setSessionTimeout(Number(value))}
          >
            <SelectTrigger id='sessionTimeout'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='7'>7 days</SelectItem>
              <SelectItem value='14'>14 days</SelectItem>
              <SelectItem value='30'>30 days</SelectItem>
              <SelectItem value='60'>60 days</SelectItem>
              <SelectItem value='90'>90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Re-authentication */}
        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Force Re-authentication for Sensitive Actions
            </p>
            <p className='text-sm text-muted-foreground'>
              Require password confirmation for security-critical operations
            </p>
          </div>
          <Switch
            checked={requireReauthForSensitive}
            onCheckedChange={setRequireReauthForSensitive}
          />
        </div>

        {/* Max Concurrent Sessions */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='maxSessions'>Maximum Concurrent Sessions</Label>
          <p className='text-sm text-muted-foreground'>
            Limit the number of active sessions per user
          </p>
          <Select
            value={maxConcurrentSessions.toString()}
            onValueChange={value => setMaxConcurrentSessions(Number(value))}
          >
            <SelectTrigger id='maxSessions'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1'>1 session (most secure)</SelectItem>
              <SelectItem value='3'>3 sessions</SelectItem>
              <SelectItem value='5'>5 sessions</SelectItem>
              <SelectItem value='10'>10 sessions</SelectItem>
              <SelectItem value='-1'>Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <Button type='submit' disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Session Settings'}
        </Button>
      </div>
    </form>
  );
}

// Domain & Email Section
function DomainEmailSection({
  settings,
  onSave,
  isSaving,
}: SettingsSectionProps) {
  const [allowedEmailDomains, setAllowedEmailDomains] = useState(
    settings?.allowedEmailDomains?.join(', ') ?? ''
  );
  const [blockedEmailDomains, setBlockedEmailDomains] = useState(
    settings?.blockedEmailDomains?.join(', ') ?? ''
  );
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(
    settings?.emailVerificationRequired ?? true
  );

  useEffect(() => {
    if (settings?.allowedEmailDomains !== undefined) {
      setAllowedEmailDomains(settings.allowedEmailDomains.join(', '));
    }
    if (settings?.blockedEmailDomains !== undefined) {
      setBlockedEmailDomains(settings.blockedEmailDomains.join(', '));
    }
    if (settings?.emailVerificationRequired !== undefined) {
      setEmailVerificationRequired(settings.emailVerificationRequired);
    }
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        allowedEmailDomains: allowedEmailDomains
          .split(',')
          .map(d => d.trim())
          .filter(Boolean),
        blockedEmailDomains: blockedEmailDomains
          .split(',')
          .map(d => d.trim())
          .filter(Boolean),
        emailVerificationRequired,
      });
    },
    [
      allowedEmailDomains,
      blockedEmailDomains,
      emailVerificationRequired,
      onSave,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className='rounded-lg border bg-card p-6'>
      <div className='mb-6 flex items-center gap-2'>
        <Mail className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Domain & Email Restrictions
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Allowed Domains */}
        <div className='space-y-2'>
          <Label htmlFor='allowedDomains'>Allowed Email Domains</Label>
          <p className='text-sm text-muted-foreground'>
            Only allow sign-ups from these domains (comma-separated). Leave
            empty to allow all.
          </p>
          <Input
            id='allowedDomains'
            value={allowedEmailDomains}
            onChange={e => setAllowedEmailDomains(e.target.value)}
            placeholder='example.com, company.org'
          />
        </div>

        {/* Blocked Domains */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='blockedDomains'>Blocked Email Domains</Label>
          <p className='text-sm text-muted-foreground'>
            Block sign-ups from these domains (comma-separated)
          </p>
          <Input
            id='blockedDomains'
            value={blockedEmailDomains}
            onChange={e => setBlockedEmailDomains(e.target.value)}
            placeholder='competitor.com, spam-domain.net'
          />
        </div>

        {/* Email Verification */}
        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Require Email Verification
            </p>
            <p className='text-sm text-muted-foreground'>
              Users must verify their email address before accessing the
              workspace
            </p>
          </div>
          <Switch
            checked={emailVerificationRequired}
            onCheckedChange={setEmailVerificationRequired}
          />
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <Button type='submit' disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Domain Settings'}
        </Button>
      </div>
    </form>
  );
}

// Data & Privacy Section
function DataPrivacySection({
  settings,
  onSave,
  isSaving,
}: SettingsSectionProps) {
  const [dataRetentionDays, setDataRetentionDays] = useState(
    settings?.dataRetentionDays ?? 365
  );
  const [messageEditWindow, setMessageEditWindow] = useState(
    settings?.messageEditWindow ?? 15
  );
  const [messageDeleteWindow, setMessageDeleteWindow] = useState(
    settings?.messageDeleteWindow ?? 60
  );
  const [fileRetentionDays, setFileRetentionDays] = useState(
    settings?.fileRetentionDays ?? 365
  );
  const [dataExportEnabled, setDataExportEnabled] = useState(
    settings?.dataExportEnabled ?? true
  );

  useEffect(() => {
    if (settings?.dataRetentionDays !== undefined) {
      setDataRetentionDays(settings.dataRetentionDays);
    }
    if (settings?.messageEditWindow !== undefined) {
      setMessageEditWindow(settings.messageEditWindow);
    }
    if (settings?.messageDeleteWindow !== undefined) {
      setMessageDeleteWindow(settings.messageDeleteWindow);
    }
    if (settings?.fileRetentionDays !== undefined) {
      setFileRetentionDays(settings.fileRetentionDays);
    }
    if (settings?.dataExportEnabled !== undefined) {
      setDataExportEnabled(settings.dataExportEnabled);
    }
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        dataRetentionDays,
        messageEditWindow,
        messageDeleteWindow,
        fileRetentionDays,
        dataExportEnabled,
      });
    },
    [
      dataRetentionDays,
      messageEditWindow,
      messageDeleteWindow,
      fileRetentionDays,
      dataExportEnabled,
      onSave,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className='rounded-lg border bg-card p-6'>
      <div className='mb-6 flex items-center gap-2'>
        <Database className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Data & Privacy
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Data Retention */}
        <div className='space-y-2'>
          <Label htmlFor='dataRetention'>Data Retention Period</Label>
          <p className='text-sm text-muted-foreground'>
            How long to retain message history and metadata
          </p>
          <Select
            value={dataRetentionDays.toString()}
            onValueChange={value => setDataRetentionDays(Number(value))}
          >
            <SelectTrigger id='dataRetention'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='30'>30 days</SelectItem>
              <SelectItem value='90'>90 days</SelectItem>
              <SelectItem value='180'>180 days</SelectItem>
              <SelectItem value='365'>1 year</SelectItem>
              <SelectItem value='730'>2 years</SelectItem>
              <SelectItem value='1825'>5 years</SelectItem>
              <SelectItem value='3650'>10 years</SelectItem>
              <SelectItem value='-1'>Forever</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Message Edit Window */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='editWindow'>Message Edit Time Window</Label>
          <p className='text-sm text-muted-foreground'>
            How long after posting members can edit their messages
          </p>
          <Select
            value={messageEditWindow.toString()}
            onValueChange={value => setMessageEditWindow(Number(value))}
          >
            <SelectTrigger id='editWindow'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='0'>Disabled</SelectItem>
              <SelectItem value='5'>5 minutes</SelectItem>
              <SelectItem value='15'>15 minutes</SelectItem>
              <SelectItem value='30'>30 minutes</SelectItem>
              <SelectItem value='60'>1 hour</SelectItem>
              <SelectItem value='-1'>Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Message Delete Window */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='deleteWindow'>Message Delete Time Window</Label>
          <p className='text-sm text-muted-foreground'>
            How long after posting members can delete their own messages
          </p>
          <Select
            value={messageDeleteWindow.toString()}
            onValueChange={value => setMessageDeleteWindow(Number(value))}
          >
            <SelectTrigger id='deleteWindow'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='0'>Disabled</SelectItem>
              <SelectItem value='15'>15 minutes</SelectItem>
              <SelectItem value='30'>30 minutes</SelectItem>
              <SelectItem value='60'>1 hour</SelectItem>
              <SelectItem value='1440'>24 hours</SelectItem>
              <SelectItem value='-1'>Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* File Retention */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='fileRetention'>File Retention Period</Label>
          <p className='text-sm text-muted-foreground'>
            How long to store uploaded files before automatic deletion
          </p>
          <Select
            value={fileRetentionDays.toString()}
            onValueChange={value => setFileRetentionDays(Number(value))}
          >
            <SelectTrigger id='fileRetention'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='30'>30 days</SelectItem>
              <SelectItem value='90'>90 days</SelectItem>
              <SelectItem value='180'>180 days</SelectItem>
              <SelectItem value='365'>1 year</SelectItem>
              <SelectItem value='730'>2 years</SelectItem>
              <SelectItem value='-1'>Forever</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data Export */}
        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>Enable Data Export</p>
            <p className='text-sm text-muted-foreground'>
              Allow administrators to export workspace data for compliance
            </p>
          </div>
          <Switch
            checked={dataExportEnabled}
            onCheckedChange={setDataExportEnabled}
          />
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <Button type='submit' disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Privacy Settings'}
        </Button>
      </div>
    </form>
  );
}

// Audit & Compliance Section
function AuditComplianceSection({
  settings,
  onSave,
  isSaving,
}: SettingsSectionProps) {
  const [activityLogRetentionDays, setActivityLogRetentionDays] = useState(
    settings?.activityLogRetentionDays ?? 90
  );
  const [auditLogsEnabled, setAuditLogsEnabled] = useState(
    settings?.auditLogsEnabled ?? true
  );
  const [complianceMode, setComplianceMode] = useState<ComplianceMode>(
    settings?.complianceMode ?? 'none'
  );

  useEffect(() => {
    if (settings?.activityLogRetentionDays !== undefined) {
      setActivityLogRetentionDays(settings.activityLogRetentionDays);
    }
    if (settings?.auditLogsEnabled !== undefined) {
      setAuditLogsEnabled(settings.auditLogsEnabled);
    }
    if (settings?.complianceMode !== undefined) {
      setComplianceMode(settings.complianceMode ?? 'none');
    }
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        activityLogRetentionDays,
        auditLogsEnabled,
        complianceMode: complianceMode === 'none' ? null : complianceMode,
      });
    },
    [activityLogRetentionDays, auditLogsEnabled, complianceMode, onSave]
  );

  return (
    <form onSubmit={handleSubmit} className='rounded-lg border bg-card p-6'>
      <div className='mb-6 flex items-center gap-2'>
        <FileText className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Audit & Compliance
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Audit Logs */}
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>Enable Audit Logs</p>
            <p className='text-sm text-muted-foreground'>
              Track security-relevant actions and administrative changes
            </p>
          </div>
          <Switch
            checked={auditLogsEnabled}
            onCheckedChange={setAuditLogsEnabled}
          />
        </div>

        {/* Activity Log Retention */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='logRetention'>Activity Log Retention Period</Label>
          <p className='text-sm text-muted-foreground'>
            How long to retain audit and activity logs
          </p>
          <Select
            value={activityLogRetentionDays.toString()}
            onValueChange={value => setActivityLogRetentionDays(Number(value))}
          >
            <SelectTrigger id='logRetention'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='30'>30 days</SelectItem>
              <SelectItem value='90'>90 days</SelectItem>
              <SelectItem value='180'>180 days (recommended)</SelectItem>
              <SelectItem value='365'>1 year</SelectItem>
              <SelectItem value='730'>2 years</SelectItem>
              <SelectItem value='1825'>5 years</SelectItem>
              <SelectItem value='2555'>
                7 years (compliance standard)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compliance Mode */}
        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='complianceMode'>Compliance Mode</Label>
          <p className='text-sm text-muted-foreground'>
            Enable specific compliance standards and controls
          </p>
          <Select
            value={complianceMode ?? 'none'}
            onValueChange={value => {
              if (isComplianceMode(value)) {
                setComplianceMode(value);
              }
            }}
          >
            <SelectTrigger id='complianceMode'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>None</SelectItem>
              <SelectItem value='gdpr'>
                GDPR (General Data Protection Regulation)
              </SelectItem>
              <SelectItem value='hipaa'>HIPAA (Healthcare)</SelectItem>
              <SelectItem value='sox'>SOX (Sarbanes-Oxley)</SelectItem>
            </SelectContent>
          </Select>
          {complianceMode !== 'none' && (
            <div className='mt-3 rounded-md bg-blue-50 p-3 dark:bg-blue-900/10'>
              <p className='text-sm text-blue-800 dark:text-blue-200'>
                {complianceMode === 'gdpr' &&
                  'GDPR mode enables data subject rights, consent tracking, and breach notification workflows.'}
                {complianceMode === 'hipaa' &&
                  'HIPAA mode enables PHI controls, access logging, and business associate agreements.'}
                {complianceMode === 'sox' &&
                  'SOX mode enables financial record retention, change tracking, and audit trails.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <Button type='submit' disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Compliance Settings'}
        </Button>
      </div>
    </form>
  );
}

// API & Integrations Security Section
function ApiIntegrationsSection({
  settings,
  onSave,
  isSaving,
}: SettingsSectionProps) {
  const [apiRateLimit, setApiRateLimit] = useState(
    settings?.apiRateLimit ?? 1000
  );
  const [allowedOAuthScopes, setAllowedOAuthScopes] = useState(
    settings?.allowedOAuthScopes ?? ['read', 'write']
  );
  const [webhookSignatureRequired, setWebhookSignatureRequired] = useState(
    settings?.webhookSignatureRequired ?? true
  );

  useEffect(() => {
    if (settings?.apiRateLimit !== undefined) {
      setApiRateLimit(settings.apiRateLimit);
    }
    if (settings?.allowedOAuthScopes !== undefined) {
      setAllowedOAuthScopes(settings.allowedOAuthScopes);
    }
    if (settings?.webhookSignatureRequired !== undefined) {
      setWebhookSignatureRequired(settings.webhookSignatureRequired);
    }
  }, [settings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        apiRateLimit,
        allowedOAuthScopes,
        webhookSignatureRequired,
      });
    },
    [apiRateLimit, allowedOAuthScopes, webhookSignatureRequired, onSave]
  );

  const toggleOAuthScope = (scope: string) => {
    setAllowedOAuthScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  return (
    <form onSubmit={handleSubmit} className='rounded-lg border bg-card p-6'>
      <div className='mb-6 flex items-center gap-2'>
        <Code className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          API & Integrations Security
        </h2>
      </div>

      <div className='space-y-6'>
        {/* API Rate Limiting */}
        <div className='space-y-2'>
          <Label htmlFor='apiRateLimit'>
            API Rate Limit (requests per minute)
          </Label>
          <p className='text-sm text-muted-foreground'>
            Maximum number of API requests allowed per minute per user
          </p>
          <Input
            type='number'
            id='apiRateLimit'
            value={apiRateLimit}
            onChange={e => setApiRateLimit(Number(e.target.value))}
            min={100}
            max={10000}
            step={100}
          />
        </div>

        {/* OAuth Scopes */}
        <div className='border-t pt-6'>
          <p className='font-medium text-foreground mb-2'>
            Allowed OAuth Scopes
          </p>
          <p className='text-sm text-muted-foreground mb-4'>
            Control what permissions third-party applications can request
          </p>
          <div className='space-y-3'>
            {['read', 'write', 'admin', 'delete'].map(scope => (
              <div key={scope} className='flex items-center justify-between'>
                <Label
                  htmlFor={`oauth-scope-${scope}`}
                  className='capitalize font-normal cursor-pointer'
                >
                  {scope}
                </Label>
                <Switch
                  id={`oauth-scope-${scope}`}
                  checked={allowedOAuthScopes.includes(scope)}
                  onCheckedChange={() => toggleOAuthScope(scope)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Security */}
        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Require Webhook Signatures
            </p>
            <p className='text-sm text-muted-foreground'>
              Validate webhook payloads using HMAC signatures
            </p>
          </div>
          <Switch
            checked={webhookSignatureRequired}
            onCheckedChange={setWebhookSignatureRequired}
          />
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <Button type='submit' disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save API Settings'}
        </Button>
      </div>
    </form>
  );
}

// Settings Skeleton
function SettingsSkeleton() {
  return (
    <div className='space-y-6'>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card p-6'>
          <div className='h-6 w-48 animate-pulse rounded bg-muted mb-6' />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className='space-y-2 mb-4'>
              <div className='h-4 w-32 animate-pulse rounded bg-muted' />
              <div className='h-10 w-full animate-pulse rounded bg-muted' />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
