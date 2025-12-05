/**
 * Model Configuration Component
 * Advanced settings for AI model parameters
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { getDefaultModelConfig, getModelById } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { Info, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ModelSelector } from './model-selector';

import type { ModelConfig } from '@/lib/ai/models';

interface ModelConfigProps {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
  onSave?: (config: ModelConfig) => void;
  className?: string;
  showSaveButton?: boolean;
}

export function ModelConfigPanel({
  config,
  onChange,
  onSave,
  className,
  showSaveButton = true,
}: ModelConfigProps) {
  const [localConfig, setLocalConfig] = useState<ModelConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);

  const selectedModel = getModelById(localConfig.model);

  useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const updateConfig = (updates: Partial<ModelConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onChange(newConfig);
    setHasChanges(true);
  };

  const handleModelChange = (modelId: string) => {
    const defaultConfig = getDefaultModelConfig(modelId);
    const newConfig = {
      ...defaultConfig,
      systemPrompt: localConfig.systemPrompt,
    };
    setLocalConfig(newConfig);
    onChange(newConfig);
    setHasChanges(true);
  };

  const handleReset = () => {
    const defaultConfig = getDefaultModelConfig(localConfig.model);
    setLocalConfig(defaultConfig);
    onChange(defaultConfig);
    setHasChanges(false);
    toast.success('Configuration reset to defaults');
  };

  const handleSave = () => {
    if (onSave) {
      onSave(localConfig);
      setHasChanges(false);
      toast.success('Configuration saved successfully');
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Model Selection */}
      <div className='space-y-2'>
        <Label htmlFor='model-select'>Model</Label>
        <ModelSelector
          value={localConfig.model}
          onChange={handleModelChange}
          showDetails={true}
        />
        {selectedModel && (
          <p className='text-sm text-muted-foreground'>
            {selectedModel.description}
          </p>
        )}
      </div>

      {/* Temperature */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='temperature'>
            Temperature
            <span className='ml-2 text-sm font-normal text-muted-foreground'>
              {localConfig.temperature.toFixed(2)}
            </span>
          </Label>
          <div className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Info className='h-3 w-3' />
            Controls randomness
          </div>
        </div>
        <Slider
          id='temperature'
          min={0}
          max={2}
          step={0.1}
          value={[localConfig.temperature]}
          onValueChange={([value]) => updateConfig({ temperature: value })}
          className='w-full'
        />
        <div className='flex justify-between text-xs text-muted-foreground'>
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Top P */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='top-p'>
            Top P
            <span className='ml-2 text-sm font-normal text-muted-foreground'>
              {localConfig.topP.toFixed(2)}
            </span>
          </Label>
          <div className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Info className='h-3 w-3' />
            Nucleus sampling
          </div>
        </div>
        <Slider
          id='top-p'
          min={0}
          max={1}
          step={0.05}
          value={[localConfig.topP]}
          onValueChange={([value]) => updateConfig({ topP: value })}
          className='w-full'
        />
        <div className='flex justify-between text-xs text-muted-foreground'>
          <span>Focused</span>
          <span>Diverse</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='max-tokens'>
            Max Output Tokens
            <span className='ml-2 text-sm font-normal text-muted-foreground'>
              {localConfig.maxTokens.toLocaleString()}
            </span>
          </Label>
          {selectedModel && (
            <span className='text-xs text-muted-foreground'>
              Limit: {selectedModel.maxOutputTokens.toLocaleString()}
            </span>
          )}
        </div>
        <Slider
          id='max-tokens'
          min={256}
          max={selectedModel?.maxOutputTokens || 16384}
          step={256}
          value={[localConfig.maxTokens]}
          onValueChange={([value]) => updateConfig({ maxTokens: value })}
          className='w-full'
        />
      </div>

      {/* System Prompt */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='system-prompt'>System Prompt (Optional)</Label>
          <span className='text-xs text-muted-foreground'>
            {localConfig.systemPrompt?.length || 0} characters
          </span>
        </div>
        <Textarea
          id='system-prompt'
          placeholder='Enter custom system instructions...'
          value={localConfig.systemPrompt || ''}
          onChange={e =>
            updateConfig({ systemPrompt: e.target.value || undefined })
          }
          className='min-h-[120px] resize-y font-mono text-sm'
        />
        <p className='text-xs text-muted-foreground'>
          Custom instructions to guide the model's behavior
        </p>
      </div>

      {/* Actions */}
      {showSaveButton && (
        <div className='flex items-center gap-2 pt-4 border-t'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleReset}
            disabled={!hasChanges}
            className='flex items-center gap-2'
          >
            <RotateCcw className='h-4 w-4' />
            Reset to Defaults
          </Button>
          <Button
            size='sm'
            onClick={handleSave}
            disabled={!hasChanges}
            className='ml-auto'
          >
            Save Configuration
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact configuration for inline use
 */
export function ModelConfigCompact({
  config,
  onChange,
  className,
}: Omit<ModelConfigProps, 'onSave' | 'showSaveButton'>) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='text-lg'>Model Settings</CardTitle>
        <CardDescription>Configure AI model parameters</CardDescription>
      </CardHeader>
      <CardContent>
        <ModelConfigPanel
          config={config}
          onChange={onChange}
          showSaveButton={false}
        />
      </CardContent>
    </Card>
  );
}
