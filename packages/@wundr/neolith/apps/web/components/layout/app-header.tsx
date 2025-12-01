'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import { NotificationCenter } from '@/components/notifications/notification-center';
import { useNotifications } from '@/hooks/use-notifications';
import { ThemeToggle } from './theme-toggle';
import { getInitials } from '@/lib/utils';

import type { Notification } from '@/types/notification';

interface AppHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  /** Compact mode for use inside SidebarInset header */
  compact?: boolean;
}

export function AppHeader({ user, compact = false }: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  // Use the notifications hook
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    markAsRead,
    markAllAsRead,
    dismiss,
    loadMore,
  } = useNotifications();

  // Handle notification click - navigate to the action URL
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read first
      if (!notification.read) {
        markAsRead(notification.id);
      }
      // Navigate to the action URL if available
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
      }
    },
    [markAsRead, router]
  );

  // Handle opening notification settings
  const handleOpenSettings = useCallback(() => {
    router.push('/settings/notifications');
  }, [router]);

  // Compact mode: render only the action buttons without the header wrapper
  if (compact) {
    return (
      <div className='flex items-center gap-2'>
        {/* Notifications */}
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          hasMore={hasMore}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDismiss={dismiss}
          onNotificationClick={handleNotificationClick}
          onLoadMore={loadMore}
          onOpenSettings={handleOpenSettings}
        />

        {/* Theme Toggle */}
        <ThemeToggle variant='compact' />
      </div>
    );
  }

  return (
    <header className='sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      {/* Page Title / Breadcrumb placeholder */}
      <div className='flex items-center gap-4'>
        <h1 className='text-lg font-semibold'>Dashboard</h1>
      </div>

      {/* Right Side Actions */}
      <div className='flex items-center gap-4'>
        {/* Notifications */}
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          hasMore={hasMore}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDismiss={dismiss}
          onNotificationClick={handleNotificationClick}
          onLoadMore={loadMore}
          onOpenSettings={handleOpenSettings}
        />

        {/* Theme Toggle */}
        <ThemeToggle variant='compact' />

        {/* User Menu */}
        <div className='relative'>
          <button
            type='button'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className='flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent'
            aria-label='User menu'
            aria-expanded={isMenuOpen}
          >
            <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground'>
              {getInitials(user?.name ?? '')}
            </div>
            <ChevronDownIcon />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <>
              <div
                className='fixed inset-0 z-40'
                onClick={() => setIsMenuOpen(false)}
                onKeyDown={e => e.key === 'Escape' && setIsMenuOpen(false)}
                role='button'
                tabIndex={0}
                aria-label='Close menu'
              />
              <div className='absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border bg-card p-1 shadow-lg animate-fade-in'>
                {/* User Info */}
                <div className='border-b px-3 py-2'>
                  <p className='font-medium'>{user?.name || 'User'}</p>
                  <p className='text-sm text-muted-foreground'>
                    {user?.email || 'user@example.com'}
                  </p>
                </div>

                {/* Menu Items */}
                <div className='py-1'>
                  <MenuItem
                    href='/settings'
                    label='Settings'
                    icon={<SettingsIcon />}
                  />
                  <MenuItem
                    href='/settings/profile'
                    label='Profile'
                    icon={<UserIcon />}
                  />
                  <MenuItem
                    href='/settings/billing'
                    label='Billing'
                    icon={<CreditCardIcon />}
                  />
                </div>

                {/* Sign Out */}
                <div className='border-t py-1'>
                  <button
                    type='button'
                    onClick={async () => {
                      await signOut({ callbackUrl: '/login' });
                    }}
                    className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent'
                  >
                    <LogOutIcon />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

interface MenuItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function MenuItem({ href, label, icon }: MenuItemProps) {
  return (
    <a
      href={href}
      className='flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent'
    >
      {icon}
      {label}
    </a>
  );
}

// Icons
function ChevronDownIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect width='20' height='14' x='2' y='5' rx='2' />
      <line x1='2' x2='22' y1='10' y2='10' />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
      <polyline points='16 17 21 12 16 7' />
      <line x1='21' x2='9' y1='12' y2='12' />
    </svg>
  );
}
