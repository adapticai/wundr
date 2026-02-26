'use client';

import {
  Loader2,
  Upload,
  Info,
  Building2,
  Globe,
  Users,
  Calendar,
  Shield,
  Trash2,
  UserCog,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { mutate } from 'swr';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
import { useWorkspaceSettings } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * General Workspace Settings Page
 *
 * Comprehensive workspace configuration including:
 * - Workspace identity (icon, name, description, slug)
 * - Default settings (channel, timezone, language)
 * - Discoverability options
 * - Workspace information and stats
 */
export default function GeneralSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const { settings, isLoading, updateSettings, error } =
    useWorkspaceSettings(workspaceSlug);

  // Workspace Identity State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [slug, setSlug] = useState('');

  // Defaults State
  const [defaultChannelId, setDefaultChannelId] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');

  // Discoverability State
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [allowDiscovery, setAllowDiscovery] = useState(false);

  // Member Join Settings State
  const [requireApprovalToJoin, setRequireApprovalToJoin] = useState(true);
  const [allowGuestAccess, setAllowGuestAccess] = useState(false);

  // Data Retention State
  const [messageRetentionDays, setMessageRetentionDays] = useState('');
  const [fileRetentionDays, setFileRetentionDays] = useState('');

  // Channels for default channel selection
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);

  // Danger Zone State
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // UI State
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with fetched settings
  useEffect(() => {
    if (settings) {
      setName(settings.name || '');
      setDescription(settings.description || '');
      setSlug(settings.slug || '');
      setVisibility(settings.visibility || 'private');

      // Extended settings properties with proper typing
      const extendedSettings = settings as typeof settings & {
        icon?: string;
        defaultChannelId?: string;
        defaultTimezone?: string;
        defaultLanguage?: string;
        allowDiscovery?: boolean;
        requireApprovalToJoin?: boolean;
        allowGuestAccess?: boolean;
        messageRetentionDays?: number;
        fileRetentionDays?: number;
      };

      setIcon(extendedSettings.icon || '');
      setDefaultChannelId(extendedSettings.defaultChannelId || '');
      setDefaultTimezone(
        extendedSettings.defaultTimezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setDefaultLanguage(extendedSettings.defaultLanguage || 'en');
      setAllowDiscovery(extendedSettings.allowDiscovery || false);
      setRequireApprovalToJoin(extendedSettings.requireApprovalToJoin ?? true);
      setAllowGuestAccess(extendedSettings.allowGuestAccess || false);
      setMessageRetentionDays(
        extendedSettings.messageRetentionDays?.toString() || ''
      );
      setFileRetentionDays(
        extendedSettings.fileRetentionDays?.toString() || ''
      );
    }
  }, [settings]);

  // Fetch channels for default channel selector
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/channels?limit=100`
        );
        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels || []);
        }
      } catch {
        // Non-critical — leave channels empty
      }
    };
    fetchChannels();
  }, [workspaceSlug]);

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!defaultTimezone) {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setDefaultTimezone(timezone);
      } catch {
        setDefaultTimezone('UTC');
      }
    }
  }, [defaultTimezone]);

  const handleIconChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !workspaceSlug) {
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Image size must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Error',
          description: 'Please upload a JPEG, PNG, WebP, or SVG image',
          variant: 'destructive',
        });
        return;
      }

      setIsUploadingIcon(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/workspaces/${workspaceSlug}/icon`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload icon');
        }

        const result = await response.json();
        setIcon(result.workspace?.icon || '');

        // Revalidate workspace data
        await mutate('/api/user/workspaces');
        await mutate(`/api/workspaces/${workspaceSlug}/admin/settings`);

        toast({
          title: 'Success',
          description: 'Workspace icon updated',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to upload icon',
          variant: 'destructive',
        });
      } finally {
        setIsUploadingIcon(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [workspaceSlug, toast]
  );

  const handleSaveIdentity = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        name,
        description,
        // slug is typically read-only after creation
      });
      toast({
        title: 'Success',
        description: 'Workspace identity updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save changes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [name, description, updateSettings, toast]);

  const handleSaveDefaults = useCallback(async () => {
    setIsSaving(true);
    try {
      // Type-safe partial update with extended properties
      const updates: Record<string, string> = {
        defaultChannelId,
        defaultTimezone,
        defaultLanguage,
      };
      await updateSettings(updates);
      toast({
        title: 'Success',
        description: 'Default settings updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save defaults',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    defaultChannelId,
    defaultTimezone,
    defaultLanguage,
    updateSettings,
    toast,
  ]);

  const handleSaveDiscoverability = useCallback(async () => {
    setIsSaving(true);
    try {
      // Type-safe partial update with extended properties
      const updates: Record<string, string | boolean> = {
        visibility,
        allowDiscovery,
      };
      await updateSettings(updates);
      toast({
        title: 'Success',
        description: 'Discoverability settings updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save discoverability',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [visibility, allowDiscovery, updateSettings, toast]);

  const handleSaveMemberSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates: Record<string, boolean> = {
        requireApprovalToJoin,
        allowGuestAccess,
      };
      await updateSettings(updates);
      toast({
        title: 'Success',
        description: 'Member join settings updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save member settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [requireApprovalToJoin, allowGuestAccess, updateSettings, toast]);

  const handleSaveRetentionSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates: Record<string, number | undefined> = {
        messageRetentionDays: messageRetentionDays
          ? parseInt(messageRetentionDays)
          : undefined,
        fileRetentionDays: fileRetentionDays
          ? parseInt(fileRetentionDays)
          : undefined,
      };
      await updateSettings(updates);
      toast({
        title: 'Success',
        description: 'Data retention policies updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save retention settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [messageRetentionDays, fileRetentionDays, updateSettings, toast]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (deleteConfirmation !== name) {
      toast({
        title: 'Error',
        description: 'Workspace name does not match',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings/delete`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workspace');
      }

      toast({
        title: 'Success',
        description: 'Workspace deleted successfully',
      });

      // Redirect to home page after deletion
      router.push('/');
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete workspace',
        variant: 'destructive',
      });
      setIsDeleting(false);
    }
  }, [deleteConfirmation, name, workspaceSlug, toast, router]);

  const handleTransferOwnership = useCallback(async () => {
    if (!transferUserId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a user ID',
        variant: 'destructive',
      });
      return;
    }

    setIsTransferring(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings/transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newOwnerId: transferUserId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transfer ownership');
      }

      toast({
        title: 'Success',
        description: 'Ownership transferred successfully',
      });

      setTransferUserId('');

      // Revalidate settings
      await mutate(`/api/workspaces/${workspaceSlug}/admin/settings`);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to transfer ownership',
        variant: 'destructive',
      });
    } finally {
      setIsTransferring(false);
    }
  }, [transferUserId, workspaceSlug, toast]);

  if (isLoading) {
    return <GeneralSettingsSkeleton />;
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>General Settings</h1>
          <p className='mt-1 text-muted-foreground'>
            Configure your workspace identity and defaults
          </p>
        </div>
        <Card className='border-red-500/50 bg-red-50 dark:bg-red-900/10'>
          <CardContent className='pt-6'>
            <p className='text-red-800 dark:text-red-200'>{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>General Settings</h1>
        <p className='mt-1 text-muted-foreground'>
          Configure your workspace identity and defaults
        </p>
      </div>

      {/* Workspace Identity */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Building2 className='h-5 w-5' />
            Workspace Identity
          </CardTitle>
          <CardDescription>
            Your workspace's name, icon, and description are displayed
            throughout the platform
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Workspace Icon */}
          <div>
            <Label className='text-base'>Workspace Icon</Label>
            <p className='text-sm text-muted-foreground mb-3'>
              This will be displayed in the sidebar and workspace switcher
            </p>
            <div className='flex items-center gap-4'>
              <div className='relative'>
                <div
                  className={cn(
                    'h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/25',
                    'flex items-center justify-center overflow-hidden bg-muted'
                  )}
                >
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={icon}
                      alt='Workspace icon'
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <span className='text-2xl font-bold text-muted-foreground'>
                      {name?.charAt(0)?.toUpperCase() || 'W'}
                    </span>
                  )}
                </div>
                {isUploadingIcon && (
                  <div className='absolute inset-0 flex items-center justify-center rounded-lg bg-black/50'>
                    <Loader2 className='h-6 w-6 animate-spin text-white' />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor='icon-upload' className='cursor-pointer'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={isUploadingIcon}
                    asChild
                  >
                    <span>
                      <Upload className='h-4 w-4 mr-2' />
                      {isUploadingIcon ? 'Uploading...' : 'Change Icon'}
                    </span>
                  </Button>
                </label>
                <input
                  ref={fileInputRef}
                  id='icon-upload'
                  type='file'
                  accept='image/jpeg,image/png,image/webp,image/svg+xml'
                  className='hidden'
                  onChange={handleIconChange}
                  disabled={isUploadingIcon}
                />
                <p className='mt-1 text-xs text-muted-foreground'>
                  PNG, JPG, WebP or SVG. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          <div className='space-y-4 border-t pt-4'>
            <div className='space-y-2'>
              <Label htmlFor='workspace-name'>Workspace Name</Label>
              <Input
                id='workspace-name'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='My Workspace'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='workspace-description'>Description</Label>
              <Textarea
                id='workspace-description'
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder='Describe your workspace...'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='workspace-slug'>Workspace URL</Label>
              <div className='flex items-center gap-2'>
                <Input
                  id='workspace-slug'
                  value={slug}
                  disabled
                  className='bg-muted'
                />
                <Badge variant='secondary'>Read-only</Badge>
              </div>
              <p className='text-xs text-muted-foreground flex items-start gap-1'>
                <Info className='h-3 w-3 mt-0.5 flex-shrink-0' />
                The workspace URL cannot be changed after creation to maintain
                consistency across integrations
              </p>
            </div>
          </div>

          <div className='flex justify-end pt-4 border-t'>
            <Button onClick={handleSaveIdentity} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='h-5 w-5' />
            Default Settings
          </CardTitle>
          <CardDescription>
            Set default preferences for new members joining your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='default-channel'>Default Channel</Label>
            <Select
              value={defaultChannelId}
              onValueChange={setDefaultChannelId}
            >
              <SelectTrigger id='default-channel'>
                <SelectValue placeholder='Select default channel' />
              </SelectTrigger>
              <SelectContent>
                {channels.length === 0 ? (
                  <SelectItem value='__none__' disabled>
                    No channels available
                  </SelectItem>
                ) : (
                  channels.map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              New members will automatically join this channel
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='default-timezone'>Default Timezone</Label>
            <Select value={defaultTimezone} onValueChange={setDefaultTimezone}>
              <SelectTrigger id='default-timezone'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='America/New_York'>
                  Eastern Time (ET)
                </SelectItem>
                <SelectItem value='America/Chicago'>
                  Central Time (CT)
                </SelectItem>
                <SelectItem value='America/Denver'>
                  Mountain Time (MT)
                </SelectItem>
                <SelectItem value='America/Los_Angeles'>
                  Pacific Time (PT)
                </SelectItem>
                <SelectItem value='Europe/London'>London (GMT)</SelectItem>
                <SelectItem value='Europe/Paris'>Paris (CET)</SelectItem>
                <SelectItem value='Asia/Tokyo'>Tokyo (JST)</SelectItem>
                <SelectItem value='UTC'>UTC</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              Default timezone for new members and workspace operations
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='default-language'>Default Language</Label>
            <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
              <SelectTrigger id='default-language'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='en'>English</SelectItem>
                <SelectItem value='es'>Spanish</SelectItem>
                <SelectItem value='fr'>French</SelectItem>
                <SelectItem value='de'>German</SelectItem>
                <SelectItem value='ja'>Japanese</SelectItem>
                <SelectItem value='zh'>Chinese</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              Default language for workspace interface
            </p>
          </div>

          <div className='flex justify-end pt-4 border-t'>
            <Button onClick={handleSaveDefaults} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Defaults'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Discoverability */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Globe className='h-5 w-5' />
            Discoverability
          </CardTitle>
          <CardDescription>
            Control how your workspace can be found and accessed
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='visibility'>Workspace Visibility</Label>
            <Select
              value={visibility}
              onValueChange={value =>
                setVisibility(value as 'public' | 'private')
              }
            >
              <SelectTrigger id='visibility'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='private'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>Private</span>
                    <span className='text-xs text-muted-foreground'>
                      Invitation only
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value='public'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>Public</span>
                    <span className='text-xs text-muted-foreground'>
                      Anyone can request to join
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='allow-discovery' className='text-base'>
                Allow workspace discovery
              </Label>
              <p className='text-sm text-muted-foreground'>
                Let people find this workspace in the directory
              </p>
            </div>
            <Switch
              id='allow-discovery'
              checked={allowDiscovery}
              onCheckedChange={setAllowDiscovery}
            />
          </div>

          <div className='flex justify-end pt-4 border-t'>
            <Button onClick={handleSaveDiscoverability} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Discoverability'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Member Join Settings */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            Member Join Settings
          </CardTitle>
          <CardDescription>
            Control how members can join your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='require-approval' className='text-base'>
                Require approval to join
              </Label>
              <p className='text-sm text-muted-foreground'>
                New members must be approved by an admin before joining
              </p>
            </div>
            <Switch
              id='require-approval'
              checked={requireApprovalToJoin}
              onCheckedChange={setRequireApprovalToJoin}
            />
          </div>

          <div className='flex items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='guest-access' className='text-base'>
                Allow guest access
              </Label>
              <p className='text-sm text-muted-foreground'>
                Allow guests to access public channels without full membership
              </p>
            </div>
            <Switch
              id='guest-access'
              checked={allowGuestAccess}
              onCheckedChange={setAllowGuestAccess}
            />
          </div>

          <div className='flex justify-end pt-4 border-t'>
            <Button onClick={handleSaveMemberSettings} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Data Retention Policies
          </CardTitle>
          <CardDescription>
            Configure automatic data retention and cleanup policies
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='message-retention'>Message Retention (days)</Label>
            <Input
              id='message-retention'
              type='number'
              min='0'
              value={messageRetentionDays}
              onChange={e => setMessageRetentionDays(e.target.value)}
              placeholder='Never delete (leave empty)'
            />
            <p className='text-xs text-muted-foreground flex items-start gap-1'>
              <Info className='h-3 w-3 mt-0.5 flex-shrink-0' />
              Messages older than this will be automatically deleted. Leave
              empty to keep messages forever.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='file-retention'>File Retention (days)</Label>
            <Input
              id='file-retention'
              type='number'
              min='0'
              value={fileRetentionDays}
              onChange={e => setFileRetentionDays(e.target.value)}
              placeholder='Never delete (leave empty)'
            />
            <p className='text-xs text-muted-foreground flex items-start gap-1'>
              <Info className='h-3 w-3 mt-0.5 flex-shrink-0' />
              Files older than this will be automatically deleted. Leave empty
              to keep files forever.
            </p>
          </div>

          <div className='flex justify-end pt-4 border-t'>
            <Button onClick={handleSaveRetentionSettings} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Policies'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace About/Info */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Calendar className='h-5 w-5' />
            Workspace Information
          </CardTitle>
          <CardDescription>
            View workspace details and statistics
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Created
              </p>
              <p className='text-sm'>
                {(() => {
                  const extendedSettings = settings as typeof settings & {
                    createdAt?: string | Date;
                  };
                  if (extendedSettings.createdAt) {
                    return new Date(
                      extendedSettings.createdAt
                    ).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    });
                  }
                  return 'Unknown';
                })()}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>Owner</p>
              <p className='text-sm'>
                {(() => {
                  const extendedSettings = settings as typeof settings & {
                    owner?: string;
                  };
                  return extendedSettings.owner || 'Unknown';
                })()}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Members
              </p>
              <p className='text-sm'>
                {(() => {
                  const extendedSettings = settings as typeof settings & {
                    memberCount?: number;
                  };
                  return extendedSettings.memberCount || 0;
                })()}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Channels
              </p>
              <p className='text-sm'>
                {(() => {
                  const extendedSettings = settings as typeof settings & {
                    channelCount?: number;
                  };
                  return extendedSettings.channelCount || 0;
                })()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className='border-red-500/50'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-red-600 dark:text-red-400'>
            <AlertTriangle className='h-5 w-5' />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Transfer Ownership */}
          <div className='rounded-lg border border-red-200 dark:border-red-900 p-4 space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <UserCog className='h-4 w-4 text-red-600 dark:text-red-400' />
                <Label className='text-base font-semibold'>
                  Transfer Ownership
                </Label>
              </div>
              <p className='text-sm text-muted-foreground'>
                Transfer workspace ownership to another admin. You will lose
                owner privileges.
              </p>
            </div>
            <div className='space-y-3'>
              <Input
                placeholder='Enter new owner user ID'
                value={transferUserId}
                onChange={e => setTransferUserId(e.target.value)}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='outline'
                    className='w-full border-red-500/50 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20'
                    disabled={!transferUserId.trim() || isTransferring}
                  >
                    {isTransferring ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Transferring...
                      </>
                    ) : (
                      <>
                        <UserCog className='h-4 w-4 mr-2' />
                        Transfer Ownership
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will transfer ownership of the workspace to
                      another user. You will lose owner privileges and will not
                      be able to reverse this action without the new owner's
                      approval.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleTransferOwnership}
                      className='bg-red-600 hover:bg-red-700'
                    >
                      Transfer Ownership
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Delete Workspace */}
          <div className='rounded-lg border border-red-200 dark:border-red-900 p-4 space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <Trash2 className='h-4 w-4 text-red-600 dark:text-red-400' />
                <Label className='text-base font-semibold'>
                  Delete Workspace
                </Label>
              </div>
              <p className='text-sm text-muted-foreground'>
                Permanently delete this workspace and all of its data. This
                action cannot be undone.
              </p>
            </div>
            <div className='space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='delete-confirmation'>
                  Type <span className='font-mono font-bold'>{name}</span> to
                  confirm
                </Label>
                <Input
                  id='delete-confirmation'
                  placeholder='Workspace name'
                  value={deleteConfirmation}
                  onChange={e => setDeleteConfirmation(e.target.value)}
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='destructive'
                    className='w-full'
                    disabled={deleteConfirmation !== name || isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className='h-4 w-4 mr-2' />
                        Delete Workspace
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the workspace, including all channels, messages, files,
                      and member data. All members will lose access immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteWorkspace}
                      className='bg-red-600 hover:bg-red-700'
                    >
                      Delete Workspace
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralSettingsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className='h-6 w-48 animate-pulse rounded bg-muted' />
            <div className='h-4 w-full animate-pulse rounded bg-muted' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
            <div className='h-10 w-full animate-pulse rounded bg-muted' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
