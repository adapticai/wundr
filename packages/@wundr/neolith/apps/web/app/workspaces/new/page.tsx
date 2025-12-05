'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Actions } from '@/components/ai/actions';
import { Conversation } from '@/components/ai/conversation';
import { Loader, TypingIndicator } from '@/components/ai/loader';
import { Message, MessageContent } from '@/components/ai/message';
import {
  PromptInputForm,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai/prompt-input';
import { Response } from '@/components/ai/response';
import { Suggestions, getEntitySuggestions } from '@/components/ai/suggestion';
import { Tool } from '@/components/ai/tool';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { WorkspaceReviewForm } from '@/components/wizard/workspace-review-form';
import {
  useAIWizardChat,
  getMessageContent,
  getToolInvocations,
  type ToolInvocation,
} from '@/hooks/use-ai-wizard-chat';

import type { WorkspaceReviewData } from '@/components/wizard/workspace-review-form';

type WizardPhase = 'conversation' | 'review' | 'creating';

const INITIAL_GREETING = `Hi! I'm here to help you create a new workspace. Let's start with the basics.

What would you like to name your workspace? And can you tell me a bit about what it's for?`;

export default function NewWorkspacePage() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<WizardPhase>('conversation');
  const [isCreating, setIsCreating] = React.useState(false);
  const [organizationId, setOrganizationId] = React.useState<string>('');

  // Fetch user's organization on mount
  React.useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            setOrganizationId(data.data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      }
    }
    fetchOrganization();
  }, []);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    append,
    extractedData,
  } = useAIWizardChat({
    entityType: 'workspace',
    initialGreeting: INITIAL_GREETING,
  });

  const handleSuggestionSelect = (suggestion: string) => {
    append({ role: 'user', content: suggestion });
  };

  const handleProceedToReview = () => {
    const data = extractedData as Partial<WorkspaceReviewData>;
    if (data.name && data.description) {
      setPhase('review');
    } else {
      toast.error('Please provide at least a name and description first');
    }
  };

  const handleCreateWorkspace = async (data: WorkspaceReviewData) => {
    if (!organizationId) {
      toast.error(
        'No organization found. Please create an organization first.'
      );
      return;
    }

    setIsCreating(true);
    setPhase('creating');

    try {
      // Generate slug from name
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Create workspace via API
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug,
          description: data.description,
          organizationId,
          settings: {
            teamSize: data.teamSize,
            organizationType: data.organizationType,
            purpose: data.purpose,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create workspace');
      }

      const result = await response.json();
      toast.success('Workspace created successfully!');

      // Navigate to the new workspace
      if (result.data?.slug) {
        router.push(`/${result.data.slug}/dashboard`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Creation failed');
      setPhase('review');
      setIsCreating(false);
    }
  };

  const completionPercentage = React.useMemo(() => {
    const data = extractedData as Partial<WorkspaceReviewData>;
    const fields = [
      'name',
      'description',
      'organizationType',
      'teamSize',
      'purpose',
    ];
    const filled = fields.filter(f => data[f as keyof WorkspaceReviewData]);
    return Math.round((filled.length / fields.length) * 100);
  }, [extractedData]);

  return (
    <div className='container max-w-4xl py-8 space-y-6'>
      {/* Header */}
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>Create New Workspace</h1>
        <p className='text-muted-foreground'>
          Let's have a conversation about your workspace and I'll help you set
          it up
        </p>
      </div>

      {/* Progress */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between text-sm'>
          <span className='font-medium'>
            {phase === 'conversation' && 'Gathering Information'}
            {phase === 'review' && 'Review Details'}
            {phase === 'creating' && 'Creating Workspace'}
          </span>
          <Badge variant='outline'>{completionPercentage}% Complete</Badge>
        </div>
        <Progress value={completionPercentage} className='h-2' />
      </div>

      {/* Main Content */}
      {phase === 'conversation' && (
        <Card className='h-[600px] flex flex-col'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Conversation</CardTitle>
            <CardDescription>
              Tell me about your workspace in natural language
            </CardDescription>
          </CardHeader>

          <CardContent className='flex-1 flex flex-col overflow-hidden p-0'>
            {/* Messages Area */}
            <Conversation className='flex-1 px-6'>
              {messages.map(message => {
                const content = getMessageContent(message);
                const toolInvocations = getToolInvocations(message);

                return (
                  <div key={message.id} className='group'>
                    <Message
                      from={message.role as 'user' | 'assistant'}
                      avatar={
                        message.role === 'assistant'
                          ? { name: 'AI', fallback: 'AI' }
                          : undefined
                      }
                    >
                      <MessageContent>
                        {message.role === 'assistant' ? (
                          <Response
                            isStreaming={
                              isLoading &&
                              message.id === messages[messages.length - 1]?.id
                            }
                          >
                            {content}
                          </Response>
                        ) : (
                          content
                        )}
                      </MessageContent>

                      {/* Tool calls */}
                      {toolInvocations.map(tool => (
                        <Tool
                          key={tool.toolCallId}
                          name={tool.toolName}
                          status={
                            tool.state === 'result' ? 'completed' : 'running'
                          }
                          input={
                            tool.input as Record<string, unknown> | undefined
                          }
                          output={tool.output}
                        />
                      ))}
                    </Message>

                    {message.role === 'assistant' && !isLoading && (
                      <Actions content={content} className='ml-12 mt-1' />
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <Message
                  from='assistant'
                  avatar={{ name: 'AI', fallback: 'AI' }}
                >
                  <TypingIndicator />
                </Message>
              )}
            </Conversation>

            {/* Suggestions */}
            {!isLoading && messages.length > 0 && (
              <div className='px-6 pb-2'>
                <Suggestions
                  suggestions={getEntitySuggestions(
                    'workspace',
                    messages.filter(m => m.role === 'user').length
                  )}
                  onSelect={handleSuggestionSelect}
                />
              </div>
            )}

            {/* Input Area */}
            <div className='border-t p-4'>
              <form onSubmit={handleSubmit}>
                <PromptInputForm>
                  <PromptInputTextarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder='Type your message... (Enter to send)'
                    disabled={isLoading}
                  />
                  <PromptInputToolbar>
                    <PromptInputTools>
                      {(extractedData as Partial<WorkspaceReviewData>).name && (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={handleProceedToReview}
                        >
                          Review & Create
                        </Button>
                      )}
                    </PromptInputTools>
                    <PromptInputSubmit disabled={!input.trim() || isLoading}>
                      {isLoading ? <Loader size={16} /> : 'Send'}
                    </PromptInputSubmit>
                  </PromptInputToolbar>
                </PromptInputForm>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data Preview */}
      {phase === 'conversation' && Object.keys(extractedData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Information Gathered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              {(() => {
                const data = extractedData as Partial<WorkspaceReviewData>;
                return (
                  <>
                    {data.name && (
                      <div>
                        <span className='font-medium'>Name:</span>{' '}
                        <span className='text-muted-foreground'>
                          {String(data.name)}
                        </span>
                      </div>
                    )}
                    {data.description && (
                      <div className='col-span-2'>
                        <span className='font-medium'>Description:</span>{' '}
                        <span className='text-muted-foreground'>
                          {String(data.description)}
                        </span>
                      </div>
                    )}
                    {data.organizationType && (
                      <div>
                        <span className='font-medium'>Type:</span>{' '}
                        <span className='text-muted-foreground'>
                          {String(data.organizationType)}
                        </span>
                      </div>
                    )}
                    {data.teamSize && (
                      <div>
                        <span className='font-medium'>Team Size:</span>{' '}
                        <span className='text-muted-foreground capitalize'>
                          {String(data.teamSize)}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Phase */}
      {phase === 'review' && (
        <WorkspaceReviewForm
          initialData={extractedData as Partial<WorkspaceReviewData>}
          onSubmit={handleCreateWorkspace}
          onBack={() => setPhase('conversation')}
          isSubmitting={isCreating}
        />
      )}

      {/* Creating Phase */}
      {phase === 'creating' && (
        <Card>
          <CardContent className='py-12'>
            <div className='flex flex-col items-center justify-center gap-4'>
              <Loader size={48} />
              <div className='text-center'>
                <p className='text-lg font-medium'>
                  Creating your workspace...
                </p>
                <p className='text-sm text-muted-foreground mt-1'>
                  This will only take a moment
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
