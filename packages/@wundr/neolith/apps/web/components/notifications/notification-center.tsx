'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { NotificationBadge } from './notification-badge';
import { NotificationItem } from './notification-item';

import type { Notification, NotificationType } from '@/types/notification';

type NotificationTab = 'all' | 'mentions' | 'messages' | 'calls';

/**
 * Props for the NotificationCenter component
 */
interface NotificationCenterProps {
  /** Array of notifications to display */
  notifications: Notification[];
  /** Total count of unread notifications */
  unreadCount: number;
  /** Whether notifications are currently loading */
  isLoading?: boolean;
  /** Whether there are more notifications to load */
  hasMore?: boolean;
  /** Callback when a notification is marked as read */
  onMarkAsRead: (id: string) => void;
  /** Callback when all notifications are marked as read */
  onMarkAllAsRead: () => void;
  /** Callback when a notification is dismissed */
  onDismiss: (id: string) => void;
  /** Callback when a notification is clicked */
  onNotificationClick: (notification: Notification) => void;
  /** Callback to load more notifications (infinite scroll) */
  onLoadMore?: () => void;
  /** Callback to open notification settings */
  onOpenSettings?: () => void;
  /** Optional CSS class name */
  className?: string;
}

const TABS: {
  id: NotificationTab;
  label: string;
  types: NotificationType[];
}[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'mentions', label: 'Mentions', types: ['mention'] },
  { id: 'messages', label: 'Messages', types: ['message', 'thread_reply'] },
  { id: 'calls', label: 'Calls', types: ['call_incoming', 'call_missed'] },
];

export function NotificationCenter({
  notifications,
  unreadCount,
  isLoading = false,
  hasMore = false,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onNotificationClick,
  onLoadMore,
  onOpenSettings,
  className,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter notifications by tab
  const filteredNotifications = notifications.filter(n => {
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab || tab.types.length === 0) {
      return true;
    }
    return tab.types.includes(n.type);
  });

  const unreadByTab = TABS.reduce(
    (acc, tab) => {
      if (tab.types.length === 0) {
        acc[tab.id] = unreadCount;
      } else {
        acc[tab.id] = notifications.filter(
          n => !n.read && tab.types.includes(n.type),
        ).length;
      }
      return acc;
    },
    {} as Record<NotificationTab, number>,
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      try {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      } catch (error) {
        console.error('Error handling outside click:', error);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    try {
      if (!scrollRef.current || !hasMore || isLoading) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        onLoadMore?.();
      }
    } catch (error) {
      console.error('Error handling scroll:', error);
    }
  }, [hasMore, isLoading, onLoadMore]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <Button
        variant='ghost'
        size='icon'
        onClick={handleToggle}
        className='relative rounded-full'
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <BellIcon className='h-5 w-5' />
        {unreadCount > 0 && (
          <span className='absolute -right-0.5 -top-0.5'>
            <NotificationBadge count={unreadCount} size='sm' showPulse />
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)]',
            'rounded-lg border bg-popover shadow-lg',
            'z-50',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200',
          )}
        >
          {/* Header */}
          <div className='flex items-center justify-between border-b px-4 py-3'>
            <h2 className='text-lg font-semibold font-heading text-stone-900 dark:text-stone-100'>
              Notifications
            </h2>
            <div className='flex items-center gap-2'>
              {unreadCount > 0 && (
                <Button
                  variant='link'
                  size='sm'
                  onClick={onMarkAllAsRead}
                  className='h-auto p-0 text-xs text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                >
                  Mark all as read
                </Button>
              )}
              <Button
                variant='ghost'
                size='icon'
                onClick={onOpenSettings}
                className='h-8 w-8'
                title='Notification settings'
              >
                <SettingsIcon className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className='flex border-b px-2'>
            {TABS.map(tab => (
              <Button
                key={tab.id}
                variant='ghost'
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors rounded-none font-sans',
                  activeTab === tab.id
                    ? 'text-stone-900 dark:text-stone-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100',
                )}
              >
                {tab.label}
                {unreadByTab[tab.id] > 0 && (
                  <span className='text-xs text-stone-500 dark:text-stone-500'>
                    ({unreadByTab[tab.id]})
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className='absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900 dark:bg-stone-100' />
                )}
              </Button>
            ))}
          </div>

          {/* Notification List */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className='max-h-[400px] overflow-y-auto'
          >
            {filteredNotifications.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <div className='divide-y'>
                {filteredNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={onNotificationClick}
                    onDismiss={onDismiss}
                    onMarkAsRead={onMarkAsRead}
                  />
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className='flex items-center justify-center py-4'>
                <LoadingSpinner />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  tab: NotificationTab;
}

function EmptyState({ tab }: EmptyStateProps) {
  const getMessage = () => {
    switch (tab) {
      case 'mentions':
        return 'No mentions yet';
      case 'messages':
        return 'No messages yet';
      case 'calls':
        return 'No calls yet';
      default:
        return 'No notifications yet';
    }
  };

  return (
    <div className='flex flex-col items-center justify-center py-12 text-center'>
      <div className='mb-3 rounded-full bg-stone-100 dark:bg-stone-800 p-3'>
        <BellOffIcon className='h-6 w-6 text-stone-400 dark:text-stone-600' />
      </div>
      <p className='text-sm text-stone-600 dark:text-stone-400 font-sans'>
        {getMessage()}
      </p>
      <p className='mt-1 text-xs text-stone-500 dark:text-stone-500 font-sans'>
        You&apos;re all caught up!
      </p>
    </div>
  );
}

// Icons
function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
      <path d='M13.73 21a2 2 0 0 1-3.46 0' />
    </svg>
  );
}

function BellOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M13.73 21a2 2 0 0 1-3.46 0' />
      <path d='M18.63 13A17.89 17.89 0 0 1 18 8' />
      <path d='M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14' />
      <path d='M18 8a6 6 0 0 0-9.33-5' />
      <line x1='1' y1='1' x2='23' y2='23' />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='3' />
      <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className='h-5 w-5 animate-spin text-primary'
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
      />
    </svg>
  );
}
