'use client';

import { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';

import type { ChannelMember, ChannelPermissions } from '@/types/channel';


/**
 * Props for the MemberList component
 */
interface MemberListProps {
  /** All members in the channel */
  members: ChannelMember[];
  /** Filtered list of online members */
  onlineMembers: ChannelMember[];
  /** Filtered list of offline members */
  offlineMembers: ChannelMember[];
  /** The current user's ID */
  currentUserId: string;
  /** Permissions for the current user in this channel */
  permissions: ChannelPermissions;
  /** Whether the member list panel is open */
  isOpen: boolean;
  /** Callback to close the member list */
  onClose: () => void;
  /** Callback to view a user's profile */
  onViewProfile?: (userId: string) => void;
  /** Callback to change a member's role */
  onChangeRole?: (userId: string, role: 'admin' | 'member') => Promise<void>;
  /** Callback to remove a member from the channel */
  onRemoveMember?: (userId: string) => Promise<void>;
  /** Additional CSS class names */
  className?: string;
}

export function MemberList({
  members,
  onlineMembers,
  offlineMembers,
  currentUserId,
  permissions,
  isOpen,
  onClose,
  onViewProfile,
  onChangeRole,
  onRemoveMember,
  className,
}: MemberListProps) {
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleChangeRole = useCallback(
    async (userId: string, role: 'admin' | 'member') => {
      if (isProcessing) {
return;
}
      setIsProcessing(true);
      try {
        await onChangeRole?.(userId, role);
      } finally {
        setIsProcessing(false);
        setActionMenuUserId(null);
      }
    },
    [isProcessing, onChangeRole],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (isProcessing) {
return;
}
      setIsProcessing(true);
      try {
        await onRemoveMember?.(userId);
      } finally {
        setIsProcessing(false);
        setActionMenuUserId(null);
      }
    },
    [isProcessing, onRemoveMember],
  );

  if (!isOpen) {
return null;
}

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-40 w-72 border-l bg-card shadow-lg transition-transform duration-200',
        isOpen ? 'translate-x-0' : 'translate-x-full',
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="font-semibold text-foreground">Members ({members.length})</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close member list"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Member list */}
      <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
        {/* Online members */}
        {onlineMembers.length > 0 && (
          <div className="py-2">
            <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Online - {onlineMembers.length}
            </h3>
            {onlineMembers.map((member) => (
              <MemberItem
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                permissions={permissions}
                showMenu={actionMenuUserId === member.userId}
                onToggleMenu={() =>
                  setActionMenuUserId(
                    actionMenuUserId === member.userId ? null : member.userId,
                  )
                }
                onCloseMenu={() => setActionMenuUserId(null)}
                onViewProfile={onViewProfile}
                onChangeRole={handleChangeRole}
                onRemove={handleRemoveMember}
                isProcessing={isProcessing}
              />
            ))}
          </div>
        )}

        {/* Offline members */}
        {offlineMembers.length > 0 && (
          <div className="py-2">
            <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Offline - {offlineMembers.length}
            </h3>
            {offlineMembers.map((member) => (
              <MemberItem
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                permissions={permissions}
                showMenu={actionMenuUserId === member.userId}
                onToggleMenu={() =>
                  setActionMenuUserId(
                    actionMenuUserId === member.userId ? null : member.userId,
                  )
                }
                onCloseMenu={() => setActionMenuUserId(null)}
                onViewProfile={onViewProfile}
                onChangeRole={handleChangeRole}
                onRemove={handleRemoveMember}
                isProcessing={isProcessing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MemberItemProps {
  member: ChannelMember;
  currentUserId: string;
  permissions: ChannelPermissions;
  showMenu: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onViewProfile?: (userId: string) => void;
  onChangeRole?: (userId: string, role: 'admin' | 'member') => void;
  onRemove?: (userId: string) => void;
  isProcessing?: boolean;
}

function MemberItem({
  member,
  currentUserId,
  permissions,
  showMenu,
  onToggleMenu,
  onCloseMenu,
  onViewProfile,
  onChangeRole,
  onRemove,
  isProcessing,
}: MemberItemProps) {
  const isCurrentUser = member.userId === currentUserId;
  const canManage = permissions.canChangeRoles || permissions.canRemoveMembers;
  const showActions = canManage && !isCurrentUser;

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (showActions ? onToggleMenu() : onViewProfile?.(member.userId))}
        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
      >
        {/* Avatar with status */}
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {member.user.image ? (
              <img
                src={member.user.image}
                alt={member.user.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              member.user.name.charAt(0).toUpperCase()
            )}
          </div>
          <span
            className={cn(
              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
              statusColors[member.user.status || 'offline'],
            )}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {member.user.name}
              {isCurrentUser && (
                <span className="ml-1 text-xs text-muted-foreground">(you)</span>
              )}
            </span>
            {member.role === 'admin' && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Admin
              </span>
            )}
          </div>
          {member.user.email && (
            <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
          )}
        </div>

        {/* More button for admins */}
        {showActions && (
          <span className="text-muted-foreground">
            <MoreIcon className="h-4 w-4" />
          </span>
        )}
      </button>

      {/* Action menu */}
      {showMenu && showActions && (
        <>
          <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
          <div className="absolute right-4 top-full z-20 mt-1 w-48 rounded-md border bg-card py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onViewProfile?.(member.userId);
                onCloseMenu();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <ProfileIcon className="h-4 w-4" />
              View profile
            </button>

            {permissions.canChangeRoles && (
              <>
                {member.role === 'member' ? (
                  <button
                    type="button"
                    onClick={() => onChangeRole?.(member.userId, 'admin')}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    <ShieldIcon className="h-4 w-4" />
                    Make admin
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChangeRole?.(member.userId, 'member')}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    <ShieldOffIcon className="h-4 w-4" />
                    Remove admin
                  </button>
                )}
              </>
            )}

            {permissions.canRemoveMembers && (
              <>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => onRemove?.(member.userId)}
                  disabled={isProcessing}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"
                >
                  <RemoveIcon className="h-4 w-4" />
                  Remove from channel
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ShieldOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function RemoveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" x2="22" y1="11" y2="11" />
    </svg>
  );
}
