'use client';

import { Paperclip, Mic } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import {
  PromptInput,
  PromptInputForm,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
} from './prompt-input';

/**
 * Example 1: Basic usage with default settings
 */
export function BasicPromptExample() {
  const [value, setValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) {
      return;
    }

    setIsLoading(true);
    console.log('Submitting:', value);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    setIsLoading(false);
    setValue('');
  };

  return (
    <div className='max-w-2xl mx-auto p-4'>
      <h3 className='text-lg font-semibold mb-4'>Basic Prompt Input</h3>
      <PromptInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        placeholder='Ask me anything...'
      />
    </div>
  );
}

/**
 * Example 2: Custom composable version with model selector and tools
 */
export function AdvancedPromptExample() {
  const [value, setValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState(
    'claude-sonnet-4-20250514'
  );

  const handleSubmit = async () => {
    if (!value.trim()) {
      return;
    }

    setIsLoading(true);
    console.log('Submitting to', selectedModel, ':', value);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsLoading(false);
    setValue('');
  };

  const handleAttachment = () => {
    console.log('Attachment clicked');
  };

  const handleVoice = () => {
    console.log('Voice input clicked');
  };

  return (
    <div className='max-w-2xl mx-auto p-4'>
      <h3 className='text-lg font-semibold mb-4'>Advanced Prompt Input</h3>
      <PromptInputForm
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <PromptInputTextarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder='Type your message... (Shift+Enter for new line)'
          disabled={isLoading}
          style={{ minHeight: 48, maxHeight: 200 }}
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputModelSelect
              value={selectedModel}
              onValueChange={setSelectedModel}
              models={[
                { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
                { value: 'claude-opus-4', label: 'Claude Opus 4' },
                { value: 'gpt-4o', label: 'GPT-4o' },
                { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
              ]}
            />
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleAttachment}
              disabled={isLoading}
            >
              <Paperclip className='h-4 w-4' />
              <span className='sr-only'>Attach file</span>
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleVoice}
              disabled={isLoading}
            >
              <Mic className='h-4 w-4' />
              <span className='sr-only'>Voice input</span>
            </Button>
          </PromptInputTools>
          <PromptInputSubmit disabled={!value.trim() || isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </PromptInputSubmit>
        </PromptInputToolbar>
      </PromptInputForm>
    </div>
  );
}

/**
 * Example 3: Minimal composable version
 */
export function MinimalPromptExample() {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Message:', value);
    setValue('');
  };

  // Auto-resize effect
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  return (
    <div className='max-w-2xl mx-auto p-4'>
      <h3 className='text-lg font-semibold mb-4'>Minimal Custom Prompt</h3>
      <PromptInputForm onSubmit={handleSubmit}>
        <PromptInputTextarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder='Minimal prompt...'
        />
        <PromptInputToolbar>
          <div />
          <PromptInputSubmit>Send</PromptInputSubmit>
        </PromptInputToolbar>
      </PromptInputForm>
    </div>
  );
}
