/**
 * Conversational Workflow Creation Page
 * @module app/(workspace)/[workspaceId]/workflows/new
 */
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Send,
  ArrowRight,
  Zap,
  GitBranch,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WorkflowPreview } from '@/components/workflows/workflow-preview';

import type {
  TriggerConfig,
  ActionConfig,
  ActionId,
  CreateWorkflowInput,
} from '@/types/workflow';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface WorkflowSpec {
  name: string;
  description: string;
  trigger: TriggerConfig | null;
  actions: Omit<ActionConfig, 'id' | 'order'>[];
  confidence: number;
  missingFields: string[];
  suggestions: string[];
}

const GREETING_MESSAGE = `Hi! I'll help you create a new Workflow. Workflows automate tasks and processes based on triggers and actions.

Let's start by understanding what you want to automate. For example:
- "Send a welcome message when someone joins a channel"
- "Notify my team when a keyword is mentioned"
- "Create a daily summary at 9 AM"

What would you like your workflow to do?`;

/**
 * ConversationalWorkflowCreation - Chat-based workflow creation
 */
export default function ConversationalWorkflowCreationPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = (params?.workspaceSlug ?? '') as string;

  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: 'greeting',
      role: 'assistant',
      content: GREETING_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generatedSpec, setGeneratedSpec] = React.useState<WorkflowSpec | null>(
    null
  );
  const [showReview, setShowReview] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const sendMessage = async (userMessage: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const response = await fetch('/api/creation/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: 'workflow',
          messages: [...messages, userMsg],
          workspaceContext: {
            id: workspaceId,
            name: 'Current Workspace',
          },
          existingSpec: generatedSpec,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Check if spec was generated
      if (data.spec) {
        const spec: WorkflowSpec = {
          name: data.spec.name || '',
          description: data.spec.description || '',
          trigger: data.spec.properties?.trigger || null,
          actions: data.spec.properties?.actions || [],
          confidence: data.spec.confidence || 0,
          missingFields: data.spec.missingFields || [],
          suggestions: data.spec.suggestions || [],
        };
        setGeneratedSpec(spec);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `I encountered an error: ${errorMessage}. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSwitchToReview = () => {
    if (!generatedSpec) {
      // Generate basic spec from conversation
      const basicSpec: WorkflowSpec = {
        name: '',
        description: messages
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' ')
          .slice(0, 200),
        trigger: null,
        actions: [],
        confidence: 0.3,
        missingFields: ['name', 'trigger', 'actions'],
        suggestions: ['Continue the conversation to provide more details'],
      };
      setGeneratedSpec(basicSpec);
    }
    setShowReview(true);
  };

  const handleCreateWorkflow = async () => {
    if (!generatedSpec || !generatedSpec.trigger) {
      setError('Workflow specification is incomplete');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const workflowInput: CreateWorkflowInput = {
        name: generatedSpec.name,
        description: generatedSpec.description,
        trigger: generatedSpec.trigger,
        actions: generatedSpec.actions.map((action, index) => ({
          ...action,
          order: index,
        })),
      };

      const response = await fetch(`/api/workspaces/${workspaceId}/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowInput),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create workflow');
      }

      await response.json();

      // Redirect to workflows page
      router.push(`/${workspaceId}/workflows`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create workflow';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/${workspaceId}/workflows`);
  };

  if (showReview && generatedSpec) {
    return (
      <div className='flex h-screen flex-col'>
        {/* Header */}
        <div className='border-b bg-background px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-xl font-semibold'>Review Workflow</h1>
              <p className='text-sm text-muted-foreground'>
                Review and finalize your workflow before creating
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowReview(false)}
              >
                Back to Chat
              </Button>
              <Button type='button' onClick={handleCancel} variant='ghost'>
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Review Content */}
        <div className='flex-1 overflow-auto p-6'>
          <div className='mx-auto max-w-4xl space-y-6'>
            {/* Confidence & Status */}
            <div className='rounded-lg border bg-card p-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  {generatedSpec.confidence >= 0.7 ? (
                    <CheckCircle className='h-5 w-5 text-green-600' />
                  ) : (
                    <AlertCircle className='h-5 w-5 text-yellow-600' />
                  )}
                  <div>
                    <p className='font-medium'>
                      Specification Confidence:{' '}
                      {Math.round(generatedSpec.confidence * 100)}%
                    </p>
                    {generatedSpec.missingFields.length > 0 && (
                      <p className='text-sm text-muted-foreground'>
                        Missing: {generatedSpec.missingFields.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {generatedSpec.suggestions.length > 0 && (
                <div className='mt-3 rounded-md bg-muted/50 p-3'>
                  <p className='text-sm font-medium'>Suggestions:</p>
                  <ul className='mt-1 space-y-1'>
                    {generatedSpec.suggestions.map((suggestion, idx) => (
                      <li key={idx} className='text-sm text-muted-foreground'>
                        • {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Workflow Details */}
            <div className='rounded-lg border bg-card p-6'>
              <h2 className='mb-4 text-lg font-semibold'>Workflow Details</h2>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground'>
                    Name
                  </label>
                  <input
                    type='text'
                    value={generatedSpec.name}
                    onChange={e =>
                      setGeneratedSpec({
                        ...generatedSpec,
                        name: e.target.value,
                      })
                    }
                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    placeholder='My Workflow'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-foreground'>
                    Description
                  </label>
                  <textarea
                    value={generatedSpec.description}
                    onChange={e =>
                      setGeneratedSpec({
                        ...generatedSpec,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                    placeholder='Describe what this workflow does...'
                  />
                </div>
              </div>
            </div>

            {/* Visual Workflow Preview */}
            {generatedSpec.trigger && (
              <WorkflowPreview
                name={generatedSpec.name}
                description={generatedSpec.description}
                trigger={generatedSpec.trigger}
                actions={generatedSpec.actions.map(
                  (action, index) =>
                    ({
                      ...action,
                      id: `preview-${index}` as ActionId,
                      order: index,
                    }) as ActionConfig
                )}
              />
            )}

            {/* Error Display */}
            {error && (
              <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className='flex justify-end gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowReview(false)}
                disabled={isSaving}
              >
                Back to Chat
              </Button>
              <Button
                type='button'
                onClick={handleCreateWorkflow}
                disabled={
                  isSaving ||
                  !generatedSpec.name.trim() ||
                  !generatedSpec.trigger ||
                  generatedSpec.actions.length === 0
                }
              >
                {isSaving ? 'Creating...' : 'Create Workflow'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-col'>
      {/* Header */}
      <div className='border-b bg-background px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-xl font-semibold'>Create Workflow</h1>
            <p className='text-sm text-muted-foreground'>
              Chat with AI to generate your workflow specification
            </p>
          </div>
          <Button type='button' onClick={handleCancel} variant='ghost'>
            Cancel
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        <div className='mx-auto max-w-3xl space-y-4'>
          {messages.map(message => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className='flex items-start gap-3'>
              <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10'>
                <Zap className='h-4 w-4 text-primary' />
              </div>
              <div className='flex-1 rounded-lg bg-muted p-4'>
                <div className='flex items-center gap-2'>
                  <LoadingDots />
                  <span className='text-sm text-muted-foreground'>
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className='border-t bg-background px-6 py-4'>
        <div className='mx-auto max-w-3xl'>
          <form onSubmit={handleSubmit} className='space-y-3'>
            <div className='flex gap-2'>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Type your message... (Enter to send, Shift+Enter for new line)'
                className='min-h-[80px] resize-none'
                disabled={isLoading}
                aria-label='Message input'
              />
              <Button
                type='submit'
                size='icon'
                className='h-[80px] w-[80px] shrink-0'
                disabled={!input.trim() || isLoading}
              >
                <Send className='h-5 w-5' />
                <span className='sr-only'>Send message</span>
              </Button>
            </div>

            <div className='flex items-center justify-between'>
              <Button
                type='button'
                variant='outline'
                onClick={handleSwitchToReview}
                disabled={isLoading}
              >
                Switch to Review
                <ArrowRight className='ml-2 h-4 w-4' />
              </Button>

              {generatedSpec && generatedSpec.trigger && (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <GitBranch className='h-4 w-4' />
                  <span>
                    Workflow spec ready: {generatedSpec.actions.length} action
                    {generatedSpec.actions.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * ChatMessage Component
 */
interface ChatMessageProps {
  message: Message;
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
        }`}
      >
        {isUser ? (
          <UserIcon className='h-4 w-4' />
        ) : (
          <Zap className='h-4 w-4 text-primary' />
        )}
      </div>
      <div
        className={`flex-1 rounded-lg p-4 ${
          isUser ? 'bg-primary/10 text-right' : 'bg-muted'
        }`}
      >
        <p className='whitespace-pre-wrap text-sm leading-relaxed'>
          {message.content}
        </p>
        <p className='mt-2 text-xs text-muted-foreground'>
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

/**
 * Loading Dots Animation
 */
function LoadingDots() {
  return (
    <div className='flex gap-1'>
      <div className='h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]' />
      <div className='h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]' />
      <div className='h-2 w-2 animate-bounce rounded-full bg-primary' />
    </div>
  );
}

/**
 * User Icon
 */
function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  );
}
