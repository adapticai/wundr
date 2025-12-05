/**
 * AI Providers Component
 * Manage API keys and provider configurations
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProviderBadge } from '@/components/ai';
import { Eye, EyeOff, Key } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface AIProvidersProps {
  userId: string;
  settings: Record<string, unknown>;
  workspaceSlug: string;
}

export function AIProviders({
  userId,
  settings,
  workspaceSlug,
}: AIProvidersProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showDeepSeekKey, setShowDeepSeekKey] = useState(false);

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/ai-config`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerKeys: {
              openai: openaiKey || undefined,
              anthropic: anthropicKey || undefined,
              deepseek: deepseekKey || undefined,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save provider configuration');
      }

      toast.success('Provider configuration saved successfully');

      // Clear fields after successful save
      setOpenaiKey('');
      setAnthropicKey('');
      setDeepseekKey('');
    } catch (error) {
      console.error('Error saving provider config:', error);
      toast.error('Failed to save provider configuration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      <p className='text-sm text-muted-foreground'>
        Configure API keys for different AI providers. Keys are encrypted and
        stored securely.
      </p>

      {/* OpenAI */}
      <div className='space-y-3 p-4 border rounded-lg'>
        <div className='flex items-center gap-2'>
          <ProviderBadge provider='openai' />
          <span className='text-sm text-muted-foreground'>
            GPT-4o, GPT-4o Mini
          </span>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='openai-key'>API Key</Label>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                id='openai-key'
                type={showOpenAIKey ? 'text' : 'password'}
                placeholder='sk-...'
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                className='pr-10'
              />
              <button
                type='button'
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                {showOpenAIKey ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            Get your API key from{' '}
            <a
              href='https://platform.openai.com/api-keys'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-foreground'
            >
              platform.openai.com
            </a>
          </p>
        </div>
      </div>

      {/* Anthropic */}
      <div className='space-y-3 p-4 border rounded-lg'>
        <div className='flex items-center gap-2'>
          <ProviderBadge provider='anthropic' />
          <span className='text-sm text-muted-foreground'>
            Claude Opus, Sonnet, Haiku
          </span>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='anthropic-key'>API Key</Label>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                id='anthropic-key'
                type={showAnthropicKey ? 'text' : 'password'}
                placeholder='sk-ant-...'
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                className='pr-10'
              />
              <button
                type='button'
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                {showAnthropicKey ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            Get your API key from{' '}
            <a
              href='https://console.anthropic.com/settings/keys'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-foreground'
            >
              console.anthropic.com
            </a>
          </p>
        </div>
      </div>

      {/* DeepSeek */}
      <div className='space-y-3 p-4 border rounded-lg'>
        <div className='flex items-center gap-2'>
          <ProviderBadge provider='deepseek' />
          <span className='text-sm text-muted-foreground'>
            DeepSeek Chat, Reasoner
          </span>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='deepseek-key'>API Key</Label>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                id='deepseek-key'
                type={showDeepSeekKey ? 'text' : 'password'}
                placeholder='sk-...'
                value={deepseekKey}
                onChange={e => setDeepseekKey(e.target.value)}
                className='pr-10'
              />
              <button
                type='button'
                onClick={() => setShowDeepSeekKey(!showDeepSeekKey)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                {showDeepSeekKey ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            Get your API key from{' '}
            <a
              href='https://platform.deepseek.com/api-keys'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-foreground'
            >
              platform.deepseek.com
            </a>
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className='flex justify-end pt-4'>
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className='flex items-center gap-2'
        >
          <Key className='h-4 w-4' />
          {isLoading ? 'Saving...' : 'Save API Keys'}
        </Button>
      </div>
    </div>
  );
}
