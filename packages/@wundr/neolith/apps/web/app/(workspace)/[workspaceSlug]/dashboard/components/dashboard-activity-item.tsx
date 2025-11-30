'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardActivityItemProps {
  /** User who performed the action */
  user: {
    name: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  };
  /** Action description with entity information */
  action: {
    type: string;
    description: string;
    entityType?: string;
    entityName?: string;
    entityId?: string;
  };
  /** Timestamp of the activity */
  timestamp: Date | string;
  /** Optional quick action button */
  quickAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Optional link to the related entity */
  href?: string;
  /** Optional className */
  className?: string;
}

/**
 * Get initials from a name
 */
function getInitials(name: string | null): string {
  if (!name) return '?';

  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Format relative timestamp
 */
function formatRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'recently';
  }
}

export function DashboardActivityItem({
  user,
  action,
  timestamp,
  quickAction,
  href,
  className,
}: DashboardActivityItemProps) {
  const displayName = user.displayName || user.name || user.email || 'Unknown user';
  const initials = getInitials(displayName);
  const relativeTime = formatRelativeTime(timestamp);

  const content = (
    <div className={cn('flex items-start gap-3 py-3', className)}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={user.avatarUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{displayName}</span>
              {' '}
              <span className="text-muted-foreground">{action.description}</span>
              {action.entityName && (
                <>
                  {' '}
                  <span className="font-medium">{action.entityName}</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {relativeTime}
            </p>
          </div>

          {quickAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={quickAction.onClick}
              className="flex-shrink-0"
            >
              {quickAction.icon}
              {quickAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block hover:bg-accent/50 rounded-lg px-2 -mx-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return <div className="px-2">{content}</div>;
}
