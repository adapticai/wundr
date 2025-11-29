'use client';

/**
 * Trigger Settings Component
 *
 * Configure when and how the orchestrator responds.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface TriggerSettingsProps {
  config: any;
  orchestratorId: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}

export function TriggerSettings({ config, onSave, disabled }: TriggerSettingsProps) {
  const [formData, setFormData] = useState({
    mentionOnly: config?.mentionOnly ?? false,
    keywordTriggers: (config?.keywordTriggers as string[]) || [],
    watchedChannels: (config?.watchedChannels as string[]) || [],
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addKeyword = () => {
    if (newKeyword && !formData.keywordTriggers.includes(newKeyword)) {
      setFormData({
        ...formData,
        keywordTriggers: [...formData.keywordTriggers, newKeyword],
      });
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywordTriggers: formData.keywordTriggers.filter((k) => k !== keyword),
    });
  };

  const addChannel = () => {
    if (newChannel && !formData.watchedChannels.includes(newChannel)) {
      setFormData({
        ...formData,
        watchedChannels: [...formData.watchedChannels, newChannel],
      });
      setNewChannel('');
    }
  };

  const removeChannel = (channel: string) => {
    setFormData({
      ...formData,
      watchedChannels: formData.watchedChannels.filter((c) => c !== channel),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Response Triggers</CardTitle>
          <CardDescription>Configure when your orchestrator should respond</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mentionOnly">Mention Only Mode</Label>
              <p className="text-sm text-muted-foreground">
                Only respond when explicitly mentioned with @
              </p>
            </div>
            <Switch
              id="mentionOnly"
              checked={formData.mentionOnly}
              onCheckedChange={(checked) => setFormData({ ...formData, mentionOnly: checked })}
              disabled={disabled}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="keywordTriggers">Keyword Triggers</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Keywords that will trigger a response from your orchestrator
              </p>
              <div className="flex gap-2">
                <Input
                  id="keywordTriggers"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Add keyword..."
                  disabled={disabled}
                />
                <Button type="button" onClick={addKeyword} disabled={disabled || !newKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.keywordTriggers.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      disabled={disabled}
                      className="ml-1 hover:bg-accent rounded-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="watchedChannels">Watched Channels</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Specific channels to monitor for messages
              </p>
              <div className="flex gap-2">
                <Input
                  id="watchedChannels"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChannel();
                    }
                  }}
                  placeholder="Channel ID..."
                  disabled={disabled}
                />
                <Button type="button" onClick={addChannel} disabled={disabled || !newChannel}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.watchedChannels.map((channel) => (
                  <Badge key={channel} variant="secondary" className="gap-1">
                    {channel}
                    <button
                      type="button"
                      onClick={() => removeChannel(channel)}
                      disabled={disabled}
                      className="ml-1 hover:bg-accent rounded-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
