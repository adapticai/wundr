'use client';

import {
  Shield,
  Download,
  Trash2,
  Eye,
  Activity,
  Cookie,
  Database,
  Share2,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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

interface PrivacySettings {
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  showTypingIndicators: boolean;
  profileDiscoverable: boolean;
  allowAnalytics: boolean;
  allowThirdPartyDataSharing: boolean;
}

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

interface PersonalDataInventory {
  profile: {
    name: string;
    email: string;
    avatar: string;
    createdAt: string;
  };
  activity: {
    lastActive: string;
    totalMessages: number;
    totalFiles: number;
    totalWorkspaces: number;
  };
  storage: {
    used: number;
    limit: number;
    unit: string;
  };
}

interface DataExportStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  requestedAt?: string;
  expiresAt?: string;
  error?: string;
}

export default function PrivacySettingsPage() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<PrivacySettings>({
    showOnlineStatus: true,
    showReadReceipts: true,
    showTypingIndicators: true,
    profileDiscoverable: true,
    allowAnalytics: true,
    allowThirdPartyDataSharing: false,
  });

  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>(
    {
      essential: true,
      functional: true,
      analytics: true,
      advertising: false,
    }
  );

  const [dataInventory, setDataInventory] =
    useState<PersonalDataInventory | null>(null);
  const [exportStatus, setExportStatus] = useState<DataExportStatus>({
    status: 'idle',
    progress: 0,
  });
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [cookieDialogOpen, setCookieDialogOpen] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      setIsLoadingSettings(true);
      const response = await fetch('/api/user/privacy');
      if (!response.ok) {
        throw new Error('Failed to load privacy settings');
      }
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
      if (data.cookiePreferences) {
        setCookiePreferences(data.cookiePreferences);
      }
      if (data.exportStatus) {
        setExportStatus(data.exportStatus);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load privacy settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleToggle = async (key: keyof PrivacySettings) => {
    const newValue = !settings[key];

    setSettings(prev => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      const response = await fetch('/api/user/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update privacy setting');
      }

      toast({
        title: 'Success',
        description: 'Privacy setting updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update setting',
        variant: 'destructive',
      });

      // Revert on error
      setSettings(prev => ({
        ...prev,
        [key]: !newValue,
      }));
    }
  };

  const handleCookieToggle = async (key: keyof CookiePreferences) => {
    // Essential cookies cannot be disabled
    if (key === 'essential') {
      toast({
        title: 'Information',
        description: 'Essential cookies are required for the site to function',
      });
      return;
    }

    const newValue = !cookiePreferences[key];

    setCookiePreferences(prev => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      const response = await fetch('/api/user/privacy/cookies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update cookie preferences');
      }

      toast({
        title: 'Success',
        description: 'Cookie preferences updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update preferences',
        variant: 'destructive',
      });

      // Revert on error
      setCookiePreferences(prev => ({
        ...prev,
        [key]: !newValue,
      }));
    }
  };

  const handleRequestDataExport = async () => {
    try {
      setExportStatus({ status: 'processing', progress: 0 });
      setExportDialogOpen(true);

      const response = await fetch('/api/user/privacy/export', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to request data export');
      }

      const data = await response.json();

      // Poll for export status
      const checkInterval = setInterval(async () => {
        const statusResponse = await fetch('/api/user/privacy/export/status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setExportStatus(statusData);

          if (
            statusData.status === 'completed' ||
            statusData.status === 'failed'
          ) {
            clearInterval(checkInterval);
          }
        }
      }, 2000);

      toast({
        title: 'Export Started',
        description: 'Your data export is being prepared',
      });
    } catch (error) {
      setExportStatus({ status: 'failed', progress: 0 });
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to request data export',
        variant: 'destructive',
      });
    }
  };

  const handleRequestDataDeletion = async (confirmText: string) => {
    if (confirmText !== 'DELETE MY DATA') {
      toast({
        title: 'Error',
        description: 'Please type "DELETE MY DATA" to confirm',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/user/privacy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: confirmText }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data deletion');
      }

      toast({
        title: 'Deletion Request Submitted',
        description:
          'Your data deletion request has been submitted. You will receive a confirmation email.',
      });

      setDeletionDialogOpen(false);

      // Redirect to home page after a delay
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to request data deletion',
        variant: 'destructive',
      });
    }
  };

  const loadDataInventory = async () => {
    try {
      setIsLoadingInventory(true);
      const response = await fetch('/api/user/privacy/inventory');
      if (!response.ok) {
        throw new Error('Failed to load data inventory');
      }
      const data = await response.json();
      setDataInventory(data);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load inventory',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const openDataInventory = () => {
    setInventoryDialogOpen(true);
    if (!dataInventory) {
      loadDataInventory();
    }
  };

  if (isLoadingSettings) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Privacy & Data Management</h1>
        <p className='mt-1 text-muted-foreground'>
          Control your privacy settings and manage your personal data
        </p>
      </div>

      {/* Visibility & Privacy Section */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Eye className='h-5 w-5' />
            <CardTitle>Visibility & Privacy</CardTitle>
          </div>
          <CardDescription>
            Control what others can see about your activity
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='online-status'>Online status visibility</Label>
              <p className='text-sm text-muted-foreground'>
                Show when you're online and active
              </p>
            </div>
            <Switch
              id='online-status'
              checked={settings.showOnlineStatus}
              onCheckedChange={() => handleToggle('showOnlineStatus')}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='read-receipts'>Read receipts</Label>
              <p className='text-sm text-muted-foreground'>
                Let others see when you've read their messages
              </p>
            </div>
            <Switch
              id='read-receipts'
              checked={settings.showReadReceipts}
              onCheckedChange={() => handleToggle('showReadReceipts')}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='typing-indicators'>Typing indicators</Label>
              <p className='text-sm text-muted-foreground'>
                Show when you're typing a message
              </p>
            </div>
            <Switch
              id='typing-indicators'
              checked={settings.showTypingIndicators}
              onCheckedChange={() => handleToggle('showTypingIndicators')}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='profile-discoverable'>
                Profile discoverability
              </Label>
              <p className='text-sm text-muted-foreground'>
                Allow others to find your profile in search
              </p>
            </div>
            <Switch
              id='profile-discoverable'
              checked={settings.profileDiscoverable}
              onCheckedChange={() => handleToggle('profileDiscoverable')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Analytics & Tracking Section */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Activity className='h-5 w-5' />
            <CardTitle>Analytics & Tracking</CardTitle>
          </div>
          <CardDescription>
            Control how your data is used for analytics
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='analytics-opt-out'>
                Allow analytics tracking
              </Label>
              <p className='text-sm text-muted-foreground'>
                Help us improve by sharing anonymous usage data
              </p>
            </div>
            <Switch
              id='analytics-opt-out'
              checked={settings.allowAnalytics}
              onCheckedChange={() => handleToggle('allowAnalytics')}
            />
          </div>

          <Separator />

          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label>Cookie preferences</Label>
                <p className='text-sm text-muted-foreground'>
                  Manage which cookies we can use
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCookieDialogOpen(true)}
              >
                <Cookie className='mr-2 h-4 w-4' />
                Manage Cookies
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sharing Section */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Share2 className='h-5 w-5' />
            <CardTitle>Data Sharing</CardTitle>
          </div>
          <CardDescription>
            Control third-party data sharing preferences
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='third-party-sharing'>
                Third-party data sharing
              </Label>
              <p className='text-sm text-muted-foreground'>
                Allow sharing data with trusted third-party services
              </p>
            </div>
            <Switch
              id='third-party-sharing'
              checked={settings.allowThirdPartyDataSharing}
              onCheckedChange={() => handleToggle('allowThirdPartyDataSharing')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management Section (GDPR Compliance) */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Database className='h-5 w-5' />
            <CardTitle>Your Data</CardTitle>
          </div>
          <CardDescription>
            View, export, or delete your personal data (GDPR compliance)
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Button
              variant='outline'
              className='justify-start h-auto py-4'
              onClick={openDataInventory}
            >
              <div className='flex items-start gap-3 text-left'>
                <FileText className='h-5 w-5 mt-0.5' />
                <div>
                  <div className='font-semibold'>View data inventory</div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    See what personal data we store about you
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant='outline'
              className='justify-start h-auto py-4'
              onClick={handleRequestDataExport}
              disabled={exportStatus.status === 'processing'}
            >
              <div className='flex items-start gap-3 text-left'>
                {exportStatus.status === 'processing' ? (
                  <Loader2 className='h-5 w-5 mt-0.5 animate-spin' />
                ) : (
                  <Download className='h-5 w-5 mt-0.5' />
                )}
                <div>
                  <div className='font-semibold'>Export your data</div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    {exportStatus.status === 'processing'
                      ? 'Export in progress...'
                      : 'Download all your data in JSON format'}
                  </div>
                </div>
              </div>
            </Button>
          </div>

          {exportStatus.status === 'completed' && exportStatus.downloadUrl && (
            <div className='flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4'>
              <CheckCircle2 className='h-5 w-5 text-green-600 dark:text-green-400' />
              <div className='flex-1'>
                <p className='text-sm font-medium text-green-900 dark:text-green-100'>
                  Your data export is ready
                </p>
                <p className='text-xs text-green-700 dark:text-green-300 mt-1'>
                  Download expires: {exportStatus.expiresAt}
                </p>
              </div>
              <Button
                size='sm'
                variant='outline'
                asChild
                className='border-green-600 text-green-600 hover:bg-green-100 dark:hover:bg-green-900'
              >
                <a href={exportStatus.downloadUrl} download>
                  <Download className='mr-2 h-4 w-4' />
                  Download
                </a>
              </Button>
            </div>
          )}

          <Separator />

          <div className='flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4'>
            <AlertTriangle className='h-5 w-5 text-destructive flex-shrink-0' />
            <div className='flex-1'>
              <p className='text-sm font-medium text-destructive'>
                Delete all your data
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button
              variant='destructive'
              size='sm'
              onClick={() => setDeletionDialogOpen(true)}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cookie Preferences Dialog */}
      <Dialog open={cookieDialogOpen} onOpenChange={setCookieDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Cookie className='h-5 w-5' />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage which cookies we can use on your device
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            <div className='space-y-4'>
              <div className='flex items-start justify-between'>
                <div className='space-y-1 flex-1'>
                  <div className='flex items-center gap-2'>
                    <Label className='text-base'>Essential</Label>
                    <Badge variant='secondary' className='text-xs'>
                      Required
                    </Badge>
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    Required for the website to function properly. These cannot
                    be disabled.
                  </p>
                </div>
                <Switch checked={true} disabled />
              </div>

              <Separator />

              <div className='flex items-start justify-between'>
                <div className='space-y-1 flex-1'>
                  <Label className='text-base'>Functional</Label>
                  <p className='text-sm text-muted-foreground'>
                    Enable enhanced functionality like remembering your
                    preferences and settings.
                  </p>
                </div>
                <Switch
                  checked={cookiePreferences.functional}
                  onCheckedChange={() => handleCookieToggle('functional')}
                />
              </div>

              <Separator />

              <div className='flex items-start justify-between'>
                <div className='space-y-1 flex-1'>
                  <Label className='text-base'>Analytics</Label>
                  <p className='text-sm text-muted-foreground'>
                    Help us understand how you use our site to improve user
                    experience.
                  </p>
                </div>
                <Switch
                  checked={cookiePreferences.analytics}
                  onCheckedChange={() => handleCookieToggle('analytics')}
                />
              </div>

              <Separator />

              <div className='flex items-start justify-between'>
                <div className='space-y-1 flex-1'>
                  <Label className='text-base'>Advertising</Label>
                  <p className='text-sm text-muted-foreground'>
                    Allow us to show you relevant advertisements based on your
                    interests.
                  </p>
                </div>
                <Switch
                  checked={cookiePreferences.advertising}
                  onCheckedChange={() => handleCookieToggle('advertising')}
                />
              </div>
            </div>
          </div>

          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setCookieDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Personal Data Inventory
            </DialogTitle>
            <DialogDescription>
              Overview of all personal data we store about you
            </DialogDescription>
          </DialogHeader>

          {isLoadingInventory ? (
            <div className='flex items-center justify-center p-8'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : dataInventory ? (
            <div className='space-y-6 py-4'>
              <div className='space-y-4'>
                <h4 className='font-semibold text-sm'>Profile Information</h4>
                <div className='grid grid-cols-2 gap-4 rounded-lg border p-4'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Name</p>
                    <p className='text-sm font-medium'>
                      {dataInventory.profile.name}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Email</p>
                    <p className='text-sm font-medium'>
                      {dataInventory.profile.email}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>
                      Account Created
                    </p>
                    <p className='text-sm font-medium'>
                      {dataInventory.profile.createdAt}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className='space-y-4'>
                <h4 className='font-semibold text-sm'>Activity Summary</h4>
                <div className='grid grid-cols-2 gap-4 rounded-lg border p-4'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Last Active</p>
                    <p className='text-sm font-medium'>
                      {dataInventory.activity.lastActive}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>
                      Total Messages
                    </p>
                    <p className='text-sm font-medium'>
                      {dataInventory.activity.totalMessages}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Total Files</p>
                    <p className='text-sm font-medium'>
                      {dataInventory.activity.totalFiles}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Workspaces</p>
                    <p className='text-sm font-medium'>
                      {dataInventory.activity.totalWorkspaces}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className='space-y-4'>
                <h4 className='font-semibold text-sm'>Storage Usage</h4>
                <div className='rounded-lg border p-4'>
                  <div className='flex items-center justify-between mb-2'>
                    <p className='text-sm font-medium'>
                      {dataInventory.storage.used} {dataInventory.storage.unit}{' '}
                      used
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      of {dataInventory.storage.limit}{' '}
                      {dataInventory.storage.unit}
                    </p>
                  </div>
                  <Progress
                    value={
                      (dataInventory.storage.used /
                        dataInventory.storage.limit) *
                      100
                    }
                    className='h-2'
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className='text-center p-8 text-muted-foreground'>
              Failed to load data inventory
            </div>
          )}

          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setInventoryDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Export Progress Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Download className='h-5 w-5' />
              Data Export
            </DialogTitle>
            <DialogDescription>
              {exportStatus.status === 'processing' &&
                'Preparing your data export...'}
              {exportStatus.status === 'completed' &&
                'Your data export is ready!'}
              {exportStatus.status === 'failed' && 'Export failed'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            {exportStatus.status === 'processing' && (
              <div className='space-y-2'>
                <Progress value={exportStatus.progress} />
                <p className='text-sm text-muted-foreground text-center'>
                  {exportStatus.progress}% complete
                </p>
              </div>
            )}

            {exportStatus.status === 'completed' &&
              exportStatus.downloadUrl && (
                <div className='flex flex-col items-center gap-4'>
                  <CheckCircle2 className='h-12 w-12 text-green-600' />
                  <p className='text-sm text-center'>
                    Your data has been exported successfully. The download link
                    will expire in 24 hours.
                  </p>
                  <Button asChild className='w-full'>
                    <a href={exportStatus.downloadUrl} download>
                      <Download className='mr-2 h-4 w-4' />
                      Download Now
                    </a>
                  </Button>
                </div>
              )}

            {exportStatus.status === 'failed' && (
              <div className='flex flex-col items-center gap-4'>
                <AlertTriangle className='h-12 w-12 text-destructive' />
                <p className='text-sm text-center text-destructive'>
                  {exportStatus.error || 'An error occurred during export'}
                </p>
                <Button
                  variant='outline'
                  onClick={handleRequestDataExport}
                  className='w-full'
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>

          {exportStatus.status === 'completed' && (
            <div className='flex justify-end'>
              <Button
                variant='outline'
                onClick={() => setExportDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Data Deletion Confirmation Dialog */}
      <AlertDialog
        open={deletionDialogOpen}
        onOpenChange={setDeletionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' />
              Delete All Your Data?
            </AlertDialogTitle>
            <AlertDialogDescription className='space-y-3'>
              <p>
                This action will permanently delete your account and all
                associated data, including:
              </p>
              <ul className='list-disc list-inside space-y-1 text-sm'>
                <li>Your profile and settings</li>
                <li>All messages and files you've shared</li>
                <li>Workspace memberships and channel access</li>
                <li>Activity history and analytics</li>
              </ul>
              <p className='font-semibold text-destructive'>
                This action cannot be undone!
              </p>
              <div className='pt-2'>
                <Label htmlFor='delete-confirm' className='text-sm'>
                  Type <strong>DELETE MY DATA</strong> to confirm
                </Label>
                <input
                  id='delete-confirm'
                  type='text'
                  className='w-full mt-2 px-3 py-2 border rounded-md'
                  placeholder='DELETE MY DATA'
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      handleRequestDataDeletion(
                        (e.target as HTMLInputElement).value
                      );
                    }
                  }}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive hover:bg-destructive/90'
              onClick={() => {
                const input = document.getElementById(
                  'delete-confirm'
                ) as HTMLInputElement;
                handleRequestDataDeletion(input?.value || '');
              }}
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
