'use client';

import {
  PlusCircle,
  Tag,
  MessageSquare,
  Archive,
  Settings,
  Info,
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

// Type definitions for channel settings
type WhoCanCreate = 'everyone' | 'admins' | 'members';
type AllowedCharacters = 'alphanumeric' | 'alphanumeric-dash' | 'any';
type PostingPermission = 'everyone' | 'admins-only' | 'approved-members';
type WhoCanArchive = 'everyone' | 'channel-creator' | 'admins';

interface ChannelSettings {
  // Channel Creation Permissions
  whoCanCreatePublic: WhoCanCreate;
  whoCanCreatePrivate: WhoCanCreate;

  // Naming Conventions
  enforceNamingConvention: boolean;
  namingPattern?: string;
  requiredPrefix?: string;
  allowedCharacters: AllowedCharacters;

  // Posting Permissions
  defaultPostingPermission: PostingPermission;
  allowThreads: boolean;
  allowReactions: boolean;

  // Archival Settings
  autoArchiveInactiveDays: number;
  whoCanArchive: WhoCanArchive;
  archiveRequiresConfirmation: boolean;

  // Channel Limits
  maxChannelNameLength: number;
  maxChannelsPerWorkspace?: number;
  maxPrivateChannelsPerUser?: number;
}

// Type guards
function isWhoCanCreate(value: string): value is WhoCanCreate {
  return ['everyone', 'admins', 'members'].includes(value);
}

function isAllowedCharacters(value: string): value is AllowedCharacters {
  return ['alphanumeric', 'alphanumeric-dash', 'any'].includes(value);
}

function isPostingPermission(value: string): value is PostingPermission {
  return ['everyone', 'admins-only', 'approved-members'].includes(value);
}

function isWhoCanArchive(value: string): value is WhoCanArchive {
  return ['everyone', 'channel-creator', 'admins'].includes(value);
}

export default function ChannelSettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Channel Settings',
      'Configure workspace-wide channel policies and permissions'
    );
  }, [setPageHeader]);

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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/channels`
        );
        if (!response.ok) {
          throw new Error('Failed to load channel settings');
        }
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load settings';
        setLoadError(message);
        toast({
          title: 'Error',
          description: message,
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
      setSettings(prev => ({ ...prev, ...updates }));
      setIsSaving(true);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/channels`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        );

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
          description:
            error instanceof Error
              ? error.message
              : 'Failed to update settings',
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

  if (loadError) {
    return (
      <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
        <p className='text-sm text-destructive'>{loadError}</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <CreationPermissionsSection
        settings={settings}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <NamingConventionsSection
        settings={settings}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <PostingPermissionsSection
        settings={settings}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <ArchivalSettingsSection
        settings={settings}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <ChannelLimitsSection
        settings={settings}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}

interface SectionProps {
  settings: ChannelSettings;
  onSave: (updates: Partial<ChannelSettings>) => Promise<void>;
  isSaving: boolean;
}

function CreationPermissionsSection({
  settings,
  onSave,
  isSaving,
}: SectionProps) {
  return (
    <div className='rounded-lg border bg-card'>
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <PlusCircle className='h-5 w-5 text-primary' />
          <h2 className='text-lg font-semibold text-foreground'>
            Channel Creation Permissions
          </h2>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Control who can create public and private channels
        </p>
      </div>

      <div className='space-y-6 p-6'>
        <div className='space-y-2'>
          <Label htmlFor='createPublic'>Who can create public channels</Label>
          <Select
            value={settings.whoCanCreatePublic}
            onValueChange={value => {
              if (isWhoCanCreate(value)) {
                onSave({ whoCanCreatePublic: value });
              }
            }}
            disabled={isSaving}
          >
            <SelectTrigger id='createPublic'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='everyone'>
                Everyone (all workspace members)
              </SelectItem>
              <SelectItem value='members'>
                Members (excluding guests)
              </SelectItem>
              <SelectItem value='admins'>Admins only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='createPrivate'>Who can create private channels</Label>
          <Select
            value={settings.whoCanCreatePrivate}
            onValueChange={value => {
              if (isWhoCanCreate(value)) {
                onSave({ whoCanCreatePrivate: value });
              }
            }}
            disabled={isSaving}
          >
            <SelectTrigger id='createPrivate'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='everyone'>
                Everyone (all workspace members)
              </SelectItem>
              <SelectItem value='members'>
                Members (excluding guests)
              </SelectItem>
              <SelectItem value='admins'>Admins only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function NamingConventionsSection({
  settings,
  onSave,
  isSaving,
}: SectionProps) {
  const [localPrefix, setLocalPrefix] = useState(settings.requiredPrefix || '');
  const [localPattern, setLocalPattern] = useState(
    settings.namingPattern || ''
  );

  return (
    <div className='rounded-lg border bg-card'>
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Tag className='h-5 w-5 text-primary' />
          <h2 className='text-lg font-semibold text-foreground'>
            Naming Conventions
          </h2>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Set rules for channel naming consistency
        </p>
      </div>

      <div className='space-y-6 p-6'>
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Enforce naming convention
            </p>
            <p className='text-sm text-muted-foreground'>
              Require channels to follow naming rules
            </p>
          </div>
          <ToggleSwitch
            checked={settings.enforceNamingConvention}
            onChange={checked => onSave({ enforceNamingConvention: checked })}
            disabled={isSaving}
          />
        </div>

        {settings.enforceNamingConvention && (
          <>
            <div className='space-y-2 border-t pt-6'>
              <Label htmlFor='prefix'>Required prefix</Label>
              <p className='text-sm text-muted-foreground'>
                All channels must start with this prefix (e.g., "team-",
                "proj-")
              </p>
              <div className='flex gap-2'>
                <Input
                  id='prefix'
                  value={localPrefix}
                  onChange={e => setLocalPrefix(e.target.value)}
                  placeholder='team-'
                  className='flex-1'
                />
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onSave({ requiredPrefix: localPrefix })}
                  disabled={isSaving}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className='space-y-2 border-t pt-6'>
              <Label htmlFor='pattern'>Naming pattern (regex)</Label>
              <p className='text-sm text-muted-foreground'>
                Advanced: define a regex pattern that all channel names must
                match
              </p>
              <div className='flex gap-2'>
                <Input
                  id='pattern'
                  value={localPattern}
                  onChange={e => setLocalPattern(e.target.value)}
                  placeholder='^[a-z][a-z0-9-]*$'
                  className='flex-1 font-mono'
                />
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onSave({ namingPattern: localPattern })}
                  disabled={isSaving}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className='space-y-2 border-t pt-6'>
              <Label htmlFor='allowedChars'>Allowed characters</Label>
              <Select
                value={settings.allowedCharacters}
                onValueChange={value => {
                  if (isAllowedCharacters(value)) {
                    onSave({ allowedCharacters: value });
                  }
                }}
                disabled={isSaving}
              >
                <SelectTrigger id='allowedChars'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='alphanumeric'>
                    Alphanumeric only (a-z, 0-9)
                  </SelectItem>
                  <SelectItem value='alphanumeric-dash'>
                    Alphanumeric + dash (a-z, 0-9, -)
                  </SelectItem>
                  <SelectItem value='any'>Any characters</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PostingPermissionsSection({
  settings,
  onSave,
  isSaving,
}: SectionProps) {
  return (
    <div className='rounded-lg border bg-card'>
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <MessageSquare className='h-5 w-5 text-primary' />
          <h2 className='text-lg font-semibold text-foreground'>
            Default Posting Permissions
          </h2>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Set default permissions for new channels
        </p>
      </div>

      <div className='space-y-6 p-6'>
        <div className='space-y-2'>
          <Label htmlFor='postingPerm'>Default posting permission</Label>
          <p className='text-sm text-muted-foreground'>
            Who can post messages in new channels by default
          </p>
          <Select
            value={settings.defaultPostingPermission}
            onValueChange={value => {
              if (isPostingPermission(value)) {
                onSave({ defaultPostingPermission: value });
              }
            }}
            disabled={isSaving}
          >
            <SelectTrigger id='postingPerm'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='everyone'>
                Everyone (all channel members)
              </SelectItem>
              <SelectItem value='approved-members'>
                Approved members only
              </SelectItem>
              <SelectItem value='admins-only'>
                Admins only (announcement channels)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Allow threaded replies
            </p>
            <p className='text-sm text-muted-foreground'>
              Enable thread conversations in channels
            </p>
          </div>
          <ToggleSwitch
            checked={settings.allowThreads}
            onChange={checked => onSave({ allowThreads: checked })}
            disabled={isSaving}
          />
        </div>

        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Allow message reactions
            </p>
            <p className='text-sm text-muted-foreground'>
              Enable emoji reactions on messages
            </p>
          </div>
          <ToggleSwitch
            checked={settings.allowReactions}
            onChange={checked => onSave({ allowReactions: checked })}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

function ArchivalSettingsSection({ settings, onSave, isSaving }: SectionProps) {
  return (
    <div className='rounded-lg border bg-card'>
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Archive className='h-5 w-5 text-primary' />
          <h2 className='text-lg font-semibold text-foreground'>
            Channel Archival
          </h2>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Configure automatic and manual channel archival
        </p>
      </div>

      <div className='space-y-6 p-6'>
        <div className='space-y-2'>
          <Label htmlFor='autoArchive'>
            Auto-archive inactive channels after
          </Label>
          <p className='text-sm text-muted-foreground'>
            Channels with no activity will be automatically archived
          </p>
          <Select
            value={settings.autoArchiveInactiveDays.toString()}
            onValueChange={value =>
              onSave({ autoArchiveInactiveDays: Number(value) })
            }
            disabled={isSaving}
          >
            <SelectTrigger id='autoArchive'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='0'>Never (disabled)</SelectItem>
              <SelectItem value='30'>30 days</SelectItem>
              <SelectItem value='60'>60 days</SelectItem>
              <SelectItem value='90'>90 days</SelectItem>
              <SelectItem value='180'>180 days</SelectItem>
              <SelectItem value='365'>1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2 border-t pt-6'>
          <Label htmlFor='whoArchive'>Who can manually archive channels</Label>
          <Select
            value={settings.whoCanArchive}
            onValueChange={value => {
              if (isWhoCanArchive(value)) {
                onSave({ whoCanArchive: value });
              }
            }}
            disabled={isSaving}
          >
            <SelectTrigger id='whoArchive'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='everyone'>
                Everyone (all channel members)
              </SelectItem>
              <SelectItem value='channel-creator'>
                Channel creator only
              </SelectItem>
              <SelectItem value='admins'>Admins only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center justify-between border-t pt-6'>
          <div className='flex-1'>
            <p className='font-medium text-foreground'>
              Require confirmation before archiving
            </p>
            <p className='text-sm text-muted-foreground'>
              Show confirmation dialog when archiving channels
            </p>
          </div>
          <ToggleSwitch
            checked={settings.archiveRequiresConfirmation}
            onChange={checked =>
              onSave({ archiveRequiresConfirmation: checked })
            }
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

function ChannelLimitsSection({ settings, onSave, isSaving }: SectionProps) {
  const [maxNameLength, setMaxNameLength] = useState(
    settings.maxChannelNameLength
  );

  return (
    <div className='rounded-lg border bg-card'>
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Settings className='h-5 w-5 text-primary' />
          <h2 className='text-lg font-semibold text-foreground'>
            Channel Limits
          </h2>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Set constraints on channel creation and naming
        </p>
      </div>

      <div className='space-y-6 p-6'>
        <div>
          <label
            htmlFor='maxNameLength'
            className='block text-sm font-medium text-foreground mb-2'
          >
            Maximum channel name length
          </label>
          <p className='text-sm text-muted-foreground mb-3'>
            Limit the number of characters in channel names
          </p>
          <div className='flex items-center gap-4'>
            <input
              type='range'
              id='maxNameLength'
              min={20}
              max={100}
              step={5}
              value={maxNameLength}
              onChange={e => setMaxNameLength(Number(e.target.value))}
              onMouseUp={() => onSave({ maxChannelNameLength: maxNameLength })}
              onTouchEnd={() => onSave({ maxChannelNameLength: maxNameLength })}
              disabled={isSaving}
              className='flex-1'
            />
            <span className='text-sm font-medium text-foreground w-16 text-right'>
              {maxNameLength} chars
            </span>
          </div>
        </div>

        <div className='rounded-md bg-blue-50 p-4 dark:bg-blue-900/10 border-t'>
          <div className='flex items-start gap-2'>
            <Info className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5' />
            <p className='text-sm text-blue-800 dark:text-blue-200'>
              Additional channel limits can be configured based on your
              workspace plan. Contact support to adjust workspace-wide or
              per-user channel limits.
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
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  );
}

function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card p-6'>
          <div className='h-6 w-48 animate-pulse rounded bg-muted mb-4' />
          <div className='space-y-4'>
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </div>
  );
}
