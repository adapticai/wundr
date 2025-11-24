'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/notification';

interface NotificationItemProps {
  notification: Notification;
  onClick?: (notification: Notification) => void;
  onDismiss?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  className?: string;
}

export function NotificationItem({
  notification,
  onClick,
  onDismiss,
  onMarkAsRead,
  className,
}: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formattedTime = useMemo(() => {
    return formatRelativeTime(notification.createdAt);
  }, [notification.createdAt]);

  const handleClick = useCallback(() => {
    if (!notification.read) {
      onMarkAsRead?.(notification.id);
    }
    onClick?.(notification);
  }, [notification, onClick, onMarkAsRead]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = e.touches[0].clientX - touchStartRef.current;
    // Only allow left swipe (negative direction)
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -100));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset < -50) {
      setIsDismissing(true);
      setTimeout(() => {
        onDismiss?.(notification.id);
      }, 200);
    } else {
      setSwipeOffset(0);
    }
    touchStartRef.current = null;
  }, [swipeOffset, notification.id, onDismiss]);

  // Reset swipe on unmount or dismiss
  useEffect(() => {
    if (isDismissing) {
      setSwipeOffset(-100);
    }
  }, [isDismissing]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        isDismissing && 'opacity-0 transition-opacity duration-200',
        className
      )}
    >
      {/* Dismiss background */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end bg-destructive px-4 text-destructive-foreground',
          'w-[100px]'
        )}
      >
        <TrashIcon className="h-5 w-5" />
      </div>

      {/* Main content */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className={cn(
          'relative flex gap-3 px-4 py-3 cursor-pointer transition-all duration-150',
          'bg-background',
          !notification.read && 'bg-accent/30',
          isHovered && 'bg-accent/50'
        )}
      >
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <NotificationIcon type={notification.type} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm line-clamp-1',
                  !notification.read ? 'font-semibold text-foreground' : 'text-foreground'
                )}
              >
                {notification.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {notification.body}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
              {formattedTime}
            </span>
          </div>

          {/* Actor info */}
          {notification.actor && (
            <div className="mt-1 flex items-center gap-2">
              {notification.actor.image ? (
                <img
                  src={notification.actor.image}
                  alt={notification.actor.name}
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-medium text-primary-foreground">
                  {notification.actor.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {notification.actor.name}
              </span>
            </div>
          )}
        </div>

        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
            <span className="block h-2 w-2 rounded-full bg-primary" />
          </div>
        )}

        {/* Hover actions (desktop) */}
        {isHovered && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1">
            {!notification.read && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead?.(notification.id);
                }}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Mark as read"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss?.(notification.id);
              }}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              title="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationIconProps {
  type: NotificationType;
  className?: string;
}

function NotificationIcon({ type, className }: NotificationIconProps) {
  const iconClasses = cn(
    'h-8 w-8 rounded-full flex items-center justify-center',
    className
  );

  switch (type) {
    case 'message':
      return (
        <div className={cn(iconClasses, 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400')}>
          <MessageIcon className="h-4 w-4" />
        </div>
      );
    case 'mention':
      return (
        <div className={cn(iconClasses, 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400')}>
          <AtIcon className="h-4 w-4" />
        </div>
      );
    case 'reaction':
      return (
        <div className={cn(iconClasses, 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400')}>
          <EmojiIcon className="h-4 w-4" />
        </div>
      );
    case 'thread_reply':
      return (
        <div className={cn(iconClasses, 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400')}>
          <ThreadIcon className="h-4 w-4" />
        </div>
      );
    case 'channel_invite':
      return (
        <div className={cn(iconClasses, 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400')}>
          <InviteIcon className="h-4 w-4" />
        </div>
      );
    case 'call_incoming':
    case 'call_missed':
      return (
        <div className={cn(iconClasses, type === 'call_missed' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400')}>
          <PhoneIcon className="h-4 w-4" />
        </div>
      );
    case 'vp_update':
      return (
        <div className={cn(iconClasses, 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400')}>
          <BotIcon className="h-4 w-4" />
        </div>
      );
    case 'system':
    default:
      return (
        <div className={cn(iconClasses, 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
          <BellIcon className="h-4 w-4" />
        </div>
      );
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Icons
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

function EmojiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}

function ThreadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8" />
      <path d="M8 13h4" />
    </svg>
  );
}

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" x2="8" y1="16" y2="16" />
      <line x1="16" x2="16" y1="16" y2="16" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
