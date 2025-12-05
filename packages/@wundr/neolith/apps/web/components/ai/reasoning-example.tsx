'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

import { Reasoning, ReasoningBadge } from './reasoning';

/**
 * Example demonstrating the Reasoning component
 * Shows streaming behavior with auto-open/close
 */
export function ReasoningExample() {
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [content, setContent] = React.useState('');

  const simulateThinking = () => {
    setIsStreaming(true);
    setContent('');

    const thinkingSteps = [
      'Analyzing the problem...',
      'Breaking down into steps...',
      'Considering edge cases...',
      'Evaluating different approaches...',
      'Selecting optimal solution...',
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < thinkingSteps.length) {
        setContent(
          prev => prev + (prev ? '\n' : '') + thinkingSteps[currentStep],
        );
        currentStep++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, 1000);
  };

  return (
    <div className='space-y-4 p-4 max-w-2xl'>
      <div className='flex items-center gap-4'>
        <Button onClick={simulateThinking} disabled={isStreaming}>
          Simulate AI Thinking
        </Button>
        <ReasoningBadge
          isActive={isStreaming}
          duration={
            isStreaming ? Math.floor(content.split('\n').length) : undefined
          }
        />
      </div>

      <Reasoning content={content} isStreaming={isStreaming} />

      <div className='text-sm text-muted-foreground'>
        <p>Behavior:</p>
        <ul className='list-disc list-inside space-y-1 ml-2'>
          <li>Auto-opens when streaming starts</li>
          <li>Updates duration every second</li>
          <li>Auto-closes 1 second after streaming ends</li>
          <li>Can be manually toggled at any time</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example using the composable parts for custom layout
 */
export function CustomReasoningExample() {
  return (
    <div className='space-y-4 p-4 max-w-2xl'>
      <h3 className='font-semibold'>Custom Reasoning Layout</h3>

      <Reasoning
        content='This reasoning block uses custom styling and remains open by default.'
        defaultOpen={true}
        className='border-primary/20'
      />
    </div>
  );
}

/**
 * Example integrating with Vercel AI SDK pattern
 */
export function ChatWithReasoningExample() {
  const messages = React.useMemo(
    () => [
      {
        id: '1',
        role: 'assistant',
        content: 'The sum of 2 + 2 is 4.',
        thinking:
          'First, I need to add 2 and 2. This is basic arithmetic. 2 + 2 = 4.',
      },
    ],
    [],
  );

  return (
    <div className='space-y-4 p-4 max-w-2xl'>
      <h3 className='font-semibold'>Chat with AI Reasoning</h3>

      {messages.map(message => (
        <div key={message.id} className='space-y-2'>
          {message.thinking && (
            <Reasoning
              content={message.thinking}
              isStreaming={false}
              duration={3}
            />
          )}
          <div className='p-3 rounded-lg bg-muted'>{message.content}</div>
        </div>
      ))}
    </div>
  );
}
