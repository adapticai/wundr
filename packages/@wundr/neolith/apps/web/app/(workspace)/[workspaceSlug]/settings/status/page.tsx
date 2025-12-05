'use client';

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Globe,
  Info,
  Loader2,
  Moon,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { EmojiPicker } from '@/components/status/emoji-picker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  statusUpdateSchema,
  workingHoursSchema,
  outOfOfficeSchema,
  scheduledStatusSchema,
  STATUS_TYPES,
  type StatusUpdateInput,
  type WorkingHoursInput,
  type OutOfOfficeInput,
  type ScheduledStatusInput,
} from '@/lib/validations/status';
import { cn } from '@/lib/utils';

const STATUS_PRESETS = [
  { emoji: '🟢', message: 'Available', type: 'available' as const },
  { emoji: '💬', message: 'In a meeting', type: 'busy' as const },
  { emoji: '🍽️', message: 'At lunch', type: 'away' as const },
  { emoji: '🏖️', message: 'On vacation', type: 'away' as const },
  { emoji: '🏠', message: 'Working from home', type: 'available' as const },
  { emoji: '🎯', message: 'Focusing', type: 'dnd' as const },
  { emoji: '🚀', message: 'Deploying', type: 'busy' as const },
  { emoji: '☕', message: 'Coffee break', type: 'away' as const },
];

const CLEAR_OPTIONS = [
  { label: "Don't clear", value: null },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: 'Today', value: 1440 },
];

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const TIMEZONES = Intl.supportedValuesOf('timeZone').slice(0, 50);

export default function StatusSettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [scheduledStatuses, setScheduledStatuses] = useState<ScheduledStatusInput[]>([]);

  // Status form
  const statusForm = useForm<StatusUpdateInput>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: {
      emoji: '🟢',
      message: '',
      type: 'available',
      clearAt: undefined,
    },
  });

  // Working hours form
  const workingHoursForm = useForm<WorkingHoursInput>({
    resolver: zodResolver(workingHoursSchema),
    defaultValues: {
      enabled: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  // Out of office form
  const outOfOfficeForm = useForm<OutOfOfficeInput>({
    resolver: zodResolver(outOfOfficeSchema),
    defaultValues: {
      enabled: false,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      autoReply: '',
      forwardTo: '',
    },
  });

  // Load current status and settings
  useEffect(() => {
    const loadData = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);

        // Load current status
        const statusResponse = await fetch('/api/users/me/status');
        if (statusResponse.ok) {
          const { data } = await statusResponse.json();
          setCurrentStatus(data);
          if (data) {
            statusForm.reset({
              emoji: data.emoji || '🟢',
              message: data.message || '',
              type: data.type || 'available',
            });
          }
        }

        // Load settings
        const settingsResponse = await fetch('/api/users/me/availability');
        if (settingsResponse.ok) {
          const { data } = await settingsResponse.json();

          if (data.workingHours) {
            workingHoursForm.reset(data.workingHours);
          }

          if (data.outOfOffice) {
            outOfOfficeForm.reset(data.outOfOffice);
          }

          if (data.scheduledStatuses) {
            setScheduledStatuses(data.scheduledStatuses);
          }
        }

        // Load status history
        const historyResponse = await fetch('/api/users/me/status/history');
        if (historyResponse.ok) {
          const { data } = await historyResponse.json();
          setStatusHistory(data || []);
        }
      } catch (error) {
        console.error('Failed to load status settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load status settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [session, toast, statusForm, workingHoursForm, outOfOfficeForm]);

  // Update status
  const onStatusSubmit = async (data: StatusUpdateInput) => {
    if (!session?.user?.id) return;

    setIsSaving(true);

    try {
      const payload = {
        ...data,
        expiresAt: data.clearAt
          ? new Date(Date.now() + data.clearAt * 60000).toISOString()
          : null,
      };

      const response = await fetch('/api/users/me/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      const { data: updatedStatus } = await response.json();
      setCurrentStatus(updatedStatus);

      toast({
        title: 'Success',
        description: 'Status updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Clear status
  const handleClearStatus = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/users/me/status', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear status');
      }

      setCurrentStatus(null);
      statusForm.reset({
        emoji: '🟢',
        message: '',
        type: 'available',
      });

      toast({
        title: 'Success',
        description: 'Status cleared successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear status',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Apply preset
  const applyPreset = (preset: typeof STATUS_PRESETS[0]) => {
    statusForm.setValue('emoji', preset.emoji);
    statusForm.setValue('message', preset.message);
    statusForm.setValue('type', preset.type);
  };

  // Save working hours
  const onWorkingHoursSubmit = async (data: WorkingHoursInput) => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/users/me/availability/working-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update working hours');
      }

      toast({
        title: 'Success',
        description: 'Working hours updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update working hours',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save out of office
  const onOutOfOfficeSubmit = async (data: OutOfOfficeInput) => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/users/me/availability/out-of-office', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update out of office settings');
      }

      toast({
        title: 'Success',
        description: 'Out of office settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update out of office settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Status & Availability</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your status, working hours, and availability settings.
        </p>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
          <TabsTrigger value="out-of-office">Out of Office</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-6">
          {/* Current Status Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
              <CardDescription>
                Your status is visible to members in your workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                {currentStatus ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{currentStatus.emoji}</span>
                    <div>
                      <p className="font-medium">{currentStatus.message}</p>
                      <p className="text-sm text-muted-foreground">
                        {STATUS_TYPES.find(t => t === currentStatus.type) || 'available'}
                      </p>
                      {currentStatus.expiresAt && (
                        <p className="text-xs text-muted-foreground">
                          Until {new Date(currentStatus.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No status set</p>
                )}
                {currentStatus && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearStatus}
                    disabled={isSaving}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Set Status Form */}
          <Card>
            <CardHeader>
              <CardTitle>Set Your Status</CardTitle>
              <CardDescription>
                Choose a status to let others know what you're up to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...statusForm}>
                <form
                  onSubmit={statusForm.handleSubmit(onStatusSubmit)}
                  className="space-y-6"
                >
                  {/* Quick Presets */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      Quick presets
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STATUS_PRESETS.map((preset, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={cn(
                            'flex items-center gap-2 p-3 rounded-lg border text-left',
                            'hover:bg-accent hover:border-primary transition-colors',
                            statusForm.watch('emoji') === preset.emoji &&
                              statusForm.watch('message') === preset.message &&
                              'bg-accent border-primary',
                          )}
                        >
                          <span className="text-xl">{preset.emoji}</span>
                          <span className="text-sm font-medium truncate">
                            {preset.message}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Status */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Custom status</Label>

                    <div className="flex gap-3">
                      <FormField
                        control={statusForm.control}
                        name="emoji"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <EmojiPicker value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={statusForm.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="What's your status?"
                                {...field}
                                maxLength={100}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={statusForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="available" id="available" />
                                <Label htmlFor="available" className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  Available
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="busy" id="busy" />
                                <Label htmlFor="busy" className="flex items-center gap-2">
                                  <Circle className="h-4 w-4 text-red-500" />
                                  Busy
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="away" id="away" />
                                <Label htmlFor="away" className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-yellow-500" />
                                  Away
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="dnd" id="dnd" />
                                <Label htmlFor="dnd" className="flex items-center gap-2">
                                  <Moon className="h-4 w-4 text-red-500" />
                                  DND
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={statusForm.control}
                      name="clearAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clear status after</FormLabel>
                          <Select
                            onValueChange={value =>
                              field.onChange(value === 'null' ? undefined : Number(value))
                            }
                            value={field.value?.toString() || 'null'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Don't clear automatically" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CLEAR_OPTIONS.map(option => (
                                <SelectItem
                                  key={option.label}
                                  value={option.value?.toString() || 'null'}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Automatically clear your status after a set time period.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Status'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClearStatus}
                      disabled={isSaving || !currentStatus}
                    >
                      Clear Status
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Working Hours Tab */}
        <TabsContent value="working-hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Working Hours</CardTitle>
              <CardDescription>
                Set your typical working hours so others know when to reach you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...workingHoursForm}>
                <form
                  onSubmit={workingHoursForm.handleSubmit(onWorkingHoursSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={workingHoursForm.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable working hours</FormLabel>
                          <FormDescription>
                            Show when you're typically available for work
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {workingHoursForm.watch('enabled') && (
                    <>
                      <FormField
                        control={workingHoursForm.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {TIMEZONES.map(tz => (
                                  <SelectItem key={tz} value={tz}>
                                    {tz.replace(/_/g, ' ')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-4">
                        <Label>Working hours by day</Label>
                        {DAYS_OF_WEEK.map(day => (
                          <div
                            key={day.key}
                            className="flex items-center gap-4 p-4 rounded-lg border"
                          >
                            <div className="flex items-center gap-2 w-32">
                              <Switch
                                checked={workingHoursForm.watch(`${day.key}.enabled` as any)}
                                onCheckedChange={checked =>
                                  workingHoursForm.setValue(`${day.key}.enabled` as any, checked)
                                }
                              />
                              <Label className="font-medium">{day.label}</Label>
                            </div>

                            {workingHoursForm.watch(`${day.key}.enabled` as any) && (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  type="time"
                                  {...workingHoursForm.register(`${day.key}.start` as any)}
                                  className="w-32"
                                />
                                <span className="text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  {...workingHoursForm.register(`${day.key}.end` as any)}
                                  className="w-32"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Working Hours'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Out of Office Tab */}
        <TabsContent value="out-of-office" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Out of Office</CardTitle>
              <CardDescription>
                Set up automatic replies when you're away from work.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...outOfOfficeForm}>
                <form
                  onSubmit={outOfOfficeForm.handleSubmit(onOutOfOfficeSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={outOfOfficeForm.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable out of office
                          </FormLabel>
                          <FormDescription>
                            Automatically respond to messages when you're away
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {outOfOfficeForm.watch('enabled') && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={outOfOfficeForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start date</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  {...field}
                                  value={
                                    field.value
                                      ? new Date(field.value)
                                          .toISOString()
                                          .slice(0, 16)
                                      : ''
                                  }
                                  onChange={e =>
                                    field.onChange(new Date(e.target.value).toISOString())
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={outOfOfficeForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End date</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  {...field}
                                  value={
                                    field.value
                                      ? new Date(field.value)
                                          .toISOString()
                                          .slice(0, 16)
                                      : ''
                                  }
                                  onChange={e =>
                                    field.onChange(new Date(e.target.value).toISOString())
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={outOfOfficeForm.control}
                        name="autoReply"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Auto-reply message</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="I'm currently out of office and will respond when I return..."
                                rows={4}
                                {...field}
                                maxLength={500}
                              />
                            </FormControl>
                            <FormDescription>
                              This message will be sent automatically to people who contact
                              you
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={outOfOfficeForm.control}
                        name="forwardTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Forward messages to (optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="colleague@example.com"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Forward urgent messages to a colleague
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Out of Office Settings'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
              <CardDescription>
                View your recent status changes and quickly reuse them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusHistory.length > 0 ? (
                <div className="space-y-2">
                  {statusHistory.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.emoji}</span>
                        <div>
                          <p className="font-medium">{item.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          statusForm.setValue('emoji', item.emoji);
                          statusForm.setValue('message', item.message);
                          statusForm.setValue('type', item.type);
                        }}
                      >
                        Reuse
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No status history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
