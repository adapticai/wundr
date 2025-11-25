'use client';

import { clsx } from 'clsx';
import { useCallback } from 'react';

/**
 * Props for the CallHeader component.
 */
export interface CallHeaderProps {
  /** Name of the call room */
  roomName: string;
  /** Optional channel name if call is associated with a channel */
  channelName?: string;
  /** Number of participants in the call */
  participantCount: number;
  /** Formatted call duration string */
  duration: string;
  /** Whether the call is being recorded */
  isRecording?: boolean;
  /** Callback to minimize the call view */
  onMinimize?: () => void;
  /** Callback to open settings */
  onOpenSettings?: () => void;
  /** Callback to toggle participant list visibility */
  onToggleParticipantList?: () => void;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Call header component displaying room info, duration, and controls
 */
export function CallHeader({
  roomName,
  channelName,
  participantCount,
  duration,
  isRecording = false,
  onMinimize,
  onOpenSettings,
  onToggleParticipantList,
  className,
}: CallHeaderProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, action?: () => void) => {
      if ((event.key === 'Enter' || event.key === ' ') && action) {
        event.preventDefault();
        action();
      }
    },
    [],
  );

  return (
    <header
      className={clsx(
        'flex items-center justify-between',
        'px-4 py-3',
        'bg-background/95 backdrop-blur-sm',
        'border-b border-border',
        className,
      )}
      role="banner"
    >
      {/* Left section - Room info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Room/Channel name */}
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">
            {channelName || roomName}
          </h1>
          {channelName && (
            <p className="text-xs text-muted-foreground truncate">{roomName}</p>
          )}
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1',
              'bg-red-500/10 text-red-500 rounded-full',
              'text-xs font-medium',
            )}
            role="status"
            aria-live="polite"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>Recording</span>
          </div>
        )}
      </div>

      {/* Center section - Duration */}
      <div className="flex items-center gap-4">
        <div
          className={clsx(
            'px-3 py-1 rounded-full',
            'bg-muted text-foreground',
            'text-sm font-mono tabular-nums',
          )}
          role="timer"
          aria-label={`Call duration: ${duration}`}
        >
          {duration}
        </div>
      </div>

      {/* Right section - Controls */}
      <div className="flex items-center gap-2">
        {/* Participant count */}
        <button
          onClick={onToggleParticipantList}
          onKeyDown={(e) => handleKeyDown(e, onToggleParticipantList)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5',
            'rounded-lg',
            'bg-muted hover:bg-muted/80',
            'text-sm text-foreground',
            'transition-colors',
          )}
          aria-label={`${participantCount} participants. Click to view list.`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{participantCount}</span>
        </button>

        {/* Settings button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            onKeyDown={(e) => handleKeyDown(e, onOpenSettings)}
            className={clsx(
              'w-8 h-8 rounded-lg',
              'flex items-center justify-center',
              'bg-muted hover:bg-muted/80',
              'text-muted-foreground hover:text-foreground',
              'transition-colors',
            )}
            aria-label="Open settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}

        {/* Minimize button */}
        {onMinimize && (
          <button
            onClick={onMinimize}
            onKeyDown={(e) => handleKeyDown(e, onMinimize)}
            className={clsx(
              'w-8 h-8 rounded-lg',
              'flex items-center justify-center',
              'bg-muted hover:bg-muted/80',
              'text-muted-foreground hover:text-foreground',
              'transition-colors',
            )}
            aria-label="Minimize call"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

export default CallHeader;
