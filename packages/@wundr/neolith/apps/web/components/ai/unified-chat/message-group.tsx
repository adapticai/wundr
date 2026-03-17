'use client';

import { Bot, User } from 'lucide-react';
import * as React from 'react';

import { ActionCopy } from '@/components/ai/actions';
import { Reasoning } from '@/components/ai/reasoning';
import { Response } from '@/components/ai/response';
import { Tool } from '@/components/ai/tool';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import type { UIMessage } from '@ai-sdk/react';

type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

function mapToolState(state: string): ToolStatus {
  switch (state) {
    case 'input-streaming':
      return 'running';
    case 'input-available':
      return 'pending';
    case 'output-available':
      return 'completed';
    case 'output-error':
      return 'error';
    default:
      return 'pending';
  }
}

interface MessageGroupProps {
  message: UIMessage;
  isStreaming?: boolean;
  showToolCalls?: boolean;
  showReasoning?: boolean;
  className?: string;
}

export function MessageGroup({
  message,
  isStreaming = false,
  showToolCalls = true,
  showReasoning = true,
  className,
}: MessageGroupProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const parts = message.parts ?? [];

  // Collect text, reasoning, and tool parts
  const textParts = parts.filter(
    (p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text'
  );
  const reasoningParts = parts.filter(
    (p): p is Extract<typeof p, { type: 'reasoning' }> => p.type === 'reasoning'
  );
  const toolParts = parts.filter(
    (
      p
    ): p is Extract<
      typeof p,
      { type: string } & {
        toolName?: string;
        toolCallId: string;
        state: string;
      }
    > => p.type.startsWith('tool-') || p.type === 'dynamic-tool'
  );

  const textContent = textParts.map(p => p.text).join('');

  if (isUser) {
    return (
      <div className={cn('flex items-end justify-end gap-2', className)}>
        <div className='max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5'>
          <p className='text-sm text-primary-foreground whitespace-pre-wrap break-words'>
            {textContent}
          </p>
        </div>
        <Avatar className='h-7 w-7 flex-shrink-0'>
          <AvatarFallback className='bg-muted text-muted-foreground'>
            <User className='h-4 w-4' />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className={cn('flex items-start gap-2', className)}>
        <Avatar className='h-7 w-7 flex-shrink-0 mt-1'>
          <AvatarFallback className='bg-primary/10 text-primary'>
            <Bot className='h-4 w-4' />
          </AvatarFallback>
        </Avatar>

        <div className='flex-1 min-w-0 space-y-2'>
          {showReasoning &&
            reasoningParts.map((part, idx) => (
              <Reasoning
                key={idx}
                content={part.text}
                isStreaming={isStreaming && part.state === 'streaming'}
              />
            ))}

          {showToolCalls &&
            toolParts.map((part, idx) => {
              const toolName =
                'toolName' in part
                  ? (part as { toolName: string }).toolName
                  : part.type.replace(/^tool-/, '');
              const state =
                'state' in part ? (part as { state: string }).state : 'pending';
              const input =
                'input' in part
                  ? (part as { input?: unknown }).input
                  : undefined;
              const output =
                'output' in part
                  ? (part as { output?: unknown }).output
                  : undefined;
              const errorText =
                'errorText' in part
                  ? (part as { errorText?: string }).errorText
                  : undefined;

              return (
                <Tool
                  key={idx}
                  name={toolName}
                  status={mapToolState(state)}
                  input={
                    input != null && typeof input === 'object'
                      ? (input as Record<string, unknown>)
                      : undefined
                  }
                  output={output}
                  error={errorText}
                />
              );
            })}

          {textContent && (
            <div className='group relative'>
              <div className='max-w-none rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5'>
                <Response isStreaming={isStreaming}>{textContent}</Response>
              </div>
              <div className='absolute -bottom-7 left-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <ActionCopy content={textContent} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
