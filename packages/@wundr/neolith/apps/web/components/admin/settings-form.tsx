'use client';

import { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';

export interface WorkspaceSettings {
  general: {
    name: string;
    description: string;
    logo?: string;
    timezone: string;
    language: string;
  };
  security: {
    mfaRequired: boolean;
    sessionTimeout: number;
    passwordMinLength: number;
    allowedDomains: string[];
  };
  messaging: {
    allowEditing: boolean;
    editWindowMinutes: number;
    allowDeletion: boolean;
    deleteWindowMinutes: number;
    fileUploadLimit: number;
  };
  notifications: {
    defaultSound: boolean;
    digestFrequency: 'immediate' | 'hourly' | 'daily' | 'none';
  };
}

/**
 * Props for the SettingsForm component.
 */
export interface SettingsFormProps {
  /** The workspace ID (used for context, prefixed with underscore as currently unused) */
  workspaceId: string;
  /** Initial settings values to populate the form */
  initialSettings?: Partial<WorkspaceSettings>;
  /** Callback when settings are saved, receives the complete settings object */
  onSave: (settings: WorkspaceSettings) => Promise<void>;
  /** Additional CSS classes to apply */
  className?: string;
}

type TabId = 'general' | 'security' | 'messaging' | 'notifications';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'notifications', label: 'Notifications' },
];

const DEFAULT_SETTINGS: WorkspaceSettings = {
  general: {
    name: '',
    description: '',
    timezone: 'UTC',
    language: 'en',
  },
  security: {
    mfaRequired: false,
    sessionTimeout: 24,
    passwordMinLength: 8,
    allowedDomains: [],
  },
  messaging: {
    allowEditing: true,
    editWindowMinutes: 15,
    allowDeletion: true,
    deleteWindowMinutes: 5,
    fileUploadLimit: 10,
  },
  notifications: {
    defaultSound: true,
    digestFrequency: 'immediate',
  },
};

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
];

export function SettingsForm({
  workspaceId: _workspaceId,
  initialSettings,
  onSave,
  className,
}: SettingsFormProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [settings, setSettings] = useState<WorkspaceSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  }));
  const [originalSettings, setOriginalSettings] = useState<WorkspaceSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  useEffect(() => {
    if (initialSettings) {
      const merged = { ...DEFAULT_SETTINGS, ...initialSettings };
      setSettings(merged);
      setOriginalSettings(merged);
    }
  }, [initialSettings]);

  const updateSettings = useCallback(
    <K extends keyof WorkspaceSettings>(
      section: K,
      updates: Partial<WorkspaceSettings[K]>,
    ) => {
      setSettings((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...updates },
      }));
      setErrors({});
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!settings.general.name.trim()) {
      newErrors['general.name'] = 'Workspace name is required';
    }

    if (settings.security.passwordMinLength < 6) {
      newErrors['security.passwordMinLength'] = 'Password must be at least 6 characters';
    }

    if (settings.messaging.editWindowMinutes < 0) {
      newErrors['messaging.editWindowMinutes'] = 'Edit window must be positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [settings]);

  const handleSave = async () => {
    if (!validate()) {
return;
}

    setIsSaving(true);
    try {
      await onSave(settings);
      setOriginalSettings(settings);
    } catch {
      // Error handling managed by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setErrors({});
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4" aria-label="Settings tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-stone-700 dark:border-stone-300 text-stone-700 dark:text-stone-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              aria-selected={activeTab === tab.id} // eslint-disable-line jsx-a11y/role-supports-aria-props
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'general' && (
          <GeneralSettings
            settings={settings.general}
            errors={errors}
            onChange={(updates) => updateSettings('general', updates)}
          />
        )}
        {activeTab === 'security' && (
          <SecurityTabSettings
            settings={settings.security}
            errors={errors}
            onChange={(updates) => updateSettings('security', updates)}
          />
        )}
        {activeTab === 'messaging' && (
          <MessagingSettings
            settings={settings.messaging}
            errors={errors}
            onChange={(updates) => updateSettings('messaging', updates)}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationSettings
            settings={settings.notifications}
            errors={errors}
            onChange={(updates) => updateSettings('notifications', updates)}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          {isDirty ? 'You have unsaved changes' : 'All changes saved'}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-muted text-muted-foreground hover:bg-muted/80',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Props for the GeneralSettings component
 */
interface GeneralSettingsProps {
  /** Current general settings values */
  settings: WorkspaceSettings['general'];
  /** Validation errors keyed by field path */
  errors: Record<string, string>;
  /** Callback when settings change */
  onChange: (updates: Partial<WorkspaceSettings['general']>) => void;
}

/**
 * General settings section component
 */
function GeneralSettings({ settings, errors, onChange }: GeneralSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Workspace Name
        </label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn(
            'w-full max-w-md px-3 py-2 rounded-lg',
            'bg-muted border text-foreground',
            errors['general.name'] ? 'border-destructive' : 'border-border',
          )}
          placeholder="My Workspace"
        />
        {errors['general.name'] && (
          <p className="mt-1 text-sm text-destructive">{errors['general.name']}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description
        </label>
        <textarea
          value={settings.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full max-w-md px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
          rows={3}
          placeholder="Describe your workspace..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Timezone
        </label>
        <select
          value={settings.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className="w-full max-w-md px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Language
        </label>
        <select
          value={settings.language}
          onChange={(e) => onChange({ language: e.target.value })}
          className="w-full max-w-md px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Props for the SecurityTabSettings component
 */
interface SecurityTabSettingsProps {
  /** Current security settings values */
  settings: WorkspaceSettings['security'];
  /** Validation errors keyed by field path */
  errors: Record<string, string>;
  /** Callback when settings change */
  onChange: (updates: Partial<WorkspaceSettings['security']>) => void;
}

/**
 * Security settings tab component
 */
function SecurityTabSettings({ settings, errors, onChange }: SecurityTabSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Require MFA
          </label>
          <p className="text-sm text-muted-foreground">
            All members must enable two-factor authentication
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ mfaRequired: !settings.mfaRequired })}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            settings.mfaRequired ? 'bg-stone-700 dark:bg-stone-300' : 'bg-muted',
          )}
          role="switch"
          aria-checked={settings.mfaRequired}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              settings.mfaRequired ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Session Timeout (hours)
        </label>
        <input
          type="number"
          value={settings.sessionTimeout}
          onChange={(e) => onChange({ sessionTimeout: parseInt(e.target.value) || 1 })}
          className="w-32 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
          min={1}
          max={168}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Minimum Password Length
        </label>
        <input
          type="number"
          value={settings.passwordMinLength}
          onChange={(e) => onChange({ passwordMinLength: parseInt(e.target.value) || 6 })}
          className={cn(
            'w-32 px-3 py-2 rounded-lg bg-muted border text-foreground',
            errors['security.passwordMinLength'] ? 'border-destructive' : 'border-border',
          )}
          min={6}
          max={32}
        />
        {errors['security.passwordMinLength'] && (
          <p className="mt-1 text-sm text-destructive">
            {errors['security.passwordMinLength']}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Props for the MessagingSettings component
 */
interface MessagingSettingsProps {
  /** Current messaging settings values */
  settings: WorkspaceSettings['messaging'];
  /** Validation errors keyed by field path */
  errors: Record<string, string>;
  /** Callback when settings change */
  onChange: (updates: Partial<WorkspaceSettings['messaging']>) => void;
}

/**
 * Messaging settings section component
 */
function MessagingSettings({ settings, errors, onChange }: MessagingSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Allow Message Editing
          </label>
          <p className="text-sm text-muted-foreground">
            Members can edit their sent messages
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ allowEditing: !settings.allowEditing })}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            settings.allowEditing ? 'bg-stone-700 dark:bg-stone-300' : 'bg-muted',
          )}
          role="switch"
          aria-checked={settings.allowEditing}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              settings.allowEditing ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      {settings.allowEditing && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Edit Window (minutes)
          </label>
          <input
            type="number"
            value={settings.editWindowMinutes}
            onChange={(e) => onChange({ editWindowMinutes: parseInt(e.target.value) || 0 })}
            className={cn(
              'w-32 px-3 py-2 rounded-lg bg-muted border text-foreground',
              errors['messaging.editWindowMinutes'] ? 'border-destructive' : 'border-border',
            )}
            min={0}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            0 = unlimited
          </p>
        </div>
      )}

      <div className="flex items-center justify-between max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Allow Message Deletion
          </label>
          <p className="text-sm text-muted-foreground">
            Members can delete their sent messages
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ allowDeletion: !settings.allowDeletion })}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            settings.allowDeletion ? 'bg-stone-700 dark:bg-stone-300' : 'bg-muted',
          )}
          role="switch"
          aria-checked={settings.allowDeletion}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              settings.allowDeletion ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          File Upload Limit (MB)
        </label>
        <input
          type="number"
          value={settings.fileUploadLimit}
          onChange={(e) => onChange({ fileUploadLimit: parseInt(e.target.value) || 1 })}
          className="w-32 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
          min={1}
          max={100}
        />
      </div>
    </div>
  );
}

/**
 * Props for the NotificationSettings component
 */
interface NotificationSettingsProps {
  /** Current notification settings values */
  settings: WorkspaceSettings['notifications'];
  /** Validation errors keyed by field path (unused but kept for consistency) */
  errors: Record<string, string>;
  /** Callback when settings change */
  onChange: (updates: Partial<WorkspaceSettings['notifications']>) => void;
}

/**
 * Notification settings section component
 */
function NotificationSettings({ settings, errors: _errors, onChange }: NotificationSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Default Sound
          </label>
          <p className="text-sm text-muted-foreground">
            Play notification sounds by default
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ defaultSound: !settings.defaultSound })}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            settings.defaultSound ? 'bg-stone-700 dark:bg-stone-300' : 'bg-muted',
          )}
          role="switch"
          aria-checked={settings.defaultSound}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              settings.defaultSound ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Email Digest Frequency
        </label>
        <select
          value={settings.digestFrequency}
          onChange={(e) =>
            onChange({
              digestFrequency: e.target.value as WorkspaceSettings['notifications']['digestFrequency'],
            })
          }
          className="w-full max-w-md px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          <option value="immediate">Immediate</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
  );
}

export default SettingsForm;
