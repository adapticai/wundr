'use client';

/**
 * Schedule Dialog Component
 * Configure report scheduling and delivery
 */

import { Calendar, Mail, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import type { ReportSchedule, ScheduleFrequency } from '../types';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ReportSchedule;
  onScheduleChange: (schedule: ReportSchedule | undefined) => void;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onScheduleChange,
}: ScheduleDialogProps) {
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const [frequency, setFrequency] = useState<ScheduleFrequency>(
    schedule?.frequency ?? 'daily'
  );
  const [time, setTime] = useState(schedule?.time ?? '09:00');
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(schedule?.dayOfMonth ?? 1);
  const [cronExpression, setCronExpression] = useState(
    schedule?.cronExpression ?? ''
  );
  const [recipients, setRecipients] = useState<string[]>(
    schedule?.recipients ?? []
  );
  const [recipientInput, setRecipientInput] = useState('');
  const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>(
    schedule?.format ?? 'pdf'
  );

  useEffect(() => {
    if (schedule) {
      setEnabled(schedule.enabled);
      setFrequency(schedule.frequency);
      setTime(schedule.time ?? '09:00');
      setDayOfWeek(schedule.dayOfWeek ?? 1);
      setDayOfMonth(schedule.dayOfMonth ?? 1);
      setCronExpression(schedule.cronExpression ?? '');
      setRecipients(schedule.recipients);
      setFormat(schedule.format);
    }
  }, [schedule]);

  const handleSave = () => {
    const newSchedule: ReportSchedule = {
      enabled,
      frequency,
      time,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      cronExpression: frequency === 'custom' ? cronExpression : undefined,
      recipients,
      format,
    };

    onScheduleChange(newSchedule);
    onOpenChange(false);
  };

  const handleAddRecipient = () => {
    if (recipientInput && !recipients.includes(recipientInput)) {
      setRecipients([...recipients, recipientInput]);
      setRecipientInput('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const getScheduleSummary = () => {
    if (!enabled) return 'Disabled';

    const parts: string[] = [];

    switch (frequency) {
      case 'daily':
        parts.push(`Daily at ${time}`);
        break;
      case 'weekly':
        parts.push(`Weekly on ${DAYS_OF_WEEK[dayOfWeek]} at ${time}`);
        break;
      case 'monthly':
        parts.push(`Monthly on day ${dayOfMonth} at ${time}`);
        break;
      case 'custom':
        parts.push(`Custom: ${cronExpression || 'Not configured'}`);
        break;
    }

    if (recipients.length > 0) {
      parts.push(`to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`);
    }

    return parts.join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule Report</DialogTitle>
          <DialogDescription>
            Configure automatic report generation and delivery
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Scheduling</Label>
              <div className="text-sm text-muted-foreground">
                Automatically generate and send this report
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <Separator />

          {/* Frequency */}
          <div className="space-y-3">
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as ScheduleFrequency)}
              disabled={!enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom (Cron)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time */}
          <div className="space-y-3">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!enabled || frequency === 'custom'}
                className="max-w-[200px]"
              />
            </div>
          </div>

          {/* Weekly - Day of Week */}
          {frequency === 'weekly' && (
            <div className="space-y-3">
              <Label>Day of Week</Label>
              <Select
                value={String(dayOfWeek)}
                onValueChange={(v) => setDayOfWeek(parseInt(v))}
                disabled={!enabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Monthly - Day of Month */}
          {frequency === 'monthly' && (
            <div className="space-y-3">
              <Label>Day of Month</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                disabled={!enabled}
                className="max-w-[200px]"
              />
            </div>
          )}

          {/* Custom - Cron Expression */}
          {frequency === 'custom' && (
            <div className="space-y-3">
              <Label>Cron Expression</Label>
              <Input
                placeholder="0 9 * * *"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Use standard cron syntax (minute hour day month weekday)
              </p>
            </div>
          )}

          <Separator />

          {/* Recipients */}
          <div className="space-y-3">
            <Label>Recipients</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRecipient();
                  }
                }}
                disabled={!enabled}
              />
              <Button
                variant="outline"
                onClick={handleAddRecipient}
                disabled={!enabled || !recipientInput}
              >
                Add
              </Button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipients.map((email) => (
                  <Badge key={email} variant="secondary">
                    <Mail className="h-3 w-3 mr-1" />
                    {email}
                    <button
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-2 hover:text-destructive"
                      disabled={!enabled}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Export Format */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as 'pdf' | 'csv' | 'xlsx')}
              disabled={!enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-start gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Schedule Summary</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {getScheduleSummary()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
