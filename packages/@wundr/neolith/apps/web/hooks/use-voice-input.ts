'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkMicrophonePermission,
  getAudioLevel,
  getSpeechRecognition,
  isSpeechRecognitionSupported,
  loadVoiceSettings,
  requestMicrophonePermission,
  saveVoiceSettings,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionResult,
  type VoiceSettings,
} from '@/lib/ai/speech';

export interface UseVoiceInputOptions {
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onEnd?: () => void;
  autoStart?: boolean;
}

export interface UseVoiceInputReturn {
  isSupported: boolean;
  isListening: boolean;
  isPaused: boolean;
  hasPermission: boolean | null;
  transcript: string;
  interimTranscript: string;
  audioLevel: number;
  duration: number;
  error: Error | null;
  settings: VoiceSettings;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  requestPermission: () => Promise<boolean>;
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { onResult, onError, onStart, onEnd, autoStart = false } = options;

  const [isSupported] = useState(() => isSpeechRecognitionSupported());
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(() =>
    loadVoiceSettings()
  );

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check permission on mount
  useEffect(() => {
    checkMicrophonePermission().then(state => {
      setHasPermission(state === 'granted');
    });
  }, []);

  // Request microphone permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestMicrophonePermission();
    setHasPermission(granted);
    return granted;
  }, []);

  // Start duration tracking
  const startDurationTracking = useCallback(() => {
    startTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setDuration((Date.now() - startTimeRef.current) / 1000);
    }, 100);
  }, []);

  // Stop duration tracking
  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setDuration(0);
  }, []);

  // Setup audio level monitoring
  const setupAudioLevel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const cleanup = await getAudioLevel(stream, level => {
        setAudioLevel(level);
      });

      audioCleanupRef.current = cleanup;
    } catch (err) {
      console.error('Failed to setup audio level monitoring:', err);
    }
  }, []);

  // Cleanup audio level monitoring
  const cleanupAudioLevel = useCallback(() => {
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  // Start voice recognition
  const start = useCallback(async () => {
    if (!isSupported) {
      const err = new Error(
        'Speech recognition is not supported in this browser'
      );
      setError(err);
      onError?.(err);
      return;
    }

    if (isListening) return;

    // Check permission
    const permitted = hasPermission ?? (await requestPermission());
    if (!permitted) {
      const err = new Error('Microphone permission denied');
      setError(err);
      onError?.(err);
      return;
    }

    try {
      const SpeechRecognition = getSpeechRecognition();
      if (!SpeechRecognition) {
        throw new Error('SpeechRecognition not available');
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // Configure recognition
      recognition.lang = settings.language;
      recognition.continuous = settings.continuous;
      recognition.interimResults = settings.interimResults;
      recognition.maxAlternatives = 1;

      // Event handlers
      recognition.onstart = () => {
        setIsListening(true);
        setIsPaused(false);
        setError(null);
        startDurationTracking();
        setupAudioLevel();
        onStart?.();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;

          if (result.isFinal) {
            final += transcriptText + ' ';
          } else {
            interim += transcriptText;
          }
        }

        if (final) {
          setTranscript(prev => prev + final);
          onResult?.({
            transcript: final.trim(),
            confidence: event.results[event.results.length - 1][0].confidence,
            isFinal: true,
          });
        }

        if (interim) {
          setInterimTranscript(interim);
          onResult?.({
            transcript: interim,
            confidence: 0,
            isFinal: false,
          });
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const err = new Error(`Speech recognition error: ${event.error}`);
        setError(err);
        onError?.(err);

        // Don't stop on "no-speech" error, just continue
        if (event.error !== 'no-speech') {
          setIsListening(false);
          cleanupAudioLevel();
          stopDurationTracking();
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsPaused(false);
        cleanupAudioLevel();
        stopDurationTracking();
        onEnd?.();
      };

      // Start recognition
      recognition.start();
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to start voice recognition');
      setError(error);
      onError?.(error);
      cleanupAudioLevel();
      stopDurationTracking();
    }
  }, [
    isSupported,
    isListening,
    hasPermission,
    settings,
    onResult,
    onError,
    onStart,
    onEnd,
    requestPermission,
    startDurationTracking,
    stopDurationTracking,
    setupAudioLevel,
    cleanupAudioLevel,
  ]);

  // Stop voice recognition
  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsPaused(false);
    cleanupAudioLevel();
    stopDurationTracking();
  }, [cleanupAudioLevel, stopDurationTracking]);

  // Pause voice recognition (browser support varies)
  const pause = useCallback(() => {
    if (recognitionRef.current && isListening) {
      setIsPaused(true);
      // Note: There's no native pause, so we stop and keep the transcript
    }
  }, [isListening]);

  // Resume voice recognition
  const resume = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      // Would need to restart recognition
    }
  }, [isPaused]);

  // Reset transcript
  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveVoiceSettings(updated);
      return updated;
    });
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && isSupported && hasPermission && !isListening) {
      start();
    }
  }, [autoStart, isSupported, hasPermission, isListening, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSupported,
    isListening,
    isPaused,
    hasPermission,
    transcript,
    interimTranscript,
    audioLevel,
    duration,
    error,
    settings,
    start,
    stop,
    pause,
    resume,
    reset,
    updateSettings,
    requestPermission,
  };
}
