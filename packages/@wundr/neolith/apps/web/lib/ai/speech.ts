/**
 * Speech recognition and synthesis utilities for AI voice input
 * Uses Web Speech API with fallback handling
 */

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface VoiceSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  autoStart: boolean;
  noiseSupression: boolean;
}

// Default supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (BR)', flag: '🇧🇷' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
] as const;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  language: 'en-US',
  continuous: false,
  interimResults: true,
  autoStart: false,
  noiseSupression: true,
};

/**
 * Check if Web Speech API is supported
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;

  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Get the SpeechRecognition constructor
 */
export type SpeechRecognitionConstructor = {
  new (): SpeechRecognition;
};

export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}

/**
 * Check microphone permission status
 */
export async function checkMicrophonePermission(): Promise<PermissionState | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return null;
  }

  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return result.state;
  } catch (error) {
    console.error('Failed to check microphone permission:', error);
    return null;
  }
}

/**
 * Create audio context for audio level detection
 */
export function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    (window as any).AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextClass) return null;

  try {
    return new AudioContextClass();
  } catch (error) {
    console.error('Failed to create AudioContext:', error);
    return null;
  }
}

/**
 * Get audio level from microphone stream
 */
export async function getAudioLevel(
  stream: MediaStream,
  callback: (level: number) => void
): Promise<() => void> {
  const audioContext = createAudioContext();
  if (!audioContext) {
    return () => {};
  }

  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  analyser.smoothingTimeConstant = 0.8;
  analyser.fftSize = 1024;
  microphone.connect(analyser);

  let animationId: number;

  const checkLevel = () => {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);
    callback(normalizedLevel);
    animationId = requestAnimationFrame(checkLevel);
  };

  checkLevel();

  // Return cleanup function
  return () => {
    cancelAnimationFrame(animationId);
    microphone.disconnect();
    audioContext.close();
  };
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Save voice settings to localStorage
 */
export function saveVoiceSettings(settings: VoiceSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('voice-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save voice settings:', error);
  }
}

/**
 * Load voice settings from localStorage
 */
export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;

  try {
    const stored = localStorage.getItem('voice-settings');
    if (!stored) return DEFAULT_VOICE_SETTINGS;

    const parsed = JSON.parse(stored);
    return { ...DEFAULT_VOICE_SETTINGS, ...parsed };
  } catch (error) {
    console.error('Failed to load voice settings:', error);
    return DEFAULT_VOICE_SETTINGS;
  }
}

/**
 * Text-to-speech synthesis
 */
export function speak(text: string, options?: SpeechSynthesisUtterance): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  if (options) {
    Object.assign(utterance, options);
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Stop speech synthesis
 */
export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
