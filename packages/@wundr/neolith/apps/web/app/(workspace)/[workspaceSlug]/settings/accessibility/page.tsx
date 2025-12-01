'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Eye,
  Keyboard,
  Volume2,
  Users,
  Sparkles,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AccessibilitySettingsPage() {
  const { toast } = useToast();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [settings, setSettings] = useState({
    // Motion & Animation
    reduceMotion: false,
    disableAllAnimations: false,
    autoPlayGifs: true,

    // Screen Reader
    screenReaderOptimized: false,
    announceNewMessages: true,
    announceReactions: false,

    // Keyboard Navigation
    keyboardShortcuts: true,
    focusIndicatorsVisible: true,

    // Visual
    highContrastMode: false,
    linkUnderlines: false,
    largerClickTargets: false,

    // Audio & Captions
    autoPlayAudio: false,
    closedCaptions: true,
  });

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

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = !settings[key];

    setSettings(prev => ({
      ...prev,
      [key]: newValue,
    }));

    // Apply settings immediately for visual feedback
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
      setSettings(prev => ({
        ...prev,
        [key]: !newValue,
      }));
      applyAccessibilitySettings(key, !newValue);
    }
  };

  const applyAccessibilitySettings = (
    key: keyof typeof settings,
    value: boolean
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
        root.classList.toggle('high-contrast', value);
        break;
      case 'linkUnderlines':
        root.classList.toggle('link-underlines', value);
        break;
      case 'largerClickTargets':
        root.classList.toggle('large-targets', value);
        break;
      case 'focusIndicatorsVisible':
        root.classList.toggle('focus-visible-always', value);
        break;
    }
  };

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
          <AlertCircle className='h-4 w-4' />
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
        </CardContent>
      </Card>

      {/* Visual */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Eye className='h-5 w-5' aria-hidden='true' />
            <CardTitle>Visual</CardTitle>
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
