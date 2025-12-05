'use client';

import * as React from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ScheduleConfig } from './schedule-config';

import type { Schedule } from './schedule-config';

/**
 * Demo component showcasing the ScheduleConfig component
 *
 * This demonstrates:
 * - Creating new schedules
 * - Managing multiple schedules
 * - Enabling/disabling schedules
 * - Deleting schedules
 * - Visual cron expression builder
 * - Schedule preview with next N runs
 * - Calendar view of scheduled runs
 * - Timezone selection
 */
export function ScheduleConfigDemo() {
  const [schedules, setSchedules] = React.useState<Schedule[]>([
    {
      id: '1',
      name: 'Daily Morning Report',
      cron: '0 9 * * *',
      timezone: 'America/New_York',
      enabled: true,
      nextRuns: [
        new Date('2024-12-06T09:00:00'),
        new Date('2024-12-07T09:00:00'),
        new Date('2024-12-08T09:00:00'),
        new Date('2024-12-09T09:00:00'),
        new Date('2024-12-10T09:00:00'),
      ],
      description: 'Send daily summary report to team',
      createdAt: new Date('2024-12-01T10:00:00'),
    },
    {
      id: '2',
      name: 'Weekly Monday Standup',
      cron: '0 9 * * 1',
      timezone: 'America/Los_Angeles',
      enabled: true,
      nextRuns: [
        new Date('2024-12-09T09:00:00'),
        new Date('2024-12-16T09:00:00'),
        new Date('2024-12-23T09:00:00'),
        new Date('2024-12-30T09:00:00'),
        new Date('2025-01-06T09:00:00'),
      ],
      description: 'Prepare standup notes every Monday',
      createdAt: new Date('2024-12-01T10:05:00'),
    },
    {
      id: '3',
      name: 'Hourly System Check',
      cron: '0 * * * *',
      timezone: 'UTC',
      enabled: false,
      nextRuns: [
        new Date('2024-12-05T20:00:00'),
        new Date('2024-12-05T21:00:00'),
        new Date('2024-12-05T22:00:00'),
        new Date('2024-12-05T23:00:00'),
        new Date('2024-12-06T00:00:00'),
      ],
      description: 'Check system health every hour',
      createdAt: new Date('2024-12-01T10:10:00'),
    },
  ]);

  const handleScheduleAdd = (schedule: Omit<Schedule, 'id' | 'createdAt'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };
    setSchedules([...schedules, newSchedule]);
    toast.success('Schedule created successfully', {
      description: `"${schedule.name}" has been added`,
    });
  };

  const handleScheduleUpdate = (
    scheduleId: string,
    updates: Partial<Schedule>
  ) => {
    setSchedules(
      schedules.map(s => (s.id === scheduleId ? { ...s, ...updates } : s))
    );
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) {
      if ('enabled' in updates) {
        toast.success(`Schedule ${updates.enabled ? 'enabled' : 'disabled'}`, {
          description: `"${schedule.name}" is now ${updates.enabled ? 'active' : 'paused'}`,
        });
      } else {
        toast.success('Schedule updated', {
          description: `"${schedule.name}" has been modified`,
        });
      }
    }
  };

  const handleScheduleDelete = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    setSchedules(schedules.filter(s => s.id !== scheduleId));
    if (schedule) {
      toast.success('Schedule deleted', {
        description: `"${schedule.name}" has been removed`,
      });
    }
  };

  return (
    <div className='container mx-auto py-8 space-y-8'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>
          Workflow Schedule Configuration
        </h1>
        <p className='text-muted-foreground'>
          Configure when workflows should run automatically using cron
          expressions
        </p>
      </div>

      <Tabs defaultValue='interactive' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='interactive'>Interactive Demo</TabsTrigger>
          <TabsTrigger value='examples'>Usage Examples</TabsTrigger>
          <TabsTrigger value='features'>Features</TabsTrigger>
        </TabsList>

        <TabsContent value='interactive' className='space-y-4'>
          <ScheduleConfig
            workflowId='demo-workflow'
            schedules={schedules}
            onScheduleAdd={handleScheduleAdd}
            onScheduleUpdate={handleScheduleUpdate}
            onScheduleDelete={handleScheduleDelete}
            maxSchedules={10}
          />
        </TabsContent>

        <TabsContent value='examples' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Usage Examples</CardTitle>
              <CardDescription>
                Common patterns for using the ScheduleConfig component
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div>
                <h3 className='font-semibold mb-2'>Basic Usage</h3>
                <pre className='bg-muted p-4 rounded-lg overflow-x-auto text-xs'>
                  {`import { ScheduleConfig } from '@/components/workflow/schedule-config';

function MyWorkflowEditor() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  return (
    <ScheduleConfig
      workflowId="my-workflow"
      schedules={schedules}
      onScheduleAdd={(schedule) => {
        // Handle adding schedule
        setSchedules([...schedules, {
          ...schedule,
          id: generateId(),
          createdAt: new Date()
        }]);
      }}
      onScheduleUpdate={(id, updates) => {
        // Handle updating schedule
        setSchedules(schedules.map(s =>
          s.id === id ? { ...s, ...updates } : s
        ));
      }}
      onScheduleDelete={(id) => {
        // Handle deleting schedule
        setSchedules(schedules.filter(s => s.id !== id));
      }}
    />
  );
}`}
                </pre>
              </div>

              <div>
                <h3 className='font-semibold mb-2'>With API Integration</h3>
                <pre className='bg-muted p-4 rounded-lg overflow-x-auto text-xs'>
                  {`import { ScheduleConfig } from '@/components/workflow/schedule-config';
import { useSchedules } from '@/hooks/use-schedules';

function WorkflowScheduler({ workflowId }: { workflowId: string }) {
  const { schedules, createSchedule, updateSchedule, deleteSchedule } =
    useSchedules(workflowId);

  return (
    <ScheduleConfig
      workflowId={workflowId}
      schedules={schedules}
      onScheduleAdd={async (schedule) => {
        await createSchedule(schedule);
      }}
      onScheduleUpdate={async (id, updates) => {
        await updateSchedule(id, updates);
      }}
      onScheduleDelete={async (id) => {
        await deleteSchedule(id);
      }}
      maxSchedules={5}
    />
  );
}`}
                </pre>
              </div>

              <div>
                <h3 className='font-semibold mb-2'>Common Cron Patterns</h3>
                <div className='space-y-2'>
                  <div className='grid grid-cols-2 gap-2 text-sm'>
                    <code className='bg-muted p-2 rounded'>* * * * *</code>
                    <span>Every minute</span>

                    <code className='bg-muted p-2 rounded'>*/5 * * * *</code>
                    <span>Every 5 minutes</span>

                    <code className='bg-muted p-2 rounded'>0 * * * *</code>
                    <span>Every hour</span>

                    <code className='bg-muted p-2 rounded'>0 9 * * *</code>
                    <span>Every day at 9 AM</span>

                    <code className='bg-muted p-2 rounded'>0 9 * * 1</code>
                    <span>Every Monday at 9 AM</span>

                    <code className='bg-muted p-2 rounded'>0 9 1 * *</code>
                    <span>First day of month at 9 AM</span>

                    <code className='bg-muted p-2 rounded'>0 0 * * 0</code>
                    <span>Every Sunday at midnight</span>

                    <code className='bg-muted p-2 rounded'>0 12 1 1 *</code>
                    <span>January 1st at noon</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='features' className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Visual Cron Builder</CardTitle>
              </CardHeader>
              <CardContent className='text-sm space-y-2'>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>Preset schedules for common patterns</li>
                  <li>Advanced mode for custom cron expressions</li>
                  <li>
                    Individual field configuration (minute, hour, day, etc.)
                  </li>
                  <li>Real-time validation and preview</li>
                  <li>Human-readable schedule descriptions</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Schedule Preview</CardTitle>
              </CardHeader>
              <CardContent className='text-sm space-y-2'>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>Shows next 5 scheduled runs</li>
                  <li>Date and time formatting</li>
                  <li>Timezone-aware calculations</li>
                  <li>Visual countdown indicators</li>
                  <li>Sortable by date/time</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Timezone Support</CardTitle>
              </CardHeader>
              <CardContent className='text-sm space-y-2'>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>10+ common timezones</li>
                  <li>Timezone-aware scheduling</li>
                  <li>Automatic DST handling</li>
                  <li>Per-schedule timezone configuration</li>
                  <li>Display in user's local time</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Schedule Management</CardTitle>
              </CardHeader>
              <CardContent className='text-sm space-y-2'>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>Multiple schedules per workflow</li>
                  <li>Enable/disable schedules</li>
                  <li>Schedule descriptions and metadata</li>
                  <li>Quick toggle for pausing schedules</li>
                  <li>Deletion with confirmation</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Calendar View</CardTitle>
              </CardHeader>
              <CardContent className='text-sm space-y-2'>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>Visual calendar with scheduled dates</li>
                  <li>Highlights days with runs</li>
                  <li>Click to view schedules for date</li>
                  <li>Month/year navigation</li>
                  <li>Shows all active schedules</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>User Experience</CardTitle>
              </CardHeader>
              <CardContent className='text-sm space-y-2'>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                  <li>Responsive design (mobile-friendly)</li>
                  <li>Dark mode support</li>
                  <li>Toast notifications for actions</li>
                  <li>Accessible keyboard navigation</li>
                  <li>Inline help and tooltips</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ScheduleConfigDemo;
