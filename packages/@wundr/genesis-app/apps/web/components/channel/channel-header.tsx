'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Channel, ChannelPermissions } from '@/types/channel';

interface ChannelHeaderProps {
  channel: Channel;
  permissions: ChannelPermissions;
  onToggleStar?: (isStarred: boolean) => Promise<void>;
  onLeave?: () => Promise<void>;
  onOpenSettings?: () => void;
  onOpenMembers?: () => void;
  className?: string;
}

export function ChannelHeader({
  channel,
  permissions,
  onToggleStar,
  onLeave,
  onOpenSettings,
  onOpenMembers,
  className,
}: ChannelHeaderProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isStarring, setIsStarring] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleToggleStar = useCallback(async () => {
    if (isStarring) return;
    setIsStarring(true);
    try {
      await onToggleStar?.(channel.isStarred || false);
    } finally {
      setIsStarring(false);
    }
  }, [channel.isStarred, isStarring, onToggleStar]);

  const handleLeave = useCallback(async () => {
    setShowMenu(false);
    await onLeave?.();
  }, [onLeave]);

  return (
    <div className={cn('border-b bg-card', className)}>
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left: Channel info */}
        <div className="flex items-center gap-3 min-w-0">
          <ChannelTypeIcon type={channel.type} className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-semibold text-foreground">
                {channel.name}
              </h1>
              {channel.isArchived && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  Archived
                </span>
              )}
            </div>
            {channel.description && (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className={cn(
                  'text-left text-xs text-muted-foreground hover:text-foreground',
                  !isDescriptionExpanded && 'truncate max-w-xs'
                )}
              >
                {channel.description}
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Member count */}
          <button
            type="button"
            onClick={onOpenMembers}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            title="View members"
          >
            <MembersIcon className="h-4 w-4" />
            <span>{channel.memberCount}</span>
            {/* Avatar stack */}
            <div className="ml-1 flex -space-x-2">
              {channel.members.slice(0, 3).map((member, index) => (
                <div
                  key={member.userId}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium"
                  style={{ zIndex: 3 - index }}
                >
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
              ))}
              {channel.memberCount > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">
                  +{channel.memberCount - 3}
                </div>
              )}
            </div>
          </button>

          {/* Star button */}
          <button
            type="button"
            onClick={handleToggleStar}
            disabled={isStarring}
            className={cn(
              'rounded-md p-2 transition-colors',
              channel.isStarred
                ? 'text-yellow-500 hover:bg-accent'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            title={channel.isStarred ? 'Unstar channel' : 'Star channel'}
          >
            {channel.isStarred ? (
              <StarFilledIcon className="h-5 w-5" />
            ) : (
              <StarIcon className="h-5 w-5" />
            )}
          </button>

          {/* Settings (if admin) */}
          {permissions.canEdit && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Channel settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          )}

          {/* Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreIcon className="h-5 w-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border bg-card py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={onOpenMembers}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    <MembersIcon className="h-4 w-4" />
                    View members
                  </button>
                  {permissions.canInvite && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        // Open invite dialog - handled by parent
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <InviteIcon className="h-4 w-4" />
                      Invite people
                    </button>
                  )}
                  {permissions.canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onOpenSettings?.();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <EditIcon className="h-4 w-4" />
                      Edit channel
                    </button>
                  )}
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                  >
                    <LeaveIcon className="h-4 w-4" />
                    Leave channel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded description */}
      {channel.description && isDescriptionExpanded && (
        <div className="border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">{channel.description}</p>
        </div>
      )}
    </div>
  );
}

function ChannelTypeIcon({
  type,
  className,
}: {
  type: 'public' | 'private' | 'direct';
  className?: string;
}) {
  if (type === 'private') {
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
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }

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
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3 8 21" />
      <path d="M16 3 14 21" />
    </svg>
  );
}

function MembersIcon({ className }: { className?: string }) {
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
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
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
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function InviteIcon({ className }: { className?: string }) {
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
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function LeaveIcon({ className }: { className?: string }) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
