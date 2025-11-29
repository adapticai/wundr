'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string | undefined;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close menu on escape key
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  if (!isAuthenticated || !user) {
    return null;
  }

  // Map user data for UserAvatar - use name or email as fallback for initials
  const avatarUser = {
    name: user.name || user.email || 'User',
    image: user.image,
  };

  return (
    <div className={cn('relative', className)} ref={menuRef}>
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <UserAvatar user={avatarUser} size="md" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {/* User Info */}
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium text-foreground">{user.name || 'User'}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <MenuItem href={workspaceSlug ? `/${workspaceSlug}/settings/profile` : '/profile'} icon={<UserIcon />}>
              Profile
            </MenuItem>
            <MenuItem href={workspaceSlug ? `/${workspaceSlug}/user-settings/notifications` : '/settings'} icon={<SettingsIcon />}>
              Settings
            </MenuItem>
            <MenuItem href={workspaceSlug ? `/${workspaceSlug}/help` : '/help'} icon={<HelpIcon />}>
              Help & Support
            </MenuItem>
          </div>

          {/* Logout */}
          <div className="border-t py-1">
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent"
            >
              <LogoutIcon />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function MenuItem({ href, icon, children }: MenuItemProps) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
    >
      {icon}
      {children}
    </a>
  );
}

// Icons
function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

function HelpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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
