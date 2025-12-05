'use client';

/**
 * Schedule Settings Component
 *
 * Manages orchestrator work schedules, availability calendar, and recurring tasks.
 */

import { Clock, Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WorkSchedule {
  workHours: {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  };
  activeDays: string[];
  timezone: string;
  breakTimes: Array<{
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }>;
  batchWindows?: Array<{
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }>;
  officeHours?: {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  };
}

interface RecurringTask {
  id?: string;
  title: string;
  description?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dayOfWeek?: string;
  dayOfMonth?: number;
  scheduledTime: {
    hour: number;
    minute: number;
  };
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedHours?: number;
  enabled?: boolean;
}

interface ScheduleSettingsProps {
  orchestratorId: string;
  workspaceSlug: string;
  disabled?: boolean;
}

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

export function ScheduleSettings({
  orchestratorId,
  workspaceSlug,
  disabled = false,
}: ScheduleSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Work Schedule State
  const [schedule, setSchedule] = useState<WorkSchedule>({
    workHours: {
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
    },
    activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    timezone: 'America/New_York',
    breakTimes: [],
    batchWindows: [],
    officeHours: {
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
    },
  });

  // Recurring Tasks State
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [newTask, setNewTask] = useState<RecurringTask>({
    title: '',
    description: '',
    frequency: 'DAILY',
    scheduledTime: { hour: 9, minute: 0 },
    priority: 'MEDIUM',
    enabled: true,
  });

  // Availability Calendar State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [availabilityData, setAvailabilityData] = useState<{
    isAvailable: boolean;
    conflicts?: Array<{
      taskId: string;
      taskTitle: string;
      start: string;
      end: string;
    }>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load initial data
  useEffect(() => {
    loadScheduleData();
    loadRecurringTasks();
  }, [orchestratorId, workspaceSlug]);

  const loadScheduleData = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/schedule`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setSchedule(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
    }
  };

  const loadRecurringTasks = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/recurring-tasks`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setRecurringTasks(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load recurring tasks:', error);
    }
  };

  const checkAvailabilityForDate = useCallback(
    async (date: Date) => {
      if (!date) {
        return;
      }

      const startTime = new Date(date);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(date);
      endTime.setHours(23, 59, 59, 999);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/availability?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}&includeSlots=true`
        );
        if (response.ok) {
          const data = await response.json();
          setAvailabilityData(data.data);
        }
      } catch (error) {
        console.error('Failed to check availability:', error);
      }
    },
    [orchestratorId, workspaceSlug]
  );

  useEffect(() => {
    if (selectedDate) {
      checkAvailabilityForDate(selectedDate);
    }
  }, [selectedDate, checkAvailabilityForDate]);

  const handleSaveSchedule = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/schedule`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schedule),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update schedule');
      }

      toast({
        title: 'Schedule Updated',
        description: 'Work schedule has been saved successfully.',
      });

      setIsDirty(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update schedule',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRecurringTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Task title is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/recurring-tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newTask.title,
            cronExpression: convertToCronExpression(newTask),
            taskConfig: {
              description: newTask.description,
              priority: newTask.priority,
              estimatedHours: newTask.estimatedHours,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add recurring task');
      }

      toast({
        title: 'Task Added',
        description: 'Recurring task has been created successfully.',
      });

      // Reset form
      setNewTask({
        title: '',
        description: '',
        frequency: 'DAILY',
        scheduledTime: { hour: 9, minute: 0 },
        priority: 'MEDIUM',
        enabled: true,
      });

      loadRecurringTasks();
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to add recurring task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecurringTask = async (index: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/recurring-tasks?index=${index}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete recurring task');
      }

      toast({
        title: 'Task Deleted',
        description: 'Recurring task has been removed successfully.',
      });

      loadRecurringTasks();
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete recurring task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const convertToCronExpression = (task: RecurringTask): string => {
    const { hour, minute } = task.scheduledTime;

    switch (task.frequency) {
      case 'DAILY':
        return `${minute} ${hour} * * *`;
      case 'WEEKLY':
        const dayNum = task.dayOfWeek
          ? DAYS_OF_WEEK.indexOf(task.dayOfWeek)
          : 1;
        return `${minute} ${hour} * * ${dayNum}`;
      case 'MONTHLY':
        return `${minute} ${hour} ${task.dayOfMonth || 1} * *`;
      default:
        return `${minute} ${hour} * * *`;
    }
  };

  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <div className='space-y-6'>
      {/* Work Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Work Schedule
          </CardTitle>
          <CardDescription>
            Configure working hours, active days, and timezone for this
            orchestrator
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Timezone */}
          <div className='space-y-2'>
            <Label htmlFor='timezone'>Timezone</Label>
            <Select
              value={schedule.timezone}
              onValueChange={value => {
                setSchedule({ ...schedule, timezone: value });
                setIsDirty(true);
              }}
              disabled={disabled || isLoading}
            >
              <SelectTrigger id='timezone'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Work Hours */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>Start Time</Label>
              <div className='flex gap-2'>
                <Input
                  type='number'
                  min='0'
                  max='23'
                  value={schedule.workHours.startHour}
                  onChange={e => {
                    setSchedule({
                      ...schedule,
                      workHours: {
                        ...schedule.workHours,
                        startHour: parseInt(e.target.value) || 0,
                      },
                    });
                    setIsDirty(true);
                  }}
                  disabled={disabled || isLoading}
                  className='w-20'
                  placeholder='HH'
                />
                <Input
                  type='number'
                  min='0'
                  max='59'
                  value={schedule.workHours.startMinute}
                  onChange={e => {
                    setSchedule({
                      ...schedule,
                      workHours: {
                        ...schedule.workHours,
                        startMinute: parseInt(e.target.value) || 0,
                      },
                    });
                    setIsDirty(true);
                  }}
                  disabled={disabled || isLoading}
                  className='w-20'
                  placeholder='MM'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label>End Time</Label>
              <div className='flex gap-2'>
                <Input
                  type='number'
                  min='0'
                  max='23'
                  value={schedule.workHours.endHour}
                  onChange={e => {
                    setSchedule({
                      ...schedule,
                      workHours: {
                        ...schedule.workHours,
                        endHour: parseInt(e.target.value) || 0,
                      },
                    });
                    setIsDirty(true);
                  }}
                  disabled={disabled || isLoading}
                  className='w-20'
                  placeholder='HH'
                />
                <Input
                  type='number'
                  min='0'
                  max='59'
                  value={schedule.workHours.endMinute}
                  onChange={e => {
                    setSchedule({
                      ...schedule,
                      workHours: {
                        ...schedule.workHours,
                        endMinute: parseInt(e.target.value) || 0,
                      },
                    });
                    setIsDirty(true);
                  }}
                  disabled={disabled || isLoading}
                  className='w-20'
                  placeholder='MM'
                />
              </div>
            </div>
          </div>

          {/* Active Days */}
          <div className='space-y-2'>
            <Label>Active Days</Label>
            <div className='flex flex-wrap gap-2'>
              {DAYS_OF_WEEK.map(day => (
                <Button
                  key={day}
                  type='button'
                  variant={
                    schedule.activeDays.includes(day) ? 'default' : 'outline'
                  }
                  size='sm'
                  onClick={() => {
                    const newActiveDays = schedule.activeDays.includes(day)
                      ? schedule.activeDays.filter(d => d !== day)
                      : [...schedule.activeDays, day];
                    setSchedule({ ...schedule, activeDays: newActiveDays });
                    setIsDirty(true);
                  }}
                  disabled={disabled || isLoading}
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className='flex justify-end'>
            <Button
              onClick={handleSaveSchedule}
              disabled={disabled || isLoading || !isDirty}
            >
              {isLoading ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Availability Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CalendarIcon className='h-5 w-5' />
            Availability Calendar
          </CardTitle>
          <CardDescription>
            View orchestrator availability and scheduled tasks
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col items-center gap-4 lg:flex-row lg:items-start'>
            <Calendar
              mode='single'
              selected={selectedDate}
              onSelect={setSelectedDate}
              className='rounded-md border'
              disabled={disabled}
            />

            {selectedDate && availabilityData && (
              <div className='flex-1 space-y-4'>
                <div>
                  <h4 className='mb-2 font-semibold'>
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h4>
                  <Badge
                    variant={
                      availabilityData.isAvailable ? 'default' : 'destructive'
                    }
                  >
                    {availabilityData.isAvailable ? 'Available' : 'Busy'}
                  </Badge>
                </div>

                {availabilityData.conflicts &&
                  availabilityData.conflicts.length > 0 && (
                    <div className='space-y-2'>
                      <h5 className='text-sm font-medium'>Scheduled Tasks:</h5>
                      {availabilityData.conflicts.map((conflict, idx) => (
                        <div
                          key={idx}
                          className='rounded-lg border bg-muted p-3 text-sm'
                        >
                          <div className='font-medium'>
                            {conflict.taskTitle}
                          </div>
                          <div className='text-muted-foreground text-xs'>
                            {new Date(conflict.start).toLocaleTimeString()} -{' '}
                            {new Date(conflict.end).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recurring Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Recurring Tasks</CardTitle>
          <CardDescription>
            Set up tasks that run automatically on a schedule
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Add New Task Form */}
          <div className='space-y-4 rounded-lg border p-4'>
            <h4 className='font-semibold'>Add Recurring Task</h4>

            <div className='grid gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='task-title'>Title *</Label>
                <Input
                  id='task-title'
                  value={newTask.title}
                  onChange={e =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  placeholder='e.g., Daily standup summary'
                  disabled={disabled || isLoading}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='task-description'>Description</Label>
                <Textarea
                  id='task-description'
                  value={newTask.description || ''}
                  onChange={e =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  placeholder='Task details...'
                  disabled={disabled || isLoading}
                  rows={2}
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-3'>
                <div className='space-y-2'>
                  <Label htmlFor='task-frequency'>Frequency</Label>
                  <Select
                    value={newTask.frequency}
                    onValueChange={value =>
                      setNewTask({
                        ...newTask,
                        frequency: value as RecurringTask['frequency'],
                      })
                    }
                    disabled={disabled || isLoading}
                  >
                    <SelectTrigger id='task-frequency'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='DAILY'>Daily</SelectItem>
                      <SelectItem value='WEEKLY'>Weekly</SelectItem>
                      <SelectItem value='MONTHLY'>Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newTask.frequency === 'WEEKLY' && (
                  <div className='space-y-2'>
                    <Label htmlFor='task-day-of-week'>Day of Week</Label>
                    <Select
                      value={newTask.dayOfWeek}
                      onValueChange={value =>
                        setNewTask({ ...newTask, dayOfWeek: value })
                      }
                      disabled={disabled || isLoading}
                    >
                      <SelectTrigger id='task-day-of-week'>
                        <SelectValue placeholder='Select day' />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(day => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newTask.frequency === 'MONTHLY' && (
                  <div className='space-y-2'>
                    <Label htmlFor='task-day-of-month'>Day of Month</Label>
                    <Input
                      id='task-day-of-month'
                      type='number'
                      min='1'
                      max='31'
                      value={newTask.dayOfMonth || 1}
                      onChange={e =>
                        setNewTask({
                          ...newTask,
                          dayOfMonth: parseInt(e.target.value) || 1,
                        })
                      }
                      disabled={disabled || isLoading}
                    />
                  </div>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='task-priority'>Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={value =>
                      setNewTask({
                        ...newTask,
                        priority: value as RecurringTask['priority'],
                      })
                    }
                    disabled={disabled || isLoading}
                  >
                    <SelectTrigger id='task-priority'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='LOW'>Low</SelectItem>
                      <SelectItem value='MEDIUM'>Medium</SelectItem>
                      <SelectItem value='HIGH'>High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>Scheduled Time</Label>
                  <div className='flex gap-2'>
                    <Input
                      type='number'
                      min='0'
                      max='23'
                      value={newTask.scheduledTime.hour}
                      onChange={e =>
                        setNewTask({
                          ...newTask,
                          scheduledTime: {
                            ...newTask.scheduledTime,
                            hour: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      disabled={disabled || isLoading}
                      className='w-20'
                      placeholder='HH'
                    />
                    <Input
                      type='number'
                      min='0'
                      max='59'
                      value={newTask.scheduledTime.minute}
                      onChange={e =>
                        setNewTask({
                          ...newTask,
                          scheduledTime: {
                            ...newTask.scheduledTime,
                            minute: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      disabled={disabled || isLoading}
                      className='w-20'
                      placeholder='MM'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='task-estimated-hours'>Estimated Hours</Label>
                  <Input
                    id='task-estimated-hours'
                    type='number'
                    min='0'
                    step='0.5'
                    value={newTask.estimatedHours || ''}
                    onChange={e =>
                      setNewTask({
                        ...newTask,
                        estimatedHours: parseFloat(e.target.value) || undefined,
                      })
                    }
                    placeholder='e.g., 2'
                    disabled={disabled || isLoading}
                  />
                </div>
              </div>

              <Button
                onClick={handleAddRecurringTask}
                disabled={disabled || isLoading || !newTask.title.trim()}
                className='w-full sm:w-auto'
              >
                <Plus className='mr-2 h-4 w-4' />
                Add Recurring Task
              </Button>
            </div>
          </div>

          {/* Existing Recurring Tasks */}
          {recurringTasks.length > 0 ? (
            <div className='space-y-3'>
              <h4 className='font-semibold'>Active Recurring Tasks</h4>
              {recurringTasks.map((task, index) => (
                <div
                  key={index}
                  className='flex items-start justify-between rounded-lg border p-4'
                >
                  <div className='flex-1 space-y-1'>
                    <div className='flex items-center gap-2'>
                      <h5 className='font-medium'>{task.title}</h5>
                      <Badge variant='outline'>{task.frequency}</Badge>
                      <Badge
                        variant={
                          task.priority === 'HIGH'
                            ? 'destructive'
                            : task.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className='text-muted-foreground text-sm'>
                        {task.description}
                      </p>
                    )}
                    <div className='text-muted-foreground flex gap-4 text-xs'>
                      <span>
                        Time:{' '}
                        {formatTime(
                          task.scheduledTime.hour,
                          task.scheduledTime.minute
                        )}
                      </span>
                      {task.dayOfWeek && <span>Day: {task.dayOfWeek}</span>}
                      {task.dayOfMonth && (
                        <span>Day of Month: {task.dayOfMonth}</span>
                      )}
                      {task.estimatedHours && (
                        <span>Est: {task.estimatedHours}h</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleDeleteRecurringTask(index)}
                    disabled={disabled || isLoading}
                  >
                    <Trash2 className='h-4 w-4 text-destructive' />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-muted-foreground text-center text-sm'>
              No recurring tasks configured yet. Add one above to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
