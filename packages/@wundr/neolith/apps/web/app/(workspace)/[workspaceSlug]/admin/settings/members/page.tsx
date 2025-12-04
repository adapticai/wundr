'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MemberSettings {
  // Invitations
  invitationsEnabled: boolean;
  whoCanInvite: 'everyone' | 'admins';
  invitationLinkEnabled: boolean;

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
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Members & Permissions',
      'Configure workspace member settings and access controls'
    );
  }, [setPageHeader]);

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
  const [inviteLink] = useState(
    `https://app.wundr.ai/invite/${workspaceSlug}/abc123`
  ); // Mock link

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings/members`
        );
        if (!response.ok) {
          throw new Error('Failed to load settings');
        }
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to load settings',
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

        toast({
          title: 'Success',
          description: 'Setting updated successfully',
        });
      } catch (error) {
        // Revert on error
        setSettings(prev => ({ ...prev, [key]: currentValue }));

        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update setting',
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

        toast({
          title: 'Success',
          description: 'Setting updated successfully',
        });
      } catch (error) {
        setSettings(prev => ({ ...prev, [key]: currentValue }));

        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update setting',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [settings, workspaceSlug, toast]
  );

  const copyInviteLink = useCallback(() => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: 'Copied',
      description: 'Invite link copied to clipboard',
    });
  }, [inviteLink, toast]);

  const regenerateInviteLink = useCallback(async () => {
    setIsSaving(true);
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

      toast({
        title: 'Success',
        description: 'New invite link generated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to regenerate link',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [workspaceSlug, toast]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const memberLimitPercentage = settings.memberLimit
    ? (settings.currentMemberCount / settings.memberLimit) * 100
    : 0;
  const nearLimit = memberLimitPercentage > 80;

  return (
    <div className='space-y-6'>
      {/* Invitations Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground'>Invitations</h2>
          <p className='text-sm text-muted-foreground'>
            Control how members can be invited to this workspace
          </p>
        </div>

        <div className='space-y-6 p-6'>
          {/* Enable Invitations */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium text-foreground'>Enable Invitations</p>
              <p className='text-sm text-muted-foreground'>
                Allow members to send email invitations
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
                      Invitation Link
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Create a shareable link that anyone can use to join
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={settings.invitationLinkEnabled}
                    onChange={() => handleToggle('invitationLinkEnabled')}
                    disabled={isSaving}
                  />
                </div>

                {settings.invitationLinkEnabled && (
                  <div className='rounded-lg border bg-muted/30 p-4'>
                    <div className='flex items-center gap-2'>
                      <input
                        type='text'
                        value={inviteLink}
                        readOnly
                        className='flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm'
                      />
                      <button
                        type='button'
                        onClick={copyInviteLink}
                        className='rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent'
                      >
                        <CopyIcon className='h-4 w-4' />
                      </button>
                    </div>
                    <button
                      type='button'
                      onClick={regenerateInviteLink}
                      disabled={isSaving}
                      className='mt-2 text-sm text-primary hover:underline disabled:opacity-50'
                    >
                      Regenerate link
                    </button>
                  </div>
                )}
              </div>

              {/* Pending Invitations Link */}
              <div className='border-t pt-6'>
                <Link
                  href={`/${workspaceSlug}/admin/members`}
                  className='inline-flex items-center gap-2 text-sm text-primary hover:underline'
                >
                  <MailIcon className='h-4 w-4' />
                  View pending invitations
                  <ChevronRightIcon className='h-4 w-4' />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Roles & Permissions Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground'>
            Roles & Permissions
          </h2>
          <p className='text-sm text-muted-foreground'>
            Manage workspace roles and their capabilities
          </p>
        </div>

        <div className='p-6'>
          <div className='space-y-4'>
            {/* Default Roles Overview */}
            <div className='grid gap-3 sm:grid-cols-3'>
              <RoleCard
                name='Owner'
                description='Full workspace access'
                color='#6366f1'
              />
              <RoleCard
                name='Admin'
                description='Manage members & settings'
                color='#8b5cf6'
              />
              <RoleCard
                name='Member'
                description='Standard access'
                color='#22c55e'
              />
            </div>

            {/* Link to Full Role Management */}
            <div className='border-t pt-4'>
              <Link
                href={`/${workspaceSlug}/admin/roles`}
                className='inline-flex items-center gap-2 text-sm text-primary hover:underline'
              >
                <ShieldIcon className='h-4 w-4' />
                Manage roles & permissions
                <ChevronRightIcon className='h-4 w-4' />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Join Settings Section */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='text-lg font-semibold text-foreground'>
            Join Settings
          </h2>
          <p className='text-sm text-muted-foreground'>
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
                Anyone with an allowed email domain can join automatically
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
              Auto-assign role for new members
            </label>
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
          <h2 className='text-lg font-semibold text-foreground'>
            Guest Access
          </h2>
          <p className='text-sm text-muted-foreground'>
            Configure guest user permissions and limitations
          </p>
        </div>

        <div className='space-y-6 p-6'>
          {/* Enable Guest Access */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium text-foreground'>Enable guest access</p>
              <p className='text-sm text-muted-foreground'>
                Allow limited access for external collaborators
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
                  <option value='none'>No channels (invite only)</option>
                  <option value='specific'>Specific channels only</option>
                  <option value='all'>All public channels</option>
                </select>
              </div>

              {/* Guest Account Expiration */}
              <div className='border-t pt-6'>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Guest account expiration
                </label>
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
                  <option value={0}>Never</option>
                </select>
                <p className='mt-2 text-sm text-muted-foreground'>
                  Guest accounts will be automatically deactivated after this
                  period
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Member Limits Section */}
      {settings.memberLimit && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <h2 className='text-lg font-semibold text-foreground'>
              Member Limits
            </h2>
            <p className='text-sm text-muted-foreground'>
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
                  <AlertIcon className='h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>
                      Approaching member limit
                    </p>
                    <p className='mt-1 text-sm text-yellow-700 dark:text-yellow-300'>
                      You're using {memberLimitPercentage.toFixed(0)}% of your
                      member capacity. Consider upgrading your plan.
                    </p>
                    <Link
                      href={`/${workspaceSlug}/admin/billing`}
                      className='mt-2 inline-flex items-center gap-1 text-sm font-medium text-yellow-800 hover:underline dark:text-yellow-200'
                    >
                      Upgrade plan
                      <ChevronRightIcon className='h-4 w-4' />
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

// Icons
function CopyIcon({ className }: { className?: string }) {
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
      <rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
      <path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
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

function ShieldIcon({ className }: { className?: string }) {
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
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d='m9 18 6-6-6-6' />
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
