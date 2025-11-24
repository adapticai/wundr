'use client';

import { clsx } from 'clsx';
import { useState, useEffect, useRef, useCallback } from 'react';

import { useLocalMedia } from '@/hooks/use-call';

import type { MediaDevice } from '@/types/call';

export interface PreJoinProps {
  roomName: string;
  userName?: string;
  onJoin: (settings: {
    videoEnabled: boolean;
    audioEnabled: boolean;
    userName: string;
  }) => void;
  onCancel?: () => void;
  className?: string;
  requireName?: boolean;
}

/**
 * Device selector dropdown for pre-join screen
 */
function DeviceSelect({
  devices,
  selectedDevice,
  onSelect,
  label,
  disabled = false,
}: {
  devices: MediaDevice[];
  selectedDevice?: string;
  onSelect: (deviceId: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <select
        value={selectedDevice || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled || devices.length === 0}
        className={clsx(
          'w-full px-3 py-2 rounded-lg',
          'bg-muted border border-border',
          'text-sm text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        aria-label={label}
      >
        {devices.length === 0 ? (
          <option value="">No devices available</option>
        ) : (
          devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

/**
 * Audio level indicator showing microphone input level
 */
function AudioLevelIndicator({
  audioTrack,
  isEnabled,
}: {
  audioTrack: MediaStreamTrack | null;
  isEnabled: boolean;
}) {
  const [level, setLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioTrack || !isEnabled) {
      setLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) {
return;
}

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setLevel(Math.min(100, average));

      animationRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [audioTrack, isEnabled]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Mic level:</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-75',
            level > 70 ? 'bg-green-500' : level > 30 ? 'bg-yellow-500' : 'bg-muted-foreground',
          )}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Pre-join screen for video calls
 * Allows users to preview camera, test microphone, and configure devices before joining
 */
export function PreJoin({
  roomName,
  userName: initialUserName = '',
  onJoin,
  onCancel,
  className,
  requireName = false,
}: PreJoinProps) {
  const [userName, setUserName] = useState(initialUserName);
  const [isJoining, setIsJoining] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const {
    videoTrack,
    audioTrack,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    enableVideo,
    enableAudio,
    disableVideo,
    disableAudio,
    devices,
    selectedVideoDevice,
    selectedAudioDevice,
    setVideoDevice,
    setAudioDevice,
    error,
    enumerateDevices,
  } = useLocalMedia();

  // Initialize devices on mount
  useEffect(() => {
    // Request permissions and enable devices
    const initDevices = async () => {
      await enumerateDevices();
      await enableVideo();
      await enableAudio();
    };

    initDevices();

    return () => {
      disableVideo();
      disableAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach video track to preview element
  useEffect(() => {
    if (videoTrack && videoPreviewRef.current) {
      videoTrack.attach(videoPreviewRef.current);
      return () => {
        videoTrack.detach(videoPreviewRef.current!);
      };
    }
  }, [videoTrack]);

  // Handle join
  const handleJoin = useCallback(async () => {
    if (requireName && !userName.trim()) {
      return;
    }

    setIsJoining(true);

    try {
      onJoin({
        videoEnabled: isVideoEnabled,
        audioEnabled: isAudioEnabled,
        userName: userName.trim() || 'Guest',
      });
    } finally {
      setIsJoining(false);
    }
  }, [requireName, userName, isVideoEnabled, isAudioEnabled, onJoin]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        handleJoin();
      } else if (event.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJoin, onCancel]);

  const canJoin = !requireName || userName.trim().length > 0;

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center min-h-screen p-6',
        'bg-background',
        className,
      )}
    >
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Ready to join?</h1>
          <p className="text-muted-foreground">
            Joining <span className="font-medium text-foreground">{roomName}</span>
          </p>
        </div>

        {/* Video preview */}
        <div
          className={clsx(
            'relative aspect-video rounded-xl overflow-hidden',
            'bg-muted border border-border',
          )}
        >
          {isVideoEnabled && videoTrack ? (
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-10 h-10 text-primary"
                  >
                    <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
                    <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">Camera is off</p>
              </div>
            </div>
          )}

          {/* Media toggle buttons overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <button
              onClick={toggleAudio}
              className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                isAudioEnabled
                  ? 'bg-muted hover:bg-muted/80 text-foreground'
                  : 'bg-red-500 hover:bg-red-600 text-white',
              )}
              aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isAudioEnabled ? (
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
              ) : (
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
              )}
            </button>

            <button
              onClick={toggleVideo}
              className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                isVideoEnabled
                  ? 'bg-muted hover:bg-muted/80 text-foreground'
                  : 'bg-red-500 hover:bg-red-600 text-white',
              )}
              aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {isVideoEnabled ? (
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
              ) : (
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
              )}
            </button>
          </div>
        </div>

        {/* Audio level indicator */}
        {isAudioEnabled && audioTrack && (
          <AudioLevelIndicator
            audioTrack={audioTrack.mediaStreamTrack}
            isEnabled={isAudioEnabled}
          />
        )}

        {/* Error display */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error.message}
          </div>
        )}

        {/* Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DeviceSelect
            devices={devices.video}
            selectedDevice={selectedVideoDevice}
            onSelect={setVideoDevice}
            label="Camera"
            disabled={!isVideoEnabled}
          />
          <DeviceSelect
            devices={devices.audio}
            selectedDevice={selectedAudioDevice}
            onSelect={setAudioDevice}
            label="Microphone"
            disabled={!isAudioEnabled}
          />
        </div>

        {/* Name input */}
        {(requireName || !initialUserName) && (
          <div className="space-y-1.5">
            <label htmlFor="userName" className="text-sm font-medium text-foreground">
              Your name {requireName && <span className="text-destructive">*</span>}
            </label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className={clsx(
                'w-full px-3 py-2 rounded-lg',
                'bg-muted border border-border',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary',
              )}
              autoFocus
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className={clsx(
                'flex-1 px-4 py-3 rounded-lg',
                'bg-muted hover:bg-muted/80',
                'text-foreground font-medium',
                'transition-colors',
              )}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleJoin}
            disabled={!canJoin || isJoining}
            className={clsx(
              'flex-1 px-4 py-3 rounded-lg',
              'bg-primary hover:bg-primary/90',
              'text-primary-foreground font-medium',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isJoining ? 'Joining...' : 'Join call'}
          </button>
        </div>

        {/* Keyboard hints */}
        <p className="text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">Enter</kbd> to join
          {onCancel && (
            <>
              {' '}
              or <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">Esc</kbd> to cancel
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default PreJoin;
