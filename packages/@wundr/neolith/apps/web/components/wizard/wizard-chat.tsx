/**
 * Wizard Chat Component
 * Full-featured AI wizard interface with streaming, extraction, and preview
 * @module components/wizard/wizard-chat
 */
'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Loader2, AlertCircle, CheckCircle2, Eye } from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EntityType } from '@/lib/ai';
import { getEntityDisplayName, getGreeting } from '@/lib/ai';

import { ChatContainer } from './chat-container';
import { ChatInput } from './chat-input';
import { EntityPreview } from './entity-preview';

export interface WizardChatProps {
  /** Type of entity being created */
  entityType: EntityType;
  /** Workspace ID for context */
  workspaceId?: string;
  /** Callback when entity is ready to create */
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional initial context */
  initialContext?: string;
}

/**
 * Helper to extract text content from a UIMessage
 */
function getMessageContent(message: UIMessage): string {
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

/**
 * Helper to get tool invocations from a UIMessage
 */
function getToolInvocations(message: UIMessage): Array<{
  toolCallId: string;
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
}> {
  if (!message.parts) {
    return [];
  }
  return message.parts
    .filter(
      (part): part is Extract<typeof part, { type: `tool-${string}` }> =>
        typeof part.type === 'string' && part.type.startsWith('tool-')
    )
    .map(part => {
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

/**
 * Create a stable initial message for hydration consistency
 */
function createInitialMessage(greeting: string): UIMessage {
  return {
    id: 'greeting',
    role: 'assistant',
    parts: [{ type: 'text', text: greeting }],
  } as UIMessage;
}

/**
 * WizardChat - Complete AI wizard with streaming chat, extraction, and preview
 *
 * Features:
 * - Streaming AI responses via Vercel AI SDK
 * - Automatic data extraction from conversation
 * - Multi-step progress tracking
 * - Live entity preview
 * - Validation before creation
 * - Error handling with retry
 * - Loading states
 */
export function WizardChat({
  entityType,
  workspaceId,
  onCreate,
  onCancel,
  initialContext,
}: WizardChatProps) {
  const [activeTab, setActiveTab] = React.useState<'chat' | 'preview'>('chat');
  const [extractedData, setExtractedData] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractionError, setExtractionError] = React.useState<string | null>(
    null
  );
  const [isCreating, setIsCreating] = React.useState(false);
  const [creationError, setCreationError] = React.useState<string | null>(null);
  const [completionProgress, setCompletionProgress] = React.useState(0);

  // Local input state management
  const [input, setInput] = React.useState('');

  // Create stable initial greeting message
  const greetingMessage = React.useMemo(
    () => createInitialMessage(initialContext || getGreeting(entityType)),
    [initialContext, entityType]
  );

  // Initialize chat with new @ai-sdk/react API
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/wizard/chat',
      body: { entityType, workspaceId },
    }),
    onToolCall: ({ toolCall }) => {
      // Check if AI included tool calls for data extraction
      if (toolCall.toolName.startsWith('extract_')) {
        const newData = toolCall.input as Record<string, unknown>;
        setExtractedData(prev => {
          const merged = prev ? { ...prev, ...newData } : newData;
          updateCompletionProgress(merged);
          return merged;
        });
      }
    },
  });

  // Combine greeting message with chat messages
  const allMessages = React.useMemo(() => {
    if (chat.messages.length === 0) {
      return [greetingMessage];
    }
    // Prepend greeting if not already there
    const hasGreeting = chat.messages.some(m => m.id === 'greeting');
    if (!hasGreeting) {
      return [greetingMessage, ...chat.messages];
    }
    return chat.messages;
  }, [greetingMessage, chat.messages]);

  // Calculate completion progress based on extracted data
  const updateCompletionProgress = (data: Record<string, unknown>) => {
    const requiredFields = getRequiredFieldsForEntity(entityType);
    const filledFields = requiredFields.filter(field => {
      const value = data[field];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null && value !== '';
    });

    const progress = (filledFields.length / requiredFields.length) * 100;
    setCompletionProgress(Math.round(progress));
  };

  // Handle manual extraction request
  const handleExtract = async () => {
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const response = await fetch('/api/wizard/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          conversationHistory: allMessages.map(m => ({
            role: m.role,
            content: getMessageContent(m),
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || 'Failed to extract entity data'
        );
      }

      const result = await response.json();

      if (result.valid && result.data) {
        setExtractedData(result.data);
        updateCompletionProgress(result.data);
        setActiveTab('preview');
      } else {
        throw new Error('Extracted data failed validation');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionError(
        error instanceof Error ? error.message : 'Failed to extract entity data'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle entity creation
  const handleCreate = async () => {
    if (!extractedData) {
      return;
    }

    setIsCreating(true);
    setCreationError(null);

    try {
      await onCreate({
        ...extractedData,
        workspaceId,
      });
    } catch (error) {
      console.error('Creation error:', error);
      setCreationError(
        error instanceof Error ? error.message : 'Failed to create entity'
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) {
      return;
    }
    const message = input;
    setInput('');
    await chat.sendMessage({ text: message });
  };

  // Reload last message (regenerate)
  const handleReload = () => {
    chat.regenerate();
  };

  // Check loading state
  const isLoading = chat.status === 'streaming' || chat.status === 'submitted';

  // Calculate if we have enough data to extract
  const canExtract = allMessages.length >= 3 && !isLoading && !isExtracting;
  const canCreate =
    extractedData !== null && completionProgress >= 70 && !isCreating;

  return (
    <Card className='flex h-[80vh] flex-col overflow-hidden'>
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        {/* Header */}
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex-1'>
              <h2 className='text-lg font-semibold'>
                Create {getEntityDisplayName(entityType)}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {activeTab === 'chat'
                  ? 'Describe what you want to create'
                  : 'Review and refine the details'}
              </p>
            </div>

            <div className='flex items-center gap-4'>
              {/* Progress Indicator */}
              {extractedData && (
                <div className='flex items-center gap-2'>
                  <Progress
                    value={completionProgress}
                    className='w-32 h-2'
                    aria-label='Completion progress'
                  />
                  <span className='text-sm text-muted-foreground whitespace-nowrap'>
                    {completionProgress}%
                  </span>
                </div>
              )}

              {/* Tab Switcher */}
              <TabsList className='grid w-[300px] grid-cols-2'>
                <TabsTrigger value='chat'>Conversation</TabsTrigger>
                <TabsTrigger value='preview' disabled={!extractedData}>
                  <Eye className='mr-2 h-4 w-4' />
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* Chat Tab */}
        <TabsContent value='chat' className='m-0 flex h-full flex-col'>
          {/* Error Alerts */}
          {(chat.error || extractionError) && (
            <div className='border-b p-4'>
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  {chat.error?.message || extractionError}
                  {chat.error && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={handleReload}
                      className='ml-2'
                    >
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Success Alert */}
          {extractedData && completionProgress >= 100 && (
            <div className='border-b p-4'>
              <Alert>
                <CheckCircle2 className='h-4 w-4' />
                <AlertDescription>
                  All required information collected! Switch to Preview to
                  review before creating.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Chat Messages */}
          <ChatContainer
            messages={allMessages.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant' | 'system',
              content: getMessageContent(m),
              timestamp: new Date(),
              isStreaming: false,
            }))}
            isLoading={isLoading}
            emptyStateTitle={`Create ${getEntityDisplayName(entityType)}`}
            emptyStateDescription='Tell me about what you want to create, and I will guide you through the process.'
          />

          {/* Chat Input */}
          <div className='border-t px-6 py-4'>
            <form onSubmit={handleSubmit} className='space-y-3'>
              <div className='flex gap-2'>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder='Type your message... (Enter to send, Shift+Enter for new line)'
                  className='flex-1 min-h-[60px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                  disabled={isLoading}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                />
                <Button
                  type='submit'
                  size='icon'
                  className='h-[60px] w-[60px] shrink-0'
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className='h-5 w-5 animate-spin' />
                  ) : (
                    <span className='text-lg'>↑</span>
                  )}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className='flex items-center justify-between'>
                <div className='flex gap-2'>
                  {canExtract && (
                    <Button
                      type='button'
                      variant='default'
                      onClick={handleExtract}
                      disabled={isExtracting}
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className='mr-2 h-4 w-4' />
                          Extract Details
                        </>
                      )}
                    </Button>
                  )}
                  {extractedData && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setActiveTab('preview')}
                    >
                      <Eye className='mr-2 h-4 w-4' />
                      View Preview
                    </Button>
                  )}
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  onClick={onCancel}
                  disabled={isLoading || isCreating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value='preview' className='m-0 h-full overflow-hidden'>
          {extractedData && (
            <div className='flex h-full flex-col'>
              {/* Creation Error */}
              {creationError && (
                <div className='border-b p-4'>
                  <Alert variant='destructive'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>{creationError}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Preview Content */}
              <div className='flex-1 overflow-y-auto p-6'>
                <EntityPreview
                  entityType={entityType}
                  data={extractedData}
                  onEdit={field => {
                    // Switch back to chat and prompt to edit specific field
                    setActiveTab('chat');
                    // Could add a message to the chat here
                  }}
                />
              </div>

              {/* Action Footer */}
              <div className='border-t px-6 py-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      onClick={() => setActiveTab('chat')}
                      disabled={isCreating}
                    >
                      Back to Chat
                    </Button>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      onClick={onCancel}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={!canCreate}>
                      {isCreating ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Creating...
                        </>
                      ) : (
                        <>Create {getEntityDisplayName(entityType)}</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/**
 * Get required fields for entity type
 */
function getRequiredFieldsForEntity(entityType: EntityType): string[] {
  const fieldMap: Record<EntityType, string[]> = {
    workspace: ['name', 'description', 'purpose'],
    orchestrator: ['name', 'role', 'description', 'capabilities'],
    'session-manager': ['name', 'responsibilities'],
    workflow: ['name', 'description', 'trigger', 'actions'],
    channel: ['name', 'type'],
    subagent: ['name', 'description', 'capabilities'],
  };

  return fieldMap[entityType] || ['name', 'description'];
}
