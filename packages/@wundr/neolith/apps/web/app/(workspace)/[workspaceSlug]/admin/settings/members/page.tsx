'use client';

import {
  ChevronRight,
  Copy,
  Shield,
  Mail,
  Users,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MemberSettings {
  // Invitations
  invitationsEnabled: boolean;
  whoCanInvite: 'everyone' | 'admins';
  invitationLinkEnabled: boolean;
  inviteLink?: string;

  // Join Settings
  allowDomainJoin: boolean;
  requireApproval: boolean;
  autoAssignRoleId?: string;
  allowedDomains?: string[];

  // Guest Access
  guestAccessEnabled: boolean;
  guestChannelAccess: 'all' | 'specific' | 'none';
  guestAccountExpiration: number; // days

  // Member Limits
  memberLimit?: number;
  currentMemberCount: number;
}

/**
 * Members & Permissions Admin Settings Page
 *
 * Controls workspace-wide member settings:
 * - Invitations configuration
 * - Roles & permissions overview
 * - Join settings
 * - Guest access controls
 * - Member limits
 */
export default function MembersSettingsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [settings, setSettings] = useState<MemberSettings>({
    invitationsEnabled: true,
    whoCanInvite: 'admins',
    invitationLinkEnabled: false,
    allowDomainJoin: false,
    requireApproval: true,
    autoAssignRoleId: '',
    allowedDomains: [],
    guestAccessEnabled: false,
    guestChannelAccess: 'specific',
    guestAccountExpiration: 30,
    currentMemberCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/members`
        );
        if (!response.ok) {
          throw new Error('Failed to load member settings');
        }
        const data = await response.json();
        setSettings(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load settings';
        setError(message);
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

  const handleToggle = useCallback(
    async (key: keyof MemberSettings) => {
      const currentValue = settings[key];
      const newValue =
        typeof currentValue === 'boolean' ? !currentValue : currentValue;

      // Optimistic update
      setSettings(prev => ({ ...prev, [key]: newValue }));
      setIsSaving(true);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/members`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: newValue }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update setting');
        }
      } catch (err) {
        // Revert on error
        setSettings(prev => ({ ...prev, [key]: currentValue }));
        toast({
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to update setting',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [settings, workspaceSlug, toast]
  );

  const handleSelectChange = useCallback(
    async (key: keyof MemberSettings, value: string | number | string[]) => {
      const currentValue = settings[key];

      setSettings(prev => ({ ...prev, [key]: value }));
      setIsSaving(true);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/members`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: value }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update setting');
        }
      } catch (err) {
        setSettings(prev => ({ ...prev, [key]: currentValue }));
        toast({
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to update setting',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [settings, workspaceSlug, toast]
  );

  const copyInviteLink = useCallback(() => {
    if (!settings.inviteLink) return;
    navigator.clipboard.writeText(settings.inviteLink);
    toast({
      title: 'Copied',
      description: 'Invite link copied to clipboard',
    });
  }, [settings.inviteLink, toast]);

  const regenerateInviteLink = useCallback(async () => {
    setIsRegeneratingLink(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/invite-link/regenerate`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate link');
      }

      const data = await response.json();
      setSettings(prev => ({ ...prev, inviteLink: data.inviteLink }));

      toast({
        title: 'Link regenerated',
        description: 'The previous link has been invalidated',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to regenerate link',
        variant: 'destructive',
      });
    } finally {
      setIsRegeneratingLink(false);
    }
  }, [workspaceSlug, toast]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Members & Permissions</h1>
          <p className='mt-1 text-muted-foreground'>
            Configure workspace member settings and access controls
          </p>
        </div>
        <div className='flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-50 p-4 dark:bg-red-900/10'>
          <AlertTriangle className='h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5' />
          <p className='text-sm text-red-800 dark:text-red-200'>{error}</p>
        </div>
      </div>
    );
  }

  const memberLimitPercentage = settings.memberLimit
    ? (settings.currentMemberCount / settings.memberLimit) * 100
    : 0;
  const nearLimit = memberLimitPercentage > 80;

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Members & Permissions</h1>
        <p className='mt-1 text-muted-foreground'>
          Configure workspace member settings and access controls
        </p>
      </div>

      {/* Invitations Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            <Mail className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              Invitations
            </h2>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            Control how members can be invited to this workspace
          </p>
        </div>

        <div className='space-y-6 p-6'>
          {/* Enable Invitations */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium text-foreground'>Enable Invitations</p>
              <p className='text-sm text-muted-foreground'>
                Allow members to send email invitations to new users
              </p>
            </div>
            <ToggleSwitch
              checked={settings.invitationsEnabled}
              onChange={() => handleToggle('invitationsEnabled')}
              disabled={isSaving}
            />
          </div>

          {/* Who Can Invite */}
          {settings.invitationsEnabled && (
            <>
              <div className='border-t pt-6'>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Who can invite members
                </label>
                <select
                  value={settings.whoCanInvite}
                  onChange={e =>
                    handleSelectChange('whoCanInvite', e.target.value)
                  }
                  disabled={isSaving}
                  className={cn(
                    'block w-full rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  <option value='everyone'>
                    Everyone (all workspace members)
                  </option>
                  <option value='admins'>Admins only</option>
                </select>
              </div>

              {/* Invitation Link */}
              <div className='border-t pt-6'>
                <div className='flex items-center justify-between mb-4'>
                  <div>
                    <p className='font-medium text-foreground'>
                      Shareable Invite Link
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Anyone with this link can request to join the workspace
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={settings.invitationLinkEnabled}
                    onChange={() => handleToggle('invitationLinkEnabled')}
                    disabled={isSaving}
                  />
                </div>

                {settings.invitationLinkEnabled && settings.inviteLink && (
                  <div className='rounded-lg border bg-muted/30 p-4 space-y-3'>
                    <div className='flex items-center gap-2'>
                      <input
                        type='text'
                        value={settings.inviteLink}
                        readOnly
                        className='flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm'
                      />
                      <button
                        type='button'
                        onClick={copyInviteLink}
                        className='inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent'
                      >
                        <Copy className='h-4 w-4' />
                        Copy
                      </button>
                    </div>
                    <button
                      type='button'
                      onClick={regenerateInviteLink}
                      disabled={isRegeneratingLink}
                      className='inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <RefreshCw className='h-4 w-4' />
                      {isRegeneratingLink
                        ? 'Regenerating...'
                        : 'Regenerate link'}
                    </button>
                    <p className='text-xs text-muted-foreground'>
                      Regenerating will immediately invalidate the current link
                    </p>
                  </div>
                )}
              </div>

              {/* Pending Invitations Link */}
              <div className='border-t pt-6'>
                <Link
                  href={`/${workspaceSlug}/admin/settings/invitations`}
                  className='inline-flex items-center gap-2 text-sm text-primary hover:underline'
                >
                  <Mail className='h-4 w-4' />
                  View and manage pending invitations
                  <ChevronRight className='h-4 w-4' />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Roles & Permissions Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              Roles & Permissions
            </h2>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            Manage workspace roles and their capabilities
          </p>
        </div>

        <div className='p-6'>
          <div className='space-y-4'>
            {/* Default Roles Overview */}
            <div className='grid gap-3 sm:grid-cols-3'>
              <RoleCard
                name='Owner'
                description='Full workspace access and billing control'
                color='#6366f1'
              />
              <RoleCard
                name='Admin'
                description='Manage members, channels, and settings'
                color='#8b5cf6'
              />
              <RoleCard
                name='Member'
                description='Standard access to channels and content'
                color='#22c55e'
              />
            </div>

            {/* Link to Full Role Management */}
            <div className='border-t pt-4'>
              <Link
                href={`/${workspaceSlug}/admin/settings/roles`}
                className='inline-flex items-center gap-2 text-sm text-primary hover:underline'
              >
                <Shield className='h-4 w-4' />
                Manage roles & permissions
                <ChevronRight className='h-4 w-4' />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Join Settings Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            <Users className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              Join Settings
            </h2>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            Control how new members can join this workspace
          </p>
        </div>

        <div className='space-y-6 p-6'>
          {/* Allow Domain Join */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium text-foreground'>
                Allow email domain join
              </p>
              <p className='text-sm text-muted-foreground'>
                Anyone with an approved email domain can join automatically
              </p>
            </div>
            <ToggleSwitch
              checked={settings.allowDomainJoin}
              onChange={() => handleToggle('allowDomainJoin')}
              disabled={isSaving}
            />
          </div>

          {settings.allowDomainJoin && (
            <div className='border-t pt-6'>
              <label className='block text-sm font-medium text-foreground mb-2'>
                Allowed email domains
              </label>
              <p className='text-sm text-muted-foreground mb-3'>
                Users with these email domains can join without an invitation
              </p>
              <input
                type='text'
                value={settings.allowedDomains?.join(', ') || ''}
                onChange={e => {
                  const domains = e.target.value
                    .split(',')
                    .map(d => d.trim())
                    .filter(Boolean);
                  handleSelectChange('allowedDomains', domains);
                }}
                placeholder='example.com, company.org'
                className={cn(
                  'block w-full rounded-md border border-input bg-background',
                  'px-3 py-2 text-sm placeholder:text-muted-foreground',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                )}
              />
            </div>
          )}

          {/* Require Approval */}
          <div className='flex items-center justify-between border-t pt-6'>
            <div>
              <p className='font-medium text-foreground'>
                Require approval for new members
              </p>
              <p className='text-sm text-muted-foreground'>
                Admins must approve join requests before access is granted
              </p>
            </div>
            <ToggleSwitch
              checked={settings.requireApproval}
              onChange={() => handleToggle('requireApproval')}
              disabled={isSaving}
            />
          </div>

          {/* Auto-assign Role */}
          <div className='border-t pt-6'>
            <label className='block text-sm font-medium text-foreground mb-2'>
              Default role for new members
            </label>
            <p className='text-sm text-muted-foreground mb-3'>
              Automatically assign this role when a new member joins
            </p>
            <select
              value={settings.autoAssignRoleId || ''}
              onChange={e =>
                handleSelectChange('autoAssignRoleId', e.target.value)
              }
              disabled={isSaving}
              className={cn(
                'block w-full rounded-md border border-input bg-background',
                'px-3 py-2 text-sm',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <option value=''>Member (default)</option>
              <option value='guest'>Guest</option>
              <option value='contributor'>Contributor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Guest Access Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            <Users className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              Guest Access
            </h2>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            Configure guest user permissions and limitations
          </p>
        </div>

        <div className='space-y-6 p-6'>
          {/* Enable Guest Access */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium text-foreground'>Enable guest access</p>
              <p className='text-sm text-muted-foreground'>
                Allow limited access for external collaborators who aren&apos;t
                full members
              </p>
            </div>
            <ToggleSwitch
              checked={settings.guestAccessEnabled}
              onChange={() => handleToggle('guestAccessEnabled')}
              disabled={isSaving}
            />
          </div>

          {settings.guestAccessEnabled && (
            <>
              {/* Guest Channel Access */}
              <div className='border-t pt-6'>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Guest channel access
                </label>
                <p className='text-sm text-muted-foreground mb-3'>
                  Which channels guests can access by default
                </p>
                <select
                  value={settings.guestChannelAccess}
                  onChange={e =>
                    handleSelectChange('guestChannelAccess', e.target.value)
                  }
                  disabled={isSaving}
                  className={cn(
                    'block w-full rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  <option value='none'>
                    No channels (invite to specific channels only)
                  </option>
                  <option value='specific'>Specific channels only</option>
                  <option value='all'>All public channels</option>
                </select>
              </div>

              {/* Guest Account Expiration */}
              <div className='border-t pt-6'>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Guest account expiration
                </label>
                <p className='text-sm text-muted-foreground mb-3'>
                  Guest accounts will be automatically deactivated after this
                  period of inactivity
                </p>
                <select
                  value={settings.guestAccountExpiration}
                  onChange={e =>
                    handleSelectChange(
                      'guestAccountExpiration',
                      Number(e.target.value)
                    )
                  }
                  disabled={isSaving}
                  className={cn(
                    'block w-full rounded-md border border-input bg-background',
                    'px-3 py-2 text-sm',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={0}>Never expire</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Member Limits Section */}
      {settings.memberLimit && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <div className='flex items-center gap-2'>
              <Users className='h-5 w-5 text-primary' />
              <h2 className='text-lg font-semibold text-foreground'>
                Member Capacity
              </h2>
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              Current workspace capacity and usage
            </p>
          </div>

          <div className='p-6'>
            <div className='space-y-4'>
              {/* Usage Bar */}
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-foreground'>
                    {settings.currentMemberCount} / {settings.memberLimit}{' '}
                    members
                  </span>
                  <span className='text-sm text-muted-foreground'>
                    {memberLimitPercentage.toFixed(0)}% used
                  </span>
                </div>
                <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                  <div
                    className={cn(
                      'h-full transition-all',
                      nearLimit ? 'bg-yellow-500' : 'bg-primary'
                    )}
                    style={{
                      width: `${Math.min(memberLimitPercentage, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Warning or Upgrade Prompt */}
              {nearLimit && (
                <div className='flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-50 p-4 dark:bg-yellow-900/10'>
                  <AlertTriangle className='h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>
                      Approaching member limit
                    </p>
                    <p className='mt-1 text-sm text-yellow-700 dark:text-yellow-300'>
                      You&apos;re using {memberLimitPercentage.toFixed(0)}% of
                      your member capacity. Consider upgrading your plan.
                    </p>
                    <Link
                      href={`/${workspaceSlug}/admin/billing`}
                      className='mt-2 inline-flex items-center gap-1 text-sm font-medium text-yellow-800 hover:underline dark:text-yellow-200'
                    >
                      Upgrade plan
                      <ChevronRight className='h-4 w-4' />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={onChange}
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

// Role Card Component
function RoleCard({
  name,
  description,
  color,
}: {
  name: string;
  description: string;
  color: string;
}) {
  return (
    <div className='rounded-lg border bg-muted/30 p-3'>
      <div className='flex items-center gap-2 mb-2'>
        <div
          className='h-3 w-3 rounded-full'
          style={{ backgroundColor: color }}
        />
        <p className='text-sm font-medium text-foreground'>{name}</p>
      </div>
      <p className='text-xs text-muted-foreground'>{description}</p>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card p-6'>
          <div className='h-5 w-48 animate-pulse rounded bg-muted mb-4' />
          <div className='space-y-4'>
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </div>
  );
}
