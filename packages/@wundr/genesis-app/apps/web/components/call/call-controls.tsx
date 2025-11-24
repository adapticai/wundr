'use client';

import { clsx } from 'clsx';
import { useState, useCallback, useRef, useEffect } from 'react';

import type { MediaDevice } from '@/types/call';

/**
 * Props for the CallControls component.
 */
export interface CallControlsProps {
  /** Whether the microphone is currently enabled */
  isAudioEnabled: boolean;
  /** Whether the camera is currently enabled */
  isVideoEnabled: boolean;
  /** Whether screen sharing is active */
  isScreenSharing: boolean;
  /** Whether the call is being recorded */
  isRecording?: boolean;
  /** Callback to toggle microphone on/off */
  onToggleAudio: () => void;
  /** Callback to toggle camera on/off */
  onToggleVideo: () => void;
  /** Callback to toggle screen sharing */
  onToggleScreenShare: () => void;
  /** Callback to end the call */
  onEndCall: () => void;
  /** Callback to open settings dialog */
  onOpenSettings?: () => void;
  /** Available audio input devices */
  audioDevices?: MediaDevice[];
  /** Available video input devices */
  videoDevices?: MediaDevice[];
  /** Currently selected audio device ID */
  selectedAudioDevice?: string;
  /** Currently selected video device ID */
  selectedVideoDevice?: string;
  /** Callback when audio device is changed */
  onSelectAudioDevice?: (deviceId: string) => void;
  /** Callback when video device is changed */
  onSelectVideoDevice?: (deviceId: string) => void;
  /** Additional CSS classes to apply */
  className?: string;
  /** Control bar variant: full (all options) or minimal */
  variant?: 'full' | 'minimal';
}

/**
 * Device selector dropdown component
 */
function DeviceSelector({
  devices,
  selectedDevice,
  onSelect,
  icon,
  label,
}: {
  devices: MediaDevice[];
  selectedDevice?: string;
  onSelect: (deviceId: string) => void;
  icon: React.ReactNode;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      } else if (event.key === 'Enter' || event.key === ' ') {
        setIsOpen(!isOpen);
      }
    },
    [isOpen],
  );

  if (devices.length === 0) {
return null;
}

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-muted hover:bg-muted/80 transition-colors',
          'text-muted-foreground hover:text-foreground',
        )}
        aria-label={`Select ${label}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {icon}
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute bottom-full mb-2 left-1/2 -translate-x-1/2',
            'min-w-[200px] max-w-[300px]',
            'bg-popover border border-border rounded-lg shadow-lg',
            'py-1 z-50',
          )}
          role="listbox"
          aria-label={`${label} options`}
        >
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
          {devices.map((device) => (
            <button
              key={device.deviceId}
              onClick={() => {
                onSelect(device.deviceId);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full px-3 py-2 text-left text-sm',
                'hover:bg-accent transition-colors',
                selectedDevice === device.deviceId && 'bg-accent text-accent-foreground',
              )}
              role="option"
              aria-selected={selectedDevice === device.deviceId}
            >
              <span className="truncate block">{device.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Control button component
 */
function ControlButton({
  onClick,
  isActive,
  isDestructive = false,
  icon,
  activeIcon,
  label,
  shortcut,
  disabled = false,
  size = 'medium',
}: {
  onClick: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}) {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-14 h-14',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'rounded-full flex items-center justify-center transition-all duration-200',
        sizeClasses[size],
        isDestructive
          ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
          : isActive === false
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-muted hover:bg-muted/80 text-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={isActive}
    >
      {isActive === false && activeIcon ? activeIcon : icon}
    </button>
  );
}

/**
 * More options menu component
 */
function MoreOptionsMenu({
  onOpenSettings,
  isRecording,
}: {
  onOpenSettings?: () => void;
  isRecording?: boolean;
}) {
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-muted hover:bg-muted/80 transition-colors',
          'text-foreground',
        )}
        aria-label="More options"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute bottom-full mb-2 right-0',
            'min-w-[180px]',
            'bg-popover border border-border rounded-lg shadow-lg',
            'py-1 z-50',
          )}
          role="menu"
        >
          {onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
              role="menuitem"
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
              Settings
            </button>
          )}

          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            role="menuitem"
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
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </button>

          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            role="menuitem"
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
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            View participants
          </button>

          {isRecording && (
            <div className="px-3 py-2 text-sm flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording in progress
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Call controls component with media toggles and device selection
 */
export function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  isRecording = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onOpenSettings,
  audioDevices = [],
  videoDevices = [],
  selectedAudioDevice,
  selectedVideoDevice,
  onSelectAudioDevice,
  onSelectVideoDevice,
  className,
  variant = 'full',
}: CallControlsProps) {
  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'm':
          onToggleAudio();
          break;
        case 'v':
          onToggleVideo();
          break;
        case 's':
          if (event.shiftKey) {
            onToggleScreenShare();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleAudio, onToggleVideo, onToggleScreenShare]);

  // Icons
  const MicIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );

  const MicOffIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );

  const VideoIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </svg>
  );

  const VideoOffIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );

  const ScreenShareIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );

  const EndCallIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      <line x1="1" x2="23" y1="1" y2="23" />
    </svg>
  );

  const ChevronUpIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-2 p-4',
        'bg-background/95 backdrop-blur-sm',
        'rounded-xl border border-border',
        className,
      )}
      role="toolbar"
      aria-label="Call controls"
    >
      {/* Audio controls */}
      <div className="flex items-center gap-1">
        <ControlButton
          onClick={onToggleAudio}
          isActive={isAudioEnabled}
          icon={MicIcon}
          activeIcon={MicOffIcon}
          label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          shortcut="M"
        />
        {variant === 'full' && onSelectAudioDevice && audioDevices.length > 0 && (
          <DeviceSelector
            devices={audioDevices}
            selectedDevice={selectedAudioDevice}
            onSelect={onSelectAudioDevice}
            icon={ChevronUpIcon}
            label="Microphone"
          />
        )}
      </div>

      {/* Video controls */}
      <div className="flex items-center gap-1">
        <ControlButton
          onClick={onToggleVideo}
          isActive={isVideoEnabled}
          icon={VideoIcon}
          activeIcon={VideoOffIcon}
          label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          shortcut="V"
        />
        {variant === 'full' && onSelectVideoDevice && videoDevices.length > 0 && (
          <DeviceSelector
            devices={videoDevices}
            selectedDevice={selectedVideoDevice}
            onSelect={onSelectVideoDevice}
            icon={ChevronUpIcon}
            label="Camera"
          />
        )}
      </div>

      {/* Screen share */}
      {variant === 'full' && (
        <ControlButton
          onClick={onToggleScreenShare}
          isActive={!isScreenSharing}
          icon={ScreenShareIcon}
          label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          shortcut="Shift+S"
        />
      )}

      {/* Divider */}
      <div className="w-px h-8 bg-border mx-2" />

      {/* End call */}
      <ControlButton
        onClick={onEndCall}
        isDestructive
        icon={EndCallIcon}
        label="End call"
        size="medium"
      />

      {/* More options */}
      {variant === 'full' && (
        <MoreOptionsMenu onOpenSettings={onOpenSettings} isRecording={isRecording} />
      )}
    </div>
  );
}

export default CallControls;
