'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import { useMembers, useInvites, useRoles } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';


type MemberStatus = 'active' | 'suspended' | 'pending';
type FilterStatus = 'all' | MemberStatus;

/**
 * Member Management Page
 *
 * Features member list, invite functionality, and member editing
 */
export default function AdminMembersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const showInviteOnLoad = searchParams.get('invite') === 'true';

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(showInviteOnLoad);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const {
    members,
    total,
    isLoading,
    hasMore,
    loadMore,
    updateMember,
    suspendMember,
    removeMember,
  } = useMembers(workspaceId, {
    status: filterStatus === 'all' ? undefined : filterStatus,
    search: searchQuery || undefined,
  });

  const { invites, createInvites, revokeInvite, isLoading: invitesLoading } = useInvites(workspaceId);
  const { roles } = useRoles(workspaceId);

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

  const handleUpdateRole = useCallback(
    async (memberId: string, roleId: string) => {
      await updateMember(memberId, { roleId });
      setEditingMember(null);
    },
    [updateMember],
  );

  const handleSuspend = useCallback(
    async (memberId: string) => {
      await suspendMember(memberId);
    },
    [suspendMember],
  );

  const handleRemove = useCallback(
    async (memberId: string) => {
      if (window.confirm('Are you sure you want to remove this member?')) {
        await removeMember(memberId);
      }
    },
    [removeMember],
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
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
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

      {/* Member List */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Member
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Joined
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <MemberRowSkeleton count={5} />
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No members found
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onEdit={() => setEditingMember(member)}
                    onSuspend={() => handleSuspend(member.id)}
                    onRemove={() => handleRemove(member.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="border-t px-4 py-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load more members'}
            </button>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          roles={roles}
          isLoading={invitesLoading}
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          roles={roles}
          onUpdateRole={(roleId) => handleUpdateRole(editingMember.id, roleId)}
          onClose={() => setEditingMember(null)}
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

// Member Row Component
interface MemberRowProps {
  member: Member;
  onEdit: () => void;
  onSuspend: () => void;
  onRemove: () => void;
}

function MemberRow({ member, onEdit, onSuspend, onRemove }: MemberRowProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <tr className="hover:bg-muted/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            {member.image ? (
              <img
                src={member.image}
                alt={member.name || 'Member'}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-primary">
                {member.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">{member.name || 'Unknown'}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {member.role?.name || 'No Role'}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={member.status} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {member.joinedAt instanceof Date ? member.joinedAt.toLocaleDateString() : new Date(member.joinedAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="relative flex justify-end">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-1 hover:bg-muted"
          >
            <MoreIcon className="h-5 w-5 text-muted-foreground" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-40 rounded-md border bg-card py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                >
                  <EditIcon className="h-4 w-4" />
                  Edit Role
                </button>
                {member.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onSuspend();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-yellow-600 hover:bg-muted"
                  >
                    <PauseIcon className="h-4 w-4" />
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onSuspend();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-muted"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Activate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onRemove();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-muted"
                >
                  <TrashIcon className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function MemberRowSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-4 py-3">
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: MemberStatus }) {
  const config = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    suspended: { label: 'Suspended', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    pending: { label: 'Pending', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
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

// Edit Member Modal Component
interface EditMemberModalProps {
  member: Member;
  roles: Role[];
  onUpdateRole: (roleId: string) => Promise<void>;
  onClose: () => void;
}

function EditMemberModal({ member, roles, onUpdateRole, onClose }: EditMemberModalProps) {
  const [roleId, setRoleId] = useState(member.roleId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onUpdateRole(roleId);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Edit Member</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {member.image ? (
              <img
                src={member.image}
                alt={member.name || 'Member'}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-primary">
                {member.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">{member.name}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="memberRole" className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              id="memberRole"
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
              disabled={isSubmitting}
              className={cn(
                'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
                'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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
