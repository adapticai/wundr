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
import { useRoles } from '@/hooks/use-admin';
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
  const { setPageHeader } = usePageHeader();

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

  const { roles } = useRoles(workspaceSlug);

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
        <div className='flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
          <AlertTriangle className='h-5 w-5 text-destructive flex-shrink-0 mt-0.5' />
          <p className='text-sm text-destructive'>{error}</p>
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
                <Label className='mb-2 block'>Who can invite members</Label>
                <Select
                  value={settings.whoCanInvite}
                  onValueChange={value =>
                    handleSelectChange('whoCanInvite', value)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='everyone'>
                      Everyone (all workspace members)
                    </SelectItem>
                    <SelectItem value='admins'>Admins only</SelectItem>
                  </SelectContent>
                </Select>
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
                      <Input
                        value={settings.inviteLink}
                        readOnly
                        className='flex-1 bg-background'
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={copyInviteLink}
                      >
                        <Copy className='h-4 w-4 mr-2' />
                        Copy
                      </Button>
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={regenerateInviteLink}
                      disabled={isRegeneratingLink}
                      className='text-primary hover:text-primary px-0'
                    >
                      <RefreshCw className='h-4 w-4 mr-2' />
                      {isRegeneratingLink
                        ? 'Regenerating...'
                        : 'Regenerate link'}
                    </Button>
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
              <Label className='mb-2 block'>Allowed email domains</Label>
              <p className='text-sm text-muted-foreground mb-3'>
                Users with these email domains can join without an invitation
              </p>
              <Input
                value={settings.allowedDomains?.join(', ') || ''}
                onChange={e => {
                  const domains = e.target.value
                    .split(',')
                    .map(d => d.trim())
                    .filter(Boolean);
                  handleSelectChange('allowedDomains', domains);
                }}
                placeholder='example.com, company.org'
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
            <Label className='mb-2 block'>Default role for new members</Label>
            <p className='text-sm text-muted-foreground mb-3'>
              Automatically assign this role when a new member joins
            </p>
            <Select
              value={settings.autoAssignRoleId || '_default'}
              onValueChange={value =>
                handleSelectChange(
                  'autoAssignRoleId',
                  value === '_default' ? '' : value
                )
              }
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a default role' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='_default'>Member (default)</SelectItem>
                {roles
                  .filter(r => !r.isSystem)
                  .map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
                <Label className='mb-2 block'>Guest channel access</Label>
                <p className='text-sm text-muted-foreground mb-3'>
                  Which channels guests can access by default
                </p>
                <Select
                  value={settings.guestChannelAccess}
                  onValueChange={value =>
                    handleSelectChange('guestChannelAccess', value)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>
                      No channels (invite to specific channels only)
                    </SelectItem>
                    <SelectItem value='specific'>
                      Specific channels only
                    </SelectItem>
                    <SelectItem value='all'>All public channels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Guest Account Expiration */}
              <div className='border-t pt-6'>
                <Label className='mb-2 block'>Guest account expiration</Label>
                <p className='text-sm text-muted-foreground mb-3'>
                  Guest accounts will be automatically deactivated after this
                  period of inactivity
                </p>
                <Select
                  value={settings.guestAccountExpiration.toString()}
                  onValueChange={value =>
                    handleSelectChange('guestAccountExpiration', Number(value))
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='7'>7 days</SelectItem>
                    <SelectItem value='30'>30 days</SelectItem>
                    <SelectItem value='60'>60 days</SelectItem>
                    <SelectItem value='90'>90 days</SelectItem>
                    <SelectItem value='0'>Never expire</SelectItem>
                  </SelectContent>
                </Select>
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

// Toggle Switch Component — delegates to shadcn Switch
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
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
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
