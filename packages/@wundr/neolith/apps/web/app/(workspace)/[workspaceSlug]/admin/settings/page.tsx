'use client';

import { AlertTriangle, Save, Settings, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  timezone: string;
  notificationDefaults: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  weeklyDigest?: boolean;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Sao_Paulo', label: 'Brasilia' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Europe/Stockholm', label: 'Stockholm' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'Mumbai, New Delhi' },
  { value: 'Asia/Bangkok', label: 'Bangkok' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Shanghai', label: 'Beijing, Shanghai' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Osaka' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
];

const DIGEST_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'never', label: 'Never' },
];

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();
  const { toast } = useToast();

  // ── Load state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState('weekly');

  // ── Page header ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setPageHeader(
      'Workspace Settings',
      'Configure general workspace settings and preferences'
    );
  }, [setPageHeader]);

  // ── Load workspace data ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/settings`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { settings: WorkspaceSettings };
        const s = data.settings;

        setName(s.name ?? '');
        setDescription(s.description ?? '');
        setSlug(s.slug ?? '');
        setTimezone(s.timezone ?? 'UTC');
        setEmailNotifications(s.notificationDefaults?.email ?? true);
        setInAppNotifications(s.notificationDefaults?.desktop ?? true);

        // Map weeklyDigest to digest frequency selection
        if (s.weeklyDigest === false) {
          setDigestFrequency('never');
        } else {
          setDigestFrequency('weekly');
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [workspaceSlug]);

  // ── Save handler ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            timezone,
            notificationDefaults: {
              email: emailNotifications,
              push: inAppNotifications,
              desktop: inAppNotifications,
            },
            weeklyDigest: digestFrequency === 'weekly',
          }),
        }
      );

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Failed to save settings');
      }

      toast({
        title: 'Settings saved',
        description: 'Workspace settings have been updated successfully.',
      });
    } catch (err) {
      toast({
        title: 'Failed to save settings',
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/settings/delete`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Failed to delete workspace');
      }

      toast({
        title: 'Workspace deleted',
        description: 'The workspace has been permanently deleted.',
      });

      // Navigate away after deletion
      router.push('/');
    } catch (err) {
      toast({
        title: 'Failed to delete workspace',
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className='space-y-6'>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className='pb-4'>
              <Skeleton className='h-5 w-40' />
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-9 w-full' />
              </div>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-9 w-full' />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* ── General Settings ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className='pb-4'>
          <div className='flex items-center gap-2'>
            <Settings className='h-5 w-5 text-muted-foreground' />
            <CardTitle className='text-base'>General</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          {/* Name */}
          <div className='space-y-2'>
            <Label htmlFor='workspace-name'>Workspace Name</Label>
            <Input
              id='workspace-name'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='My Workspace'
              maxLength={100}
            />
            <p className='text-xs text-muted-foreground'>
              This is the display name for your workspace.
            </p>
          </div>

          <Separator />

          {/* Description */}
          <div className='space-y-2'>
            <Label htmlFor='workspace-description'>Description</Label>
            <Textarea
              id='workspace-description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='Describe what this workspace is used for...'
              rows={3}
              maxLength={500}
            />
            <p className='text-xs text-muted-foreground'>
              {description.length}/500 characters
            </p>
          </div>

          <Separator />

          {/* Slug (read-only) */}
          <div className='space-y-2'>
            <Label htmlFor='workspace-slug'>Workspace URL</Label>
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted-foreground shrink-0'>
                app.wundr.ai/
              </span>
              <Input
                id='workspace-slug'
                value={slug}
                readOnly
                disabled
                className='bg-muted text-muted-foreground cursor-not-allowed'
              />
            </div>
            <p className='text-xs text-muted-foreground'>
              The workspace URL slug cannot be changed after creation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Default Timezone ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>Default Timezone</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          <Label htmlFor='workspace-timezone'>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id='workspace-timezone' className='w-full sm:w-80'>
              <SelectValue placeholder='Select a timezone' />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-xs text-muted-foreground'>
            Sets the default timezone for dates and times shown in the
            workspace.
          </p>
        </CardContent>
      </Card>

      {/* ── Notifications ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>Notifications</CardTitle>
        </CardHeader>
        <CardContent className='space-y-5'>
          {/* Email notifications */}
          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='email-notifications' className='text-sm'>
                Email Notifications
              </Label>
              <p className='text-xs text-muted-foreground'>
                Send email alerts for important workspace activity.
              </p>
            </div>
            <Switch
              id='email-notifications'
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <Separator />

          {/* In-app notifications */}
          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='inapp-notifications' className='text-sm'>
                In-App Notifications
              </Label>
              <p className='text-xs text-muted-foreground'>
                Show desktop and in-app notification banners.
              </p>
            </div>
            <Switch
              id='inapp-notifications'
              checked={inAppNotifications}
              onCheckedChange={setInAppNotifications}
            />
          </div>

          <Separator />

          {/* Digest frequency */}
          <div className='space-y-2'>
            <Label htmlFor='digest-frequency'>Digest Frequency</Label>
            <Select value={digestFrequency} onValueChange={setDigestFrequency}>
              <SelectTrigger id='digest-frequency' className='w-full sm:w-56'>
                <SelectValue placeholder='Select frequency' />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              How often to send workspace activity digest emails to members.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ──────────────────────────────────────────────────────── */}
      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={saving} className='gap-2'>
          <Save className='h-4 w-4' />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      <Card className='border-destructive/50'>
        <CardHeader className='pb-4'>
          <div className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-destructive' />
            <CardTitle className='text-base text-destructive'>
              Danger Zone
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex items-start justify-between gap-6'>
            <div className='space-y-1'>
              <p className='text-sm font-medium'>Delete this workspace</p>
              <p className='text-xs text-muted-foreground'>
                Permanently delete the workspace and all of its data, including
                channels, messages, files, and members. This action cannot be
                undone.
              </p>
            </div>
            <Button
              variant='destructive'
              size='sm'
              className='shrink-0 gap-2'
              onClick={() => {
                setDeleteConfirmText('');
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className='h-4 w-4' />
              Delete Workspace
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All channels,
              messages, files, orchestrators, and members will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-3 py-2'>
            <p className='text-sm text-muted-foreground'>
              To confirm, type{' '}
              <span className='font-semibold text-foreground'>{slug}</span>{' '}
              below.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={slug}
              autoComplete='off'
            />
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={deleteConfirmText !== slug || deleting}
              className='gap-2'
            >
              <Trash2 className='h-4 w-4' />
              {deleting ? 'Deleting...' : 'Delete Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
