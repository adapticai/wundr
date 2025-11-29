'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import { UserAvatar } from '@/components/ui/user-avatar';
import { useMembers, useInvites, useRoles } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';


type MemberStatus = 'active' | 'suspended' | 'pending';
type FilterStatus = 'all' | MemberStatus;

/**
 * Team Members Page
 *
 * Features member list, invite functionality, and member viewing
 * Note: This is a read-only view for regular workspace members.
 * Admin users should use /admin/members for full management capabilities.
 */
export default function MembersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceSlug = params.workspaceSlug as string;
  const showInviteOnLoad = searchParams.get('invite') === 'true';

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(showInviteOnLoad);

  const {
    members,
    total,
    isLoading,
    hasMore,
    loadMore,
  } = useMembers(workspaceSlug, {
    status: filterStatus === 'all' ? undefined : filterStatus,
    search: searchQuery || undefined,
  });

  const { invites, createInvites, revokeInvite, isLoading: invitesLoading } = useInvites(workspaceSlug);
  const { roles } = useRoles(workspaceSlug);

  // Filter members based on status and search
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (filterStatus !== 'all' && member.status !== filterStatus) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          member.name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [members, filterStatus, searchQuery]);

  const handleInvite = useCallback(
    async (emails: string[], roleId?: string) => {
      await createInvites(emails, roleId);
      setShowInviteModal(false);
    },
    [createInvites],
  );

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All Members' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'pending', label: 'Pending' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} member{total !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2',
            'text-sm font-medium text-primary-foreground hover:bg-primary/90',
          )}
        >
          <UserPlusIcon className="h-4 w-4" />
          Invite Members
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterStatus(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filterStatus === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-md border border-input bg-background py-2 pl-9 pr-4',
              'text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'sm:w-64',
            )}
          />
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-foreground">
              Pending Invites ({invites.length})
            </h2>
          </div>
          <div className="divide-y">
            {invites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                roles={roles}
                onRevoke={() => revokeInvite(invite.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Member Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <MemberCardSkeleton count={8} />
        ) : filteredMembers.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed bg-card p-12 text-center">
            <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No members found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Invite members to get started'}
            </p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="rounded-md bg-muted px-6 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load more members'}
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          roles={roles}
          isLoading={invitesLoading}
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}
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
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
  memberCount?: number;
}

// Member Card Component
interface MemberCardProps {
  member: Member;
}

function MemberCard({ member }: MemberCardProps) {
  return (
    <div className="group rounded-lg border bg-card p-4 transition-all hover:shadow-md">
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-3">
          <UserAvatar user={member} size="2xl" />
          {/* Status Indicator */}
          {member.status === 'active' && (
            <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-green-500" />
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-foreground">
          {member.name || 'Unknown'}
        </h3>

        {/* Email */}
        <p className="mt-1 text-sm text-muted-foreground">
          {member.email}
        </p>

        {/* Role Badge */}
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {member.role?.name || 'No Role'}
          </span>
        </div>

        {/* Status Badge */}
        <div className="mt-2">
          <StatusBadge status={member.status} />
        </div>

        {/* Joined Date */}
        <p className="mt-3 text-xs text-muted-foreground">
          Joined {member.joinedAt instanceof Date ? member.joinedAt.toLocaleDateString() : new Date(member.joinedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function MemberCardSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-6 w-20 animate-pulse rounded-full bg-muted" />
            <div className="mt-2 h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: MemberStatus }) {
  const config = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    suspended: { label: 'Suspended', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    pending: { label: 'Pending', className: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300' },
  };

  const { label, className } = config[status];

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}

// Invite Row Component
function InviteRow({ invite, onRevoke, roles }: { invite: Invite; onRevoke: () => void; roles: Role[] }) {
  const isExpired = invite.status === 'expired' || new Date(invite.expiresAt) < new Date();
  const roleName = roles.find(r => r.id === invite.roleId)?.name || 'Member';

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <MailIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{invite.email}</p>
          <p className="text-sm text-muted-foreground">
            Invited as {roleName} - {isExpired ? 'Expired' : `Expires ${invite.expiresAt instanceof Date ? invite.expiresAt.toLocaleDateString() : new Date(invite.expiresAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        Revoke
      </button>
    </div>
  );
}

// Invite Modal Component
interface InviteModalProps {
  roles: Role[];
  isLoading: boolean;
  onInvite: (emails: string[], roleId?: string) => Promise<void>;
  onClose: () => void;
}

function InviteModal({ roles, isLoading, onInvite, onClose }: InviteModalProps) {
  const [emails, setEmails] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailList = emails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emailList.length > 0) {
      await onInvite(emailList, roleId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Invite Members</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="emails" className="block text-sm font-medium text-foreground">
              Email Addresses
            </label>
            <textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Enter email addresses (separated by comma or newline)"
              rows={4}
              className={cn(
                'mt-1 block w-full rounded-md border border-input bg-background',
                'px-3 py-2 text-sm placeholder:text-muted-foreground',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              )}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              id="role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className={cn(
                'mt-1 block w-full rounded-md border border-input bg-background',
                'px-3 py-2 text-sm',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              )}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !emails.trim()}
              className={cn(
                'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
                'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isLoading ? 'Sending...' : 'Send Invites'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Icons
function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
