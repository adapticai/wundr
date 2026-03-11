'use client';

import * as React from 'react';
import type { UserProfile } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

export type NotificationSeverity = 'error' | 'warning' | 'success' | 'info';

export interface Notification {
  id: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  timestamp: Date;
  read: boolean;
}

// ---------------------------------------------------------------------------
// User context
// ---------------------------------------------------------------------------

interface UserContextValue {
  user: UserProfile | null;
  isLoading: boolean;
}

const UserContext = React.createContext<UserContextValue>({
  user: null,
  isLoading: false,
});

export interface UserProviderProps {
  children: React.ReactNode;
  /**
   * Optional pre-resolved user. Pass this from a server component or an auth
   * session once a real auth system is in place. When omitted the context
   * defaults to the unauthenticated state.
   */
  user?: UserProfile | null;
}

export function UserProvider({ children, user = null }: UserProviderProps) {
  // isLoading could be wired to a real session fetch in the future.
  const [isLoading] = React.useState(false);

  const value = React.useMemo<UserContextValue>(
    () => ({ user, isLoading }),
    [user, isLoading]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  return React.useContext(UserContext);
}

// ---------------------------------------------------------------------------
// Notifications context
// ---------------------------------------------------------------------------

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
}

const NotificationsContext = React.createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => undefined,
});

export interface NotificationsProviderProps {
  children: React.ReactNode;
  /**
   * Seed notifications from outside (e.g. fetched on the server). When
   * omitted the list starts empty, ready for a real API/WebSocket hook.
   */
  initialNotifications?: Notification[];
}

export function NotificationsProvider({
  children,
  initialNotifications = [],
}: NotificationsProviderProps) {
  const [notifications, setNotifications] =
    React.useState<Notification[]>(initialNotifications);

  const unreadCount = React.useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const markAllRead = React.useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const value = React.useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, markAllRead }),
    [notifications, unreadCount, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return React.useContext(NotificationsContext);
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

/** Map a notification severity to the dot colour class used in the UI. */
export function severityDotClass(severity: NotificationSeverity): string {
  switch (severity) {
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'success':
      return 'bg-green-500';
    case 'info':
    default:
      return 'bg-blue-500';
  }
}
