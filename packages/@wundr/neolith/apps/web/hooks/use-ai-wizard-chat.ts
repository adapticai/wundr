'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import * as React from 'react';

import type { EntityType } from '@/lib/ai/types';

export interface UseWizardChatOptions {
  entityType: EntityType;
  workspaceSlug?: string;
  initialGreeting?: string;
  onDataExtracted?: (data: Record<string, unknown>) => void;
}

// Helper to extract text content from a UIMessage
export function getMessageContent(message: UIMessage): string {
  if (!message.parts) {
    return '';
  }
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text'
    )
    .map(part => part.text)
    .join('');
}

// Type for the tool invocation returned by helper
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
}

// Helper to get tool invocations from a UIMessage
export function getToolInvocations(message: UIMessage): ToolInvocation[] {
  if (!message.parts) {
    return [];
  }
  return message.parts
    .filter(
      (part): part is Extract<typeof part, { type: `tool-${string}` }> =>
        typeof part.type === 'string' && part.type.startsWith('tool-')
    )
    .map(part => {
      // Extract tool name from type (e.g., 'tool-extract_workspace' -> 'extract_workspace')
      const toolName = part.type.replace(/^tool-/, '');
      return {
        toolCallId: 'toolCallId' in part ? (part.toolCallId as string) : '',
        toolName,
        state: 'state' in part ? (part.state as string) : 'unknown',
        input: 'input' in part ? part.input : undefined,
        output: 'output' in part ? part.output : undefined,
      };
    });
}

export function useAIWizardChat({
  entityType,
  workspaceSlug,
  initialGreeting,
  onDataExtracted,
}: UseWizardChatOptions) {
  const [input, setInput] = React.useState('');
  const [extractedData, setExtractedData] = React.useState<
    Record<string, unknown>
  >({});
  const [extractionHistory, setExtractionHistory] = React.useState<
    Record<string, unknown>[]
  >([]);

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/wizard/chat',
      body: { entityType, workspaceSlug },
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName.startsWith('extract_')) {
        const newData = toolCall.input as Record<string, unknown>;
        setExtractedData(prev => {
          const merged = { ...prev, ...newData };
          onDataExtracted?.(merged);
          return merged;
        });
        setExtractionHistory(prev => [...prev, newData]);
      }
    },
  });

  // Add initial greeting message if needed
  React.useEffect(() => {
    if (initialGreeting && chat.messages.length === 0) {
      // Directly set messages via the messages property
      chat.messages = [
        {
          id: 'greeting',
          role: 'assistant',
          parts: [{ type: 'text', text: initialGreeting }],
        } as UIMessage,
      ];
    }
  }, [initialGreeting, chat.messages.length, chat]);

  const handleSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim()) {
        return;
      }
      const message = input;
      setInput('');
      await chat.sendMessage({ text: message });
    },
    [input, chat]
  );

  const append = React.useCallback(
    async (message: { role: string; content: string }) => {
      await chat.sendMessage({ text: message.content });
    },
    [chat]
  );

  const isLoading = chat.status === 'streaming' || chat.status === 'submitted';

  const resetExtraction = React.useCallback(() => {
    setExtractedData({});
    setExtractionHistory([]);
  }, []);

  const calculateCompletion = React.useCallback(
    (requiredFields: string[], optionalFields: string[] = []) => {
      const requiredFilled = requiredFields.filter(f => extractedData[f]);
      const optionalFilled = optionalFields.filter(f => {
        const val = extractedData[f];
        return val && (Array.isArray(val) ? val.length > 0 : true);
      });
      const total = requiredFields.length * 2 + optionalFields.length;
      const filled = requiredFilled.length * 2 + optionalFilled.length;
      return Math.round((filled / total) * 100);
    },
    [extractedData]
  );

  const isComplete = React.useCallback(
    (requiredFields: string[]) => {
      return requiredFields.every(f => extractedData[f]);
    },
    [extractedData]
  );

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    sendMessage: chat.sendMessage,
    regenerate: chat.regenerate,
    stop: chat.stop,
    // Compatibility layer
    input,
    setInput,
    handleSubmit,
    isLoading,
    append,
    // Extraction helpers
    extractedData,
    extractionHistory,
    resetExtraction,
    calculateCompletion,
    isComplete,
  };
}
