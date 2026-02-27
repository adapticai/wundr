/**
 * Audio/Video Settings Component
 * @module components/settings/audio-video-settings
 */
'use client';

import {
  Mic,
  Video,
  Volume2,
  Settings,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Waves,
  Gauge,
} from 'lucide-react';
import * as React from 'react';

import {
  SettingsSection,
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/settings-section';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MediaDeviceInfo {
  deviceId: string;
  groupId: string;
  kind: MediaDeviceKind;
  label: string;
}

interface AudioVideoPreferences {
  // Audio Input
  microphoneId: string;
  microphoneVolume: number;
  noiseCancellation: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  autoMuteOnJoin: boolean;

  // Audio Output
  speakerId: string;
  speakerVolume: number;

  // Video
  cameraId: string;
  videoQuality: 'low' | 'medium' | 'high' | 'hd';
  virtualBackground: boolean;
  virtualBackgroundType: 'blur' | 'image' | 'none';
  virtualBackgroundBlurAmount: number;

  // Advanced
  hardwareAcceleration: boolean;
  sampleRate: number;
  echoCancellationType: 'browser' | 'system';
}

export function AudioVideoSettings() {
  const { toast } = useToast();
  const [mounted, setMounted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Device lists
  const [microphones, setMicrophones] = React.useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = React.useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = React.useState<MediaDeviceInfo[]>([]);

  // Testing state
  const [isMicTesting, setIsMicTesting] = React.useState(false);
  const [micLevel, setMicLevel] = React.useState(0);
  const [isSpeakerTesting, setIsSpeakerTesting] = React.useState(false);
  const [isCameraPreviewActive, setIsCameraPreviewActive] =
    React.useState(false);

  // Media streams
  const [audioStream, setAudioStream] = React.useState<MediaStream | null>(
    null
  );
  const [videoStream, setVideoStream] = React.useState<MediaStream | null>(
    null
  );

  // Refs
  const videoPreviewRef = React.useRef<HTMLVideoElement>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const testAudioRef = React.useRef<HTMLAudioElement | null>(null);
  // Keep stream refs in sync to avoid stale closures in cleanup
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const videoStreamRef = React.useRef<MediaStream | null>(null);
  // Use a ref to track mic testing state inside animation frame callbacks
  const isMicTestingRef = React.useRef(false);

  const DEFAULT_PREFERENCES: AudioVideoPreferences = {
    microphoneId: 'default',
    microphoneVolume: 80,
    noiseCancellation: true,
    echoCancellation: true,
    autoGainControl: true,
    autoMuteOnJoin: false,
    speakerId: 'default',
    speakerVolume: 70,
    cameraId: 'default',
    videoQuality: 'hd',
    virtualBackground: false,
    virtualBackgroundType: 'none',
    virtualBackgroundBlurAmount: 5,
    hardwareAcceleration: true,
    sampleRate: 48000,
    echoCancellationType: 'browser',
  };

  const [preferences, setPreferences] =
    React.useState<AudioVideoPreferences>(DEFAULT_PREFERENCES);

  const [permissionsGranted, setPermissionsGranted] = React.useState({
    microphone: false,
    camera: false,
  });

  // Load saved preferences and enumerate devices
  React.useEffect(() => {
    setMounted(true);

    const savedPreferences = localStorage.getItem('audio-video-preferences');
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    }

    enumerateDevices();
    checkPermissions();

    return () => {
      cleanupStreams();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const micPermission = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      const cameraPermission = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });

      setPermissionsGranted({
        microphone: micPermission.state === 'granted',
        camera: cameraPermission.state === 'granted',
      });

      micPermission.onchange = () => {
        setPermissionsGranted(prev => ({
          ...prev,
          microphone: micPermission.state === 'granted',
        }));
      };

      cameraPermission.onchange = () => {
        setPermissionsGranted(prev => ({
          ...prev,
          camera: cameraPermission.state === 'granted',
        }));
      };
    } catch (error) {
      console.error('Permission API not supported:', error);
    }
  };

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const mics = devices
        .filter(d => d.kind === 'audioinput' && d.deviceId)
        .map(d => ({
          deviceId: d.deviceId,
          groupId: d.groupId,
          kind: d.kind,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
        }));

      const spkrs = devices
        .filter(d => d.kind === 'audiooutput' && d.deviceId)
        .map(d => ({
          deviceId: d.deviceId,
          groupId: d.groupId,
          kind: d.kind,
          label: d.label || `Speaker ${d.deviceId.slice(0, 5)}`,
        }));

      const cams = devices
        .filter(d => d.kind === 'videoinput' && d.deviceId)
        .map(d => ({
          deviceId: d.deviceId,
          groupId: d.groupId,
          kind: d.kind,
          label: d.label || `Camera ${d.deviceId.slice(0, 5)}`,
        }));

      setMicrophones(mics);
      setSpeakers(spkrs);
      setCameras(cams);
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      toast({
        title: 'Device Error',
        description: 'Failed to load audio/video devices',
        variant: 'destructive',
      });
    }
  };

  const cleanupStreams = () => {
    isMicTestingRef.current = false;
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (testAudioRef.current) {
      testAudioRef.current.pause();
    }
    setAudioStream(null);
    setVideoStream(null);
  };

  const updatePreference = <K extends keyof AudioVideoPreferences>(
    key: K,
    value: AudioVideoPreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('audio-video-preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMicrophoneTest = async () => {
    if (isMicTesting) {
      isMicTestingRef.current = false;
      setIsMicTesting(false);
      cleanupStreams();
      setMicLevel(0);
      return;
    }

    try {
      isMicTestingRef.current = true;
      setIsMicTesting(true);

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId:
            preferences.microphoneId !== 'default'
              ? { exact: preferences.microphoneId }
              : undefined,
          echoCancellation: preferences.echoCancellation,
          noiseSuppression: preferences.noiseCancellation,
          autoGainControl: preferences.autoGainControl,
          sampleRate: preferences.sampleRate,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;
      setAudioStream(stream);

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const checkLevel = () => {
        if (!analyserRef.current || !isMicTestingRef.current) {
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(
          100,
          (average / 255) * 100 * (preferences.microphoneVolume / 100)
        );
        setMicLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(checkLevel);
      };

      checkLevel();

      toast({
        title: 'Microphone Active',
        description: 'Speak to test your microphone',
      });
    } catch (error) {
      console.error('Microphone test failed:', error);
      isMicTestingRef.current = false;
      setIsMicTesting(false);
      toast({
        title: 'Microphone Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to access microphone',
        variant: 'destructive',
      });
    }
  };

  const handleSpeakerTest = async () => {
    if (isSpeakerTesting) {
      setIsSpeakerTesting(false);
      if (testAudioRef.current) {
        testAudioRef.current.pause();
        testAudioRef.current.currentTime = 0;
      }
      return;
    }

    try {
      setIsSpeakerTesting(true);

      // Create a test tone (440 Hz beep)
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = preferences.speakerVolume / 100;

      oscillator.start();

      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
        setIsSpeakerTesting(false);
      }, 1000);

      toast({
        title: 'Speaker Test',
        description: 'You should hear a tone',
      });
    } catch (error) {
      console.error('Speaker test failed:', error);
      setIsSpeakerTesting(false);
      toast({
        title: 'Speaker Error',
        description: 'Failed to test speakers',
        variant: 'destructive',
      });
    }
  };

  const handleCameraPreview = async () => {
    if (isCameraPreviewActive) {
      setIsCameraPreviewActive(false);
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
        setVideoStream(null);
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      return;
    }

    try {
      setIsCameraPreviewActive(true);

      const videoQualityConstraints = {
        low: { width: 320, height: 240 },
        medium: { width: 640, height: 480 },
        high: { width: 1280, height: 720 },
        hd: { width: 1920, height: 1080 },
      };

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId:
            preferences.cameraId !== 'default'
              ? { exact: preferences.cameraId }
              : undefined,
          ...videoQualityConstraints[preferences.videoQuality],
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;
      setVideoStream(stream);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      toast({
        title: 'Camera Active',
        description: 'Camera preview started',
      });
    } catch (error) {
      console.error('Camera preview failed:', error);
      setIsCameraPreviewActive(false);
      toast({
        title: 'Camera Error',
        description:
          error instanceof Error ? error.message : 'Failed to access camera',
        variant: 'destructive',
      });
    }
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioVideo: preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Saved',
        description: 'Audio/Video preferences saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const requestPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      await checkPermissions();
      await enumerateDevices();
      toast({
        title: 'Permissions Granted',
        description: 'Audio and video permissions granted',
      });
    } catch (error) {
      toast({
        title: 'Permission Denied',
        description: 'Failed to get audio/video permissions',
        variant: 'destructive',
      });
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Audio & Video</h1>
        <p className='text-muted-foreground'>
          Configure your microphone, speakers, and camera for meetings and
          calls.
        </p>
      </div>

      {(!permissionsGranted.microphone || !permissionsGranted.camera) && (
        <Alert>
          <Settings className='h-4 w-4' />
          <AlertDescription className='flex items-center justify-between'>
            <span>
              Audio/Video permissions are required to test and configure
              devices.
            </span>
            <Button size='sm' onClick={requestPermissions}>
              Grant Permissions
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Audio Input Settings */}
      <SettingsSection
        title='Audio Input'
        description='Configure your microphone settings'
      >
        <SettingsGroup>
          <SettingsRow
            label='Microphone'
            description='Select your preferred microphone device'
            htmlFor='microphone-select'
          >
            <Select
              value={preferences.microphoneId || 'default'}
              onValueChange={value => updatePreference('microphoneId', value)}
            >
              <SelectTrigger id='microphone-select' className='w-64'>
                <SelectValue placeholder='Select microphone' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='default'>System Default</SelectItem>
                {microphones.map(mic => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label='Microphone Volume'
            description={`Input sensitivity: ${preferences.microphoneVolume}%`}
            htmlFor='mic-volume'
          >
            <div className='w-64 space-y-2'>
              <Slider
                id='mic-volume'
                min={0}
                max={100}
                step={1}
                value={[preferences.microphoneVolume]}
                onValueChange={([value]) =>
                  updatePreference('microphoneVolume', value)
                }
              />
            </div>
          </SettingsRow>

          <SettingsRow
            label='Test Microphone'
            description='Test your microphone and see input levels'
          >
            <div className='flex items-center gap-3'>
              <Button
                variant={isMicTesting ? 'destructive' : 'default'}
                size='sm'
                onClick={handleMicrophoneTest}
                className='gap-2'
              >
                {isMicTesting ? (
                  <>
                    <Square className='h-4 w-4' />
                    Stop Test
                  </>
                ) : (
                  <>
                    <Play className='h-4 w-4' />
                    Start Test
                  </>
                )}
              </Button>
              {isMicTesting && (
                <div className='flex items-center gap-2'>
                  <div className='w-32 h-2 bg-muted rounded-full overflow-hidden'>
                    <div
                      className='h-full bg-green-500 transition-all duration-100'
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <span className='text-xs text-muted-foreground w-8'>
                    {Math.round(micLevel)}%
                  </span>
                </div>
              )}
            </div>
          </SettingsRow>
        </SettingsGroup>

        <Separator className='my-6' />

        <SettingsGroup
          title='Audio Processing'
          description='Advanced audio enhancements'
        >
          <SettingsRow
            label='Noise Cancellation'
            description='Reduce background noise during calls'
            htmlFor='noise-cancellation'
          >
            <Switch
              id='noise-cancellation'
              checked={preferences.noiseCancellation}
              onCheckedChange={checked =>
                updatePreference('noiseCancellation', checked)
              }
            />
          </SettingsRow>

          <SettingsRow
            label='Echo Cancellation'
            description='Prevent audio feedback and echoes'
            htmlFor='echo-cancellation'
          >
            <Switch
              id='echo-cancellation'
              checked={preferences.echoCancellation}
              onCheckedChange={checked =>
                updatePreference('echoCancellation', checked)
              }
            />
          </SettingsRow>

          <SettingsRow
            label='Auto Gain Control'
            description='Automatically adjust microphone volume'
            htmlFor='auto-gain'
          >
            <Switch
              id='auto-gain'
              checked={preferences.autoGainControl}
              onCheckedChange={checked =>
                updatePreference('autoGainControl', checked)
              }
            />
          </SettingsRow>

          <SettingsRow
            label='Auto-mute on Join'
            description='Automatically mute when joining meetings'
            htmlFor='auto-mute'
          >
            <Switch
              id='auto-mute'
              checked={preferences.autoMuteOnJoin}
              onCheckedChange={checked =>
                updatePreference('autoMuteOnJoin', checked)
              }
            />
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {/* Audio Output Settings */}
      <SettingsSection
        title='Audio Output'
        description='Configure your speaker/headphone settings'
      >
        <SettingsGroup>
          <SettingsRow
            label='Speaker/Headphones'
            description='Select your audio output device'
            htmlFor='speaker-select'
          >
            <Select
              value={preferences.speakerId || 'default'}
              onValueChange={value => updatePreference('speakerId', value)}
            >
              <SelectTrigger id='speaker-select' className='w-64'>
                <SelectValue placeholder='Select speaker' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='default'>System Default</SelectItem>
                {speakers.map(speaker => (
                  <SelectItem key={speaker.deviceId} value={speaker.deviceId}>
                    {speaker.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label='Speaker Volume'
            description={`Output volume: ${preferences.speakerVolume}%`}
            htmlFor='speaker-volume'
          >
            <div className='w-64 space-y-2'>
              <Slider
                id='speaker-volume'
                min={0}
                max={100}
                step={1}
                value={[preferences.speakerVolume]}
                onValueChange={([value]) =>
                  updatePreference('speakerVolume', value)
                }
              />
            </div>
          </SettingsRow>

          <SettingsRow
            label='Test Speakers'
            description='Play a test sound through your speakers'
          >
            <Button
              variant={isSpeakerTesting ? 'destructive' : 'default'}
              size='sm'
              onClick={handleSpeakerTest}
              className='gap-2'
              disabled={isSpeakerTesting}
            >
              {isSpeakerTesting ? (
                <>
                  <Waves className='h-4 w-4 animate-pulse' />
                  Playing...
                </>
              ) : (
                <>
                  <Volume2 className='h-4 w-4' />
                  Test Sound
                </>
              )}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {/* Video Settings */}
      <SettingsSection
        title='Video'
        description='Configure your camera and video settings'
      >
        <SettingsGroup>
          <SettingsRow
            label='Camera'
            description='Select your preferred camera device'
            htmlFor='camera-select'
          >
            <Select
              value={preferences.cameraId || 'default'}
              onValueChange={value => updatePreference('cameraId', value)}
            >
              <SelectTrigger id='camera-select' className='w-64'>
                <SelectValue placeholder='Select camera' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='default'>System Default</SelectItem>
                {cameras.map(camera => (
                  <SelectItem key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label='Video Quality'
            description='Choose video resolution and quality'
            htmlFor='video-quality'
          >
            <Select
              value={preferences.videoQuality}
              onValueChange={(value: AudioVideoPreferences['videoQuality']) =>
                updatePreference('videoQuality', value)
              }
            >
              <SelectTrigger id='video-quality' className='w-64'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='low'>Low (320x240)</SelectItem>
                <SelectItem value='medium'>Medium (640x480)</SelectItem>
                <SelectItem value='high'>High (1280x720)</SelectItem>
                <SelectItem value='hd'>HD (1920x1080)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <div className='space-y-4'>
            <SettingsRow
              label='Camera Preview'
              description='Test your camera and see how you look'
            >
              <Button
                variant={isCameraPreviewActive ? 'destructive' : 'default'}
                size='sm'
                onClick={handleCameraPreview}
                className='gap-2'
              >
                {isCameraPreviewActive ? (
                  <>
                    <Square className='h-4 w-4' />
                    Stop Preview
                  </>
                ) : (
                  <>
                    <Video className='h-4 w-4' />
                    Start Preview
                  </>
                )}
              </Button>
            </SettingsRow>

            {isCameraPreviewActive && (
              <div className='rounded-lg overflow-hidden border bg-muted'>
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className='w-full aspect-video object-cover'
                />
              </div>
            )}
          </div>
        </SettingsGroup>

        <Separator className='my-6' />

        <SettingsGroup
          title='Virtual Background'
          description='Customize your video background'
        >
          <SettingsRow
            label='Enable Virtual Background'
            description='Use blur or custom backgrounds'
            htmlFor='virtual-background'
          >
            <Switch
              id='virtual-background'
              checked={preferences.virtualBackground}
              onCheckedChange={checked =>
                updatePreference('virtualBackground', checked)
              }
            />
          </SettingsRow>

          {preferences.virtualBackground && (
            <>
              <SettingsRow
                label='Background Type'
                description='Choose background effect type'
                htmlFor='background-type'
              >
                <Select
                  value={preferences.virtualBackgroundType}
                  onValueChange={(
                    value: AudioVideoPreferences['virtualBackgroundType']
                  ) => updatePreference('virtualBackgroundType', value)}
                >
                  <SelectTrigger id='background-type' className='w-64'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>None</SelectItem>
                    <SelectItem value='blur'>Blur</SelectItem>
                    <SelectItem value='image'>Custom Image</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              {preferences.virtualBackgroundType === 'blur' && (
                <SettingsRow
                  label='Blur Amount'
                  description={`Blur intensity: ${preferences.virtualBackgroundBlurAmount}`}
                  htmlFor='blur-amount'
                >
                  <div className='w-64 space-y-2'>
                    <Slider
                      id='blur-amount'
                      min={1}
                      max={10}
                      step={1}
                      value={[preferences.virtualBackgroundBlurAmount]}
                      onValueChange={([value]) =>
                        updatePreference('virtualBackgroundBlurAmount', value)
                      }
                    />
                  </div>
                </SettingsRow>
              )}
            </>
          )}
        </SettingsGroup>
      </SettingsSection>

      {/* Advanced Settings */}
      <SettingsSection
        title='Advanced'
        description='Advanced audio/video configuration'
      >
        <SettingsGroup>
          <SettingsRow
            label='Hardware Acceleration'
            description='Use GPU for video processing (recommended)'
            htmlFor='hardware-accel'
          >
            <Switch
              id='hardware-accel'
              checked={preferences.hardwareAcceleration}
              onCheckedChange={checked =>
                updatePreference('hardwareAcceleration', checked)
              }
            />
          </SettingsRow>

          <SettingsRow
            label='Echo Cancellation Type'
            description='Choose echo cancellation implementation'
            htmlFor='echo-type'
          >
            <Select
              value={preferences.echoCancellationType}
              onValueChange={(
                value: AudioVideoPreferences['echoCancellationType']
              ) => updatePreference('echoCancellationType', value)}
            >
              <SelectTrigger id='echo-type' className='w-64'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='browser'>Browser (Recommended)</SelectItem>
                <SelectItem value='system'>System</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label='Audio Sample Rate'
            description='Higher rates provide better quality'
            htmlFor='sample-rate'
          >
            <Select
              value={preferences.sampleRate.toString()}
              onValueChange={value =>
                updatePreference('sampleRate', parseInt(value))
              }
            >
              <SelectTrigger id='sample-rate' className='w-64'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='16000'>16 kHz (Low)</SelectItem>
                <SelectItem value='24000'>24 kHz (Medium)</SelectItem>
                <SelectItem value='48000'>48 kHz (High)</SelectItem>
                <SelectItem value='96000'>96 kHz (Studio)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Gauge className='h-5 w-5' />
            Device Status
          </CardTitle>
          <CardDescription>
            Current device configuration summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-sm'>
                <Mic className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium'>Microphone</span>
              </div>
              <div className='text-xs text-muted-foreground space-y-1'>
                <div className='flex items-center gap-2'>
                  {permissionsGranted.microphone ? (
                    <CheckCircle2 className='h-3 w-3 text-green-500' />
                  ) : (
                    <XCircle className='h-3 w-3 text-red-500' />
                  )}
                  <span>
                    {microphones.find(
                      m => m.deviceId === preferences.microphoneId
                    )?.label || 'Default'}
                  </span>
                </div>
                <div>Volume: {preferences.microphoneVolume}%</div>
                <div>
                  {preferences.noiseCancellation && 'Noise Cancellation, '}
                  {preferences.echoCancellation && 'Echo Cancellation, '}
                  {preferences.autoGainControl && 'Auto Gain'}
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-sm'>
                <Volume2 className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium'>Speaker</span>
              </div>
              <div className='text-xs text-muted-foreground space-y-1'>
                <div className='flex items-center gap-2'>
                  {speakers.length > 0 ? (
                    <CheckCircle2 className='h-3 w-3 text-green-500' />
                  ) : (
                    <XCircle className='h-3 w-3 text-red-500' />
                  )}
                  <span>
                    {speakers.find(s => s.deviceId === preferences.speakerId)
                      ?.label || 'Default'}
                  </span>
                </div>
                <div>Volume: {preferences.speakerVolume}%</div>
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-sm'>
                <Video className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium'>Camera</span>
              </div>
              <div className='text-xs text-muted-foreground space-y-1'>
                <div className='flex items-center gap-2'>
                  {permissionsGranted.camera ? (
                    <CheckCircle2 className='h-3 w-3 text-green-500' />
                  ) : (
                    <XCircle className='h-3 w-3 text-red-500' />
                  )}
                  <span>
                    {cameras.find(c => c.deviceId === preferences.cameraId)
                      ?.label || 'Default'}
                  </span>
                </div>
                <div>Quality: {preferences.videoQuality.toUpperCase()}</div>
                {preferences.virtualBackground && (
                  <div>
                    Virtual Background: {preferences.virtualBackgroundType}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className='flex justify-end gap-3'>
        <Button
          variant='outline'
          onClick={() => {
            cleanupStreams();
            setIsMicTesting(false);
            setIsSpeakerTesting(false);
            setIsCameraPreviewActive(false);
            setMicLevel(0);
            const saved = localStorage.getItem('audio-video-preferences');
            if (saved) {
              try {
                setPreferences(JSON.parse(saved));
              } catch {
                setPreferences(DEFAULT_PREFERENCES);
              }
            } else {
              setPreferences(DEFAULT_PREFERENCES);
            }
          }}
        >
          Reset Changes
        </Button>
        <Button onClick={handleSavePreferences} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}
