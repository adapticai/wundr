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
  Contrast,
  Sparkles,
  Maximize2,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AppearancePreferences {
  // Theme
  accentColor: string;
  highContrast: boolean;

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
  displayDensity: 'compact' | 'comfortable' | 'spacious';
  enableAnimations: boolean;
  reducedMotion: boolean;
  showHelpfulHints: boolean;

  // Code
  codeBlockTheme:
    | 'github-light'
    | 'github-dark'
    | 'nord'
    | 'dracula'
    | 'monokai';

  // Advanced
  customCSS: string;
}

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
];

const CODE_THEMES = [
  { value: 'github-light', label: 'GitHub Light', preview: '#f6f8fa' },
  { value: 'github-dark', label: 'GitHub Dark', preview: '#0d1117' },
  { value: 'nord', label: 'Nord', preview: '#2e3440' },
  { value: 'dracula', label: 'Dracula', preview: '#282a36' },
  { value: 'monokai', label: 'Monokai', preview: '#272822' },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedPreferences, setSavedPreferences] =
    React.useState<AppearancePreferences | null>(null);

  const [preferences, setPreferences] = React.useState<AppearancePreferences>({
    accentColor: '#3b82f6',
    highContrast: false,
    sidebarPosition: 'left',
    compactSidebar: false,
    showSidebarIcons: true,
    messageDensity: 'cozy',
    showTimestamps: 'hover',
    showUserAvatars: true,
    showLinkPreviews: true,
    fontSize: 'medium',
    displayDensity: 'comfortable',
    enableAnimations: true,
    reducedMotion: false,
    showHelpfulHints: true,
    codeBlockTheme: 'github-dark',
    customCSS: '',
  });

  React.useEffect(() => {
    setMounted(true);
    // Load saved preferences from localStorage or API
    const stored = localStorage.getItem('appearance-preferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
        setSavedPreferences(parsed);
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  // Apply accent color to document
  React.useEffect(() => {
    if (mounted && preferences.accentColor) {
      document.documentElement.style.setProperty(
        '--accent-color',
        preferences.accentColor
      );
    }
  }, [mounted, preferences.accentColor]);

  // Apply high contrast mode
  React.useEffect(() => {
    if (mounted) {
      if (preferences.highContrast) {
        document.documentElement.classList.add('high-contrast');
      } else {
        document.documentElement.classList.remove('high-contrast');
      }
    }
  }, [mounted, preferences.highContrast]);

  // Apply reduced motion
  React.useEffect(() => {
    if (mounted) {
      if (preferences.reducedMotion) {
        document.documentElement.style.setProperty(
          '--animation-duration',
          '0.01ms'
        );
      } else {
        document.documentElement.style.removeProperty('--animation-duration');
      }
    }
  }, [mounted, preferences.reducedMotion]);

  // Apply display density
  React.useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute(
        'data-density',
        preferences.displayDensity
      );
    }
  }, [mounted, preferences.displayDensity]);

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

      setSavedPreferences(preferences);
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
      accentColor: '#3b82f6',
      highContrast: false,
      sidebarPosition: 'left',
      compactSidebar: false,
      showSidebarIcons: true,
      messageDensity: 'cozy',
      showTimestamps: 'hover',
      showUserAvatars: true,
      showLinkPreviews: true,
      fontSize: 'medium',
      displayDensity: 'comfortable',
      enableAnimations: true,
      reducedMotion: false,
      showHelpfulHints: true,
      codeBlockTheme: 'github-dark',
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
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      {/* Settings Panel */}
      <div className='lg:col-span-2 space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Appearance</h2>
          <p className='text-muted-foreground'>
            Customize how the application looks and feels on your device.
          </p>
        </div>

        <Tabs defaultValue='theme' className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='theme'>Theme</TabsTrigger>
            <TabsTrigger value='display'>Display</TabsTrigger>
            <TabsTrigger value='layout'>Layout</TabsTrigger>
            <TabsTrigger value='advanced'>Advanced</TabsTrigger>
          </TabsList>

          {/* Theme Tab */}
          <TabsContent value='theme' className='space-y-4'>
            {/* Theme Selection */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Palette className='h-5 w-5' />
                  <CardTitle>Color Theme</CardTitle>
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
              </CardContent>
            </Card>

            {/* Accent Color */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-5 w-5' />
                  <CardTitle>Accent Color</CardTitle>
                </div>
                <CardDescription>
                  Customize the accent color used throughout the interface.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center gap-4'>
                  <div className='flex-1'>
                    <Label htmlFor='accent-color'>Custom Color</Label>
                    <div className='flex items-center gap-2 mt-2'>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            className='w-[120px] justify-start gap-2'
                          >
                            <div
                              className='h-6 w-6 rounded border'
                              style={{
                                backgroundColor: preferences.accentColor,
                              }}
                            />
                            <span className='text-sm'>Pick</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-64'>
                          <div className='space-y-3'>
                            <Input
                              type='color'
                              value={preferences.accentColor}
                              onChange={e =>
                                updatePreference('accentColor', e.target.value)
                              }
                              className='h-32 w-full cursor-pointer'
                            />
                            <Input
                              type='text'
                              value={preferences.accentColor}
                              onChange={e =>
                                updatePreference('accentColor', e.target.value)
                              }
                              className='font-mono'
                              placeholder='#000000'
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Input
                        type='text'
                        value={preferences.accentColor}
                        onChange={e =>
                          updatePreference('accentColor', e.target.value)
                        }
                        className='font-mono flex-1'
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className='mb-3 block'>Preset Colors</Label>
                  <div className='grid grid-cols-8 gap-2'>
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() =>
                          updatePreference('accentColor', color.value)
                        }
                        className={cn(
                          'h-10 w-10 rounded-md border-2 transition-all hover:scale-110',
                          preferences.accentColor === color.value
                            ? 'border-foreground ring-2 ring-offset-2 ring-foreground'
                            : 'border-muted hover:border-muted-foreground'
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High Contrast Mode */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Contrast className='h-5 w-5' />
                  <CardTitle>High Contrast Mode</CardTitle>
                </div>
                <CardDescription>
                  Increase contrast for better visibility.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='high-contrast'>Enable High Contrast</Label>
                    <p className='text-sm text-muted-foreground'>
                      Use higher contrast colors for improved accessibility
                    </p>
                  </div>
                  <Switch
                    id='high-contrast'
                    checked={preferences.highContrast}
                    onCheckedChange={checked =>
                      updatePreference('highContrast', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Code Block Theme */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Code className='h-5 w-5' />
                  <CardTitle>Code Block Theme</CardTitle>
                </div>
                <CardDescription>
                  Choose a syntax highlighting theme for code blocks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={preferences.codeBlockTheme}
                  onValueChange={(value: any) =>
                    updatePreference('codeBlockTheme', value)
                  }
                  className='space-y-3'
                >
                  {CODE_THEMES.map(codeTheme => (
                    <Label
                      key={codeTheme.value}
                      className={cn(
                        'flex items-center gap-3 rounded-md border-2 p-3 cursor-pointer transition-colors hover:bg-accent',
                        preferences.codeBlockTheme === codeTheme.value &&
                          'border-primary bg-primary/5'
                      )}
                    >
                      <RadioGroupItem value={codeTheme.value} />
                      <div
                        className='h-8 w-12 rounded border'
                        style={{ backgroundColor: codeTheme.preview }}
                      />
                      <span className='font-medium flex-1'>
                        {codeTheme.label}
                      </span>
                      {preferences.codeBlockTheme === codeTheme.value && (
                        <Check className='h-4 w-4 text-primary' />
                      )}
                    </Label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value='display' className='space-y-4'>
            {/* Font Size and Density */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Eye className='h-5 w-5' />
                  <CardTitle>Display Settings</CardTitle>
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
                    <Label htmlFor='display-density'>Display Density</Label>
                    <p className='text-sm text-muted-foreground'>
                      Control spacing and padding throughout the interface
                    </p>
                  </div>
                  <Select
                    value={preferences.displayDensity}
                    onValueChange={(
                      value: 'compact' | 'comfortable' | 'spacious'
                    ) => updatePreference('displayDensity', value)}
                  >
                    <SelectTrigger id='display-density' className='w-40'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='compact'>Compact</SelectItem>
                      <SelectItem value='comfortable'>Comfortable</SelectItem>
                      <SelectItem value='spacious'>Spacious</SelectItem>
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
                    <Label htmlFor='reduced-motion'>Reduced Motion</Label>
                    <p className='text-sm text-muted-foreground'>
                      Minimize animations for accessibility
                    </p>
                  </div>
                  <Switch
                    id='reduced-motion'
                    checked={preferences.reducedMotion}
                    onCheckedChange={checked =>
                      updatePreference('reducedMotion', checked)
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
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value='layout' className='space-y-4'>
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
                    onValueChange={(
                      value: 'compact' | 'cozy' | 'comfortable'
                    ) => updatePreference('messageDensity', value)}
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
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value='advanced' className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Code className='h-5 w-5' />
                  <CardTitle>Custom CSS</CardTitle>
                </div>
                <CardDescription>
                  Advanced customization options for power users.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='custom-css'>Custom Styles</Label>
                  <p className='text-sm text-muted-foreground mb-2'>
                    Add custom CSS to personalize your experience (use with
                    caution)
                  </p>
                  <Textarea
                    id='custom-css'
                    placeholder='/* Your custom CSS here */&#10;.my-class {&#10;  color: blue;&#10;}'
                    value={preferences.customCSS}
                    onChange={e =>
                      updatePreference('customCSS', e.target.value)
                    }
                    className='font-mono text-sm min-h-[200px]'
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
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className='flex justify-end gap-3'>
          <Button
            variant='outline'
            onClick={() => {
              if (savedPreferences) {
                setPreferences(savedPreferences);
              }
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSavePreferences} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className='lg:col-span-1'>
        <div className='sticky top-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Maximize2 className='h-5 w-5' />
                <CardTitle>Live Preview</CardTitle>
              </div>
              <CardDescription>See your changes in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePreview
                preferences={preferences}
                currentTheme={theme as string}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface ThemePreviewProps {
  preferences: AppearancePreferences;
  currentTheme: string;
}

function ThemePreview({ preferences, currentTheme }: ThemePreviewProps) {
  const densityClasses = {
    compact: 'space-y-2 p-3',
    comfortable: 'space-y-4 p-4',
    spacious: 'space-y-6 p-6',
  };

  const fontSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  return (
    <div className='space-y-4'>
      {/* Theme Indicator */}
      <div className='text-center p-3 rounded-lg bg-muted'>
        <p className='text-xs text-muted-foreground mb-1'>Current Theme</p>
        <p className='font-semibold capitalize'>{currentTheme}</p>
      </div>

      {/* Main Preview */}
      <div
        className={cn(
          'rounded-lg border bg-background',
          densityClasses[preferences.displayDensity],
          fontSizeClasses[preferences.fontSize]
        )}
        style={{
          borderColor: preferences.highContrast ? '#000' : undefined,
        }}
      >
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {preferences.showUserAvatars && (
              <div
                className='h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold'
                style={{ backgroundColor: preferences.accentColor }}
              >
                A
              </div>
            )}
            <div className='space-y-1'>
              <div className='h-3 w-20 rounded bg-foreground' />
              {preferences.showTimestamps !== 'never' && (
                <div className='h-2 w-16 rounded bg-muted-foreground/50' />
              )}
            </div>
          </div>
          {preferences.showSidebarIcons && (
            <div className='h-6 w-6 rounded bg-muted' />
          )}
        </div>

        {/* Content */}
        <div
          className={cn(
            'space-y-1',
            preferences.messageDensity === 'compact' && 'space-y-0.5',
            preferences.messageDensity === 'comfortable' && 'space-y-2'
          )}
        >
          <div className='h-2.5 w-full rounded bg-muted' />
          <div className='h-2.5 w-5/6 rounded bg-muted' />
          <div className='h-2.5 w-4/6 rounded bg-muted' />
        </div>

        {/* Code Block Preview */}
        <div className='rounded border p-2 font-mono text-xs bg-card'>
          <div className='h-2 w-3/4 rounded bg-muted mb-1' />
          <div className='h-2 w-5/6 rounded bg-muted' />
        </div>

        {/* Actions */}
        <div className='flex gap-2 pt-2'>
          <div
            className={cn(
              'h-8 w-20 rounded flex items-center justify-center',
              !preferences.enableAnimations && 'transition-none'
            )}
            style={{ backgroundColor: preferences.accentColor }}
          >
            <span className='text-[10px] text-white font-medium'>Button</span>
          </div>
          <div className='h-8 w-20 rounded border border-input flex items-center justify-center'>
            <span className='text-[10px] font-medium'>Cancel</span>
          </div>
        </div>
      </div>

      {/* Settings Summary */}
      <div className='space-y-2 text-xs'>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Accent:</span>
          <div className='flex items-center gap-1'>
            <div
              className='h-3 w-3 rounded border'
              style={{ backgroundColor: preferences.accentColor }}
            />
            <span className='font-mono'>{preferences.accentColor}</span>
          </div>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Density:</span>
          <span className='capitalize'>{preferences.displayDensity}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Font Size:</span>
          <span className='capitalize'>{preferences.fontSize}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Animations:</span>
          <span>{preferences.enableAnimations ? 'On' : 'Off'}</span>
        </div>
        {preferences.highContrast && (
          <div className='flex justify-between text-primary'>
            <span>High Contrast:</span>
            <span className='font-semibold'>Enabled</span>
          </div>
        )}
        {preferences.reducedMotion && (
          <div className='flex justify-between text-primary'>
            <span>Reduced Motion:</span>
            <span className='font-semibold'>Enabled</span>
          </div>
        )}
      </div>
    </div>
  );
}
