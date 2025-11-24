'use client';

import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOnline: boolean;
  queuedActions?: number;
  syncProgress?: number;
  onRetry?: () => void;
  className?: string;
}

export function OfflineIndicator({
  isOnline,
  queuedActions = 0,
  syncProgress,
  onRetry,
  className,
}: OfflineIndicatorProps) {
  const [wasOffline, setWasOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  // Track transition from offline to online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything when online and not transitioning
  if (isOnline && !showBackOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'transition-all duration-300',
        className,
      )}
    >
      {showBackOnline ? (
        <BackOnlineBanner />
      ) : (
        <OfflineBanner
          queuedActions={queuedActions}
          syncProgress={syncProgress}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

interface OfflineBannerProps {
  queuedActions: number;
  syncProgress?: number;
  onRetry?: () => void;
}

function OfflineBanner({ queuedActions, syncProgress, onRetry }: OfflineBannerProps) {
  return (
    <div className="bg-destructive text-destructive-foreground">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
          <OfflineIcon className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">You&apos;re offline</p>
            {queuedActions > 0 && (
              <p className="text-xs opacity-90">
                {queuedActions} action{queuedActions !== 1 ? 's' : ''} waiting to sync
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {syncProgress !== undefined && syncProgress > 0 && syncProgress < 100 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-destructive-foreground/20">
                <div
                  className="h-full bg-destructive-foreground transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <span className="text-xs">{syncProgress}%</span>
            </div>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-md bg-destructive-foreground/10 px-3 py-1 text-xs font-medium hover:bg-destructive-foreground/20 transition-colors"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BackOnlineBanner() {
  return (
    <div className="bg-green-600 text-white animate-in slide-in-from-top duration-300">
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2">
        <OnlineIcon className="h-5 w-5" />
        <p className="text-sm font-medium">You&apos;re back online</p>
      </div>
    </div>
  );
}

/**
 * Floating offline indicator for bottom of screen
 */
interface FloatingOfflineIndicatorProps {
  isOnline: boolean;
  queuedActions?: number;
  className?: string;
}

export function FloatingOfflineIndicator({
  isOnline,
  queuedActions = 0,
  className,
}: FloatingOfflineIndicatorProps) {
  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 rounded-full bg-destructive px-4 py-2 shadow-lg',
        'text-destructive-foreground',
        'animate-in slide-in-from-bottom-4 fade-in-0 duration-300',
        className,
      )}
    >
      <OfflineIcon className="h-4 w-4" />
      <span className="text-sm font-medium">Offline</span>
      {queuedActions > 0 && (
        <>
          <span className="text-xs opacity-75">|</span>
          <span className="text-xs opacity-90">
            {queuedActions} pending
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Hook to detect online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Icons
function OfflineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" x2="23" y1="1" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" x2="12.01" y1="20" y2="20" />
    </svg>
  );
}

function OnlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" x2="12.01" y1="20" y2="20" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
