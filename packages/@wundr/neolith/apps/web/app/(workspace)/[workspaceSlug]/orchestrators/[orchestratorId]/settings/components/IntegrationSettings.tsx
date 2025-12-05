'use client';

/**
 * Integration Settings Component
 *
 * Configure third-party integrations and webhooks for the orchestrator.
 */

import { Plus, X, ExternalLink } from 'lucide-react';
import { useState } from 'react';

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

interface IntegrationSettingsProps {
  config: any;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}

export function IntegrationSettings({
  config,
  onSave,
  disabled,
}: IntegrationSettingsProps) {
  const [webhookUrls, setWebhookUrls] = useState<string[]>(
    (config?.webhookUrls as string[]) || [],
  );
  const [newWebhook, setNewWebhook] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addWebhook = () => {
    try {
      // Validate URL
      new URL(newWebhook);
      if (!webhookUrls.includes(newWebhook)) {
        setWebhookUrls([...webhookUrls, newWebhook]);
        setNewWebhook('');
      }
    } catch {
      // Invalid URL, ignore
    }
  };

  const removeWebhook = (url: string) => {
    setWebhookUrls(webhookUrls.filter(w => w !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ webhookUrls });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Webhook Notifications</CardTitle>
          <CardDescription>
            Configure webhook endpoints to receive notifications about
            orchestrator activities
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='webhook-url'>Webhook URLs</Label>
            <p className='text-sm text-muted-foreground mb-2'>
              Add webhook endpoints to receive POST requests for events
            </p>
            <div className='flex gap-2'>
              <Input
                id='webhook-url'
                value={newWebhook}
                onChange={e => setNewWebhook(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addWebhook();
                  }
                }}
                placeholder='https://your-endpoint.com/webhook'
                disabled={disabled}
                type='url'
              />
              <Button
                type='button'
                onClick={addWebhook}
                disabled={disabled || !newWebhook}
              >
                <Plus className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {webhookUrls.length > 0 ? (
            <div className='space-y-2'>
              {webhookUrls.map(url => (
                <div
                  key={url}
                  className='flex items-center justify-between border rounded-lg p-3'
                >
                  <div className='flex items-center gap-2'>
                    <ExternalLink className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-mono'>{url}</span>
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => removeWebhook(url)}
                    disabled={disabled}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-8 text-muted-foreground text-sm'>
              No webhooks configured
            </div>
          )}

          <div className='border-t pt-4'>
            <Label>Available Events</Label>
            <div className='flex flex-wrap gap-2 mt-2'>
              <Badge variant='outline'>message.created</Badge>
              <Badge variant='outline'>task.assigned</Badge>
              <Badge variant='outline'>task.completed</Badge>
              <Badge variant='outline'>workflow.executed</Badge>
              <Badge variant='outline'>error.occurred</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Third-Party Integrations</CardTitle>
          <CardDescription>
            Configure external service integrations (managed at workspace level)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-sm text-muted-foreground'>
            Integration configurations are managed through workspace settings.
            Your orchestrator will have access to all workspace-level
            integrations based on your capabilities.
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
