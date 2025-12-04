'use client';

/**
 * General Settings Component
 *
 * General configuration settings for orchestrator.
 */

import { useState } from 'react';

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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface GeneralSettingsProps {
  config: any;
  user: any;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}

export function GeneralSettings({
  config,
  user,
  onSave,
  disabled,
}: GeneralSettingsProps) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    displayName: user?.displayName || '',
    avatarUrl: user?.avatarUrl || '',
    bio: user?.bio || '',
    autoReply: config?.autoReply ?? true,
    replyDelay: config?.replyDelay ?? 0,
    maxDailyActions: config?.maxDailyActions || '',
    maxHourlyActions: config?.maxHourlyActions || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        autoReply: formData.autoReply,
        replyDelay: formData.replyDelay,
        maxDailyActions: formData.maxDailyActions
          ? Number(formData.maxDailyActions)
          : null,
        maxHourlyActions: formData.maxHourlyActions
          ? Number(formData.maxHourlyActions)
          : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Your orchestrator profile and basic information
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-4'>
            <Avatar className='h-20 w-20'>
              <AvatarImage src={formData.avatarUrl} alt={formData.name} />
              <AvatarFallback>{formData.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className='flex-1 space-y-2'>
              <Label htmlFor='avatarUrl'>Avatar URL</Label>
              <Input
                id='avatarUrl'
                value={formData.avatarUrl}
                onChange={e =>
                  setFormData({ ...formData, avatarUrl: e.target.value })
                }
                placeholder='https://...'
                disabled
              />
              <p className='text-xs text-muted-foreground'>
                Contact an administrator to update your avatar
              </p>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='displayName'>Display Name</Label>
              <Input
                id='displayName'
                value={formData.displayName}
                onChange={e =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                disabled
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='bio'>Bio</Label>
            <Textarea
              id='bio'
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
              disabled
            />
            <p className='text-xs text-muted-foreground'>
              Contact an administrator to update profile information
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response Behavior</CardTitle>
          <CardDescription>
            Control how your orchestrator responds to messages
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='autoReply'>Auto-reply</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically respond to messages when triggered
              </p>
            </div>
            <Switch
              id='autoReply'
              checked={formData.autoReply}
              onCheckedChange={checked =>
                setFormData({ ...formData, autoReply: checked })
              }
              disabled={disabled}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='replyDelay'>Reply Delay (seconds)</Label>
            <Input
              id='replyDelay'
              type='number'
              min='0'
              max='3600'
              value={formData.replyDelay}
              onChange={e =>
                setFormData({ ...formData, replyDelay: Number(e.target.value) })
              }
              disabled={disabled}
            />
            <p className='text-xs text-muted-foreground'>
              Add a delay before responding to make interactions feel more
              natural
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limits</CardTitle>
          <CardDescription>
            Control how many actions your orchestrator can perform
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='maxHourlyActions'>Max Actions Per Hour</Label>
              <Input
                id='maxHourlyActions'
                type='number'
                min='1'
                value={formData.maxHourlyActions}
                onChange={e =>
                  setFormData({ ...formData, maxHourlyActions: e.target.value })
                }
                placeholder='No limit'
                disabled={disabled}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='maxDailyActions'>Max Actions Per Day</Label>
              <Input
                id='maxDailyActions'
                type='number'
                min='1'
                value={formData.maxDailyActions}
                onChange={e =>
                  setFormData({ ...formData, maxDailyActions: e.target.value })
                }
                placeholder='No limit'
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button type='submit' disabled={disabled || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
