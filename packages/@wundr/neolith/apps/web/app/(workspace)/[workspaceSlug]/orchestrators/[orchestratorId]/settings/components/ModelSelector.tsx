'use client';

/**
 * Model Selector Component
 *
 * Configure LLM model and parameters for the orchestrator.
 */

import { useState } from 'react';

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
import { Slider } from '@/components/ui/slider';

interface ModelSelectorProps {
  config: any;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}

const ANTHROPIC_MODELS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export function ModelSelector({
  config,
  onSave,
  disabled,
}: ModelSelectorProps) {
  const [formData, setFormData] = useState({
    llmProvider: config?.llmProvider || 'anthropic',
    llmModel: config?.llmModel || 'claude-3-5-sonnet-20241022',
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens ?? 4096,
  });

  const [isSaving, setIsSaving] = useState(false);

  const availableModels =
    formData.llmProvider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;

  const handleProviderChange = (provider: string) => {
    const defaultModel =
      provider === 'anthropic'
        ? 'claude-3-5-sonnet-20241022'
        : 'gpt-4-turbo-preview';
    setFormData({
      ...formData,
      llmProvider: provider,
      llmModel: defaultModel,
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
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>LLM Model Configuration</CardTitle>
          <CardDescription>
            Choose and configure the AI model for your orchestrator
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='llmProvider'>Provider</Label>
              <Select
                value={formData.llmProvider}
                onValueChange={handleProviderChange}
                disabled={disabled}
              >
                <SelectTrigger id='llmProvider'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='anthropic'>Anthropic (Claude)</SelectItem>
                  <SelectItem value='openai'>OpenAI (GPT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='llmModel'>Model</Label>
              <Select
                value={formData.llmModel}
                onValueChange={value =>
                  setFormData({ ...formData, llmModel: value })
                }
                disabled={disabled}
              >
                <SelectTrigger id='llmModel'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex justify-between'>
                <Label htmlFor='temperature'>
                  Temperature: {formData.temperature.toFixed(2)}
                </Label>
                <span className='text-sm text-muted-foreground'>
                  Creativity
                </span>
              </div>
              <Slider
                id='temperature'
                min={0}
                max={2}
                step={0.1}
                value={[formData.temperature]}
                onValueChange={value =>
                  setFormData({ ...formData, temperature: value[0] })
                }
                disabled={disabled}
              />
              <p className='text-xs text-muted-foreground'>
                Lower values make responses more focused, higher values more
                creative
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='maxTokens'>Max Tokens</Label>
              <Input
                id='maxTokens'
                type='number'
                min='1'
                max='200000'
                value={formData.maxTokens}
                onChange={e =>
                  setFormData({
                    ...formData,
                    maxTokens: Number(e.target.value),
                  })
                }
                disabled={disabled}
              />
              <p className='text-xs text-muted-foreground'>
                Maximum length of generated responses
              </p>
            </div>
          </div>

          <div className='border-t pt-4'>
            <div className='space-y-2'>
              <Label>Model Capabilities</Label>
              <div className='text-sm space-y-1'>
                {formData.llmProvider === 'anthropic' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Context Window:
                      </span>
                      <span>200K tokens</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>Vision:</span>
                      <span>Supported</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>Tool Use:</span>
                      <span>Advanced</span>
                    </div>
                  </>
                )}
                {formData.llmProvider === 'openai' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Context Window:
                      </span>
                      <span>128K tokens</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>Vision:</span>
                      <span>Supported (GPT-4)</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Function Calling:
                      </span>
                      <span>Supported</span>
                    </div>
                  </>
                )}
              </div>
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
