'use client';

import {
  Download,
  Upload,
  Calendar,
  Clock,
  FileJson,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  History,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExportJob {
  id: string;
  type: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  error?: string;
  recordCount?: number;
}

interface BackupSchedule {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  format: 'json' | 'csv';
  includeTypes: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
}

const EXPORT_TYPES = [
  { value: 'all', label: 'All Data' },
  { value: 'channels', label: 'Channels' },
  { value: 'messages', label: 'Messages' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'members', label: 'Members' },
  { value: 'vps', label: 'Virtual Professionals' },
  { value: 'workflows', label: 'Workflows' },
];

const IMPORT_PLATFORMS = [
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'neolith', label: 'Neolith Backup' },
];

/**
 * Export/Import Admin Page
 *
 * Comprehensive data export/import functionality including:
 * - Export workspace data in multiple formats
 * - Import from other platforms
 * - Backup scheduling and management
 * - Export history and restore capabilities
 */
export default function ExportImportPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Export & Import',
      'Export workspace data, import from other platforms, and manage automated backups'
    );
  }, [setPageHeader]);

  // Export state
  const [exportType, setExportType] = useState('all');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [importPlatform, setImportPlatform] = useState('neolith');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Backup schedule state
  const [backupFrequency, setBackupFrequency] = useState<
    'daily' | 'weekly' | 'monthly'
  >('daily');
  const [backupTime, setBackupTime] = useState('00:00');
  const [backupFormat, setBackupFormat] = useState<'json' | 'csv'>('json');
  const [backupTypes, setBackupTypes] = useState<string[]>(['all']);
  const [backupEnabled, setBackupEnabled] = useState(false);

  // Fetch export jobs
  const { data: exportJobs, mutate: mutateJobs } = useSWR<ExportJob[]>(
    `/api/workspaces/${workspaceSlug}/export-import/jobs`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch export jobs');
      }
      const data = await res.json();
      return data.jobs || [];
    },
    { refreshInterval: 5000 }
  );

  // Fetch backup schedules
  const { data: backupSchedules, mutate: mutateSchedules } = useSWR<
    BackupSchedule[]
  >(
    `/api/workspaces/${workspaceSlug}/export-import/schedules`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch backup schedules');
      }
      const data = await res.json();
      return data.schedules || [];
    }
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        type: exportType,
        format: exportFormat,
        ...(exportStartDate && {
          startDate: new Date(exportStartDate).toISOString(),
        }),
        ...(exportEndDate && {
          endDate: new Date(exportEndDate).toISOString(),
        }),
      });

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/export-import/export?${params}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const contentType = response.headers.get('content-type');

      // Check if this is an async export job
      if (contentType?.includes('application/json')) {
        const result = await response.json();
        if (result.async) {
          toast({
            title: 'Export Job Created',
            description: `Export job created with ${result.estimatedRecords || 0} estimated records. Check the export history for download link.`,
          });
          await mutateJobs();
          return;
        }
      }

      // Direct download
      const blob = await response.blob();
      const filename =
        response.headers
          .get('content-disposition')
          ?.split('filename=')[1]
          ?.replace(/"/g, '') || `export-${Date.now()}.${exportFormat}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: 'Data exported successfully',
      });
      await mutateJobs();
    } catch (error) {
      toast({
        title: 'Export Failed',
        description:
          error instanceof Error ? error.message : 'Failed to export data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    workspaceSlug,
    exportType,
    exportFormat,
    exportStartDate,
    exportEndDate,
    toast,
    mutateJobs,
  ]);

  const handleImport = useCallback(async () => {
    if (!importFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a file to import',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('platform', importPlatform);

      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/export-import/import`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${result.recordsImported || 0} records`,
      });

      setImportFile(null);
      await mutateJobs();
    } catch (error) {
      toast({
        title: 'Import Failed',
        description:
          error instanceof Error ? error.message : 'Failed to import data',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, [workspaceSlug, importFile, importPlatform, toast, mutateJobs]);

  const handleCreateSchedule = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/export-import/schedules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frequency: backupFrequency,
            time: backupTime,
            format: backupFormat,
            includeTypes: backupTypes,
            enabled: backupEnabled,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create schedule');
      }

      toast({
        title: 'Schedule Created',
        description: 'Backup schedule created successfully',
      });

      await mutateSchedules();
    } catch (error) {
      toast({
        title: 'Failed to Create Schedule',
        description:
          error instanceof Error ? error.message : 'Failed to create schedule',
        variant: 'destructive',
      });
    }
  }, [
    workspaceSlug,
    backupFrequency,
    backupTime,
    backupFormat,
    backupTypes,
    backupEnabled,
    toast,
    mutateSchedules,
  ]);

  const handleDeleteSchedule = useCallback(
    async (scheduleId: string) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/export-import/schedules/${scheduleId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete schedule');
        }

        toast({
          title: 'Schedule Deleted',
          description: 'Backup schedule deleted successfully',
        });

        await mutateSchedules();
      } catch (error) {
        toast({
          title: 'Failed to Delete Schedule',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to delete schedule',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast, mutateSchedules]
  );

  const handleDownloadExport = useCallback(
    async (job: ExportJob) => {
      if (!job.downloadUrl) {
        return;
      }

      try {
        const response = await fetch(job.downloadUrl);
        if (!response.ok) {
          throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `export-${job.id}.${job.format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        toast({
          title: 'Download Failed',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to download export',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const handleRestoreBackup = useCallback(
    async (job: ExportJob) => {
      if (!job.downloadUrl) {
        return;
      }

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/export-import/restore`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Restore failed');
        }

        toast({
          title: 'Restore Complete',
          description: 'Backup restored successfully',
        });
      } catch (error) {
        toast({
          title: 'Restore Failed',
          description:
            error instanceof Error ? error.message : 'Failed to restore backup',
          variant: 'destructive',
        });
      }
    },
    [workspaceSlug, toast]
  );

  const toggleBackupType = useCallback((type: string) => {
    setBackupTypes(prev => {
      if (type === 'all') {
        return ['all'];
      }
      const filtered = prev.filter(t => t !== 'all');
      if (filtered.includes(type)) {
        return filtered.filter(t => t !== type);
      }
      return [...filtered, type];
    });
  }, []);

  return (
    <div className='space-y-6'>
      <Tabs defaultValue='export' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='export'>
            <Download className='h-4 w-4 mr-2' />
            Export
          </TabsTrigger>
          <TabsTrigger value='import'>
            <Upload className='h-4 w-4 mr-2' />
            Import
          </TabsTrigger>
          <TabsTrigger value='backup'>
            <Archive className='h-4 w-4 mr-2' />
            Backup Schedule
          </TabsTrigger>
          <TabsTrigger value='history'>
            <History className='h-4 w-4 mr-2' />
            Export History
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value='export'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Download className='h-5 w-5' />
                Export Workspace Data
              </CardTitle>
              <CardDescription>
                Export your workspace data in JSON or CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid gap-6 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='export-type'>Data Type</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger id='export-type'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPORT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='export-format'>Format</Label>
                  <Select
                    value={exportFormat}
                    onValueChange={value =>
                      setExportFormat(value as 'json' | 'csv')
                    }
                  >
                    <SelectTrigger id='export-format'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='json'>
                        <div className='flex items-center gap-2'>
                          <FileJson className='h-4 w-4' />
                          JSON
                        </div>
                      </SelectItem>
                      <SelectItem value='csv'>
                        <div className='flex items-center gap-2'>
                          <FileText className='h-4 w-4' />
                          CSV
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='export-start-date'>
                    Start Date (Optional)
                  </Label>
                  <Input
                    id='export-start-date'
                    type='date'
                    value={exportStartDate}
                    onChange={e => setExportStartDate(e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='export-end-date'>End Date (Optional)</Label>
                  <Input
                    id='export-end-date'
                    type='date'
                    value={exportEndDate}
                    onChange={e => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className='flex justify-end pt-4 border-t'>
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className='min-w-32'
                >
                  {isExporting ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className='h-4 w-4 mr-2' />
                      Export Data
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value='import'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Upload className='h-5 w-5' />
                Import Data
              </CardTitle>
              <CardDescription>
                Import data from other platforms or restore from backup
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='import-platform'>Source Platform</Label>
                <Select
                  value={importPlatform}
                  onValueChange={setImportPlatform}
                >
                  <SelectTrigger id='import-platform'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORT_PLATFORMS.map(platform => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='import-file'>Import File</Label>
                <div className='flex items-center gap-4'>
                  <Input
                    id='import-file'
                    type='file'
                    accept='.json,.csv,.zip'
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <Badge variant='secondary'>{importFile.name}</Badge>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Supports JSON, CSV, and ZIP files
                </p>
              </div>

              <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/10'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5' />
                  <div className='space-y-1'>
                    <p className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>
                      Import Warning
                    </p>
                    <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                      Importing data will merge with existing workspace data.
                      This action cannot be undone. Consider creating a backup
                      first.
                    </p>
                  </div>
                </div>
              </div>

              <div className='flex justify-end pt-4 border-t'>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || !importFile}
                  className='min-w-32'
                >
                  {isImporting ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className='h-4 w-4 mr-2' />
                      Import Data
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Schedule Tab */}
        <TabsContent value='backup'>
          <div className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Archive className='h-5 w-5' />
                  Automated Backup Schedule
                </CardTitle>
                <CardDescription>
                  Configure automatic backups of your workspace data
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='grid gap-6 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='backup-frequency'>Frequency</Label>
                    <Select
                      value={backupFrequency}
                      onValueChange={value =>
                        setBackupFrequency(
                          value as 'daily' | 'weekly' | 'monthly'
                        )
                      }
                    >
                      <SelectTrigger id='backup-frequency'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='daily'>Daily</SelectItem>
                        <SelectItem value='weekly'>Weekly</SelectItem>
                        <SelectItem value='monthly'>Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='backup-time'>Time</Label>
                    <Input
                      id='backup-time'
                      type='time'
                      value={backupTime}
                      onChange={e => setBackupTime(e.target.value)}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='backup-format'>Format</Label>
                    <Select
                      value={backupFormat}
                      onValueChange={value =>
                        setBackupFormat(value as 'json' | 'csv')
                      }
                    >
                      <SelectTrigger id='backup-format'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='json'>JSON</SelectItem>
                        <SelectItem value='csv'>CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='space-y-3'>
                  <Label>Include Data Types</Label>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    {EXPORT_TYPES.map(type => (
                      <div
                        key={type.value}
                        className='flex items-center justify-between rounded-lg border p-3'
                      >
                        <Label
                          htmlFor={`backup-type-${type.value}`}
                          className='cursor-pointer flex-1'
                        >
                          {type.label}
                        </Label>
                        <Switch
                          id={`backup-type-${type.value}`}
                          checked={backupTypes.includes(type.value)}
                          onCheckedChange={() => toggleBackupType(type.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='backup-enabled' className='text-base'>
                      Enable Backup Schedule
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Automatically backup workspace data
                    </p>
                  </div>
                  <Switch
                    id='backup-enabled'
                    checked={backupEnabled}
                    onCheckedChange={setBackupEnabled}
                  />
                </div>

                <div className='flex justify-end pt-4 border-t'>
                  <Button onClick={handleCreateSchedule}>
                    <Calendar className='h-4 w-4 mr-2' />
                    Create Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Active Schedules */}
            {backupSchedules && backupSchedules.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Schedules</CardTitle>
                  <CardDescription>
                    Manage your automated backup schedules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    {backupSchedules.map(schedule => (
                      <div
                        key={schedule.id}
                        className='flex items-center justify-between rounded-lg border p-4'
                      >
                        <div className='space-y-1'>
                          <div className='flex items-center gap-2'>
                            <Badge
                              variant={
                                schedule.enabled ? 'default' : 'secondary'
                              }
                            >
                              {schedule.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                            <span className='text-sm font-medium'>
                              {schedule.frequency} at {schedule.time}
                            </span>
                            <Badge variant='outline'>{schedule.format}</Badge>
                          </div>
                          <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                            {schedule.lastRun && (
                              <span className='flex items-center gap-1'>
                                <Clock className='h-3 w-3' />
                                Last:{' '}
                                {new Date(
                                  schedule.lastRun
                                ).toLocaleDateString()}
                              </span>
                            )}
                            <span className='flex items-center gap-1'>
                              <Clock className='h-3 w-3' />
                              Next:{' '}
                              {new Date(schedule.nextRun).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Export History Tab */}
        <TabsContent value='history'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <History className='h-5 w-5' />
                Export History
              </CardTitle>
              <CardDescription>
                View and download previous exports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exportJobs && exportJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportJobs.map(job => (
                      <TableRow key={job.id}>
                        <TableCell className='font-medium'>
                          {EXPORT_TYPES.find(t => t.value === job.type)
                            ?.label || job.type}
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>{job.format}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              job.status === 'COMPLETED'
                                ? 'default'
                                : job.status === 'FAILED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className='flex items-center gap-1 w-fit'
                          >
                            {job.status === 'COMPLETED' && (
                              <CheckCircle2 className='h-3 w-3' />
                            )}
                            {job.status === 'FAILED' && (
                              <XCircle className='h-3 w-3' />
                            )}
                            {job.status === 'PENDING' && (
                              <Loader2 className='h-3 w-3 animate-spin' />
                            )}
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {job.recordCount?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                          {new Date(job.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            {job.status === 'COMPLETED' && job.downloadUrl && (
                              <>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={() => handleDownloadExport(job)}
                                >
                                  <Download className='h-3 w-3 mr-1' />
                                  Download
                                </Button>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={() => handleRestoreBackup(job)}
                                >
                                  <RotateCcw className='h-3 w-3 mr-1' />
                                  Restore
                                </Button>
                              </>
                            )}
                            {job.status === 'FAILED' && job.error && (
                              <span className='text-xs text-red-600'>
                                {job.error}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <Database className='h-12 w-12 text-muted-foreground mb-4' />
                  <h3 className='text-lg font-semibold mb-2'>
                    No Export History
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Your export jobs will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
