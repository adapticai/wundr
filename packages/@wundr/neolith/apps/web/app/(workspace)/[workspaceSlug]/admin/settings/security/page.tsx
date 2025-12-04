'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useWorkspaceSettings } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

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
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Security & Compliance',
      'Configure workspace security policies and compliance settings'
    );
  }, [setPageHeader]);

  const { settings, isLoading, updateSettings, error } =
    useWorkspaceSettings(workspaceSlug);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = useCallback(
    async (updates: Partial<SecuritySettings>) => {
      setIsSaving(true);
      setSuccessMessage(null);

      try {
        await updateSettings(updates);
        setSuccessMessage('Security settings saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch {
        // Error is handled by the hook
      } finally {
        setIsSaving(false);
      }
    },
    [updateSettings]
  );

  return (
    <div className='space-y-6'>
      {/* Success/Error Messages */}
      {successMessage && (
        <div className='flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-50 px-4 py-3 text-green-800 dark:bg-green-900/10 dark:text-green-200'>
          <CheckIcon className='h-4 w-4' />
          {successMessage}
        </div>
      )}

      {error && (
        <div className='flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-50 px-4 py-3 text-red-800 dark:bg-red-900/10 dark:text-red-200'>
          <AlertIcon className='h-4 w-4' />
          {error.message}
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
        <ShieldCheckIcon className='h-5 w-5 text-primary' />
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
          <ToggleSwitch
            checked={twoFactorRequired}
            onChange={setTwoFactorRequired}
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
            <ToggleSwitch checked={ssoEnabled} onChange={setSsoEnabled} />
          </div>

          {ssoEnabled && (
            <div className='ml-6 mt-4'>
              <label
                htmlFor='ssoProvider'
                className='block text-sm font-medium text-foreground mb-2'
              >
                SSO Provider
              </label>
              <select
                id='ssoProvider'
                value={ssoProvider ?? ''}
                onChange={e => {
                  const value = e.target.value;
                  if (value === '') {
                    setSsoProvider(null);
                  } else if (isSsoProvider(value)) {
                    setSsoProvider(value);
                  }
                }}
                className={cn(
                  'block w-full rounded-md border border-input bg-background',
                  'px-3 py-2 text-sm',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                )}
              >
                <option value=''>Select Provider</option>
                <option value='okta'>Okta</option>
                <option value='azure'>Azure AD</option>
                <option value='google'>Google Workspace</option>
              </select>
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
          <div className='space-y-2'>
            {['email', 'google', 'github', 'microsoft'].map(method => (
              <label
                key={method}
                className='flex items-center gap-3 cursor-pointer'
              >
                <input
                  type='checkbox'
                  checked={allowedAuthMethods.includes(method)}
                  onChange={() => toggleAuthMethod(method)}
                  className='h-4 w-4 rounded border-input text-primary focus:ring-primary'
                />
                <span className='text-sm text-foreground capitalize'>
                  {method}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <button
          type='submit'
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Authentication Settings'}
        </button>
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
        <ClockIcon className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Session Policies
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Session Timeout */}
        <div>
          <label
            htmlFor='sessionTimeout'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Session Timeout Duration
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Automatically log out inactive users after this period
          </p>
          <select
            id='sessionTimeout'
            value={sessionTimeout}
            onChange={e => setSessionTimeout(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
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
          <ToggleSwitch
            checked={requireReauthForSensitive}
            onChange={setRequireReauthForSensitive}
          />
        </div>

        {/* Max Concurrent Sessions */}
        <div className='border-t pt-6'>
          <label
            htmlFor='maxSessions'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Maximum Concurrent Sessions
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Limit the number of active sessions per user
          </p>
          <select
            id='maxSessions'
            value={maxConcurrentSessions}
            onChange={e => setMaxConcurrentSessions(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={1}>1 session (most secure)</option>
            <option value={3}>3 sessions</option>
            <option value={5}>5 sessions</option>
            <option value={10}>10 sessions</option>
            <option value={-1}>Unlimited</option>
          </select>
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <button
          type='submit'
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Session Settings'}
        </button>
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
        <MailIcon className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Domain & Email Restrictions
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Allowed Domains */}
        <div>
          <label
            htmlFor='allowedDomains'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Allowed Email Domains
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Only allow sign-ups from these domains (comma-separated). Leave
            empty to allow all.
          </p>
          <input
            type='text'
            id='allowedDomains'
            value={allowedEmailDomains}
            onChange={e => setAllowedEmailDomains(e.target.value)}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
            placeholder='example.com, company.org'
          />
        </div>

        {/* Blocked Domains */}
        <div className='border-t pt-6'>
          <label
            htmlFor='blockedDomains'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Blocked Email Domains
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Block sign-ups from these domains (comma-separated)
          </p>
          <input
            type='text'
            id='blockedDomains'
            value={blockedEmailDomains}
            onChange={e => setBlockedEmailDomains(e.target.value)}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
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
          <ToggleSwitch
            checked={emailVerificationRequired}
            onChange={setEmailVerificationRequired}
          />
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <button
          type='submit'
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Domain Settings'}
        </button>
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
        <DatabaseIcon className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          Data & Privacy
        </h2>
      </div>

      <div className='space-y-6'>
        {/* Data Retention */}
        <div>
          <label
            htmlFor='dataRetention'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Data Retention Period
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            How long to retain message history and metadata
          </p>
          <select
            id='dataRetention'
            value={dataRetentionDays}
            onChange={e => setDataRetentionDays(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
            <option value={730}>2 years</option>
            <option value={1825}>5 years</option>
            <option value={3650}>10 years</option>
            <option value={-1}>Forever</option>
          </select>
        </div>

        {/* Message Edit Window */}
        <div className='border-t pt-6'>
          <label
            htmlFor='editWindow'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Message Edit Time Window (minutes)
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            How long after posting can users edit their messages
          </p>
          <select
            id='editWindow'
            value={messageEditWindow}
            onChange={e => setMessageEditWindow(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={0}>Disabled</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={-1}>Unlimited</option>
          </select>
        </div>

        {/* Message Delete Window */}
        <div className='border-t pt-6'>
          <label
            htmlFor='deleteWindow'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Message Delete Time Window (minutes)
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            How long after posting can users delete their messages
          </p>
          <select
            id='deleteWindow'
            value={messageDeleteWindow}
            onChange={e => setMessageDeleteWindow(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={0}>Disabled</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={1440}>24 hours</option>
            <option value={-1}>Unlimited</option>
          </select>
        </div>

        {/* File Retention */}
        <div className='border-t pt-6'>
          <label
            htmlFor='fileRetention'
            className='block text-sm font-medium text-foreground mb-2'
          >
            File Retention Period
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            How long to store uploaded files
          </p>
          <select
            id='fileRetention'
            value={fileRetentionDays}
            onChange={e => setFileRetentionDays(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
            <option value={730}>2 years</option>
            <option value={-1}>Forever</option>
          </select>
        </div>

        {/* Data Export */}
        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>Enable Data Export</p>
            <p className='text-sm text-muted-foreground'>
              Allow administrators to export workspace data for compliance
            </p>
          </div>
          <ToggleSwitch
            checked={dataExportEnabled}
            onChange={setDataExportEnabled}
          />
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <button
          type='submit'
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Privacy Settings'}
        </button>
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
        <FileTextIcon className='h-5 w-5 text-primary' />
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
          <ToggleSwitch
            checked={auditLogsEnabled}
            onChange={setAuditLogsEnabled}
          />
        </div>

        {/* Activity Log Retention */}
        <div className='border-t pt-6'>
          <label
            htmlFor='logRetention'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Activity Log Retention Period
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            How long to retain audit and activity logs
          </p>
          <select
            id='logRetention'
            value={activityLogRetentionDays}
            onChange={e => setActivityLogRetentionDays(Number(e.target.value))}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days (recommended)</option>
            <option value={365}>1 year</option>
            <option value={730}>2 years</option>
            <option value={1825}>5 years</option>
            <option value={2555}>7 years (compliance standard)</option>
          </select>
        </div>

        {/* Compliance Mode */}
        <div className='border-t pt-6'>
          <label
            htmlFor='complianceMode'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Compliance Mode
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Enable specific compliance standards and controls
          </p>
          <select
            id='complianceMode'
            value={complianceMode ?? 'none'}
            onChange={e => {
              const value = e.target.value;
              if (isComplianceMode(value)) {
                setComplianceMode(value);
              }
            }}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            <option value='none'>None</option>
            <option value='gdpr'>
              GDPR (General Data Protection Regulation)
            </option>
            <option value='hipaa'>HIPAA (Healthcare)</option>
            <option value='sox'>SOX (Sarbanes-Oxley)</option>
          </select>
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
        <button
          type='submit'
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Compliance Settings'}
        </button>
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
        <CodeIcon className='h-5 w-5 text-primary' />
        <h2 className='text-lg font-semibold text-foreground'>
          API & Integrations Security
        </h2>
      </div>

      <div className='space-y-6'>
        {/* API Rate Limiting */}
        <div>
          <label
            htmlFor='apiRateLimit'
            className='block text-sm font-medium text-foreground mb-2'
          >
            API Rate Limit (requests per minute)
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Maximum number of API requests allowed per minute per user
          </p>
          <input
            type='number'
            id='apiRateLimit'
            value={apiRateLimit}
            onChange={e => setApiRateLimit(Number(e.target.value))}
            min={100}
            max={10000}
            step={100}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
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
          <div className='space-y-2'>
            {['read', 'write', 'admin', 'delete'].map(scope => (
              <label
                key={scope}
                className='flex items-center gap-3 cursor-pointer'
              >
                <input
                  type='checkbox'
                  checked={allowedOAuthScopes.includes(scope)}
                  onChange={() => toggleOAuthScope(scope)}
                  className='h-4 w-4 rounded border-input text-primary focus:ring-primary'
                />
                <span className='text-sm text-foreground capitalize'>
                  {scope}
                </span>
              </label>
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
          <ToggleSwitch
            checked={webhookSignatureRequired}
            onChange={setWebhookSignatureRequired}
          />
        </div>
      </div>

      <div className='mt-6 flex justify-end'>
        <button
          type='submit'
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSaving ? 'Saving...' : 'Save API Settings'}
        </button>
      </div>
    </form>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
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

// Icons
function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
      <path d='m9 12 2 2 4-4' />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <rect width='20' height='16' x='2' y='4' rx='2' />
      <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <ellipse cx='12' cy='5' rx='9' ry='3' />
      <path d='M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' />
      <path d='M3 12c0 1.66 4 3 9 3s9-1.34 9-3' />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' />
      <path d='M14 2v4a2 2 0 0 0 2 2h4' />
      <path d='M10 9H8' />
      <path d='M16 13H8' />
      <path d='M16 17H8' />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='16 18 22 12 16 6' />
      <polyline points='8 6 2 12 8 18' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='12' />
      <line x1='12' x2='12.01' y1='16' y2='16' />
    </svg>
  );
}
