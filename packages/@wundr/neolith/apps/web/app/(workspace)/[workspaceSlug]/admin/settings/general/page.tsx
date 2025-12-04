'use client';

import {
  Loader2,
  Upload,
  Info,
  Building2,
  Globe,
  Users,
  Calendar,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { mutate } from 'swr';

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
      // Icon would come from settings if available
      setIcon((settings as any).icon || '');
      setDefaultChannelId((settings as any).defaultChannelId || '');
      setDefaultTimezone(
        (settings as any).defaultTimezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setDefaultLanguage((settings as any).defaultLanguage || 'en');
      setAllowDiscovery((settings as any).allowDiscovery || false);
    }
  }, [settings]);

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
      await updateSettings({
        defaultChannelId,
        defaultTimezone,
        defaultLanguage,
      } as any);
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
      await updateSettings({
        visibility,
        allowDiscovery,
      } as any);
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
                <SelectItem value='general'>general</SelectItem>
                <SelectItem value='random'>random</SelectItem>
                <SelectItem value='announcements'>announcements</SelectItem>
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
            <Button
              type='button'
              role='switch'
              aria-checked={allowDiscovery}
              variant='ghost'
              size='sm'
              onClick={() => setAllowDiscovery(!allowDiscovery)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                allowDiscovery ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  allowDiscovery ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </Button>
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
                {(settings as any)?.createdAt
                  ? new Date((settings as any).createdAt).toLocaleDateString(
                      'en-US',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }
                    )
                  : 'Unknown'}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>Owner</p>
              <p className='text-sm'>{(settings as any)?.owner || 'Unknown'}</p>
            </div>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Members
              </p>
              <p className='text-sm'>{(settings as any)?.memberCount || 0}</p>
            </div>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Channels
              </p>
              <p className='text-sm'>{(settings as any)?.channelCount || 0}</p>
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
