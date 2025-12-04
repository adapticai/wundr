'use client';

import { Loader2, Upload, Info } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useToast } from '@/hooks/use-toast';

interface ProfileData {
  name: string;
  fullName: string;
  email: string;
  avatar: string;
  title: string;
  pronouns: string;
  customPronouns: string;
  statusMessage: string;
}

const DISPLAY_NAME_LIMIT = 32;
const STATUS_MESSAGE_LIMIT = 100;
const PRONOUN_OPTIONS = [
  { value: 'he/him', label: 'he/him' },
  { value: 'she/her', label: 'she/her' },
  { value: 'they/them', label: 'they/them' },
  { value: 'custom', label: 'Custom' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export default function ProfileSettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);

  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    fullName: '',
    email: '',
    avatar: '',
    title: '',
    pronouns: '',
    customPronouns: '',
    statusMessage: '',
  });

  const [userTimeZone, setUserTimeZone] = useState<string>('');

  useEffect(() => {
    if (session?.user) {
      setProfileData({
        name: session.user.name || '',
        fullName: (session.user as any).fullName || '',
        email: session.user.email || '',
        avatar: session.user.image || '',
        title: (session.user as any).title || '',
        pronouns: (session.user as any).pronouns || '',
        customPronouns: (session.user as any).customPronouns || '',
        statusMessage: (session.user as any).statusMessage || '',
      });
    }

    // Detect user's timezone
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimeZone(timezone);
    } catch (error) {
      setUserTimeZone('UTC');
    }
  }, [session]);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (data: Partial<ProfileData>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!session?.user?.id) {
          return;
        }

        try {
          const response = await fetch('/api/users/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update profile');
          }

          await updateSession();
        } catch (error) {
          toast({
            title: 'Error',
            description:
              error instanceof Error ? error.message : 'Failed to save changes',
            variant: 'destructive',
          });
        }
      }, 1000); // 1 second debounce
    },
    [session?.user?.id, updateSession, toast]
  );

  // Handle field changes with auto-save
  const handleFieldChange = useCallback(
    (field: keyof ProfileData, value: string) => {
      setProfileData(prev => {
        const updated = { ...prev, [field]: value };
        debouncedSave({ [field]: value });
        return updated;
      });
    },
    [debouncedSave]
  );

  const validateFile = (file: File): string | null => {
    if (file.size > 10 * 1024 * 1024) {
      return 'Image size must be less than 10MB';
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a JPEG, PNG, WebP, or GIF image';
    }

    return null;
  };

  const uploadAvatar = async (file: File) => {
    if (!session?.user?.id) {
      return;
    }

    const error = validateFile(file);
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/users/${session.user.id}/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }

      const result = await response.json();

      setProfileData(prev => ({
        ...prev,
        avatar: result.avatar?.url || prev.avatar,
      }));

      await updateSession();

      toast({
        title: 'Success',
        description: 'Avatar updated successfully',
      });

      setAvatarPreview(null);
    } catch (error) {
      setAvatarPreview(null);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    uploadAvatar(file);
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      dragCounterRef.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        uploadAvatar(file);
      } else {
        toast({
          title: 'Error',
          description: 'Please drop an image file',
          variant: 'destructive',
        });
      }
    },
    [uploadAvatar, toast]
  );

  const getInitials = (name: string) => {
    return name
      ? name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
      : 'U';
  };

  const formatTimeZone = (tz: string) => {
    const now = new Date();
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    })
      .formatToParts(now)
      .find(part => part.type === 'timeZoneName')?.value;

    return `${tz.replace(/_/g, ' ')} ${offset ? `(${offset})` : ''}`;
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Profile</h1>
        <p className='mt-1 text-muted-foreground'>
          Manage your profile identity and how others see you.
        </p>
      </div>

      {/* Profile Identity Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Identity</CardTitle>
          <CardDescription>
            Customize how you appear across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Avatar Upload with Drag & Drop */}
          <div>
            <Label className='mb-3 block'>Profile Picture</Label>
            <div
              className={`relative flex items-center gap-6 rounded-lg border-2 border-dashed p-4 transition-colors ${
                isDraggingOver
                  ? 'border-primary bg-accent'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className='relative'>
                <Avatar className='h-20 w-20' shape='lg'>
                  <AvatarImage
                    src={avatarPreview || profileData.avatar}
                    alt={profileData.name}
                  />
                  <AvatarFallback className='text-lg' shape='lg'>
                    {getInitials(profileData.name)}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className='absolute inset-0 flex items-center justify-center rounded-lg bg-black/60'>
                    <Loader2 className='h-6 w-6 animate-spin text-white' />
                  </div>
                )}
              </div>

              <div className='flex-1'>
                <div className='flex items-center gap-3'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    <Upload className='mr-2 h-4 w-4' />
                    {isUploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                  {isDraggingOver && (
                    <span className='text-sm font-medium text-primary'>
                      Drop to upload
                    </span>
                  )}
                </div>
                <p className='mt-2 text-xs text-muted-foreground'>
                  Drag and drop an image, or click to browse. JPG, PNG, WebP or
                  GIF. Max 10MB.
                </p>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/jpeg,image/png,image/webp,image/gif'
                  className='hidden'
                  onChange={handleAvatarChange}
                  disabled={isUploadingAvatar}
                />
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='display-name'>Display Name</Label>
              <span
                className={`text-xs ${
                  profileData.name.length > DISPLAY_NAME_LIMIT
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {profileData.name.length}/{DISPLAY_NAME_LIMIT}
              </span>
            </div>
            <Input
              id='display-name'
              type='text'
              placeholder='How you want to be called'
              value={profileData.name}
              onChange={e => {
                const value = e.target.value.slice(0, DISPLAY_NAME_LIMIT);
                handleFieldChange('name', value);
              }}
              maxLength={DISPLAY_NAME_LIMIT}
            />
            <p className='text-xs text-muted-foreground'>
              This is the name that appears across the workspace.
            </p>
          </div>

          {/* Full Name */}
          <div className='space-y-2'>
            <Label htmlFor='full-name'>Full Name</Label>
            <Input
              id='full-name'
              type='text'
              placeholder='Your full legal name'
              value={profileData.fullName}
              onChange={e => handleFieldChange('fullName', e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Your complete name for official records.
            </p>
          </div>

          {/* Title/Role */}
          <div className='space-y-2'>
            <Label htmlFor='title'>Title / Role (optional)</Label>
            <Input
              id='title'
              type='text'
              placeholder='e.g., Senior Designer, Product Manager'
              value={profileData.title}
              onChange={e => handleFieldChange('title', e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Your job title or role within the organization.
            </p>
          </div>

          {/* Pronouns */}
          <div className='space-y-2'>
            <Label htmlFor='pronouns'>Pronouns (optional)</Label>
            <Select
              value={profileData.pronouns}
              onValueChange={value => handleFieldChange('pronouns', value)}
            >
              <SelectTrigger id='pronouns'>
                <SelectValue placeholder='Select your pronouns' />
              </SelectTrigger>
              <SelectContent>
                {PRONOUN_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profileData.pronouns === 'custom' && (
              <Input
                type='text'
                placeholder='Enter your pronouns'
                value={profileData.customPronouns}
                onChange={e =>
                  handleFieldChange('customPronouns', e.target.value)
                }
                className='mt-2'
              />
            )}
            <p className='text-xs text-muted-foreground'>
              Help others know how to refer to you.
            </p>
          </div>

          {/* Status Message */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='status-message'>Status Message (optional)</Label>
              <span
                className={`text-xs ${
                  profileData.statusMessage.length > STATUS_MESSAGE_LIMIT
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {profileData.statusMessage.length}/{STATUS_MESSAGE_LIMIT}
              </span>
            </div>
            <Textarea
              id='status-message'
              placeholder="What's your current status? e.g., On vacation, In a meeting, Available"
              value={profileData.statusMessage}
              onChange={e => {
                const value = e.target.value.slice(0, STATUS_MESSAGE_LIMIT);
                handleFieldChange('statusMessage', value);
              }}
              maxLength={STATUS_MESSAGE_LIMIT}
              rows={2}
            />
            <p className='text-xs text-muted-foreground'>
              Let others know what you're up to or your availability.
            </p>
          </div>

          {/* Time Zone - Informational */}
          <div className='space-y-2'>
            <Label>Time Zone</Label>
            <div className='flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2'>
              <span className='flex-1 text-sm'>
                {formatTimeZone(userTimeZone)}
              </span>
              <Link
                href='./language-region'
                className='flex items-center gap-1 text-xs text-primary hover:underline'
              >
                <Info className='h-3 w-3' />
                Change in Language & Region
              </Link>
            </div>
            <p className='text-xs text-muted-foreground'>
              Your local time zone is detected automatically.
            </p>
          </div>

          {/* Auto-save indicator */}
          <div className='flex items-center gap-2 rounded-md bg-muted/50 p-3'>
            <Info className='h-4 w-4 text-muted-foreground' />
            <p className='text-xs text-muted-foreground'>
              Changes are saved automatically as you type.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
