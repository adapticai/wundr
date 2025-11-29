'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProfileData {
  name: string;
  email: string;
  avatar: string;
}

interface ProfilePreferences {
  enableAnimations: boolean;
  compactSidebar: boolean;
  showHelpfulHints: boolean;
}

export default function ProfileSettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    avatar: '',
  });
  const [preferences, setPreferences] = useState<ProfilePreferences>({
    enableAnimations: true,
    compactSidebar: false,
    showHelpfulHints: true,
  });

  useEffect(() => {
    if (session?.user) {
      setProfileData({
        name: session.user.name || '',
        email: session.user.email || '',
        avatar: session.user.image || '',
      });
    }
  }, [session]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user?.id) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Please upload a JPEG, PNG, WebP, or GIF image',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Upload using FormData to the avatar API
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

      // Update local state with the new avatar URL
      setProfileData((prev) => ({
        ...prev,
        avatar: result.avatar?.url || prev.avatar,
      }));

      // Trigger session update to refresh avatar across the app
      await updateSession();

      toast({
        title: 'Success',
        description: 'Avatar updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!session?.user?.id) return;

    setIsSaving(true);
    try {
      // Update user profile via the /api/users/me endpoint
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileData.name,
          // Note: email updates may require verification and are handled separately
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      // Refresh session to get updated user data
      await updateSession();

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      toast({
        title: 'Success',
        description: 'Preferences saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update preferences',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your personal profile and preferences.</p>
      </div>

      {/* Personal Information Section */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20" shape="lg">
                <AvatarImage src={profileData.avatar} alt={profileData.name} />
                <AvatarFallback className="text-lg" shape="lg">
                  {profileData.name
                    ? profileData.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </AvatarFallback>
              </Avatar>
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={isUploadingAvatar}
                >
                  <span>{isUploadingAvatar ? 'Uploading...' : 'Change Avatar'}</span>
                </Button>
              </Label>
              <input
                ref={fileInputRef}
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP or GIF. Max size 10MB.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={profileData.name}
              onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={profileData.email}
              onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Your email is used for account recovery and notifications
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Manage how you interact with Neolith.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-animations">Enable animations</Label>
                <p className="text-sm text-muted-foreground">
                  Show smooth transitions and animations
                </p>
              </div>
              <Switch
                id="enable-animations"
                checked={preferences.enableAnimations}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, enableAnimations: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compact-sidebar">Compact sidebar</Label>
                <p className="text-sm text-muted-foreground">
                  Use a more compact sidebar layout
                </p>
              </div>
              <Switch
                id="compact-sidebar"
                checked={preferences.compactSidebar}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, compactSidebar: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-hints">Show helpful hints</Label>
                <p className="text-sm text-muted-foreground">
                  Display tooltips and onboarding hints
                </p>
              </div>
              <Switch
                id="show-hints"
                checked={preferences.showHelpfulHints}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, showHelpfulHints: checked }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
