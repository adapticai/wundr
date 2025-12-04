/**
 * Appearance Settings Component
 * @module components/settings/appearance-settings
 */
'use client';

import {
  Monitor,
  Moon,
  Sun,
  Check,
  Palette,
  MessageSquare,
  Eye,
  Code,
  RotateCcw,
  Sidebar,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AppearancePreferences {
  // Sidebar
  sidebarPosition: 'left' | 'right';
  compactSidebar: boolean;
  showSidebarIcons: boolean;

  // Messages
  messageDensity: 'compact' | 'cozy' | 'comfortable';
  showTimestamps: 'always' | 'hover' | 'never';
  showUserAvatars: boolean;
  showLinkPreviews: boolean;

  // Display
  fontSize: 'small' | 'medium' | 'large';
  enableAnimations: boolean;
  showHelpfulHints: boolean;

  // Advanced
  customCSS: string;
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [preferences, setPreferences] = React.useState<AppearancePreferences>({
    sidebarPosition: 'left',
    compactSidebar: false,
    showSidebarIcons: true,
    messageDensity: 'cozy',
    showTimestamps: 'hover',
    showUserAvatars: true,
    showLinkPreviews: true,
    fontSize: 'medium',
    enableAnimations: true,
    showHelpfulHints: true,
    customCSS: '',
  });

  React.useEffect(() => {
    setMounted(true);
    // Load saved preferences from localStorage or API
    const savedPreferences = localStorage.getItem('appearance-preferences');
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  const updatePreference = <K extends keyof AppearancePreferences>(
    key: K,
    value: AppearancePreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      // Save to localStorage
      localStorage.setItem('appearance-preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appearance: preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Saved',
        description: 'Appearance preferences saved successfully',
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

  const handleResetToDefaults = () => {
    const defaults: AppearancePreferences = {
      sidebarPosition: 'left',
      compactSidebar: false,
      showSidebarIcons: true,
      messageDensity: 'cozy',
      showTimestamps: 'hover',
      showUserAvatars: true,
      showLinkPreviews: true,
      fontSize: 'medium',
      enableAnimations: true,
      showHelpfulHints: true,
      customCSS: '',
    };

    setPreferences(defaults);
    localStorage.setItem('appearance-preferences', JSON.stringify(defaults));
    setTheme('system');

    toast({
      title: 'Reset Complete',
      description: 'All appearance settings have been reset to defaults',
    });
  };

  if (!mounted) {
    return null;
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun, description: 'Light theme' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark theme' },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Match system',
    },
  ];

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Appearance</h2>
        <p className='text-muted-foreground'>
          Customize how the application looks and feels on your device.
        </p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Palette className='h-5 w-5' />
            <CardTitle>Theme</CardTitle>
          </div>
          <CardDescription>
            Select your preferred color theme for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className='grid grid-cols-1 md:grid-cols-3 gap-4'
          >
            {themes.map(({ value, label, icon: Icon, description }) => (
              <Label
                key={value}
                className={cn(
                  'flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                  theme === value && 'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem value={value} className='sr-only' />
                <Icon className='mb-3 h-8 w-8' />
                <span className='font-medium'>{label}</span>
                <span className='text-xs text-muted-foreground text-center'>
                  {description}
                </span>
                {theme === value && (
                  <Check className='mt-2 h-4 w-4 text-primary' />
                )}
              </Label>
            ))}
          </RadioGroup>

          <Separator className='my-4' />

          <div>
            <h4 className='text-sm font-medium mb-3'>Theme Preview</h4>
            <ThemePreview />
          </div>
        </CardContent>
      </Card>

      {/* Sidebar Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Sidebar className='h-5 w-5' />
            <CardTitle>Sidebar</CardTitle>
          </div>
          <CardDescription>
            Configure how the sidebar appears and behaves.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='sidebar-position'>Sidebar Position</Label>
              <p className='text-sm text-muted-foreground'>
                Choose which side the sidebar appears on
              </p>
            </div>
            <Select
              value={preferences.sidebarPosition}
              onValueChange={(value: 'left' | 'right') =>
                updatePreference('sidebarPosition', value)
              }
            >
              <SelectTrigger id='sidebar-position' className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='left'>Left</SelectItem>
                <SelectItem value='right'>Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='compact-sidebar'>Compact Mode</Label>
              <p className='text-sm text-muted-foreground'>
                Use a more compact sidebar layout
              </p>
            </div>
            <Switch
              id='compact-sidebar'
              checked={preferences.compactSidebar}
              onCheckedChange={checked =>
                updatePreference('compactSidebar', checked)
              }
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='sidebar-icons'>Show Icons</Label>
              <p className='text-sm text-muted-foreground'>
                Display icons next to sidebar items
              </p>
            </div>
            <Switch
              id='sidebar-icons'
              checked={preferences.showSidebarIcons}
              onCheckedChange={checked =>
                updatePreference('showSidebarIcons', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <MessageSquare className='h-5 w-5' />
            <CardTitle>Messages</CardTitle>
          </div>
          <CardDescription>
            Customize how messages are displayed in conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='message-density'>Message Density</Label>
              <p className='text-sm text-muted-foreground'>
                Control spacing between messages
              </p>
            </div>
            <Select
              value={preferences.messageDensity}
              onValueChange={(value: 'compact' | 'cozy' | 'comfortable') =>
                updatePreference('messageDensity', value)
              }
            >
              <SelectTrigger id='message-density' className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='compact'>Compact</SelectItem>
                <SelectItem value='cozy'>Cozy</SelectItem>
                <SelectItem value='comfortable'>Comfortable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='show-timestamps'>Show Timestamps</Label>
              <p className='text-sm text-muted-foreground'>
                When to display message timestamps
              </p>
            </div>
            <Select
              value={preferences.showTimestamps}
              onValueChange={(value: 'always' | 'hover' | 'never') =>
                updatePreference('showTimestamps', value)
              }
            >
              <SelectTrigger id='show-timestamps' className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='always'>Always</SelectItem>
                <SelectItem value='hover'>On Hover</SelectItem>
                <SelectItem value='never'>Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='show-avatars'>Show User Avatars</Label>
              <p className='text-sm text-muted-foreground'>
                Display profile pictures in messages
              </p>
            </div>
            <Switch
              id='show-avatars'
              checked={preferences.showUserAvatars}
              onCheckedChange={checked =>
                updatePreference('showUserAvatars', checked)
              }
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='link-previews'>Show Link Previews</Label>
              <p className='text-sm text-muted-foreground'>
                Display previews for shared links
              </p>
            </div>
            <Switch
              id='link-previews'
              checked={preferences.showLinkPreviews}
              onCheckedChange={checked =>
                updatePreference('showLinkPreviews', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Eye className='h-5 w-5' />
            <CardTitle>Display</CardTitle>
          </div>
          <CardDescription>
            Adjust visual display settings for optimal viewing.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='font-size'>Font Size</Label>
              <p className='text-sm text-muted-foreground'>
                Adjust the base font size
              </p>
            </div>
            <Select
              value={preferences.fontSize}
              onValueChange={(value: 'small' | 'medium' | 'large') =>
                updatePreference('fontSize', value)
              }
            >
              <SelectTrigger id='font-size' className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='small'>Small</SelectItem>
                <SelectItem value='medium'>Medium</SelectItem>
                <SelectItem value='large'>Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='enable-animations'>Enable Animations</Label>
              <p className='text-sm text-muted-foreground'>
                Show smooth transitions and animations
              </p>
            </div>
            <Switch
              id='enable-animations'
              checked={preferences.enableAnimations}
              onCheckedChange={checked =>
                updatePreference('enableAnimations', checked)
              }
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='show-hints'>Show Helpful Hints</Label>
              <p className='text-sm text-muted-foreground'>
                Display tooltips and onboarding hints
              </p>
            </div>
            <Switch
              id='show-hints'
              checked={preferences.showHelpfulHints}
              onCheckedChange={checked =>
                updatePreference('showHelpfulHints', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Code className='h-5 w-5' />
            <CardTitle>Advanced</CardTitle>
          </div>
          <CardDescription>
            Advanced customization options for power users.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='custom-css'>Custom CSS</Label>
            <p className='text-sm text-muted-foreground mb-2'>
              Add custom CSS to personalize your experience (use with caution)
            </p>
            <Textarea
              id='custom-css'
              placeholder='/* Your custom CSS here */&#10;.my-class {&#10;  color: blue;&#10;}'
              value={preferences.customCSS}
              onChange={e => updatePreference('customCSS', e.target.value)}
              className='font-mono text-sm min-h-[120px]'
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label>Reset to Defaults</Label>
              <p className='text-sm text-muted-foreground'>
                Restore all appearance settings to their default values
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={handleResetToDefaults}
              className='gap-2'
            >
              <RotateCcw className='h-4 w-4' />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className='flex justify-end gap-3'>
        <Button variant='outline' onClick={() => window.location.reload()}>
          Cancel
        </Button>
        <Button onClick={handleSavePreferences} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}

function ThemePreview() {
  return (
    <div className='rounded-lg border p-6 space-y-4 bg-background'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold'>
            A
          </div>
          <div className='space-y-1'>
            <div className='h-4 w-24 rounded bg-foreground' />
            <div className='h-3 w-32 rounded bg-muted-foreground/50' />
          </div>
        </div>
        <div className='h-8 w-8 rounded bg-muted' />
      </div>

      {/* Content */}
      <div className='space-y-2'>
        <div className='h-3 w-full rounded bg-muted' />
        <div className='h-3 w-5/6 rounded bg-muted' />
        <div className='h-3 w-4/6 rounded bg-muted' />
      </div>

      {/* Actions */}
      <div className='flex gap-2 pt-2'>
        <div className='h-9 w-24 rounded bg-primary' />
        <div className='h-9 w-24 rounded border border-input' />
      </div>
    </div>
  );
}
