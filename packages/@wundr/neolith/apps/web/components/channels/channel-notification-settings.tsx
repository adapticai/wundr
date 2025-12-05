'use client';

import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Clock,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Notification preference type matching API schema
 */
type NotificationPreference = 'all' | 'mentions' | 'none';

/**
 * Mute duration options
 */
type MuteDuration =
  | '1hour'
  | '4hours'
  | 'tomorrow'
  | 'nextweek'
  | 'custom'
  | null;

/**
 * Props for ChannelNotificationBell component
 */
interface ChannelNotificationBellProps {
  channelId: string;
  className?: string;
  variant?: 'icon' | 'button';
}

/**
 * Props for ChannelNotificationSettings component
 */
interface ChannelNotificationSettingsProps {
  channelId: string;
  onClose?: () => void;
}

/**
 * Channel Notification Bell - Quick access in channel header
 *
 * Features:
 * - Shows current notification state (all, mentions, muted)
 * - Quick mute options dropdown
 * - Visual indicator for muted channels
 */
export function ChannelNotificationBell({
  channelId,
  className,
  variant = 'icon',
}: ChannelNotificationBellProps) {
  const [preference, setPreference] = useState<NotificationPreference>('all');
  const [muteUntil, setMuteUntil] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current notification settings
  useEffect(() => {
    fetch(`/api/channels/${channelId}/notifications`)
      .then(res => res.json())
      .then(data => {
        setPreference(data.preference || 'all');
        // In a real implementation, muteUntil would come from API
      })
      .catch(error => {
        console.error('Failed to fetch notification settings:', error);
      });
  }, [channelId]);

  const updatePreference = useCallback(
    async (newPreference: NotificationPreference) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/channels/${channelId}/notifications`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preference: newPreference }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to update notification settings');
        }

        const data = await response.json();
        setPreference(data.preference);
      } catch (error) {
        console.error('Failed to update notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [channelId],
  );

  const handleMuteFor = useCallback(
    (duration: MuteDuration) => {
      if (!duration) {
        setMuteUntil(null);
        updatePreference('all');
        return;
      }

      const now = new Date();
      let until: Date;

      switch (duration) {
        case '1hour':
          until = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '4hours':
          until = new Date(now.getTime() + 4 * 60 * 60 * 1000);
          break;
        case 'tomorrow':
          until = new Date(now);
          until.setDate(until.getDate() + 1);
          until.setHours(9, 0, 0, 0);
          break;
        case 'nextweek':
          until = new Date(now);
          until.setDate(until.getDate() + 7);
          until.setHours(9, 0, 0, 0);
          break;
        default:
          return;
      }

      setMuteUntil(until);
      updatePreference('none');
    },
    [updatePreference],
  );

  const isMuted = preference === 'none' || muteUntil !== null;
  const isMentionsOnly = preference === 'mentions';

  const BellIcon = isMuted ? BellOff : isMentionsOnly ? Bell : BellRing;

  if (variant === 'button') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className={cn('gap-2', className)}
            disabled={isLoading}
          >
            <BellIcon
              className={cn(
                'h-4 w-4',
                isMuted && 'text-muted-foreground',
                isMentionsOnly && 'text-yellow-500',
              )}
            />
            Notifications
          </Button>
        </DropdownMenuTrigger>
        <NotificationDropdownContent
          preference={preference}
          muteUntil={muteUntil}
          onPreferenceChange={updatePreference}
          onMuteFor={handleMuteFor}
          isLoading={isLoading}
        />
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className={cn(
            'relative rounded-md p-1.5 hover:bg-accent transition-colors',
            className,
          )}
          title='Notification settings'
          disabled={isLoading}
        >
          <BellIcon
            className={cn(
              'h-5 w-5',
              isMuted && 'text-muted-foreground',
              isMentionsOnly && 'text-yellow-500',
            )}
          />
          {muteUntil && (
            <span className='absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500' />
          )}
        </button>
      </DropdownMenuTrigger>
      <NotificationDropdownContent
        preference={preference}
        muteUntil={muteUntil}
        onPreferenceChange={updatePreference}
        onMuteFor={handleMuteFor}
        isLoading={isLoading}
      />
    </DropdownMenu>
  );
}

/**
 * Notification dropdown content component
 */
function NotificationDropdownContent({
  preference,
  muteUntil,
  onPreferenceChange,
  onMuteFor,
  isLoading,
}: {
  preference: NotificationPreference;
  muteUntil: Date | null;
  onPreferenceChange: (pref: NotificationPreference) => void;
  onMuteFor: (duration: MuteDuration) => void;
  isLoading: boolean;
}) {
  return (
    <DropdownMenuContent align='end' className='w-64'>
      <DropdownMenuLabel>Notification preferences</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={value =>
          onPreferenceChange(value as NotificationPreference)
        }
      >
        <DropdownMenuRadioItem value='all' disabled={isLoading}>
          <Volume2 className='mr-2 h-4 w-4' />
          All messages
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value='mentions' disabled={isLoading}>
          <Bell className='mr-2 h-4 w-4' />
          Mentions only
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value='none' disabled={isLoading}>
          <VolumeX className='mr-2 h-4 w-4' />
          Nothing
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Mute for</DropdownMenuLabel>

      {muteUntil && (
        <>
          <DropdownMenuItem disabled className='text-xs text-muted-foreground'>
            Muted until {muteUntil.toLocaleString()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMuteFor(null)}>
            <Check className='mr-2 h-4 w-4' />
            Unmute
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}

      <DropdownMenuItem onClick={() => onMuteFor('1hour')}>
        <Clock className='mr-2 h-4 w-4' />
        1 hour
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMuteFor('4hours')}>
        <Clock className='mr-2 h-4 w-4' />
        4 hours
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMuteFor('tomorrow')}>
        <Sun className='mr-2 h-4 w-4' />
        Until tomorrow (9:00 AM)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMuteFor('nextweek')}>
        <Moon className='mr-2 h-4 w-4' />
        Until next week (9:00 AM)
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

/**
 * Channel Notification Settings - Full settings page/dialog
 *
 * Features:
 * - All notification preference options
 * - Custom mute schedules
 * - Schedule-based notifications (work hours, etc.)
 * - Save preferences per user per channel
 */
export function ChannelNotificationSettings({
  channelId,
  onClose,
}: ChannelNotificationSettingsProps) {
  const [preference, setPreference] = useState<NotificationPreference>('all');
  const [muteUntil, setMuteUntil] = useState<Date | null>(null);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [scheduleEnd, setScheduleEnd] = useState('17:00');
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current notification settings
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/channels/${channelId}/notifications`)
      .then(res => res.json())
      .then(data => {
        setPreference(data.preference || 'all');
        // In a real implementation, schedule settings would come from API
      })
      .catch(error => {
        console.error('Failed to fetch notification settings:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [channelId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/channels/${channelId}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preference,
          // In a real implementation, include schedule settings
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification settings');
      }

      onClose?.();
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [channelId, preference, onClose]);

  if (isLoading) {
    return (
      <div className='p-6 space-y-6'>
        <div className='animate-pulse space-y-4'>
          <div className='h-4 bg-muted rounded w-3/4' />
          <div className='h-10 bg-muted rounded' />
          <div className='h-4 bg-muted rounded w-1/2' />
        </div>
      </div>
    );
  }

  return (
    <div className='p-6 space-y-6'>
      <div>
        <h3 className='text-lg font-semibold mb-1'>Notification settings</h3>
        <p className='text-sm text-muted-foreground'>
          Choose when you want to be notified about activity in this channel
        </p>
      </div>

      {/* Notification preference */}
      <div className='space-y-3'>
        <Label className='text-base'>Notify me about</Label>
        <RadioGroup value={preference} onValueChange={(value) => setPreference(value as NotificationPreference)}>
          <div className='flex items-start space-x-3'>
            <RadioGroupItem value='all' id='all' />
            <div className='flex-1'>
              <Label htmlFor='all' className='font-medium cursor-pointer'>
                All messages
              </Label>
              <p className='text-sm text-muted-foreground'>
                Get notified for every message in this channel
              </p>
            </div>
          </div>

          <div className='flex items-start space-x-3'>
            <RadioGroupItem value='mentions' id='mentions' />
            <div className='flex-1'>
              <Label htmlFor='mentions' className='font-medium cursor-pointer'>
                Mentions only
              </Label>
              <p className='text-sm text-muted-foreground'>
                Only when someone mentions you or @channel
              </p>
            </div>
          </div>

          <div className='flex items-start space-x-3'>
            <RadioGroupItem value='none' id='none' />
            <div className='flex-1'>
              <Label htmlFor='none' className='font-medium cursor-pointer'>
                Nothing
              </Label>
              <p className='text-sm text-muted-foreground'>
                Turn off all notifications for this channel
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Mute status */}
      {muteUntil && (
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950'>
          <div className='flex items-start gap-3'>
            <BellOff className='h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5' />
            <div className='flex-1'>
              <p className='font-medium text-amber-900 dark:text-amber-100'>
                Channel is muted
              </p>
              <p className='text-sm text-amber-700 dark:text-amber-300'>
                Muted until {muteUntil.toLocaleString()}
              </p>
              <Button
                variant='link'
                size='sm'
                className='h-auto p-0 text-amber-600 dark:text-amber-400'
                onClick={() => setMuteUntil(null)}
              >
                Unmute now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom schedule */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            <Label className='text-base'>Custom notification schedule</Label>
            <p className='text-sm text-muted-foreground'>
              Only receive notifications during specific hours
            </p>
          </div>
          <Switch
            checked={enableSchedule}
            onCheckedChange={setEnableSchedule}
          />
        </div>

        {enableSchedule && (
          <div className='ml-6 space-y-4 border-l-2 pl-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='start-time'>Start time</Label>
                <input
                  id='start-time'
                  type='time'
                  value={scheduleStart}
                  onChange={e => setScheduleStart(e.target.value)}
                  className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='end-time'>End time</Label>
                <input
                  id='end-time'
                  type='time'
                  value={scheduleEnd}
                  onChange={e => setScheduleEnd(e.target.value)}
                  className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                />
              </div>
            </div>

            <div className='flex items-center space-x-2'>
              <Switch
                id='weekdays'
                checked={weekdaysOnly}
                onCheckedChange={setWeekdaysOnly}
              />
              <Label htmlFor='weekdays' className='cursor-pointer'>
                Weekdays only (Monday - Friday)
              </Label>
            </div>

            <p className='text-xs text-muted-foreground'>
              You will only receive notifications between {scheduleStart} and{' '}
              {scheduleEnd}
              {weekdaysOnly && ' on weekdays'}. Messages will still be
              delivered, but notifications will be silent.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className='flex justify-end gap-2 pt-4 border-t'>
        {onClose && (
          <Button variant='outline' onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}

export default ChannelNotificationSettings;
