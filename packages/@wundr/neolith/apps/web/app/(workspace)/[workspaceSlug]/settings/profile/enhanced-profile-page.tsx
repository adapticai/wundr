'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Globe,
  Info,
  Link2,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ImageCropDialog } from '@/components/profile/image-crop-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  enhancedProfileSchema,
  PROFILE_LIMITS,
  VISIBILITY_OPTIONS,
  type EnhancedProfileInput,
  type ProfileVisibility,
} from '@/lib/validations/profile';

const PRONOUN_OPTIONS = [
  { value: 'he/him', label: 'he/him' },
  { value: 'she/her', label: 'she/her' },
  { value: 'they/them', label: 'they/them' },
  { value: 'custom', label: 'Custom' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const TIMEZONES = Intl.supportedValuesOf('timeZone').slice(0, 50);

interface UserProfile {
  name: string;
  displayName: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio: string;
  location: string;
  timezone: string;
  title: string;
  pronouns: string;
  customPronouns: string;
  statusMessage: string;
  socialLinks: {
    linkedin: string;
    github: string;
    twitter: string;
    website: string;
    portfolio: string;
  };
  visibility: {
    profileVisibility: ProfileVisibility;
    showEmail: boolean;
    showLocation: boolean;
    showSocialLinks: boolean;
    showBio: boolean;
  };
}

export default function EnhancedProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [usernameAvailability, setUsernameAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm({
    resolver: zodResolver(enhancedProfileSchema),
    defaultValues: {
      name: '',
      username: '',
      bio: '',
      location: '',
      timezone: '',
      title: '',
      pronouns: '',
      customPronouns: '',
      statusMessage: '',
      socialLinks: {
        linkedin: '',
        github: '',
        twitter: '',
        website: '',
        portfolio: '',
      },
      visibility: {
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
        showSocialLinks: true,
        showBio: true,
      },
    },
  });

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user?.id) {
return;
}

      try {
        const response = await fetch('/api/users/me');
        if (!response.ok) {
throw new Error('Failed to fetch profile');
}

        const { data: user } = await response.json();
        const prefs = (user.preferences || {}) as Record<string, any>;
        const socialLinks = prefs.socialLinks || {};
        const visibility = prefs.visibility || {};

        // Detect timezone
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        form.reset({
          name: user.name || '',
          username: user.displayName || '',
          bio: user.bio || '',
          location: prefs.location || '',
          timezone: prefs.timezone || detectedTimezone,
          title: prefs.title || '',
          pronouns: prefs.pronouns || '',
          customPronouns: prefs.customPronouns || '',
          statusMessage: prefs.statusMessage || '',
          socialLinks: {
            linkedin: socialLinks.linkedin || '',
            github: socialLinks.github || '',
            twitter: socialLinks.twitter || '',
            website: socialLinks.website || '',
            portfolio: socialLinks.portfolio || '',
          },
          visibility: {
            profileVisibility: visibility.profileVisibility || 'public',
            showEmail: visibility.showEmail ?? false,
            showLocation: visibility.showLocation ?? true,
            showSocialLinks: visibility.showSocialLinks ?? true,
            showBio: visibility.showBio ?? true,
          },
        });

        setAvatarPreview(user.avatarUrl || null);
      } catch (error) {
        console.error('Failed to load profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [session, form, toast]);

  // Check username availability
  const checkUsernameAvailability = useCallback(
    async (username: string) => {
      if (!username || username.length < PROFILE_LIMITS.USERNAME_MIN) {
        setUsernameAvailability({
          checking: false,
          available: null,
          message: '',
        });
        return;
      }

      setUsernameAvailability({ checking: true, available: null, message: '' });

      try {
        const response = await fetch('/api/users/username/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });

        const data = await response.json();

        setUsernameAvailability({
          checking: false,
          available: data.available,
          message: data.message || '',
        });
      } catch (error) {
        setUsernameAvailability({
          checking: false,
          available: null,
          message: 'Failed to check availability',
        });
      }
    },
    [],
  );

  // Debounced username check
  const handleUsernameChange = useCallback(
    (value: string) => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }

      usernameCheckTimeoutRef.current = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
    },
    [checkUsernameAvailability],
  );

  // Handle avatar file selection
  const handleAvatarFileSelect = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setImageToCrop(dataUrl);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
return;
}

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    handleAvatarFileSelect(file);
  };

  // Handle cropped image upload
  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      if (!session?.user?.id) {
return;
}

      setIsUploadingAvatar(true);

      try {
        const formData = new FormData();
        formData.append(
          'file',
          croppedBlob,
          `avatar-${Date.now()}.jpg`,
        );

        const response = await fetch(`/api/users/${session.user.id}/avatar`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload avatar');
        }

        const result = await response.json();
        setAvatarPreview(result.avatar?.url || null);
        await updateSession();

        toast({
          title: 'Success',
          description: 'Profile picture updated successfully',
        });
      } catch (error) {
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
    },
    [session?.user?.id, updateSession, toast],
  );

  // Drag and drop handlers
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
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      dragCounterRef.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleAvatarFileSelect(file);
      } else {
        toast({
          title: 'Error',
          description: 'Please drop an image file',
          variant: 'destructive',
        });
      }
    },
    [handleAvatarFileSelect, toast],
  );

  // Form submission
  const onSubmit = async (data: EnhancedProfileInput) => {
    if (!session?.user?.id) {
return;
}

    setIsSaving(true);

    try {
      const payload = {
        name: data.name,
        displayName: data.username,
        bio: data.bio || '',
        preferences: {
          location: data.location || '',
          timezone: data.timezone || '',
          title: data.title || '',
          pronouns: data.pronouns || '',
          customPronouns: data.customPronouns || '',
          statusMessage: data.statusMessage || '',
          socialLinks: data.socialLinks,
          visibility: data.visibility,
        },
      };

      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      await updateSession();

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      ? name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
      : 'U';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your public profile and how others see you across workspaces.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Picture Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Upload a profile picture to personalize your account. Drag and drop
                or click to browse.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={avatarPreview || undefined}
                      alt={form.watch('name') || 'User'}
                    />
                    <AvatarFallback className="text-lg">
                      {getInitials(form.watch('name') || 'User')}
                    </AvatarFallback>
                  </Avatar>
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                    </Button>
                    {isDraggingOver && (
                      <span className="text-sm font-medium text-primary">
                        Drop to upload
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    JPG, PNG, WebP or GIF. Max 10MB. Image will be cropped to a
                    circle.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isUploadingAvatar}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Your display name and username are visible across the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="How you want to be called"
                          {...field}
                          maxLength={PROFILE_LIMITS.DISPLAY_NAME_MAX}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                          {field.value?.length || 0}/
                          {PROFILE_LIMITS.DISPLAY_NAME_MAX}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      This is your public display name across workspaces.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username / Handle</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="your-username"
                          {...field}
                          maxLength={PROFILE_LIMITS.USERNAME_MAX}
                          onChange={e => {
                            field.onChange(e);
                            handleUsernameChange(e.target.value);
                          }}
                        />
                        <div className="absolute right-3 top-2.5 flex items-center gap-2">
                          {usernameAvailability.checking && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {!usernameAvailability.checking &&
                            usernameAvailability.available === true && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          {!usernameAvailability.checking &&
                            usernameAvailability.available === false && (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {usernameAvailability.message ||
                        'Unique identifier, lowercase letters, numbers, hyphens, and underscores only.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio / Description</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Textarea
                          placeholder="Tell us a little about yourself..."
                          rows={4}
                          {...field}
                          maxLength={PROFILE_LIMITS.BIO_MAX}
                        />
                        <span className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                          {field.value?.length || 0}/{PROFILE_LIMITS.BIO_MAX}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      A short bio that appears on your profile.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
              <CardDescription>
                Help others understand your role and expertise.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title / Role</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Senior Designer, Product Manager"
                        {...field}
                        maxLength={PROFILE_LIMITS.TITLE_MAX}
                      />
                    </FormControl>
                    <FormDescription>
                      Your job title or professional role.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., San Francisco, CA"
                        {...field}
                        maxLength={PROFILE_LIMITS.LOCATION_MAX}
                      />
                    </FormControl>
                    <FormDescription>
                      Where you're based (city, region, or remote).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz} value={tz}>
                            {tz.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Your local timezone for scheduling and collaboration.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pronouns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pronouns (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your pronouns" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRONOUN_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Help others know how to refer to you.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('pronouns') === 'custom' && (
                <FormField
                  control={form.control}
                  name="customPronouns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Pronouns</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ze/zir" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="statusMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Message (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="e.g., On vacation, Available, In meetings"
                          {...field}
                          maxLength={PROFILE_LIMITS.STATUS_MESSAGE_MAX}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                          {field.value?.length || 0}/
                          {PROFILE_LIMITS.STATUS_MESSAGE_MAX}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Let others know your current availability or status.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>
                Connect your social profiles and portfolio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="socialLinks.linkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://linkedin.com/in/username"
                          {...field}
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="socialLinks.github"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://github.com/username"
                          {...field}
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="socialLinks.twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Twitter / X</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://twitter.com/username"
                          {...field}
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="socialLinks.website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://yourwebsite.com"
                          {...field}
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="socialLinks.portfolio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfolio</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="https://portfolio.com"
                          {...field}
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Visibility</CardTitle>
              <CardDescription>
                Control who can see your profile information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="visibility.profileVisibility"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Profile Visibility</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-start space-x-3 space-y-0">
                          <RadioGroupItem value="public" id="public" />
                          <div className="flex-1">
                            <Label htmlFor="public" className="font-medium">
                              Public
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Anyone can see your profile
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 space-y-0">
                          <RadioGroupItem value="workspace" id="workspace" />
                          <div className="flex-1">
                            <Label htmlFor="workspace" className="font-medium">
                              Workspace Members Only
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Only members of your workspaces can see your profile
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 space-y-0">
                          <RadioGroupItem value="private" id="private" />
                          <div className="flex-1">
                            <Label htmlFor="private" className="font-medium">
                              Private
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Only you can see your full profile
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Visible Information</h4>

                <FormField
                  control={form.control}
                  name="visibility.showEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Show Email</FormLabel>
                        <FormDescription>
                          Display your email address on your profile
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility.showLocation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Show Location</FormLabel>
                        <FormDescription>
                          Display your location on your profile
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility.showBio"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Show Bio</FormLabel>
                        <FormDescription>
                          Display your bio on your profile
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility.showSocialLinks"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Show Social Links
                        </FormLabel>
                        <FormDescription>
                          Display your social media links on your profile
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Make sure all information is accurate before saving.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      {/* Image Crop Dialog */}
      {imageToCrop && (
        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageUrl={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
        />
      )}
    </div>
  );
}
