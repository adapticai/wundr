'use client';

import {
  AlertCircle,
  AlertTriangle,
  Database,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  HardDrive,
  Loader2,
  Settings,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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

interface StorageBreakdown {
  type: string;
  size: number;
  count: number;
  percentage: number;
}

interface StorageUsageOverTime {
  date: string;
  size: number;
}

interface LargeFile {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  url?: string;
}

interface StorageSettings {
  quota: number;
  retentionDays: number;
  autoCleanup: boolean;
  warningThreshold: number;
}

interface CleanupRule {
  id: string;
  name: string;
  enabled: boolean;
  fileType?: string;
  olderThanDays?: number;
  minSize?: number;
}

interface StorageAlert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  createdAt: string;
}

interface StorageData {
  overview: {
    totalSize: number;
    totalSizeGB: number;
    quota: number;
    usagePercentage: number;
    fileCount: number;
  };
  breakdown: StorageBreakdown[];
  usageOverTime: StorageUsageOverTime[];
  largeFiles: LargeFile[];
  settings: StorageSettings;
  cleanupRules: CleanupRule[];
  alerts: StorageAlert[];
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  Images: <FileImage className='h-4 w-4' />,
  Videos: <FileVideo className='h-4 w-4' />,
  Audio: <FileAudio className='h-4 w-4' />,
  Documents: <FileText className='h-4 w-4' />,
  Archives: <FileArchive className='h-4 w-4' />,
  Code: <FileCode className='h-4 w-4' />,
  Other: <File className='h-4 w-4' />,
};

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];

export default function AdminStoragePage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();
  const { setPageHeader } = usePageHeader();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<StorageData | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Settings form state
  const [quota, setQuota] = useState(5);
  const [retentionDays, setRetentionDays] = useState(365);
  const [autoCleanup, setAutoCleanup] = useState(false);
  const [warningThreshold, setWarningThreshold] = useState(80);

  useEffect(() => {
    setPageHeader(
      'Storage Management',
      'Monitor and manage workspace storage usage'
    );
  }, [setPageHeader]);

  useEffect(() => {
    loadStorageData();
  }, [workspaceSlug]);

  useEffect(() => {
    if (data) {
      setQuota(data.settings.quota);
      setRetentionDays(data.settings.retentionDays);
      setAutoCleanup(data.settings.autoCleanup);
      setWarningThreshold(data.settings.warningThreshold);
    }
  }, [data]);

  const loadStorageData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/storage`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch storage data');
      }
      const storageData = await response.json();
      setData(storageData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load storage data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    setProcessingAction('updateSettings');
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/storage`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quota,
            retentionDays,
            autoCleanup,
            warningThreshold,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      toast({
        title: 'Success',
        description: 'Storage settings updated successfully',
      });

      setShowSettingsDialog(false);
      await loadStorageData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update storage settings',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCleanup = async () => {
    setProcessingAction('cleanup');
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/storage/cleanup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileIds: Array.from(selectedFiles),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cleanup files');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: `Deleted ${result.deletedCount} files, freed ${result.freedSpaceGB.toFixed(2)} GB`,
      });

      setSelectedFiles(new Set());
      setShowCleanupDialog(false);
      await loadStorageData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cleanup files',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-end'>
          <Skeleton className='h-9 w-24' />
        </div>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-4' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-8 w-20 mb-1' />
                <Skeleton className='h-3 w-32' />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className='h-10 w-80' />
        <Skeleton className='h-80 w-full' />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertTitle>Failed to load storage data</AlertTitle>
        <AlertDescription>
          Unable to retrieve storage information. Please try refreshing the
          page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-end'>
        <Button onClick={() => setShowSettingsDialog(true)}>
          <Settings className='mr-2 h-4 w-4' />
          Settings
        </Button>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className='space-y-2'>
          {data.alerts.map(alert => (
            <Alert
              key={alert.id}
              variant={alert.type === 'critical' ? 'destructive' : 'default'}
            >
              {alert.type === 'critical' ? (
                <AlertCircle className='h-4 w-4' />
              ) : (
                <AlertTriangle className='h-4 w-4' />
              )}
              <AlertTitle>
                {alert.type === 'critical' ? 'Critical' : 'Warning'}
              </AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Storage</CardTitle>
            <HardDrive className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.overview.totalSizeGB.toFixed(2)} GB
            </div>
            <p className='text-xs text-muted-foreground'>
              of {data.overview.quota} GB quota
            </p>
            <Progress value={data.overview.usagePercentage} className='mt-2' />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>File Count</CardTitle>
            <Database className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.overview.fileCount.toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground'>Total files stored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Usage</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.overview.usagePercentage.toFixed(1)}%
            </div>
            <p className='text-xs text-muted-foreground'>
              {data.overview.usagePercentage >= data.settings.warningThreshold
                ? 'Above threshold'
                : 'Within limits'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Average Size</CardTitle>
            <File className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {formatBytes(
                data.overview.fileCount > 0
                  ? data.overview.totalSize / data.overview.fileCount
                  : 0
              )}
            </div>
            <p className='text-xs text-muted-foreground'>Per file</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue='breakdown' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='breakdown'>Breakdown</TabsTrigger>
          <TabsTrigger value='usage'>Usage Over Time</TabsTrigger>
          <TabsTrigger value='files'>Large Files</TabsTrigger>
          <TabsTrigger value='cleanup'>Cleanup</TabsTrigger>
        </TabsList>

        {/* Storage Breakdown */}
        <TabsContent value='breakdown' className='space-y-6'>
          <div className='grid gap-6 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Storage by File Type</CardTitle>
                <CardDescription>
                  Distribution of storage across different file types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={300}>
                  <PieChart>
                    <Pie
                      data={data.breakdown}
                      dataKey='size'
                      nameKey='type'
                      cx='50%'
                      cy='50%'
                      outerRadius={100}
                      label={entry =>
                        `${entry.type}: ${entry.percentage.toFixed(1)}%`
                      }
                    >
                      {data.breakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatBytes(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>File Type Details</CardTitle>
                <CardDescription>
                  File counts and sizes by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {data.breakdown.map((item, index) => (
                    <div key={item.type} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          {FILE_TYPE_ICONS[item.type] || (
                            <File className='h-4 w-4' />
                          )}
                          <span className='font-medium'>{item.type}</span>
                        </div>
                        <Badge variant='secondary'>{item.count} files</Badge>
                      </div>
                      <div className='flex items-center justify-between text-sm text-muted-foreground'>
                        <span>{formatBytes(item.size)}</span>
                        <span>{item.percentage.toFixed(1)}%</span>
                      </div>
                      <Progress
                        value={item.percentage}
                        className='h-2'
                        style={{
                          backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Over Time */}
        <TabsContent value='usage' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Storage Growth</CardTitle>
              <CardDescription>
                Storage usage trend over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={400}>
                <AreaChart data={data.usageOverTime}>
                  <defs>
                    <linearGradient id='colorSize' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.8} />
                      <stop offset='95%' stopColor='#3b82f6' stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='date'
                    tickFormatter={date => formatDate(date)}
                  />
                  <YAxis tickFormatter={value => `${value.toFixed(1)} GB`} />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toFixed(2)} GB`,
                      'Storage',
                    ]}
                    labelFormatter={label => formatDate(label)}
                  />
                  <Legend />
                  <Area
                    type='monotone'
                    dataKey='size'
                    stroke='#3b82f6'
                    fillOpacity={1}
                    fill='url(#colorSize)'
                    name='Storage (GB)'
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Large Files */}
        <TabsContent value='files' className='space-y-6'>
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle>Large Files</CardTitle>
                  <CardDescription>
                    Top 50 largest files in your workspace
                  </CardDescription>
                </div>
                {selectedFiles.size > 0 && (
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => setShowCleanupDialog(true)}
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Delete Selected ({selectedFiles.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-12'>
                      <Checkbox
                        checked={selectedFiles.size === data.largeFiles.length}
                        onCheckedChange={checked => {
                          if (checked) {
                            setSelectedFiles(
                              new Set(data.largeFiles.map(f => f.id))
                            );
                          } else {
                            setSelectedFiles(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.largeFiles.map(file => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedFiles.has(file.id)}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                        />
                      </TableCell>
                      <TableCell className='font-medium'>{file.name}</TableCell>
                      <TableCell>{formatBytes(file.size)}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>
                          {file.type.split('/')[0] || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{file.createdByName}</TableCell>
                      <TableCell>{formatDate(file.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cleanup Rules */}
        <TabsContent value='cleanup' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Cleanup Rules</CardTitle>
              <CardDescription>
                Configure automatic cleanup policies for your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label>Automatic Cleanup</Label>
                  <p className='text-sm text-muted-foreground'>
                    Automatically delete files based on retention policies
                  </p>
                </div>
                <Switch
                  checked={autoCleanup}
                  onCheckedChange={setAutoCleanup}
                />
              </div>

              <Separator />

              <div className='space-y-4'>
                <h4 className='text-sm font-medium'>Retention Policy</h4>
                <div className='rounded-lg border p-4 space-y-4'>
                  <div className='space-y-2'>
                    <Label>Delete files older than (days)</Label>
                    <Input
                      type='number'
                      value={retentionDays}
                      onChange={e =>
                        setRetentionDays(parseInt(e.target.value, 10))
                      }
                      min={1}
                    />
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    Files older than this will be eligible for automatic cleanup
                    if enabled
                  </p>
                </div>
              </div>

              {data.cleanupRules.length > 0 && (
                <>
                  <Separator />
                  <div className='space-y-4'>
                    <h4 className='text-sm font-medium'>Custom Rules</h4>
                    <div className='space-y-2'>
                      {data.cleanupRules.map(rule => (
                        <div
                          key={rule.id}
                          className='flex items-center justify-between rounded-lg border p-4'
                        >
                          <div className='space-y-0.5'>
                            <Label>{rule.name}</Label>
                            <p className='text-sm text-muted-foreground'>
                              {rule.fileType && `Type: ${rule.fileType} • `}
                              {rule.olderThanDays &&
                                `Older than ${rule.olderThanDays} days • `}
                              {rule.minSize &&
                                `Minimum size: ${formatBytes(rule.minSize)}`}
                            </p>
                          </div>
                          <Switch checked={rule.enabled} />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storage Settings</DialogTitle>
            <DialogDescription>
              Configure storage quota and retention policies
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='quota'>Storage Quota (GB)</Label>
              <Input
                id='quota'
                type='number'
                value={quota}
                onChange={e => setQuota(parseInt(e.target.value, 10))}
                min={1}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='retention'>Retention Period (days)</Label>
              <Input
                id='retention'
                type='number'
                value={retentionDays}
                onChange={e => setRetentionDays(parseInt(e.target.value, 10))}
                min={1}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='threshold'>Warning Threshold (%)</Label>
              <Input
                id='threshold'
                type='number'
                value={warningThreshold}
                onChange={e =>
                  setWarningThreshold(parseInt(e.target.value, 10))
                }
                min={1}
                max={100}
              />
            </div>
            <div className='flex items-center space-x-2'>
              <Switch
                id='autoCleanup'
                checked={autoCleanup}
                onCheckedChange={setAutoCleanup}
              />
              <Label htmlFor='autoCleanup'>Enable automatic cleanup</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowSettingsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSettings}
              disabled={processingAction === 'updateSettings'}
            >
              {processingAction === 'updateSettings' ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cleanup Confirmation Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedFiles.size} selected
              files? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This will permanently delete the selected files from storage.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowCleanupDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleCleanup}
              disabled={processingAction === 'cleanup'}
            >
              {processingAction === 'cleanup' ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete Files
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
