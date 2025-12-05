'use client';

import { Check, Loader2, Mic, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useVoiceInput } from '@/hooks/use-voice-input';
import {
  checkMicrophonePermission,
  SUPPORTED_LANGUAGES,
  type VoiceSettings as VoiceSettingsType,
} from '@/lib/ai/speech';
import { cn } from '@/lib/utils';

import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface VoiceSettingsProps {
  settings: VoiceSettingsType;
  onSettingsChange: (settings: Partial<VoiceSettingsType>) => void;
  className?: string;
  showPermissionStatus?: boolean;
}

export function VoiceSettings({
  settings,
  onSettingsChange,
  className,
  showPermissionStatus = true,
}: VoiceSettingsProps) {
  const [permissionState, setPermissionState] =
    useState<PermissionState | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  const { requestPermission } = useVoiceInput();

  // Check permission status
  useEffect(() => {
    checkMicrophonePermission().then(setPermissionState);
  }, []);

  // Handle permission request
  const handleRequestPermission = async () => {
    setIsCheckingPermission(true);
    try {
      const granted = await requestPermission();
      setPermissionState(granted ? 'granted' : 'denied');
    } finally {
      setIsCheckingPermission(false);
    }
  };

  // Handle language change
  const handleLanguageChange = (language: string) => {
    onSettingsChange({ language });
  };

  // Handle continuous mode toggle
  const handleContinuousToggle = () => {
    onSettingsChange({ continuous: !settings.continuous });
  };

  // Handle interim results toggle
  const handleInterimResultsToggle = () => {
    onSettingsChange({ interimResults: !settings.interimResults });
  };

  // Handle auto-start toggle
  const handleAutoStartToggle = () => {
    onSettingsChange({ autoStart: !settings.autoStart });
  };

  // Handle noise suppression toggle
  const handleNoiseSuppressionToggle = () => {
    onSettingsChange({ noiseSupression: !settings.noiseSupression });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex items-center gap-2'>
        <Settings2 className='h-5 w-5 text-muted-foreground' />
        <h3 className='font-semibold'>Voice Settings</h3>
      </div>

      {/* Permission Status */}
      {showPermissionStatus && (
        <div className='space-y-2'>
          <label className='text-sm font-medium'>Microphone Permission</label>
          <div className='flex items-center gap-2'>
            {permissionState === 'granted' ? (
              <div className='flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-green-600'>
                <Check className='h-4 w-4' />
                <span className='text-sm'>Granted</span>
              </div>
            ) : permissionState === 'denied' ? (
              <div className='flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-red-600'>
                <Mic className='h-4 w-4' />
                <span className='text-sm'>Denied</span>
              </div>
            ) : (
              <Button
                size='sm'
                variant='outline'
                onClick={handleRequestPermission}
                disabled={isCheckingPermission}
              >
                {isCheckingPermission ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Checking...
                  </>
                ) : (
                  <>
                    <Mic className='mr-2 h-4 w-4' />
                    Request Permission
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Language Selection */}
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Language</label>
        <Select value={settings.language} onValueChange={handleLanguageChange}>
          <SelectTrigger>
            <SelectValue placeholder='Select language' />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map(lang => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className='flex items-center gap-2'>
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggle Options */}
      <div className='space-y-3'>
        {/* Continuous Mode */}
        <div className='flex items-center justify-between'>
          <div className='space-y-0.5'>
            <label className='text-sm font-medium'>Continuous Mode</label>
            <p className='text-xs text-muted-foreground'>
              Keep listening after detecting speech
            </p>
          </div>
          <Button
            size='sm'
            variant={settings.continuous ? 'default' : 'outline'}
            onClick={handleContinuousToggle}
            className='h-8'
          >
            {settings.continuous ? 'On' : 'Off'}
          </Button>
        </div>

        {/* Interim Results */}
        <div className='flex items-center justify-between'>
          <div className='space-y-0.5'>
            <label className='text-sm font-medium'>Interim Results</label>
            <p className='text-xs text-muted-foreground'>
              Show real-time transcription
            </p>
          </div>
          <Button
            size='sm'
            variant={settings.interimResults ? 'default' : 'outline'}
            onClick={handleInterimResultsToggle}
            className='h-8'
          >
            {settings.interimResults ? 'On' : 'Off'}
          </Button>
        </div>

        {/* Auto Start */}
        <div className='flex items-center justify-between'>
          <div className='space-y-0.5'>
            <label className='text-sm font-medium'>Auto Start</label>
            <p className='text-xs text-muted-foreground'>
              Start recording automatically
            </p>
          </div>
          <Button
            size='sm'
            variant={settings.autoStart ? 'default' : 'outline'}
            onClick={handleAutoStartToggle}
            className='h-8'
          >
            {settings.autoStart ? 'On' : 'Off'}
          </Button>
        </div>

        {/* Noise Suppression */}
        <div className='flex items-center justify-between'>
          <div className='space-y-0.5'>
            <label className='text-sm font-medium'>Noise Suppression</label>
            <p className='text-xs text-muted-foreground'>
              Reduce background noise
            </p>
          </div>
          <Button
            size='sm'
            variant={settings.noiseSupression ? 'default' : 'outline'}
            onClick={handleNoiseSuppressionToggle}
            className='h-8'
          >
            {settings.noiseSupression ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className='rounded-lg border bg-muted/50 p-3'>
        <p className='text-xs text-muted-foreground'>
          Voice recognition uses your browser's Web Speech API. For best
          results, use Chrome, Edge, or Safari.
        </p>
      </div>
    </div>
  );
}
