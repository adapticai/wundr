'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { ModelConfigPanel } from '@/components/ai';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { getDefaultModelConfig } from '@/lib/ai/models';

import type { ModelConfig } from '@/lib/ai/models';

interface AIPreferencesProps {
  userId: string;
  settings: Record<string, unknown>;
  workspaceSlug: string;
}

const HISTORY_RETENTION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'forever', label: 'Forever' },
];

export function AIPreferences({
  userId,
  settings,
  workspaceSlug,
}: AIPreferencesProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Initialize model config from settings or use defaults
  const initialConfig: ModelConfig = settings.modelConfig
    ? (settings.modelConfig as ModelConfig)
    : getDefaultModelConfig('gpt-4o-mini');

  const [config, setConfig] = useState<ModelConfig>(initialConfig);
  const [historyRetention, setHistoryRetention] = useState(
    (settings.historyRetention as string) || '90'
  );
  const [enableContextMemory, setEnableContextMemory] = useState(
    (settings.enableContextMemory as boolean) ?? true
  );
  const [enableSuggestions, setEnableSuggestions] = useState(
    (settings.enableSuggestions as boolean) ?? true
  );
  const [shareUsageData, setShareUsageData] = useState(
    (settings.shareUsageData as boolean) ?? false
  );

  const handleSaveModelConfig = async (savedConfig: ModelConfig) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/ai-config`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defaultModel: savedConfig.model,
            temperature: savedConfig.temperature,
            maxTokens: savedConfig.maxTokens,
            systemPrompt: savedConfig.systemPrompt,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save model configuration');
      }

      toast.success('Model configuration saved successfully');
    } catch (error) {
      console.error('Error saving model config:', error);
      toast.error('Failed to save model configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historyRetention,
          enableContextMemory,
          enableSuggestions,
          shareUsageData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('AI preferences saved successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Model Configuration */}
      <div>
        <h3 className='text-base font-medium mb-4'>Default Model Settings</h3>
        <ModelConfigPanel
          config={config}
          onChange={setConfig}
          onSave={handleSaveModelConfig}
          showSaveButton={true}
        />
      </div>

      <Separator />

      {/* History Retention */}
      <div className='space-y-2'>
        <Label htmlFor='history-retention'>
          Conversation History Retention
        </Label>
        <Select value={historyRetention} onValueChange={setHistoryRetention}>
          <SelectTrigger id='history-retention'>
            <SelectValue placeholder='Select retention period' />
          </SelectTrigger>
          <SelectContent>
            {HISTORY_RETENTION_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className='text-sm text-muted-foreground'>
          How long to keep your AI conversation history
        </p>
      </div>

      {/* Context Memory */}
      <div className='flex items-center justify-between'>
        <div className='space-y-0.5'>
          <Label htmlFor='context-memory'>Context Memory</Label>
          <p className='text-sm text-muted-foreground'>
            Allow AI to remember context across conversations
          </p>
        </div>
        <Switch
          id='context-memory'
          checked={enableContextMemory}
          onCheckedChange={setEnableContextMemory}
        />
      </div>

      {/* AI Suggestions */}
      <div className='flex items-center justify-between'>
        <div className='space-y-0.5'>
          <Label htmlFor='suggestions'>AI Suggestions</Label>
          <p className='text-sm text-muted-foreground'>
            Enable smart suggestions and auto-completion
          </p>
        </div>
        <Switch
          id='suggestions'
          checked={enableSuggestions}
          onCheckedChange={setEnableSuggestions}
        />
      </div>

      {/* Share Usage Data */}
      <div className='flex items-center justify-between'>
        <div className='space-y-0.5'>
          <Label htmlFor='share-data'>Share Usage Data</Label>
          <p className='text-sm text-muted-foreground'>
            Help improve AI models by sharing anonymized usage data
          </p>
        </div>
        <Switch
          id='share-data'
          checked={shareUsageData}
          onCheckedChange={setShareUsageData}
        />
      </div>

      {/* Save Button */}
      <div className='flex justify-end pt-4'>
        <Button onClick={handleSavePreferences} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
