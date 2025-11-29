'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import { cn, getInitials } from '@/lib/utils';

import type { Notification, NotificationType, NotificationPriority } from '@/types/notification';

/**
 * Props for the NotificationToast component
 */
interface NotificationToastProps {
  /** The notification to display */
  notification: Notification;
  /** Duration in milliseconds before auto-dismiss (0 for no auto-dismiss) */
  duration?: number;
  /** Whether to play a sound when the toast appears */
  soundEnabled?: boolean;
  /** Callback when the toast is clicked */
  onClick?: (notification: Notification) => void;
  /** Callback when the toast is closed */
  onClose?: (id: string) => void;
  /** Optional CSS class name */
  className?: string;
}

export function NotificationToast({
  notification,
  duration = 5000,
  soundEnabled = false,
  onClick,
  onClose,
  className,
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.(notification.id);
    }, 200);
  }, [notification.id, onClose]);

  const handleClick = useCallback(() => {
    onClick?.(notification);
    handleClose();
  }, [notification, onClick, handleClose]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(handleClose, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, handleClose]);

  // Play sound
  useEffect(() => {
    if (soundEnabled && notification.priority !== 'low') {
      // Use Web Audio API for better browser support
      try {
        audioRef.current = new Audio('/sounds/notification.mp3');
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch((error: Error) => {
          // Silently fail if audio can't play (e.g., user hasn't interacted with page)
          // This is expected behavior due to browser autoplay policies
          console.debug('Notification sound blocked:', error.message);
        });
      } catch (error) {
        // Audio not supported or other initialization errors
        console.debug('Notification sound initialization failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          // Ignore cleanup errors
          console.debug('Audio cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
        }
        audioRef.current = null;
      }
    };
  }, [soundEnabled, notification.priority]);

  // Pause timer on hover
  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(handleClose, duration / 2);
    }
  }, [duration, handleClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border bg-popover shadow-lg',
        'transition-all duration-200',
        isExiting
          ? 'translate-x-full opacity-0'
          : 'animate-in slide-in-from-right-full fade-in-0',
        className,
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <ToastIcon type={notification.type} priority={notification.priority} />

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={handleClick}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-semibold text-foreground line-clamp-1">
                  {notification.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                  {notification.body}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close notification"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Actor info */}
            {/* eslint-disable-next-line @next/next/no-img-element */}

            {notification.actor && (
              <div className="mt-2 flex items-center gap-2">
                {notification.actor.image ? (
                  <img
                    src={notification.actor.image}
                    alt={notification.actor.name}
                    className="h-5 w-5 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[10px] font-medium text-primary-foreground">
                    {getInitials(notification.actor.name)}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {notification.actor.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {duration > 0 && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all ease-linear"
              style={{
                animation: isExiting ? 'none' : `shrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Props for the ToastContainer component
 */
interface ToastContainerProps {
  /** Toast elements to render */
  children: React.ReactNode;
  /** Position of the toast container on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Optional CSS class name */
  className?: string;
}

export function ToastContainer({
  children,
  position = 'top-right',
  className,
}: ToastContainerProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-50 flex flex-col gap-2',
        positionClasses[position],
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </div>
  );
}

interface ToastIconProps {
  type: NotificationType;
  priority: NotificationPriority;
}

function ToastIcon({ type, priority }: ToastIconProps) {
  const baseClasses = 'h-8 w-8 rounded-full flex items-center justify-center shrink-0';

  if (priority === 'urgent') {
    return (
      <div className={cn(baseClasses, 'bg-destructive/10 text-destructive')}>
        <AlertIcon className="h-4 w-4" />
      </div>
    );
  }

  switch (type) {
    case 'message':
    case 'mention':
    case 'thread_reply':
      return (
        <div className={cn(baseClasses, 'bg-primary/10 text-primary')}>
          <MessageIcon className="h-4 w-4" />
        </div>
      );
    case 'call_incoming':
      return (
        <div className={cn(baseClasses, 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400')}>
          <PhoneIcon className="h-4 w-4" />
        </div>
      );
    case 'call_missed':
      return (
        <div className={cn(baseClasses, 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400')}>
          <PhoneMissedIcon className="h-4 w-4" />
        </div>
      );
    case 'channel_invite':
      return (
        <div className={cn(baseClasses, 'bg-stone-100 text-stone-600 dark:bg-stone-900/30 dark:text-stone-400')}>
          <UserPlusIcon className="h-4 w-4" />
        </div>
      );
    default:
      return (
        <div className={cn(baseClasses, 'bg-muted text-muted-foreground')}>
          <BellIcon className="h-4 w-4" />
        </div>
      );
  }
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

function PhoneMissedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="23" x2="17" y1="1" y2="7" />
      <line x1="17" x2="23" y1="1" y2="7" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
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

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
