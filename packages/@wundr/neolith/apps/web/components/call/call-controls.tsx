'use client';

import { clsx } from 'clsx';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  MoreHorizontal,
  ChevronUp,
  Settings,
  MessageSquare,
  LayoutGrid,
} from 'lucide-react';
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
  /** Callback to toggle chat panel */
  onToggleChat?: () => void;
  /** Callback to toggle participants panel */
  onToggleParticipants?: () => void;
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
    <div className='relative' ref={dropdownRef}>
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
        aria-haspopup='listbox'
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
          role='listbox'
          aria-label={`${label} options`}
        >
          <div className='px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider'>
            {label}
          </div>
          {devices.map(device => (
            <button
              key={device.deviceId}
              onClick={() => {
                onSelect(device.deviceId);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full px-3 py-2 text-left text-sm',
                'hover:bg-accent transition-colors',
                selectedDevice === device.deviceId &&
                  'bg-accent text-accent-foreground',
              )}
              role='option'
              aria-selected={selectedDevice === device.deviceId}
            >
              <span className='truncate block'>{device.label}</span>
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
  onToggleChat,
  onToggleParticipants,
  isRecording,
}: {
  onOpenSettings?: () => void;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
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
    <div className='relative' ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-muted hover:bg-muted/80 transition-colors',
          'text-foreground',
        )}
        aria-label='More options'
        aria-expanded={isOpen}
        aria-haspopup='menu'
      >
        <MoreHorizontal className='w-5 h-5' />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute bottom-full mb-2 right-0',
            'min-w-[180px]',
            'bg-popover border border-border rounded-lg shadow-lg',
            'py-1 z-50',
          )}
          role='menu'
        >
          {onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                setIsOpen(false);
              }}
              className='w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2'
              role='menuitem'
            >
              <Settings className='w-4 h-4' />
              Settings
            </button>
          )}

          {onToggleChat && (
            <button
              onClick={() => {
                onToggleChat();
                setIsOpen(false);
              }}
              className='w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2'
              role='menuitem'
            >
              <MessageSquare className='w-4 h-4' />
              Chat
            </button>
          )}

          {onToggleParticipants && (
            <button
              onClick={() => {
                onToggleParticipants();
                setIsOpen(false);
              }}
              className='w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2'
              role='menuitem'
            >
              <LayoutGrid className='w-4 h-4' />
              View participants
            </button>
          )}

          {isRecording && (
            <div className='px-3 py-2 text-sm flex items-center gap-2 text-red-500'>
              <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
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
  onToggleChat,
  onToggleParticipants,
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
  const MicIcon = <Mic className='w-5 h-5' />;
  const MicOffIcon = <MicOff className='w-5 h-5' />;
  const VideoIcon = <Video className='w-5 h-5' />;
  const VideoOffIcon = <VideoOff className='w-5 h-5' />;
  const ScreenShareIcon = <Monitor className='w-5 h-5' />;
  const EndCallIcon = <PhoneOff className='w-5 h-5' />;
  const ChevronUpIcon = <ChevronUp className='w-3 h-3' />;

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-2 p-4',
        'bg-background/95 backdrop-blur-sm',
        'rounded-xl border border-border',
        className,
      )}
      role='toolbar'
      aria-label='Call controls'
    >
      {/* Audio controls */}
      <div className='flex items-center gap-1'>
        <ControlButton
          onClick={onToggleAudio}
          isActive={isAudioEnabled}
          icon={MicIcon}
          activeIcon={MicOffIcon}
          label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          shortcut='M'
        />
        {variant === 'full' &&
          onSelectAudioDevice &&
          audioDevices.length > 0 && (
            <DeviceSelector
              devices={audioDevices}
              selectedDevice={selectedAudioDevice}
              onSelect={onSelectAudioDevice}
              icon={ChevronUpIcon}
              label='Microphone'
            />
          )}
      </div>

      {/* Video controls */}
      <div className='flex items-center gap-1'>
        <ControlButton
          onClick={onToggleVideo}
          isActive={isVideoEnabled}
          icon={VideoIcon}
          activeIcon={VideoOffIcon}
          label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          shortcut='V'
        />
        {variant === 'full' &&
          onSelectVideoDevice &&
          videoDevices.length > 0 && (
            <DeviceSelector
              devices={videoDevices}
              selectedDevice={selectedVideoDevice}
              onSelect={onSelectVideoDevice}
              icon={ChevronUpIcon}
              label='Camera'
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
          shortcut='Shift+S'
        />
      )}

      {/* Divider */}
      <div className='w-px h-8 bg-border mx-2' />

      {/* End call */}
      <ControlButton
        onClick={onEndCall}
        isDestructive
        icon={EndCallIcon}
        label='End call'
        size='medium'
      />

      {/* More options */}
      {variant === 'full' && (
        <MoreOptionsMenu
          onOpenSettings={onOpenSettings}
          onToggleChat={onToggleChat}
          onToggleParticipants={onToggleParticipants}
          isRecording={isRecording}
        />
      )}
    </div>
  );
}

export default CallControls;
