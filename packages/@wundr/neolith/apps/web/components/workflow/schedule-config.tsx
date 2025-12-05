'use client';

import { format, addDays, addWeeks, addMonths, parseISO } from 'date-fns';
import {
  Calendar,
  Clock,
  Globe,
  Plus,
  Trash2,
  Info,
  Play,
  Pause,
  AlertCircle,
} from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Cron expression builder types
interface CronConfig {
  minute: string; // 0-59 or */n
  hour: string; // 0-23 or */n
  dayOfMonth: string; // 1-31 or */n or ?
  month: string; // 1-12 or */n
  dayOfWeek: string; // 0-6 or */n or ?
}

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  nextRuns: Date[];
  description?: string;
  createdAt: Date;
}

interface ScheduleConfigProps {
  workflowId: string;
  schedules?: Schedule[];
  onScheduleAdd?: (schedule: Omit<Schedule, 'id' | 'createdAt'>) => void;
  onScheduleUpdate?: (scheduleId: string, updates: Partial<Schedule>) => void;
  onScheduleDelete?: (scheduleId: string) => void;
  maxSchedules?: number;
}

// Common timezone options
const TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York (EST)', value: 'America/New_York' },
  { label: 'America/Chicago (CST)', value: 'America/Chicago' },
  { label: 'America/Denver (MST)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
  { label: 'Europe/London (GMT)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET)', value: 'Europe/Paris' },
  { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (CST)', value: 'Asia/Shanghai' },
  { label: 'Australia/Sydney (AEDT)', value: 'Australia/Sydney' },
];

// Cron presets
const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'First day of month at 9 AM', value: '0 9 1 * *' },
  { label: 'Custom', value: 'custom' },
];

// Parse cron expression into config
function parseCron(cron: string): CronConfig {
  const parts = cron.split(' ');
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    dayOfMonth: parts[2] || '*',
    month: parts[3] || '*',
    dayOfWeek: parts[4] || '*',
  };
}

// Build cron expression from config
function buildCron(config: CronConfig): string {
  return `${config.minute} ${config.hour} ${config.dayOfMonth} ${config.month} ${config.dayOfWeek}`;
}

// Calculate next N runs based on cron expression
function calculateNextRuns(
  cron: string,
  timezone: string,
  count: number = 5
): Date[] {
  // This is a simplified implementation
  // In production, use a library like 'cron-parser' or 'cronstrue'
  const runs: Date[] = [];
  const now = new Date();

  // Parse cron for simple patterns
  const config = parseCron(cron);

  // Handle some common patterns
  if (cron === '* * * * *') {
    // Every minute
    for (let i = 1; i <= count; i++) {
      runs.push(new Date(now.getTime() + i * 60000));
    }
  } else if (cron.startsWith('*/')) {
    // Every N minutes
    const interval = parseInt(cron.split(' ')[0].substring(2));
    for (let i = 1; i <= count; i++) {
      runs.push(new Date(now.getTime() + i * interval * 60000));
    }
  } else if (cron === '0 * * * *') {
    // Every hour
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    for (let i = 0; i < count; i++) {
      runs.push(new Date(next.getTime() + i * 3600000));
    }
  } else if (cron === '0 0 * * *') {
    // Every day at midnight
    const next = new Date(now);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    for (let i = 0; i < count; i++) {
      runs.push(addDays(next, i));
    }
  } else {
    // Default: approximate daily
    for (let i = 1; i <= count; i++) {
      runs.push(addDays(now, i));
    }
  }

  return runs;
}

// Get human-readable description of cron expression
function describeCron(cron: string): string {
  const presets = CRON_PRESETS.find(p => p.value === cron);
  if (presets && presets.value !== 'custom') {
    return presets.label;
  }

  const config = parseCron(cron);

  // Build description
  const parts: string[] = [];

  if (config.minute === '*') {
    parts.push('every minute');
  } else if (config.minute.startsWith('*/')) {
    parts.push(`every ${config.minute.substring(2)} minutes`);
  } else {
    parts.push(`at minute ${config.minute}`);
  }

  if (config.hour !== '*') {
    if (config.hour.startsWith('*/')) {
      parts.push(`every ${config.hour.substring(2)} hours`);
    } else {
      parts.push(`at ${config.hour}:00`);
    }
  }

  if (config.dayOfMonth !== '*') {
    parts.push(`on day ${config.dayOfMonth}`);
  }

  if (config.month !== '*') {
    parts.push(`in month ${config.month}`);
  }

  if (config.dayOfWeek !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    parts.push(`on ${days[parseInt(config.dayOfWeek)]}`);
  }

  return parts.join(' ');
}

// Visual Cron Builder Component
function CronBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (cron: string) => void;
}) {
  const [preset, setPreset] = React.useState<string>(() => {
    const found = CRON_PRESETS.find(p => p.value === value);
    return found ? found.value : 'custom';
  });
  const [config, setConfig] = React.useState<CronConfig>(() =>
    parseCron(value)
  );
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handlePresetChange = (newPreset: string) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      onChange(newPreset);
      setConfig(parseCron(newPreset));
      setShowAdvanced(false);
    } else {
      setShowAdvanced(true);
    }
  };

  const handleConfigChange = (field: keyof CronConfig, value: string) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onChange(buildCron(newConfig));
  };

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>Schedule Preset</Label>
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger>
            <SelectValue placeholder='Select a preset' />
          </SelectTrigger>
          <SelectContent>
            {CRON_PRESETS.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(showAdvanced || preset === 'custom') && (
        <div className='space-y-4 p-4 border rounded-lg bg-muted/30'>
          <div className='flex items-center justify-between'>
            <Label className='text-sm font-semibold'>
              Advanced Configuration
            </Label>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showAdvanced && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='minute' className='text-xs'>
                  Minute (0-59)
                </Label>
                <Input
                  id='minute'
                  value={config.minute}
                  onChange={e => handleConfigChange('minute', e.target.value)}
                  placeholder='* or */5'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='hour' className='text-xs'>
                  Hour (0-23)
                </Label>
                <Input
                  id='hour'
                  value={config.hour}
                  onChange={e => handleConfigChange('hour', e.target.value)}
                  placeholder='* or 9'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='dayOfMonth' className='text-xs'>
                  Day of Month (1-31)
                </Label>
                <Input
                  id='dayOfMonth'
                  value={config.dayOfMonth}
                  onChange={e =>
                    handleConfigChange('dayOfMonth', e.target.value)
                  }
                  placeholder='* or 1'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='month' className='text-xs'>
                  Month (1-12)
                </Label>
                <Input
                  id='month'
                  value={config.month}
                  onChange={e => handleConfigChange('month', e.target.value)}
                  placeholder='* or 1'
                />
              </div>

              <div className='space-y-2 col-span-2'>
                <Label htmlFor='dayOfWeek' className='text-xs'>
                  Day of Week (0-6, 0=Sunday)
                </Label>
                <Input
                  id='dayOfWeek'
                  value={config.dayOfWeek}
                  onChange={e =>
                    handleConfigChange('dayOfWeek', e.target.value)
                  }
                  placeholder='* or 1'
                />
              </div>
            </div>
          )}

          <div className='pt-2'>
            <Alert>
              <Info className='h-4 w-4' />
              <AlertDescription className='text-xs'>
                Use * for any value, */n for intervals, or specific numbers
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      <div className='p-3 bg-primary/5 rounded-md border'>
        <div className='flex items-center gap-2 mb-1'>
          <Clock className='h-4 w-4 text-muted-foreground' />
          <span className='text-sm font-medium'>Schedule Description</span>
        </div>
        <p className='text-sm text-muted-foreground'>{describeCron(value)}</p>
      </div>
    </div>
  );
}

// Schedule Preview Component
function SchedulePreview({
  cron,
  timezone,
}: {
  cron: string;
  timezone: string;
}) {
  const nextRuns = React.useMemo(
    () => calculateNextRuns(cron, timezone, 5),
    [cron, timezone]
  );

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Calendar className='h-4 w-4 text-muted-foreground' />
        <Label className='text-sm font-medium'>Next 5 Scheduled Runs</Label>
      </div>

      <div className='space-y-2'>
        {nextRuns.map((run, index) => (
          <div
            key={index}
            className='flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors'
          >
            <div className='flex items-center gap-3'>
              <div className='flex flex-col items-center justify-center w-12 h-12 bg-primary/10 rounded-md'>
                <span className='text-xs font-semibold text-primary'>
                  {format(run, 'MMM')}
                </span>
                <span className='text-lg font-bold text-primary'>
                  {format(run, 'd')}
                </span>
              </div>
              <div>
                <div className='text-sm font-medium'>
                  {format(run, 'EEEE, MMMM d, yyyy')}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {format(run, 'h:mm:ss a')}
                </div>
              </div>
            </div>
            <Badge variant='outline' className='text-xs'>
              {index === 0 ? 'Next' : `+${index} run${index > 1 ? 's' : ''}`}
            </Badge>
          </div>
        ))}
      </div>

      <div className='pt-2'>
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription className='text-xs'>
            Times shown in {timezone} timezone
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

// Schedule Calendar View Component
function ScheduleCalendar({
  schedules,
  timezone,
}: {
  schedules: Schedule[];
  timezone: string;
}) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date()
  );

  // Get all scheduled dates for the selected month
  const scheduledDates = React.useMemo(() => {
    const dates = new Set<string>();
    schedules.forEach(schedule => {
      if (schedule.enabled) {
        schedule.nextRuns.forEach(run => {
          dates.add(format(run, 'yyyy-MM-dd'));
        });
      }
    });
    return dates;
  }, [schedules]);

  // Get schedules for selected date
  const schedulesForDate = React.useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return schedules.filter(schedule =>
      schedule.nextRuns.some(run => format(run, 'yyyy-MM-dd') === dateStr)
    );
  }, [schedules, selectedDate]);

  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <div>
        <CalendarComponent
          mode='single'
          selected={selectedDate}
          onSelect={setSelectedDate}
          modifiers={{
            scheduled: date => scheduledDates.has(format(date, 'yyyy-MM-dd')),
          }}
          modifiersClassNames={{
            scheduled: 'bg-primary/20 font-bold',
          }}
          className='rounded-md border'
        />
        <div className='mt-4 flex items-center gap-2 text-xs text-muted-foreground'>
          <div className='flex items-center gap-1'>
            <div className='w-3 h-3 bg-primary/20 rounded' />
            <span>Has scheduled runs</span>
          </div>
        </div>
      </div>

      <div className='space-y-3'>
        <Label className='text-sm font-medium'>
          Schedules for {selectedDate && format(selectedDate, 'MMM d, yyyy')}
        </Label>
        {schedulesForDate.length > 0 ? (
          <div className='space-y-2'>
            {schedulesForDate.map(schedule => {
              const runsForDate = schedule.nextRuns.filter(
                run =>
                  format(run, 'yyyy-MM-dd') ===
                  format(selectedDate!, 'yyyy-MM-dd')
              );
              return (
                <Card key={schedule.id}>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between mb-2'>
                      <div>
                        <div className='font-medium text-sm'>
                          {schedule.name}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {describeCron(schedule.cron)}
                        </div>
                      </div>
                      <Badge
                        variant={schedule.enabled ? 'default' : 'secondary'}
                        className='text-xs'
                      >
                        {schedule.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className='space-y-1'>
                      {runsForDate.map((run, idx) => (
                        <div
                          key={idx}
                          className='flex items-center gap-2 text-xs text-muted-foreground'
                        >
                          <Clock className='h-3 w-3' />
                          {format(run, 'h:mm:ss a')}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/30'>
            <Calendar className='h-12 w-12 text-muted-foreground/50 mb-3' />
            <p className='text-sm text-muted-foreground text-center'>
              No scheduled runs for this date
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Schedule Config Component
export function ScheduleConfig({
  workflowId,
  schedules = [],
  onScheduleAdd,
  onScheduleUpdate,
  onScheduleDelete,
  maxSchedules = 10,
}: ScheduleConfigProps) {
  const [isAddingSchedule, setIsAddingSchedule] = React.useState(false);
  const [newSchedule, setNewSchedule] = React.useState({
    name: '',
    cron: '0 9 * * *',
    timezone: 'UTC',
    enabled: true,
    description: '',
  });

  const canAddMore = schedules.length < maxSchedules;

  const handleAddSchedule = () => {
    if (!newSchedule.name) {
      return;
    }

    const schedule: Omit<Schedule, 'id' | 'createdAt'> = {
      ...newSchedule,
      nextRuns: calculateNextRuns(newSchedule.cron, newSchedule.timezone, 5),
    };

    onScheduleAdd?.(schedule);
    setIsAddingSchedule(false);
    setNewSchedule({
      name: '',
      cron: '0 9 * * *',
      timezone: 'UTC',
      enabled: true,
      description: '',
    });
  };

  const handleToggleSchedule = (scheduleId: string, enabled: boolean) => {
    onScheduleUpdate?.(scheduleId, { enabled });
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold'>Workflow Schedules</h3>
          <p className='text-sm text-muted-foreground'>
            Configure when this workflow should run automatically
          </p>
        </div>
        <Button
          onClick={() => setIsAddingSchedule(true)}
          disabled={!canAddMore || isAddingSchedule}
        >
          <Plus className='h-4 w-4 mr-2' />
          Add Schedule
        </Button>
      </div>

      {/* Add Schedule Form */}
      {isAddingSchedule && (
        <Card className='border-primary'>
          <CardHeader>
            <CardTitle className='text-base'>New Schedule</CardTitle>
            <CardDescription>
              Configure a new schedule for this workflow
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='schedule-name'>Schedule Name *</Label>
              <Input
                id='schedule-name'
                placeholder='e.g., Daily Morning Report'
                value={newSchedule.name}
                onChange={e =>
                  setNewSchedule({ ...newSchedule, name: e.target.value })
                }
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='schedule-description'>Description</Label>
              <Input
                id='schedule-description'
                placeholder='Optional description'
                value={newSchedule.description}
                onChange={e =>
                  setNewSchedule({
                    ...newSchedule,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <Separator />

            <div className='space-y-2'>
              <Label>Timezone</Label>
              <Select
                value={newSchedule.timezone}
                onValueChange={value =>
                  setNewSchedule({ ...newSchedule, timezone: value })
                }
              >
                <SelectTrigger>
                  <Globe className='h-4 w-4 mr-2' />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <CronBuilder
              value={newSchedule.cron}
              onChange={cron => setNewSchedule({ ...newSchedule, cron })}
            />

            <Separator />

            <SchedulePreview
              cron={newSchedule.cron}
              timezone={newSchedule.timezone}
            />

            <div className='flex items-center justify-between p-4 bg-muted/30 rounded-lg'>
              <div className='flex items-center gap-3'>
                <Switch
                  id='schedule-enabled'
                  checked={newSchedule.enabled}
                  onCheckedChange={enabled =>
                    setNewSchedule({ ...newSchedule, enabled })
                  }
                />
                <Label htmlFor='schedule-enabled' className='cursor-pointer'>
                  Enable schedule immediately
                </Label>
              </div>
            </div>
          </CardContent>
          <CardFooter className='flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setIsAddingSchedule(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddSchedule} disabled={!newSchedule.name}>
              Create Schedule
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Existing Schedules */}
      {schedules.length > 0 && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <Label className='text-base font-semibold'>
              Active Schedules ({schedules.length}/{maxSchedules})
            </Label>
          </div>

          <div className='grid gap-4'>
            {schedules.map(schedule => (
              <Card key={schedule.id}>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div className='space-y-1'>
                      <CardTitle className='text-base flex items-center gap-2'>
                        {schedule.name}
                        <Badge
                          variant={schedule.enabled ? 'default' : 'secondary'}
                          className='text-xs'
                        >
                          {schedule.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </CardTitle>
                      {schedule.description && (
                        <CardDescription>
                          {schedule.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() =>
                          handleToggleSchedule(schedule.id, !schedule.enabled)
                        }
                      >
                        {schedule.enabled ? (
                          <Pause className='h-4 w-4' />
                        ) : (
                          <Play className='h-4 w-4' />
                        )}
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => onScheduleDelete?.(schedule.id)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Clock className='h-4 w-4' />
                        <span className='font-medium'>Schedule:</span>
                        {describeCron(schedule.cron)}
                      </div>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Globe className='h-4 w-4' />
                        <span className='font-medium'>Timezone:</span>
                        {schedule.timezone}
                      </div>
                      <div className='text-xs text-muted-foreground font-mono bg-muted p-2 rounded'>
                        {schedule.cron}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-xs font-medium text-muted-foreground'>
                        Next 3 Runs
                      </Label>
                      <div className='space-y-1'>
                        {schedule.nextRuns.slice(0, 3).map((run, idx) => (
                          <div
                            key={idx}
                            className='flex items-center gap-2 text-sm'
                          >
                            <Calendar className='h-3 w-3 text-muted-foreground' />
                            <span>
                              {format(run, 'MMM d, yyyy')} at{' '}
                              {format(run, 'h:mm a')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Calendar View */}
      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Schedule Calendar</CardTitle>
            <CardDescription>
              View all scheduled runs in calendar format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleCalendar
              schedules={schedules.filter(s => s.enabled)}
              timezone={schedules[0]?.timezone || 'UTC'}
            />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {schedules.length === 0 && !isAddingSchedule && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Calendar className='h-16 w-16 text-muted-foreground/50 mb-4' />
            <h4 className='text-lg font-semibold mb-2'>No Schedules Yet</h4>
            <p className='text-sm text-muted-foreground text-center mb-4 max-w-sm'>
              Add a schedule to run this workflow automatically at specific
              times
            </p>
            <Button onClick={() => setIsAddingSchedule(true)}>
              <Plus className='h-4 w-4 mr-2' />
              Create First Schedule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ScheduleConfig;
