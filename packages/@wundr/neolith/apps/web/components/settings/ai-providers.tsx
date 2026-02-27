/**
 * AI Providers Component
 * Manage API keys and provider configurations
 */

'use client';

import { Eye, EyeOff, Key, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ProviderBadge } from '@/components/ai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AIProvidersProps {
  userId: string;
  settings: Record<string, unknown>;
  workspaceSlug: string;
}

interface ProviderKeyState {
  value: string;
  show: boolean;
}

export function AIProviders({ settings, workspaceSlug }: AIProvidersProps) {
  const [isLoading, setIsLoading] = useState(false);

  const [openai, setOpenai] = useState<ProviderKeyState>({
    value: '',
    show: false,
  });
  const [anthropic, setAnthropic] = useState<ProviderKeyState>({
    value: '',
    show: false,
  });
  const [deepseek, setDeepseek] = useState<ProviderKeyState>({
    value: '',
    show: false,
  });

  // Derive configured status from settings (server provides masked indicators, not actual keys)
  const configuredProviders = (settings.configuredProviders as string[]) ?? [];
  const isOpenAIConfigured = configuredProviders.includes('openai');
  const isAnthropicConfigured = configuredProviders.includes('anthropic');
  const isDeepSeekConfigured = configuredProviders.includes('deepseek');

  const handleSave = async () => {
    const providerKeys: Record<string, string> = {};
    if (openai.value.trim()) providerKeys.openai = openai.value.trim();
    if (anthropic.value.trim()) providerKeys.anthropic = anthropic.value.trim();
    if (deepseek.value.trim()) providerKeys.deepseek = deepseek.value.trim();

    if (Object.keys(providerKeys).length === 0) {
      toast.error('Enter at least one API key to save');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/ai-config`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerKeys }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save provider configuration');
      }

      toast.success('API keys saved successfully');

      // Clear fields after successful save — keys are write-only
      setOpenai({ value: '', show: false });
      setAnthropic({ value: '', show: false });
      setDeepseek({ value: '', show: false });
    } catch (error) {
      console.error('Error saving provider config:', error);
      toast.error('Failed to save API keys');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      <p className='text-sm text-muted-foreground'>
        Enter your own API keys to use AI providers directly. Keys are encrypted
        at rest and never exposed after saving.
      </p>

      {/* OpenAI */}
      <ProviderKeyRow
        provider='openai'
        label='OpenAI'
        models='GPT-4o, GPT-4o Mini, o1'
        placeholder='sk-...'
        docsUrl='https://platform.openai.com/api-keys'
        docsLabel='platform.openai.com'
        isConfigured={isOpenAIConfigured}
        keyState={openai}
        onKeyChange={value => setOpenai(prev => ({ ...prev, value }))}
        onToggleShow={() => setOpenai(prev => ({ ...prev, show: !prev.show }))}
      />

      {/* Anthropic */}
      <ProviderKeyRow
        provider='anthropic'
        label='Anthropic'
        models='Claude Opus 4, Sonnet 4, Haiku 3.5'
        placeholder='sk-ant-...'
        docsUrl='https://console.anthropic.com/settings/keys'
        docsLabel='console.anthropic.com'
        isConfigured={isAnthropicConfigured}
        keyState={anthropic}
        onKeyChange={value => setAnthropic(prev => ({ ...prev, value }))}
        onToggleShow={() =>
          setAnthropic(prev => ({ ...prev, show: !prev.show }))
        }
      />

      {/* DeepSeek */}
      <ProviderKeyRow
        provider='deepseek'
        label='DeepSeek'
        models='DeepSeek Chat, DeepSeek Reasoner'
        placeholder='sk-...'
        docsUrl='https://platform.deepseek.com/api-keys'
        docsLabel='platform.deepseek.com'
        isConfigured={isDeepSeekConfigured}
        keyState={deepseek}
        onKeyChange={value => setDeepseek(prev => ({ ...prev, value }))}
        onToggleShow={() =>
          setDeepseek(prev => ({ ...prev, show: !prev.show }))
        }
      />

      {/* Save Button */}
      <div className='flex justify-end pt-2'>
        <Button onClick={handleSave} disabled={isLoading} className='gap-2'>
          <Key className='h-4 w-4' />
          {isLoading ? 'Saving...' : 'Save API Keys'}
        </Button>
      </div>
    </div>
  );
}

interface ProviderKeyRowProps {
  provider: string;
  label: string;
  models: string;
  placeholder: string;
  docsUrl: string;
  docsLabel: string;
  isConfigured: boolean;
  keyState: ProviderKeyState;
  onKeyChange: (value: string) => void;
  onToggleShow: () => void;
}

function ProviderKeyRow({
  provider,
  label,
  models,
  placeholder,
  docsUrl,
  docsLabel,
  isConfigured,
  keyState,
  onKeyChange,
  onToggleShow,
}: ProviderKeyRowProps) {
  return (
    <div className='space-y-3 p-4 border rounded-lg'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <ProviderBadge
            provider={provider as 'openai' | 'anthropic' | 'deepseek'}
          />
          <span className='text-sm text-muted-foreground'>{models}</span>
        </div>
        {isConfigured && (
          <Badge
            variant='secondary'
            className='gap-1 text-green-700 dark:text-green-400'
          >
            <CheckCircle2 className='h-3 w-3' />
            Configured
          </Badge>
        )}
      </div>
      <div className='space-y-2'>
        <Label htmlFor={`${provider}-key`}>
          {isConfigured ? 'Replace API Key' : 'API Key'}
        </Label>
        <div className='relative'>
          <Input
            id={`${provider}-key`}
            type={keyState.show ? 'text' : 'password'}
            placeholder={
              isConfigured
                ? 'Enter new key to replace existing...'
                : placeholder
            }
            value={keyState.value}
            onChange={e => onKeyChange(e.target.value)}
            className='pr-10'
            autoComplete='off'
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={onToggleShow}
            className='absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground'
            aria-label={keyState.show ? 'Hide key' : 'Show key'}
          >
            {keyState.show ? (
              <EyeOff className='h-4 w-4' />
            ) : (
              <Eye className='h-4 w-4' />
            )}
          </Button>
        </div>
        <p className='text-xs text-muted-foreground'>
          Get your API key from{' '}
          <a
            href={docsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='underline hover:text-foreground'
          >
            {docsLabel}
          </a>
        </p>
      </div>
    </div>
  );
}
