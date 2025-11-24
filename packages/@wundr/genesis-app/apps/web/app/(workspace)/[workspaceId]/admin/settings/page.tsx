'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback } from 'react';

import { useWorkspaceSettings } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';


type SettingsTab = 'general' | 'security' | 'notifications' | 'advanced';

/**
 * Admin Settings Page
 *
 * Full settings page with tabs for each settings section
 */
export default function AdminSettingsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { settings, isLoading, updateSettings, error } = useWorkspaceSettings(workspaceId);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = useCallback(
    async (updates: Partial<WorkspaceSettings>) => {
      setIsSaving(true);
      setSuccessMessage(null);

      try {
        await updateSettings(updates);
        setSuccessMessage('Settings saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch {
        // Error is handled by the hook
      } finally {
        setIsSaving(false);
      }
    },
    [updateSettings],
  );

  const tabs: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'security', label: 'Security', icon: ShieldIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'advanced', label: 'Advanced', icon: WrenchIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Workspace Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your workspace preferences and security settings
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-50 px-4 py-3 text-green-800 dark:bg-green-900/10 dark:text-green-200">
          <CheckIcon className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-50 px-4 py-3 text-red-800 dark:bg-red-900/10 dark:text-red-200">
          <AlertIcon className="h-4 w-4" />
          {error.message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <SettingsSkeleton />
        ) : (
          <>
            {activeTab === 'general' && (
              <GeneralSettings
                settings={settings}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {activeTab === 'security' && (
              <SecuritySettings
                settings={settings}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationSettings
                settings={settings}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {activeTab === 'advanced' && (
              <AdvancedSettings
                settings={settings}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Settings Types - Extended from hook's WorkspaceSettings to include local fields
interface WorkspaceSettings {
  // From hook
  name: string;
  slug: string;
  description?: string;
  visibility: 'public' | 'private';
  allowGuestAccess: boolean;
  defaultRole?: string;
  messageRetention?: number;
  fileRetention?: number;
  twoFactorRequired: boolean;
  ssoEnabled: boolean;
  notificationDefaults: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  // Local extensions for UI
  icon?: string;
  defaultChannelId?: string;
  requireTwoFactor?: boolean;
  sessionTimeout?: number;
  allowedDomains?: string[];
  notifyOnNewMember?: boolean;
  notifyOnSecurityEvent?: boolean;
  weeklyDigest?: boolean;
  dataRetentionDays?: number;
  exportEnabled?: boolean;
  apiRateLimit?: number;
}

interface SettingsSectionProps {
  settings: Partial<WorkspaceSettings> | null;
  onSave: (updates: Partial<WorkspaceSettings>) => Promise<void>;
  isSaving: boolean;
}

// General Settings Section
function GeneralSettings({ settings, onSave, isSaving }: SettingsSectionProps) {
  const [name, setName] = useState(settings?.name ?? '');
  const [description, setDescription] = useState(settings?.description ?? '');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({ name, description });
    },
    [name, description, onSave],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Workspace Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
            placeholder="My Workspace"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
            placeholder="Describe your workspace..."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// Security Settings Section
function SecuritySettings({ settings, onSave, isSaving }: SettingsSectionProps) {
  const [requireTwoFactor, setRequireTwoFactor] = useState(settings?.requireTwoFactor ?? false);
  const [sessionTimeout, setSessionTimeout] = useState(settings?.sessionTimeout ?? 30);
  const [allowedDomains, setAllowedDomains] = useState(
    settings?.allowedDomains?.join(', ') ?? '',
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({
        requireTwoFactor,
        sessionTimeout,
        allowedDomains: allowedDomains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      });
    },
    [requireTwoFactor, sessionTimeout, allowedDomains, onSave],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Require Two-Factor Authentication</p>
            <p className="text-sm text-muted-foreground">
              All members must enable 2FA to access this workspace
            </p>
          </div>
          <ToggleSwitch
            checked={requireTwoFactor}
            onChange={setRequireTwoFactor}
          />
        </div>

        <div className="border-t pt-4">
          <label htmlFor="sessionTimeout" className="block text-sm font-medium text-foreground">
            Session Timeout (days)
          </label>
          <select
            id="sessionTimeout"
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(Number(e.target.value))}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <label htmlFor="allowedDomains" className="block text-sm font-medium text-foreground">
            Allowed Email Domains
          </label>
          <p className="text-sm text-muted-foreground">
            Restrict sign-ups to specific email domains (comma-separated)
          </p>
          <input
            type="text"
            id="allowedDomains"
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
            placeholder="example.com, company.org"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// Notification Settings Section
function NotificationSettings({ settings, onSave, isSaving }: SettingsSectionProps) {
  const [notifyOnNewMember, setNotifyOnNewMember] = useState(
    settings?.notifyOnNewMember ?? true,
  );
  const [notifyOnSecurityEvent, setNotifyOnSecurityEvent] = useState(
    settings?.notifyOnSecurityEvent ?? true,
  );
  const [weeklyDigest, setWeeklyDigest] = useState(settings?.weeklyDigest ?? false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({ notifyOnNewMember, notifyOnSecurityEvent, weeklyDigest });
    },
    [notifyOnNewMember, notifyOnSecurityEvent, weeklyDigest, onSave],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">New Member Notifications</p>
            <p className="text-sm text-muted-foreground">
              Notify admins when new members join the workspace
            </p>
          </div>
          <ToggleSwitch checked={notifyOnNewMember} onChange={setNotifyOnNewMember} />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="font-medium text-foreground">Security Event Alerts</p>
            <p className="text-sm text-muted-foreground">
              Notify admins of security-related events
            </p>
          </div>
          <ToggleSwitch checked={notifyOnSecurityEvent} onChange={setNotifyOnSecurityEvent} />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="font-medium text-foreground">Weekly Digest</p>
            <p className="text-sm text-muted-foreground">
              Receive a weekly summary of workspace activity
            </p>
          </div>
          <ToggleSwitch checked={weeklyDigest} onChange={setWeeklyDigest} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// Advanced Settings Section
function AdvancedSettings({ settings, onSave, isSaving }: SettingsSectionProps) {
  const [dataRetentionDays, setDataRetentionDays] = useState(
    settings?.dataRetentionDays ?? 365,
  );
  const [exportEnabled, setExportEnabled] = useState(settings?.exportEnabled ?? true);
  const [apiRateLimit, setApiRateLimit] = useState(settings?.apiRateLimit ?? 1000);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave({ dataRetentionDays, exportEnabled, apiRateLimit });
    },
    [dataRetentionDays, exportEnabled, apiRateLimit, onSave],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="dataRetention"
            className="block text-sm font-medium text-foreground"
          >
            Data Retention Period (days)
          </label>
          <p className="text-sm text-muted-foreground">
            How long to retain message history and files
          </p>
          <input
            type="number"
            id="dataRetention"
            value={dataRetentionDays}
            onChange={(e) => setDataRetentionDays(Number(e.target.value))}
            min={30}
            max={3650}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="font-medium text-foreground">Enable Data Export</p>
            <p className="text-sm text-muted-foreground">
              Allow admins to export workspace data
            </p>
          </div>
          <ToggleSwitch checked={exportEnabled} onChange={setExportEnabled} />
        </div>

        <div className="border-t pt-4">
          <label
            htmlFor="apiRateLimit"
            className="block text-sm font-medium text-foreground"
          >
            API Rate Limit (requests/minute)
          </label>
          <input
            type="number"
            id="apiRateLimit"
            value={apiRateLimit}
            onChange={(e) => setApiRateLimit(Number(e.target.value))}
            min={100}
            max={10000}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
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
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

// Settings Skeleton
function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// Icons
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
