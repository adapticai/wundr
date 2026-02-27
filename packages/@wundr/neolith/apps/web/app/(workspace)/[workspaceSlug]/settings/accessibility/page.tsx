'use client';

import {
  Eye,
  Keyboard,
  Volume2,
  Users,
  Sparkles,
  ExternalLink,
  AlertCircle,
  Type,
  Settings,
} from 'lucide-react';
import { useState, useEffect } from 'react';

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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

type ColorBlindnessMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
type FocusStyle = 'default' | 'thick' | 'high-contrast' | 'rounded';

interface AccessibilitySettings {
  // Motion & Animation
  reduceMotion: boolean;
  disableAllAnimations: boolean;
  autoPlayGifs: boolean;

  // Screen Reader
  screenReaderOptimized: boolean;
  announceNewMessages: boolean;
  announceReactions: boolean;

  // Keyboard Navigation
  keyboardShortcuts: boolean;
  focusIndicatorsVisible: boolean;
  focusStyle: FocusStyle;
  customShortcuts: Record<string, string>;

  // Visual
  highContrastMode: boolean;
  linkUnderlines: boolean;
  largerClickTargets: boolean;
  colorBlindnessMode: ColorBlindnessMode;

  // Font Scaling
  fontScale: number;
  lineHeight: number;
  letterSpacing: number;

  // Audio & Captions
  autoPlayAudio: boolean;
  closedCaptions: boolean;
  transcriptAutoLoad: boolean;
}

const defaultSettings: AccessibilitySettings = {
  reduceMotion: false,
  disableAllAnimations: false,
  autoPlayGifs: true,
  screenReaderOptimized: false,
  announceNewMessages: true,
  announceReactions: false,
  keyboardShortcuts: true,
  focusIndicatorsVisible: true,
  focusStyle: 'default',
  customShortcuts: {},
  highContrastMode: false,
  linkUnderlines: false,
  largerClickTargets: false,
  colorBlindnessMode: 'none',
  fontScale: 100,
  lineHeight: 150,
  letterSpacing: 0,
  autoPlayAudio: false,
  closedCaptions: true,
  transcriptAutoLoad: false,
};

export default function AccessibilitySettingsPage() {
  const { toast } = useToast();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [settings, setSettings] =
    useState<AccessibilitySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Detect system prefers-reduced-motion setting
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/user/accessibility');
        if (response.ok) {
          const data = await response.json();
          setSettings({ ...defaultSettings, ...data });
          applyAllSettings({ ...defaultSettings, ...data });
        }
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleToggle = async (key: keyof AccessibilitySettings) => {
    if (typeof settings[key] !== 'boolean') {
      return;
    }

    const newValue = !settings[key];
    const newSettings = {
      ...settings,
      [key]: newValue,
    };

    setSettings(newSettings);
    applyAccessibilitySettings(key, newValue);

    try {
      const response = await fetch('/api/user/accessibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update accessibility setting');
      }

      toast({
        title: 'Setting updated',
        description: 'Your accessibility preference has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });

      // Revert on error
      setSettings(settings);
      applyAccessibilitySettings(key, settings[key] as boolean);
    }
  };

  const handleSelectChange = async <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(newSettings);
    applyAccessibilitySettings(key, value);

    try {
      const response = await fetch('/api/user/accessibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update accessibility setting');
      }

      toast({
        title: 'Setting updated',
        description: 'Your accessibility preference has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });

      // Revert on error
      setSettings(settings);
      applyAccessibilitySettings(key, settings[key]);
    }
  };

  const handleSliderChange = async <K extends keyof AccessibilitySettings>(
    key: K,
    value: number
  ) => {
    const newSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(newSettings);
    applyAccessibilitySettings(key, value as AccessibilitySettings[K]);
  };

  const handleSliderCommit = async <K extends keyof AccessibilitySettings>(
    key: K
  ) => {
    try {
      const response = await fetch('/api/user/accessibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: settings[key] }),
      });

      if (!response.ok) {
        throw new Error('Failed to update accessibility setting');
      }

      toast({
        title: 'Setting updated',
        description: 'Your accessibility preference has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const applyAccessibilitySettings = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const root = document.documentElement;

    switch (key) {
      case 'reduceMotion':
      case 'disableAllAnimations':
        if (value) {
          root.style.setProperty('--animation-duration', '0.01ms');
          root.style.setProperty('--transition-duration', '0.01ms');
        } else {
          root.style.removeProperty('--animation-duration');
          root.style.removeProperty('--transition-duration');
        }
        break;
      case 'highContrastMode':
        root.classList.toggle('high-contrast', value as boolean);
        break;
      case 'linkUnderlines':
        root.classList.toggle('link-underlines', value as boolean);
        break;
      case 'largerClickTargets':
        root.classList.toggle('large-targets', value as boolean);
        break;
      case 'focusIndicatorsVisible':
        root.classList.toggle('focus-visible-always', value as boolean);
        break;
      case 'focusStyle':
        root.setAttribute('data-focus-style', value as string);
        break;
      case 'colorBlindnessMode':
        root.setAttribute('data-colorblind-mode', value as string);
        break;
      case 'fontScale':
        root.style.setProperty('--font-scale', `${(value as number) / 100}`);
        break;
      case 'lineHeight':
        root.style.setProperty('--line-height', `${(value as number) / 100}`);
        break;
      case 'letterSpacing':
        root.style.setProperty(
          '--letter-spacing',
          `${(value as number) / 100}em`
        );
        break;
    }
  };

  const applyAllSettings = (allSettings: AccessibilitySettings) => {
    Object.entries(allSettings).forEach(([key, value]) => {
      applyAccessibilitySettings(
        key as keyof AccessibilitySettings,
        value as any
      );
    });
  };

  const handleResetToDefaults = async () => {
    setSettings(defaultSettings);
    applyAllSettings(defaultSettings);

    try {
      const response = await fetch('/api/user/accessibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }

      toast({
        title: 'Settings reset',
        description: 'All accessibility settings have been reset to defaults.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to reset settings',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='h-8 w-64 bg-muted animate-pulse rounded' />
        <div className='h-4 w-96 bg-muted animate-pulse rounded' />
        <div className='space-y-4'>
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className='h-6 w-48 bg-muted animate-pulse rounded' />
              </CardHeader>
              <CardContent>
                <div className='h-20 bg-muted animate-pulse rounded' />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className='space-y-6'
      role='main'
      aria-labelledby='accessibility-heading'
    >
      <div>
        <h1 id='accessibility-heading' className='text-2xl font-bold'>
          Accessibility Settings
        </h1>
        <p className='mt-1 text-muted-foreground'>
          Customize your experience to meet your accessibility needs.
        </p>
      </div>

      {/* System Preference Alert */}
      {prefersReducedMotion && !settings.reduceMotion && (
        <Alert>
          <AlertCircle className='h-4 w-4' aria-hidden='true' />
          <AlertDescription>
            Your system is set to reduce motion. We recommend enabling the
            &quot;Reduce motion&quot; setting below for the best experience.
          </AlertDescription>
        </Alert>
      )}

      {/* Motion & Animation */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Motion & Animation</CardTitle>
          </div>
          <CardDescription>
            Control animation and motion effects throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='reduce-motion'>Reduce motion</Label>
              <p className='text-sm text-muted-foreground'>
                Minimize motion and animations (respects system preferences)
              </p>
            </div>
            <Switch
              id='reduce-motion'
              checked={settings.reduceMotion}
              onCheckedChange={() => handleToggle('reduceMotion')}
              aria-describedby='reduce-motion-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='disable-animations'>Disable all animations</Label>
              <p className='text-sm text-muted-foreground'>
                Turn off all animations completely
              </p>
            </div>
            <Switch
              id='disable-animations'
              checked={settings.disableAllAnimations}
              onCheckedChange={() => handleToggle('disableAllAnimations')}
              aria-describedby='disable-animations-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='autoplay-gifs'>Auto-play GIFs</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically play animated GIFs in messages
              </p>
            </div>
            <Switch
              id='autoplay-gifs'
              checked={settings.autoPlayGifs}
              onCheckedChange={() => handleToggle('autoPlayGifs')}
              aria-describedby='autoplay-gifs-description'
            />
          </div>
        </CardContent>
      </Card>

      {/* Screen Reader */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Users className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Screen Reader</CardTitle>
          </div>
          <CardDescription>
            Optimize the experience for screen reader users.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='screen-reader-optimized'>
                Screen reader optimization
              </Label>
              <p className='text-sm text-muted-foreground'>
                Enable enhanced screen reader support with additional context
              </p>
            </div>
            <Switch
              id='screen-reader-optimized'
              checked={settings.screenReaderOptimized}
              onCheckedChange={() => handleToggle('screenReaderOptimized')}
              aria-describedby='screen-reader-optimized-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='announce-messages'>Announce new messages</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically announce new messages as they arrive
              </p>
            </div>
            <Switch
              id='announce-messages'
              checked={settings.announceNewMessages}
              onCheckedChange={() => handleToggle('announceNewMessages')}
              aria-describedby='announce-messages-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='announce-reactions'>Announce reactions</Label>
              <p className='text-sm text-muted-foreground'>
                Announce when reactions are added to messages
              </p>
            </div>
            <Switch
              id='announce-reactions'
              checked={settings.announceReactions}
              onCheckedChange={() => handleToggle('announceReactions')}
              aria-describedby='announce-reactions-description'
            />
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Navigation */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Keyboard className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Keyboard Navigation</CardTitle>
          </div>
          <CardDescription>
            Configure keyboard shortcuts and navigation preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='keyboard-shortcuts'>
                Enable keyboard shortcuts
              </Label>
              <p className='text-sm text-muted-foreground'>
                Use keyboard shortcuts to navigate and perform actions quickly
              </p>
            </div>
            <Switch
              id='keyboard-shortcuts'
              checked={settings.keyboardShortcuts}
              onCheckedChange={() => handleToggle('keyboardShortcuts')}
              aria-describedby='keyboard-shortcuts-description'
            />
          </div>

          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5 flex-1'>
              <Label>Custom keyboard shortcuts</Label>
              <p className='text-sm text-muted-foreground'>
                View and customize keyboard shortcuts
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              aria-label='View keyboard shortcuts documentation'
            >
              View shortcuts
              <ExternalLink className='ml-2 h-4 w-4' aria-hidden='true' />
            </Button>
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='focus-indicators'>
                Enhanced focus indicators
              </Label>
              <p className='text-sm text-muted-foreground'>
                Show more visible focus indicators for keyboard navigation
              </p>
            </div>
            <Switch
              id='focus-indicators'
              checked={settings.focusIndicatorsVisible}
              onCheckedChange={() => handleToggle('focusIndicatorsVisible')}
              aria-describedby='focus-indicators-description'
            />
          </div>

          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='focus-style'>Focus indicator style</Label>
              <p className='text-sm text-muted-foreground'>
                Choose the appearance of focus indicators
              </p>
            </div>
            <Select
              value={settings.focusStyle}
              onValueChange={(value: FocusStyle) =>
                handleSelectChange('focusStyle', value)
              }
            >
              <SelectTrigger id='focus-style' className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='default'>Default</SelectItem>
                <SelectItem value='thick'>Thick border</SelectItem>
                <SelectItem value='high-contrast'>High contrast</SelectItem>
                <SelectItem value='rounded'>Rounded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Visual Accessibility */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Eye className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Visual Accessibility</CardTitle>
          </div>
          <CardDescription>
            Adjust visual elements for better readability and visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='high-contrast'>High contrast mode</Label>
              <p className='text-sm text-muted-foreground'>
                Increase contrast for better visibility
              </p>
            </div>
            <Switch
              id='high-contrast'
              checked={settings.highContrastMode}
              onCheckedChange={() => handleToggle('highContrastMode')}
              aria-describedby='high-contrast-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='link-underlines'>Always underline links</Label>
              <p className='text-sm text-muted-foreground'>
                Show underlines on all links for easier identification
              </p>
            </div>
            <Switch
              id='link-underlines'
              checked={settings.linkUnderlines}
              onCheckedChange={() => handleToggle('linkUnderlines')}
              aria-describedby='link-underlines-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='larger-targets'>Larger click targets</Label>
              <p className='text-sm text-muted-foreground'>
                Increase the size of buttons and interactive elements
              </p>
            </div>
            <Switch
              id='larger-targets'
              checked={settings.largerClickTargets}
              onCheckedChange={() => handleToggle('largerClickTargets')}
              aria-describedby='larger-targets-description'
            />
          </div>

          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='colorblind-mode'>Color blindness mode</Label>
              <p className='text-sm text-muted-foreground'>
                Adjust colors for different types of color blindness
              </p>
            </div>
            <Select
              value={settings.colorBlindnessMode}
              onValueChange={(value: ColorBlindnessMode) =>
                handleSelectChange('colorBlindnessMode', value)
              }
            >
              <SelectTrigger id='colorblind-mode' className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>None</SelectItem>
                <SelectItem value='deuteranopia'>Deuteranopia</SelectItem>
                <SelectItem value='protanopia'>Protanopia</SelectItem>
                <SelectItem value='tritanopia'>Tritanopia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Font Scaling */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Type className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Font Scaling</CardTitle>
          </div>
          <CardDescription>
            Adjust text size and spacing for comfortable reading.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='font-scale'>Font size</Label>
              <span
                className='text-sm text-muted-foreground tabular-nums'
                aria-label={`Font size is ${settings.fontScale} percent`}
              >
                {settings.fontScale}%
              </span>
            </div>
            <Slider
              id='font-scale'
              min={75}
              max={200}
              step={5}
              value={[settings.fontScale]}
              onValueChange={([value]) =>
                handleSliderChange('fontScale', value)
              }
              onValueCommit={() => handleSliderCommit('fontScale')}
              aria-label='Font size slider'
              aria-valuemin={75}
              aria-valuemax={200}
              aria-valuenow={settings.fontScale}
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>75%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='line-height'>Line height</Label>
              <span
                className='text-sm text-muted-foreground tabular-nums'
                aria-label={`Line height is ${settings.lineHeight} percent`}
              >
                {settings.lineHeight}%
              </span>
            </div>
            <Slider
              id='line-height'
              min={100}
              max={250}
              step={10}
              value={[settings.lineHeight]}
              onValueChange={([value]) =>
                handleSliderChange('lineHeight', value)
              }
              onValueCommit={() => handleSliderCommit('lineHeight')}
              aria-label='Line height slider'
              aria-valuemin={100}
              aria-valuemax={250}
              aria-valuenow={settings.lineHeight}
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>100%</span>
              <span>175%</span>
              <span>250%</span>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='letter-spacing'>Letter spacing</Label>
              <span
                className='text-sm text-muted-foreground tabular-nums'
                aria-label={`Letter spacing is ${settings.letterSpacing}`}
              >
                {settings.letterSpacing > 0 ? '+' : ''}
                {settings.letterSpacing}
              </span>
            </div>
            <Slider
              id='letter-spacing'
              min={-5}
              max={10}
              step={1}
              value={[settings.letterSpacing]}
              onValueChange={([value]) =>
                handleSliderChange('letterSpacing', value)
              }
              onValueCommit={() => handleSliderCommit('letterSpacing')}
              aria-label='Letter spacing slider'
              aria-valuemin={-5}
              aria-valuemax={10}
              aria-valuenow={settings.letterSpacing}
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>-5</span>
              <span>0</span>
              <span>+10</span>
            </div>
          </div>

          {/* Preview Text */}
          <div className='mt-6 p-4 border rounded-lg bg-muted/30'>
            <p
              className='text-sm'
              style={{
                fontSize: `${settings.fontScale / 100}em`,
                lineHeight: settings.lineHeight / 100,
                letterSpacing: `${settings.letterSpacing / 100}em`,
              }}
            >
              This is a preview of how text will appear with your current
              settings. The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Audio & Captions */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Volume2 className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Audio & Captions</CardTitle>
          </div>
          <CardDescription>
            Configure audio playback and caption preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='autoplay-audio'>Auto-play audio messages</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically play audio messages when received
              </p>
            </div>
            <Switch
              id='autoplay-audio'
              checked={settings.autoPlayAudio}
              onCheckedChange={() => handleToggle('autoPlayAudio')}
              aria-describedby='autoplay-audio-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='closed-captions'>Closed captions for video</Label>
              <p className='text-sm text-muted-foreground'>
                Show closed captions on video content when available
              </p>
            </div>
            <Switch
              id='closed-captions'
              checked={settings.closedCaptions}
              onCheckedChange={() => handleToggle('closedCaptions')}
              aria-describedby='closed-captions-description'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5 flex-1'>
              <Label htmlFor='transcript-autoload'>Auto-load transcripts</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically load transcripts for audio and video content
              </p>
            </div>
            <Switch
              id='transcript-autoload'
              checked={settings.transcriptAutoLoad}
              onCheckedChange={() => handleToggle('transcriptAutoLoad')}
              aria-describedby='transcript-autoload-description'
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage your accessibility settings.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Button
            variant='outline'
            className='w-full justify-start'
            onClick={handleResetToDefaults}
          >
            <Settings className='mr-2 h-4 w-4' aria-hidden='true' />
            Reset all settings to defaults
          </Button>
        </CardContent>
      </Card>

      {/* Helpful Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Helpful Resources</CardTitle>
          <CardDescription>
            Learn more about accessibility features and report issues.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Button variant='outline' className='w-full justify-start' asChild>
            <a
              href='/docs/accessibility'
              target='_blank'
              rel='noopener noreferrer'
              aria-label='Open accessibility documentation in new tab'
            >
              <ExternalLink className='mr-2 h-4 w-4' aria-hidden='true' />
              Accessibility Documentation
            </a>
          </Button>

          <Button variant='outline' className='w-full justify-start' asChild>
            <a
              href='/docs/keyboard-shortcuts'
              target='_blank'
              rel='noopener noreferrer'
              aria-label='Open keyboard shortcuts guide in new tab'
            >
              <Keyboard className='mr-2 h-4 w-4' aria-hidden='true' />
              Keyboard Shortcuts Guide
            </a>
          </Button>

          <Button variant='outline' className='w-full justify-start' asChild>
            <a
              href='mailto:accessibility@neolith.com?subject=Accessibility%20Issue'
              aria-label='Send email to report accessibility issues'
            >
              <AlertCircle className='mr-2 h-4 w-4' aria-hidden='true' />
              Report Accessibility Issues
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Screen Reader Announcements Region */}
      <div
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
        id='accessibility-announcements'
      >
        {/* Dynamic announcements will be inserted here */}
      </div>
    </div>
  );
}
