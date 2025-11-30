'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ChannelSettings {
  // Channel Creation Permissions
  whoCanCreatePublic: 'everyone' | 'admins' | 'members';
  whoCanCreatePrivate: 'everyone' | 'admins' | 'members';

  // Naming Conventions
  enforceNamingConvention: boolean;
  namingPattern?: string;
  requiredPrefix?: string;
  allowedCharacters: 'alphanumeric' | 'alphanumeric-dash' | 'any';

  // Posting Permissions
  defaultPostingPermission: 'everyone' | 'admins-only' | 'approved-members';
  allowThreads: boolean;
  allowReactions: boolean;

  // Archival Settings
  autoArchiveInactiveDays: number;
  whoCanArchive: 'everyone' | 'channel-creator' | 'admins';
  archiveRequiresConfirmation: boolean;

  // Channel Limits
  maxChannelNameLength: number;
  maxChannelsPerWorkspace?: number;
  maxPrivateChannelsPerUser?: number;
}

export default function ChannelSettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [settings, setSettings] = useState<ChannelSettings>({
    whoCanCreatePublic: 'everyone',
    whoCanCreatePrivate: 'members',
    enforceNamingConvention: false,
    namingPattern: '',
    requiredPrefix: '',
    allowedCharacters: 'alphanumeric-dash',
    defaultPostingPermission: 'everyone',
    allowThreads: true,
    allowReactions: true,
    autoArchiveInactiveDays: 90,
    whoCanArchive: 'admins',
    archiveRequiresConfirmation: true,
    maxChannelNameLength: 80,
    maxChannelsPerWorkspace: undefined,
    maxPrivateChannelsPerUser: undefined,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceSlug}/admin/settings/channels`);
        if (!response.ok) throw new Error('Failed to load settings');
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [workspaceSlug, toast]);

  const handleSave = useCallback(
    async (updates: Partial<ChannelSettings>) => {
      const currentValues = { ...settings };
      setSettings((prev) => ({ ...prev, ...updates }));
      setIsSaving(true);

      try {
        const response = await fetch(`/api/workspaces/${workspaceSlug}/admin/settings/channels`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        toast({
          title: 'Success',
          description: 'Channel settings updated successfully',
        });
      } catch (error) {
        setSettings(currentValues);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update settings',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [settings, workspaceSlug, toast]
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Channel Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure workspace-wide channel policies and permissions
        </p>
      </div>

      <CreationPermissionsSection settings={settings} onSave={handleSave} isSaving={isSaving} />
      <NamingConventionsSection settings={settings} onSave={handleSave} isSaving={isSaving} />
      <PostingPermissionsSection settings={settings} onSave={handleSave} isSaving={isSaving} />
      <ArchivalSettingsSection settings={settings} onSave={handleSave} isSaving={isSaving} />
      <ChannelLimitsSection settings={settings} onSave={handleSave} isSaving={isSaving} />
    </div>
  );
}

interface SectionProps {
  settings: ChannelSettings;
  onSave: (updates: Partial<ChannelSettings>) => Promise<void>;
  isSaving: boolean;
}

function CreationPermissionsSection({ settings, onSave, isSaving }: SectionProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <PlusCircleIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Channel Creation Permissions</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Control who can create public and private channels
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <label htmlFor="createPublic" className="block text-sm font-medium text-foreground mb-2">
            Who can create public channels
          </label>
          <select
            id="createPublic"
            value={settings.whoCanCreatePublic}
            onChange={(e) => onSave({ whoCanCreatePublic: e.target.value as any })}
            disabled={isSaving}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <option value="everyone">Everyone (all workspace members)</option>
            <option value="members">Members (excluding guests)</option>
            <option value="admins">Admins only</option>
          </select>
        </div>

        <div className="border-t pt-6">
          <label htmlFor="createPrivate" className="block text-sm font-medium text-foreground mb-2">
            Who can create private channels
          </label>
          <select
            id="createPrivate"
            value={settings.whoCanCreatePrivate}
            onChange={(e) => onSave({ whoCanCreatePrivate: e.target.value as any })}
            disabled={isSaving}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <option value="everyone">Everyone (all workspace members)</option>
            <option value="members">Members (excluding guests)</option>
            <option value="admins">Admins only</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function NamingConventionsSection({ settings, onSave, isSaving }: SectionProps) {
  const [localPrefix, setLocalPrefix] = useState(settings.requiredPrefix || '');
  const [localPattern, setLocalPattern] = useState(settings.namingPattern || '');

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <TagIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Naming Conventions</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Set rules for channel naming consistency
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-medium text-foreground">Enforce naming convention</p>
            <p className="text-sm text-muted-foreground">
              Require channels to follow naming rules
            </p>
          </div>
          <ToggleSwitch
            checked={settings.enforceNamingConvention}
            onChange={(checked) => onSave({ enforceNamingConvention: checked })}
            disabled={isSaving}
          />
        </div>

        {settings.enforceNamingConvention && (
          <>
            <div className="border-t pt-6">
              <label htmlFor="prefix" className="block text-sm font-medium text-foreground mb-2">
                Required prefix
              </label>
              <p className="text-sm text-muted-foreground mb-3">
                All channels must start with this prefix (e.g., "team-", "proj-")
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="prefix"
                  value={localPrefix}
                  onChange={(e) => setLocalPrefix(e.target.value)}
                  placeholder="team-"
                  className={cn(
                    'flex-1 rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm placeholder:text-muted-foreground',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  )}
                />
                <button
                  type="button"
                  onClick={() => onSave({ requiredPrefix: localPrefix })}
                  disabled={isSaving}
                  className={cn(
                    'rounded-md border border-input bg-background px-4 py-2 text-sm font-medium',
                    'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <label htmlFor="pattern" className="block text-sm font-medium text-foreground mb-2">
                Naming pattern (regex)
              </label>
              <p className="text-sm text-muted-foreground mb-3">
                Advanced: Define a regex pattern for channel names
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="pattern"
                  value={localPattern}
                  onChange={(e) => setLocalPattern(e.target.value)}
                  placeholder="^[a-z][a-z0-9-]*$"
                  className={cn(
                    'flex-1 rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm font-mono placeholder:text-muted-foreground',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                  )}
                />
                <button
                  type="button"
                  onClick={() => onSave({ namingPattern: localPattern })}
                  disabled={isSaving}
                  className={cn(
                    'rounded-md border border-input bg-background px-4 py-2 text-sm font-medium',
                    'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <label htmlFor="allowedChars" className="block text-sm font-medium text-foreground mb-2">
                Allowed characters
              </label>
              <select
                id="allowedChars"
                value={settings.allowedCharacters}
                onChange={(e) => onSave({ allowedCharacters: e.target.value as any })}
                disabled={isSaving}
                className={cn(
                  'block w-full rounded-md border border-input bg-background',
                  'px-3 py-2 text-sm',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <option value="alphanumeric">Alphanumeric only (a-z, 0-9)</option>
                <option value="alphanumeric-dash">Alphanumeric + dash (a-z, 0-9, -)</option>
                <option value="any">Any characters</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PostingPermissionsSection({ settings, onSave, isSaving }: SectionProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Default Posting Permissions</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Set default permissions for new channels
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <label htmlFor="postingPerm" className="block text-sm font-medium text-foreground mb-2">
            Default posting permission
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            Who can post messages in new channels by default
          </p>
          <select
            id="postingPerm"
            value={settings.defaultPostingPermission}
            onChange={(e) => onSave({ defaultPostingPermission: e.target.value as any })}
            disabled={isSaving}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <option value="everyone">Everyone (all channel members)</option>
            <option value="approved-members">Approved members only</option>
            <option value="admins-only">Admins only (announcement channels)</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-t pt-6">
          <div className="flex-1">
            <p className="font-medium text-foreground">Allow threaded replies</p>
            <p className="text-sm text-muted-foreground">
              Enable thread conversations in channels
            </p>
          </div>
          <ToggleSwitch
            checked={settings.allowThreads}
            onChange={(checked) => onSave({ allowThreads: checked })}
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-6">
          <div className="flex-1">
            <p className="font-medium text-foreground">Allow message reactions</p>
            <p className="text-sm text-muted-foreground">
              Enable emoji reactions on messages
            </p>
          </div>
          <ToggleSwitch
            checked={settings.allowReactions}
            onChange={(checked) => onSave({ allowReactions: checked })}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

function ArchivalSettingsSection({ settings, onSave, isSaving }: SectionProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <ArchiveIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Channel Archival</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure automatic and manual channel archival
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <label htmlFor="autoArchive" className="block text-sm font-medium text-foreground mb-2">
            Auto-archive inactive channels after
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            Channels with no activity will be automatically archived
          </p>
          <select
            id="autoArchive"
            value={settings.autoArchiveInactiveDays}
            onChange={(e) => onSave({ autoArchiveInactiveDays: Number(e.target.value) })}
            disabled={isSaving}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <option value={0}>Never (disabled)</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>

        <div className="border-t pt-6">
          <label htmlFor="whoArchive" className="block text-sm font-medium text-foreground mb-2">
            Who can manually archive channels
          </label>
          <select
            id="whoArchive"
            value={settings.whoCanArchive}
            onChange={(e) => onSave({ whoCanArchive: e.target.value as any })}
            disabled={isSaving}
            className={cn(
              'block w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <option value="everyone">Everyone (all channel members)</option>
            <option value="channel-creator">Channel creator only</option>
            <option value="admins">Admins only</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-t pt-6">
          <div className="flex-1">
            <p className="font-medium text-foreground">Require confirmation before archiving</p>
            <p className="text-sm text-muted-foreground">
              Show confirmation dialog when archiving channels
            </p>
          </div>
          <ToggleSwitch
            checked={settings.archiveRequiresConfirmation}
            onChange={(checked) => onSave({ archiveRequiresConfirmation: checked })}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

function ChannelLimitsSection({ settings, onSave, isSaving }: SectionProps) {
  const [maxNameLength, setMaxNameLength] = useState(settings.maxChannelNameLength);

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Channel Limits</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Set constraints on channel creation and naming
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <label htmlFor="maxNameLength" className="block text-sm font-medium text-foreground mb-2">
            Maximum channel name length
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            Limit the number of characters in channel names
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              id="maxNameLength"
              min={20}
              max={100}
              step={5}
              value={maxNameLength}
              onChange={(e) => setMaxNameLength(Number(e.target.value))}
              onMouseUp={() => onSave({ maxChannelNameLength: maxNameLength })}
              onTouchEnd={() => onSave({ maxChannelNameLength: maxNameLength })}
              disabled={isSaving}
              className="flex-1"
            />
            <span className="text-sm font-medium text-foreground w-16 text-right">
              {maxNameLength} chars
            </span>
          </div>
        </div>

        <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/10 border-t">
          <div className="flex items-start gap-2">
            <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Additional channel limits can be configured based on your workspace plan. Contact support to adjust workspace-wide or per-user channel limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        disabled && 'cursor-not-allowed opacity-50'
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-muted mb-4" />
          <div className="space-y-4">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Icons
function PlusCircleIcon({ className }: { className?: string }) {
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
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
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
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

function MessageSquareIcon({ className }: { className?: string }) {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
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
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

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

function InfoIcon({ className }: { className?: string }) {
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
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
