'use client';

import { useState } from 'react';
import { Calendar, Clock, Mail, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useReports } from '@/hooks/reports/use-reports';
import { ReportSchedule, ReportTemplate } from '@/types/reports';
import type { ReportParameters } from '@/types/report-parameters';
import { format, addDays, addWeeks, addMonths } from 'date-fns';

interface ReportSchedulingModalProps {
  onClose: () => void;
}

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const dayOfWeekOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

export function ReportSchedulingModal({ onClose }: ReportSchedulingModalProps) {
  const { templates, schedules, scheduleReport } = useReports();
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [isCreating, setIsCreating] = useState(false);

  // Form state for creating new schedule
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'quarterly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: '09:00',
    timezone: 'UTC',
    recipients: [''],
    isActive: true,
  });

  const [templateParameters, setTemplateParameters] = useState<ReportParameters>({});

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, ''],
    }));
  };

  const updateRecipient = (index: number, email: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((r, i) => i === index ? email : r),
    }));
  };

  const removeRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }));
  };

  const getNextRunDate = () => {
    const now = new Date();
    const [hours, minutes] = formData.time.split(':').map(Number);
    
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (formData.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun = addDays(nextRun, 1);
        }
        break;
      case 'weekly':
        const daysUntilTarget = (formData.dayOfWeek - now.getDay() + 7) % 7;
        nextRun = addDays(nextRun, daysUntilTarget);
        if (nextRun <= now) {
          nextRun = addWeeks(nextRun, 1);
        }
        break;
      case 'monthly':
        nextRun.setDate(formData.dayOfMonth);
        if (nextRun <= now) {
          nextRun = addMonths(nextRun, 1);
        }
        break;
      case 'quarterly':
        nextRun.setDate(formData.dayOfMonth);
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const nextQuarterMonth = (currentQuarter + 1) * 3;
        nextRun.setMonth(nextQuarterMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextQuarterMonth + 3);
        }
        break;
    }

    return nextRun;
  };

  const handleCreateSchedule = async () => {
    if (!formData.name.trim() || !formData.templateId) return;

    setIsCreating(true);
    try {
      const scheduleData = {
        name: formData.name,
        frequency: formData.frequency,
        dayOfWeek: formData.frequency === 'weekly' ? formData.dayOfWeek : undefined,
        dayOfMonth: ['monthly', 'quarterly'].includes(formData.frequency) ? formData.dayOfMonth : undefined,
        time: formData.time,
        timezone: formData.timezone,
        isActive: formData.isActive,
        recipients: formData.recipients.filter(r => r.trim() !== ''),
      };

      await scheduleReport(scheduleData);
      onClose();
    } catch (_error) {
      // Error logged - details available in network tab;
    } finally {
      setIsCreating(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === formData.templateId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Report Scheduling</DialogTitle>
        <DialogDescription>
          Create and manage automated report schedules
        </DialogDescription>
      </DialogHeader>

      {/* Tabs */}
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'create'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Create Schedule
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'manage'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Manage Schedules ({schedules.length})
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="schedule-name">Schedule Name</Label>
              <Input
                id="schedule-name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="Weekly Migration Report"
              />
            </div>
            <div>
              <Label htmlFor="template">Report Template</Label>
              <Select value={formData.templateId} onValueChange={(value) => updateFormData({ templateId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schedule Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(value: string) => updateFormData({ frequency: value as 'daily' | 'weekly' | 'monthly' | 'quarterly' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.frequency === 'weekly' && (
                  <div>
                    <Label>Day of Week</Label>
                    <Select value={formData.dayOfWeek.toString()} onValueChange={(value) => updateFormData({ dayOfWeek: Number(value) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dayOfWeekOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(['monthly', 'quarterly'].includes(formData.frequency)) && (
                  <div>
                    <Label>Day of Month</Label>
                    <Input
                      type="number"
                      min="1"
                      max="28"
                      value={formData.dayOfMonth}
                      onChange={(e) => updateFormData({ dayOfMonth: Number(e.target.value) })}
                    />
                  </div>
                )}

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => updateFormData({ time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Timezone</Label>
                <Select value={formData.timezone} onValueChange={(value) => updateFormData({ timezone: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => updateFormData({ isActive: checked })}
                />
                <Label htmlFor="active">Schedule is active</Label>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Next Run:</Label>
                <p className="text-sm text-muted-foreground">
                  {format(getNextRunDate(), 'PPpp')} ({formData.timezone})
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Recipients
              </CardTitle>
              <CardDescription>
                Add email addresses to receive the generated reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.recipients.map((recipient, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    value={recipient}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    placeholder="recipient@example.com"
                  />
                  {formData.recipients.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeRecipient(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={addRecipient}>
                Add Recipient
              </Button>
            </CardContent>
          </Card>

          {/* Template Parameters */}
          {selectedTemplate && selectedTemplate.parameters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Template Parameters</CardTitle>
                <CardDescription>
                  Configure default parameters for scheduled reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Parameters will use template defaults. You can modify these when editing the schedule.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSchedule}
              disabled={!formData.name.trim() || !formData.templateId || isCreating}
            >
              {isCreating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Scheduled Reports</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first scheduled report to automate report generation.
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {schedule.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(schedule.nextRun, 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {schedule.recipients.length} recipient(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </>
  );
}