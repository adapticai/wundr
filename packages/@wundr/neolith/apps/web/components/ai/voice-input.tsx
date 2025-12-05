'use client';

import { AlertCircle, Mic, MicOff, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useVoiceInput } from '@/hooks/use-voice-input';
import { cn } from '@/lib/utils';

import { Button } from '../ui/button';
import { VoiceVisualizer } from './voice-visualizer';

export interface VoiceInputProps {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onStop?: () => void;
  className?: string;
  autoSubmit?: boolean;
  placeholder?: string;
}

export function VoiceInput({
  onTranscript,
  onStart,
  onStop,
  className,
  autoSubmit = false,
  placeholder = 'Click the microphone to start speaking...',
}: VoiceInputProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    isSupported,
    isListening,
    isPaused,
    hasPermission,
    transcript,
    interimTranscript,
    audioLevel,
    duration,
    error,
    start,
    stop,
    pause,
    resume,
    reset,
    requestPermission,
  } = useVoiceInput({
    onResult: result => {
      onTranscript?.(result.transcript, result.isFinal);
    },
    onStart: () => {
      setShowTranscript(true);
      onStart?.();
    },
    onEnd: () => {
      onStop?.();
      if (autoSubmit && transcript) {
        // Auto-submit would be handled by parent
      }
    },
  });

  // Handle microphone button click
  const handleMicClick = async () => {
    if (!isSupported) {
      alert(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    if (hasPermission === false) {
      const granted = await requestPermission();
      if (!granted) {
        alert(
          'Microphone permission is required for voice input. Please enable it in your browser settings.'
        );
        return;
      }
    }

    if (isListening) {
      stop();
      setShowTranscript(false);
    } else {
      reset();
      start();
    }
  };

  // Handle pause/resume
  const handlePauseResume = () => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  };

  // Handle reset
  const handleReset = () => {
    reset();
    setShowTranscript(false);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Not supported state
  if (!isSupported) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3',
          className
        )}
      >
        <AlertCircle className='h-5 w-5 text-destructive' />
        <p className='text-sm text-muted-foreground'>
          Voice input is not supported in this browser
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Control Buttons */}
      <div className='flex items-center gap-2'>
        {/* Main Mic Button */}
        <Button
          size='icon'
          variant={isListening ? 'destructive' : 'default'}
          onClick={handleMicClick}
          className={cn(
            'relative h-12 w-12 rounded-full transition-all',
            isListening && 'animate-pulse'
          )}
          title={isListening ? 'Stop recording' : 'Start recording'}
        >
          {isListening ? (
            <MicOff className='h-5 w-5' />
          ) : (
            <Mic className='h-5 w-5' />
          )}

          {/* Pulse Ring Animation */}
          {isListening && (
            <>
              <span className='absolute inset-0 -z-10 animate-ping rounded-full bg-destructive opacity-75' />
              <span className='absolute inset-0 -z-10 animate-pulse rounded-full bg-destructive opacity-50' />
            </>
          )}
        </Button>

        {/* Pause/Resume Button */}
        {isListening && (
          <Button
            size='icon'
            variant='outline'
            onClick={handlePauseResume}
            className='h-10 w-10'
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Play className='h-4 w-4' />
            ) : (
              <Pause className='h-4 w-4' />
            )}
          </Button>
        )}

        {/* Reset Button */}
        {(transcript || interimTranscript) && (
          <Button
            size='icon'
            variant='outline'
            onClick={handleReset}
            className='h-10 w-10'
            title='Clear transcript'
          >
            <RotateCcw className='h-4 w-4' />
          </Button>
        )}

        {/* Duration Display */}
        {isListening && (
          <div className='flex items-center gap-2 rounded-md bg-muted px-3 py-2'>
            <div className='h-2 w-2 animate-pulse rounded-full bg-destructive' />
            <span className='font-mono text-sm font-medium'>
              {formatDuration(duration)}
            </span>
          </div>
        )}
      </div>

      {/* Audio Visualizer */}
      {isListening && (
        <VoiceVisualizer
          audioLevel={audioLevel}
          isActive={!isPaused}
          className='h-16'
        />
      )}

      {/* Transcript Display */}
      {showTranscript && (transcript || interimTranscript) && (
        <div className='rounded-lg border bg-muted/50 p-4'>
          <div className='space-y-2'>
            {transcript && (
              <p className='text-sm leading-relaxed'>{transcript}</p>
            )}
            {interimTranscript && (
              <p className='text-sm leading-relaxed text-muted-foreground italic'>
                {interimTranscript}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className='flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3'>
          <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0 text-destructive' />
          <div className='space-y-1'>
            <p className='text-sm font-medium text-destructive'>
              Voice Input Error
            </p>
            <p className='text-sm text-muted-foreground'>{error.message}</p>
          </div>
        </div>
      )}

      {/* Placeholder */}
      {!showTranscript && !isListening && (
        <p className='text-center text-sm text-muted-foreground'>
          {placeholder}
        </p>
      )}

      {/* Permission Prompt */}
      {hasPermission === false && (
        <div className='rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600' />
            <div className='space-y-2'>
              <p className='text-sm text-muted-foreground'>
                Microphone access is required for voice input
              </p>
              <Button size='sm' variant='outline' onClick={requestPermission}>
                Grant Permission
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
