/**
 * Language and Regional Settings Component
 * @module components/settings/language-settings
 */
'use client';

import {
  Globe,
  Clock,
  Calendar,
  Hash,
  DollarSign,
  Keyboard,
  Check,
  ChevronRight,
  Languages,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { useToast } from '@/hooks/use-toast';
import {
  LOCALES,
  TIMEZONES,
  DATE_FORMATS,
  TIME_FORMATS,
  WEEKDAY_START,
  NUMBER_FORMATS,
  CURRENCY_FORMATS,
  SPELL_CHECK_LANGUAGES,
  detectTimezone,
  detectLocale,
  getLocaleRegions,
  getTimezoneRegions,
} from '@/lib/i18n/locales';
import { cn } from '@/lib/utils';

import type { Locale, Timezone } from '@/lib/i18n/locales';

interface LanguagePreferences {
  locale: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStart: 'sunday' | 'monday' | 'saturday';
  numberFormat: string;
  currencyFormat: 'symbol-before' | 'symbol-after' | 'code-before' | 'code-after';
  spellCheckLanguage: string;
  keyboardLanguage: string;
  enableRTL: boolean;
}

export function LanguageSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const [preferences, setPreferences] = React.useState<LanguagePreferences>({
    locale: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    weekStart: 'sunday',
    numberFormat: 'en-US',
    currencyFormat: 'symbol-before',
    spellCheckLanguage: 'en',
    keyboardLanguage: 'en-US',
    enableRTL: false,
  });

  const [localeSearch, setLocaleSearch] = React.useState('');
  const [timezoneSearch, setTimezoneSearch] = React.useState('');
  const [localeOpen, setLocaleOpen] = React.useState(false);
  const [timezoneOpen, setTimezoneOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    // Load saved preferences
    const savedPreferences = localStorage.getItem('language-preferences');
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    } else {
      // Auto-detect locale and timezone
      const detectedLocale = detectLocale();
      const detectedTimezone = detectTimezone();
      setPreferences(prev => ({
        ...prev,
        locale: detectedLocale,
        timezone: detectedTimezone,
      }));
    }
  }, []);

  const updatePreference = <K extends keyof LanguagePreferences>(
    key: K,
    value: LanguagePreferences[K],
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('language-preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAutoDetect = () => {
    const detectedLocale = detectLocale();
    const detectedTimezone = detectTimezone();

    updatePreference('locale', detectedLocale);
    updatePreference('timezone', detectedTimezone);

    toast({
      title: 'Auto-detected',
      description: `Locale: ${detectedLocale}, Timezone: ${detectedTimezone}`,
    });
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Saved',
        description: 'Language preferences saved successfully',
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
    const defaults: LanguagePreferences = {
      locale: detectLocale(),
      timezone: detectTimezone(),
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      weekStart: 'sunday',
      numberFormat: 'en-US',
      currencyFormat: 'symbol-before',
      spellCheckLanguage: 'en',
      keyboardLanguage: 'en-US',
      enableRTL: false,
    };

    setPreferences(defaults);
    localStorage.setItem('language-preferences', JSON.stringify(defaults));

    toast({
      title: 'Reset Complete',
      description: 'All language settings have been reset to defaults',
    });
  };

  if (!mounted) {
    return null;
  }

  const selectedLocale = LOCALES.find(l => l.code === preferences.locale);
  const selectedTimezone = TIMEZONES.find(t => t.value === preferences.timezone);

  // Group locales by region
  const localesByRegion = React.useMemo(() => {
    const regions = getLocaleRegions();
    return regions.map(region => ({
      region,
      locales: LOCALES.filter(l => l.region === region),
    }));
  }, []);

  // Group timezones by region
  const timezonesByRegion = React.useMemo(() => {
    const regions = getTimezoneRegions();
    return regions.map(region => ({
      region,
      timezones: TIMEZONES.filter(t => t.region === region),
    }));
  }, []);

  // Filter locales based on search
  const filteredLocaleRegions = React.useMemo(() => {
    if (!localeSearch) return localesByRegion;

    const searchLower = localeSearch.toLowerCase();
    return localesByRegion
      .map(group => ({
        ...group,
        locales: group.locales.filter(
          l =>
            l.name.toLowerCase().includes(searchLower) ||
            l.nativeName.toLowerCase().includes(searchLower) ||
            l.code.toLowerCase().includes(searchLower)
        ),
      }))
      .filter(group => group.locales.length > 0);
  }, [localesByRegion, localeSearch]);

  // Filter timezones based on search
  const filteredTimezoneRegions = React.useMemo(() => {
    if (!timezoneSearch) return timezonesByRegion;

    const searchLower = timezoneSearch.toLowerCase();
    return timezonesByRegion
      .map(group => ({
        ...group,
        timezones: group.timezones.filter(
          t =>
            t.label.toLowerCase().includes(searchLower) ||
            t.value.toLowerCase().includes(searchLower) ||
            t.offset.toLowerCase().includes(searchLower)
        ),
      }))
      .filter(group => group.timezones.length > 0);
  }, [timezonesByRegion, timezoneSearch]);

  const selectedDateFormat = DATE_FORMATS.find(f => f.value === preferences.dateFormat);
  const selectedTimeFormat = TIME_FORMATS.find(f => f.value === preferences.timeFormat);
  const selectedNumberFormat = NUMBER_FORMATS.find(f => f.value === preferences.numberFormat);
  const selectedCurrencyFormat = CURRENCY_FORMATS.find(f => f.value === preferences.currencyFormat);

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Language & Region</h2>
          <p className='text-muted-foreground'>
            Configure language, timezone, and regional formatting preferences.
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={handleAutoDetect} className='gap-2'>
          <MapPin className='h-4 w-4' />
          Auto-detect
        </Button>
      </div>

      {/* Language and Locale */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Globe className='h-5 w-5' />
            <CardTitle>Language & Locale</CardTitle>
          </div>
          <CardDescription>
            Select your preferred language and regional locale.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Locale</Label>
            <p className='text-sm text-muted-foreground'>
              Choose your language and regional settings
            </p>
            <Popover open={localeOpen} onOpenChange={setLocaleOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  aria-expanded={localeOpen}
                  className='w-full justify-between'
                >
                  <div className='flex items-center gap-2'>
                    <Languages className='h-4 w-4' />
                    {selectedLocale ? (
                      <span>
                        {selectedLocale.nativeName} ({selectedLocale.code})
                      </span>
                    ) : (
                      'Select locale...'
                    )}
                  </div>
                  <ChevronRight className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-[400px] p-0' align='start'>
                <Command>
                  <CommandInput
                    placeholder='Search locales...'
                    value={localeSearch}
                    onValueChange={setLocaleSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No locale found.</CommandEmpty>
                    {filteredLocaleRegions.map(group => (
                      <CommandGroup key={group.region} heading={group.region}>
                        {group.locales.map(locale => (
                          <CommandItem
                            key={locale.code}
                            value={locale.code}
                            onSelect={(value) => {
                              updatePreference('locale', value);
                              if (locale.isRTL !== undefined) {
                                updatePreference('enableRTL', locale.isRTL);
                              }
                              setLocaleOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                preferences.locale === locale.code
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <div className='flex flex-col'>
                              <span>{locale.nativeName}</span>
                              <span className='text-xs text-muted-foreground'>
                                {locale.name}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label>Right-to-Left (RTL) Support</Label>
              <p className='text-sm text-muted-foreground'>
                Enable RTL layout for Arabic, Hebrew, etc.
              </p>
            </div>
            <Switch
              checked={preferences.enableRTL}
              onCheckedChange={checked => updatePreference('enableRTL', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            <CardTitle>Timezone</CardTitle>
          </div>
          <CardDescription>
            Select your current timezone for accurate time display.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Current Timezone</Label>
            <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  aria-expanded={timezoneOpen}
                  className='w-full justify-between'
                >
                  {selectedTimezone ? (
                    <span>
                      {selectedTimezone.label} ({selectedTimezone.offset})
                    </span>
                  ) : (
                    'Select timezone...'
                  )}
                  <ChevronRight className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-[400px] p-0' align='start'>
                <Command>
                  <CommandInput
                    placeholder='Search timezones...'
                    value={timezoneSearch}
                    onValueChange={setTimezoneSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No timezone found.</CommandEmpty>
                    {filteredTimezoneRegions.map(group => (
                      <CommandGroup key={group.region} heading={group.region}>
                        {group.timezones.map(timezone => (
                          <CommandItem
                            key={timezone.value}
                            value={timezone.value}
                            onSelect={(value) => {
                              updatePreference('timezone', value);
                              setTimezoneOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                preferences.timezone === timezone.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <div className='flex flex-col'>
                              <span>{timezone.label}</span>
                              <span className='text-xs text-muted-foreground'>
                                {timezone.offset}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Date and Time Formats */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Calendar className='h-5 w-5' />
            <CardTitle>Date & Time Formats</CardTitle>
          </div>
          <CardDescription>
            Customize how dates and times are displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Date Format</Label>
            <Select
              value={preferences.dateFormat}
              onValueChange={value => updatePreference('dateFormat', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(format => (
                  <SelectItem key={format.value} value={format.value}>
                    <div className='flex items-center justify-between gap-4'>
                      <span>{format.label}</span>
                      <span className='text-xs text-muted-foreground'>
                        {format.example}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDateFormat && (
              <p className='text-xs text-muted-foreground'>
                Example: {selectedDateFormat.example}
              </p>
            )}
          </div>

          <Separator />

          <div className='space-y-2'>
            <Label>Time Format</Label>
            <RadioGroup
              value={preferences.timeFormat}
              onValueChange={(value: '12h' | '24h') =>
                updatePreference('timeFormat', value)
              }
              className='flex gap-4'
            >
              {TIME_FORMATS.map(format => (
                <Label
                  key={format.value}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer',
                    preferences.timeFormat === format.value &&
                      'border-primary bg-primary/5'
                  )}
                >
                  <RadioGroupItem value={format.value} className='sr-only' />
                  <span className='font-medium'>{format.label}</span>
                  <span className='text-xs text-muted-foreground'>
                    {format.example}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          <div className='space-y-2'>
            <Label>First Day of Week</Label>
            <Select
              value={preferences.weekStart}
              onValueChange={(value: 'sunday' | 'monday' | 'saturday') =>
                updatePreference('weekStart', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_START.map(day => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Number and Currency Formats */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Hash className='h-5 w-5' />
            <CardTitle>Number Formatting</CardTitle>
          </div>
          <CardDescription>
            Configure how numbers and currencies are displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Number Format</Label>
            <p className='text-sm text-muted-foreground'>
              Choose decimal and thousands separators
            </p>
            <Select
              value={preferences.numberFormat}
              onValueChange={value => updatePreference('numberFormat', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUMBER_FORMATS.map(format => (
                  <SelectItem key={format.value} value={format.value}>
                    <div className='flex items-center justify-between gap-4'>
                      <span>{format.label}</span>
                      <span className='text-xs text-muted-foreground'>
                        {format.example}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedNumberFormat && (
              <p className='text-xs text-muted-foreground'>
                Decimal: {selectedNumberFormat.decimal}, Thousands:{' '}
                {selectedNumberFormat.thousands}
              </p>
            )}
          </div>

          <Separator />

          <div className='space-y-2'>
            <Label>Currency Display</Label>
            <p className='text-sm text-muted-foreground'>
              Choose how currency values are formatted
            </p>
            <RadioGroup
              value={preferences.currencyFormat}
              onValueChange={(
                value:
                  | 'symbol-before'
                  | 'symbol-after'
                  | 'code-before'
                  | 'code-after'
              ) => updatePreference('currencyFormat', value)}
              className='grid grid-cols-2 gap-4'
            >
              {CURRENCY_FORMATS.map(format => (
                <Label
                  key={format.value}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer',
                    preferences.currencyFormat === format.value &&
                      'border-primary bg-primary/5'
                  )}
                >
                  <RadioGroupItem value={format.value} className='sr-only' />
                  <DollarSign className='mb-2 h-5 w-5' />
                  <span className='font-medium text-center'>{format.label}</span>
                  <span className='text-xs text-muted-foreground text-center'>
                    {format.description}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Spell Check and Keyboard */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Keyboard className='h-5 w-5' />
            <CardTitle>Input Settings</CardTitle>
          </div>
          <CardDescription>
            Configure spell checking and keyboard language settings.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Spell Check Language</Label>
            <p className='text-sm text-muted-foreground'>
              Language for spell checking in text inputs
            </p>
            <Select
              value={preferences.spellCheckLanguage}
              onValueChange={value => updatePreference('spellCheckLanguage', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPELL_CHECK_LANGUAGES.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className='space-y-2'>
            <Label>Keyboard Shortcuts Language</Label>
            <p className='text-sm text-muted-foreground'>
              Language mapping for keyboard shortcuts
            </p>
            <Select
              value={preferences.keyboardLanguage}
              onValueChange={value => updatePreference('keyboardLanguage', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map(locale => (
                  <SelectItem key={locale.code} value={locale.code}>
                    {locale.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reset to Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Reset Settings</CardTitle>
          <CardDescription>
            Restore all language and regional settings to their default values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant='outline'
            onClick={handleResetToDefaults}
            className='gap-2'
          >
            <RotateCcw className='h-4 w-4' />
            Reset to Defaults
          </Button>
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
