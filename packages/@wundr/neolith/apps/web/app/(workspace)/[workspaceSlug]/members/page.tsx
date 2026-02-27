'use client';

import {
  UserPlus,
  Search,
  Users,
  Mail,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useMembers, useInvites, useRoles, type Role } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type MemberStatus = 'active' | 'suspended' | 'pending';
type FilterStatus = 'all' | MemberStatus;

/**
 * Team Members Page
 *
 * Features member list, invite functionality, and member viewing.
 * Note: This is a read-only view for regular workspace members.
 * Admin users should use /admin/members for full management capabilities.
 */
export default function MembersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceSlug = params.workspaceSlug as string;
  const showInviteOnLoad = searchParams.get('invite') === 'true';
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(showInviteOnLoad);

  const {
    members,
    total,
    isLoading,
    hasMore,
    loadMore,
    error: membersError,
  } = useMembers(workspaceSlug, {
    status: filterStatus === 'all' ? undefined : filterStatus,
    search: searchQuery || undefined,
  });

  const {
    invites,
    createInvites,
    revokeInvite,
    resendInvite,
    isLoading: invitesLoading,
  } = useInvites(workspaceSlug);
  const { roles } = useRoles(workspaceSlug);

  const handleInvite = useCallback(
    async (emails: string[], roleId?: string) => {
      try {
        await createInvites(emails, roleId);
        setShowInviteModal(false);
        toast({
          title: 'Invitations sent',
          description: `${emails.length} invitation${emails.length !== 1 ? 's' : ''} sent successfully.`,
        });
      } catch (err) {
        toast({
          title: 'Failed to send invitations',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [createInvites, toast]
  );

  const handleRevokeInvite = useCallback(
    async (inviteId: string) => {
      try {
        await revokeInvite(inviteId);
        toast({
          title: 'Invitation revoked',
          description: 'The invitation has been revoked.',
        });
      } catch (err) {
        toast({
          title: 'Failed to revoke invitation',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [revokeInvite, toast]
  );

  const handleResendInvite = useCallback(
    async (inviteId: string, email: string) => {
      try {
        await resendInvite(inviteId);
        toast({
          title: 'Invitation resent',
          description: `A new invitation has been sent to ${email}.`,
        });
      } catch (err) {
        toast({
          title: 'Failed to resend invitation',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [resendInvite, toast]
  );

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All Members' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'pending', label: 'Pending' },
  ];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Team Members</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            {isLoading
              ? 'Loading members...'
              : `${total} member${total !== 1 ? 's' : ''} in this workspace`}
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className='h-4 w-4' />
          Invite Members
        </Button>
      </div>

      {/* Error State */}
      {membersError && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Failed to load members. {membersError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        {/* Status Filter */}
        <div className='flex flex-wrap gap-2'>
          {filterOptions.map(option => (
            <Button
              key={option.value}
              variant={filterStatus === option.value ? 'default' : 'outline'}
              size='sm'
              onClick={() => setFilterStatus(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className='relative sm:w-64'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='text'
            placeholder='Search members...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='pl-9'
          />
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-4 py-3'>
            <h2 className='font-semibold text-foreground'>
              Pending Invites ({invites.length})
            </h2>
          </div>
          <div className='divide-y'>
            {invites.map(invite => (
              <InviteRow
                key={invite.id}
                invite={invite}
                roles={roles}
                onRevoke={() => handleRevokeInvite(invite.id)}
                onResend={() => handleResendInvite(invite.id, invite.email)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Member Grid */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {isLoading ? (
          <MemberCardSkeleton count={8} />
        ) : members.length === 0 ? (
          <div className='col-span-full rounded-lg border border-dashed bg-card p-12 text-center'>
            <Users className='mx-auto h-12 w-12 text-muted-foreground opacity-20' />
            <h3 className='mt-4 text-lg font-semibold text-foreground'>
              No members found
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Invite members to get started.'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button className='mt-4' onClick={() => setShowInviteModal(true)}>
                Invite Members
              </Button>
            )}
          </div>
        ) : (
          members.map(member => <MemberCard key={member.id} member={member} />)
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className='flex justify-center pt-4'>
          <Button variant='outline' onClick={loadMore} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load more members'}
          </Button>
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        open={showInviteModal}
        roles={roles}
        isLoading={invitesLoading}
        onInvite={handleInvite}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
}

// Types - aligned with useMembers, useInvites, useRoles hooks
interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role?: { id: string; name: string };
  roleId: string | null;
  status: MemberStatus;
  joinedAt: Date;
}

interface Invite {
  id: string;
  email: string;
  roleId?: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: Date;
  createdAt: Date;
}

// Role type imported from '@/hooks/use-admin'

// Member Card Component
interface MemberCardProps {
  member: Member;
}

function MemberCard({ member }: MemberCardProps) {
  // Create avatar-compatible user object (exclude incompatible status type)
  const avatarUser = { name: member.name, image: member.image };

  return (
    <div className='group rounded-lg border bg-card p-4 transition-all hover:shadow-md'>
      <div className='flex flex-col items-center text-center'>
        {/* Avatar */}
        <div className='relative mb-3'>
          <UserAvatar user={avatarUser} size='2xl' />
          {/* Status Indicator */}
          {member.status === 'active' && (
            <div className='absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-green-500' />
          )}
        </div>

        {/* Name */}
        <h3 className='font-semibold text-foreground'>
          {member.name || 'Unknown'}
        </h3>

        {/* Email */}
        <p className='mt-1 truncate text-sm text-muted-foreground w-full px-2'>
          {member.email}
        </p>

        {/* Role Badge */}
        <div className='mt-3'>
          <Badge variant='secondary'>{member.role?.name || 'Member'}</Badge>
        </div>

        {/* Status Badge */}
        <div className='mt-2'>
          <StatusBadge status={member.status} />
        </div>

        {/* Joined Date */}
        <p className='mt-3 text-xs text-muted-foreground'>
          Joined{' '}
          {member.joinedAt instanceof Date
            ? member.joinedAt.toLocaleDateString()
            : new Date(member.joinedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function MemberCardSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='rounded-lg border bg-card p-4'>
          <div className='flex flex-col items-center'>
            <div className='h-16 w-16 animate-pulse rounded-full bg-muted' />
            <div className='mt-3 h-5 w-32 animate-pulse rounded bg-muted' />
            <div className='mt-2 h-4 w-40 animate-pulse rounded bg-muted' />
            <div className='mt-3 h-6 w-20 animate-pulse rounded-full bg-muted' />
            <div className='mt-2 h-5 w-16 animate-pulse rounded-full bg-muted' />
            <div className='mt-3 h-3 w-24 animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: MemberStatus }) {
  const config = {
    active: {
      label: 'Active',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    suspended: {
      label: 'Suspended',
      className:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    pending: {
      label: 'Pending',
      className:
        'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',
    },
  };

  const { label, className } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        className
      )}
    >
      {label}
    </span>
  );
}

// Invite Row Component
function InviteRow({
  invite,
  onRevoke,
  onResend,
  roles,
}: {
  invite: Invite;
  onRevoke: () => void;
  onResend: () => void;
  roles: Role[];
}) {
  const isExpired =
    invite.status === 'EXPIRED' || new Date(invite.expiresAt) < new Date();
  const roleName = roles.find(r => r.id === invite.roleId)?.name || 'Member';

  return (
    <div className='flex items-center justify-between px-4 py-3'>
      <div className='flex items-center gap-3'>
        <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted'>
          <Mail className='h-5 w-5 text-muted-foreground' />
        </div>
        <div>
          <p className='font-medium text-foreground'>{invite.email}</p>
          <p className='text-sm text-muted-foreground'>
            Invited as {roleName} &middot;{' '}
            {isExpired
              ? 'Expired'
              : `Expires ${invite.expiresAt instanceof Date ? invite.expiresAt.toLocaleDateString() : new Date(invite.expiresAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        {!isExpired && (
          <Button
            variant='ghost'
            size='sm'
            onClick={onResend}
            className='text-muted-foreground'
          >
            <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
            Resend
          </Button>
        )}
        <Button
          variant='ghost'
          size='sm'
          onClick={onRevoke}
          className='text-destructive hover:bg-destructive/10 hover:text-destructive'
        >
          Revoke
        </Button>
      </div>
    </div>
  );
}

// Invite Modal Component
interface InviteModalProps {
  open: boolean;
  roles: Role[];
  isLoading: boolean;
  onInvite: (emails: string[], roleId?: string) => Promise<void>;
  onClose: () => void;
}

function InviteModal({
  open,
  roles,
  isLoading,
  onInvite,
  onClose,
}: InviteModalProps) {
  const [emails, setEmails] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailList = emails
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(Boolean);
    if (emailList.length > 0) {
      await onInvite(emailList, roleId || undefined);
      setEmails('');
    }
  };

  const emailCount = emails
    .split(/[,\n]/)
    .map(e => e.trim())
    .filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Send email invitations to add new members to this workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='emails'>Email Addresses</Label>
            <Textarea
              id='emails'
              value={emails}
              onChange={e => setEmails(e.target.value)}
              placeholder={'alice@example.com\nbob@example.com'}
              rows={4}
            />
            <p className='text-xs text-muted-foreground'>
              Separate multiple addresses with commas or new lines.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='role'>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id='role'>
                <SelectValue placeholder='Select a role' />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading || emailCount === 0}>
              {isLoading
                ? 'Sending...'
                : emailCount > 1
                  ? `Send ${emailCount} Invites`
                  : 'Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
