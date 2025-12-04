'use client';

import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Actions } from '@/components/ai/actions';
import { Conversation } from '@/components/ai/conversation';
import { Loader, TypingIndicator } from '@/components/ai/loader';
import { Message, MessageContent } from '@/components/ai/message';
import {
  PromptInput,
  PromptInputForm,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai/prompt-input';
import { Response } from '@/components/ai/response';
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
import {
  Suggestions,
  SESSION_MANAGER_SUGGESTIONS,
} from '@/components/ai/suggestion';
import { Tool } from '@/components/ai/tool';
import { SessionManagerReviewForm } from '@/components/wizard/session-manager-review-form';
import {
  useAIWizardChat,
  getMessageContent,
  getToolInvocations,
} from '@/hooks/use-ai-wizard-chat';

interface ExtractedSessionManagerData {
  name?: string;
  responsibilities?: string;
  parentOrchestrator?: string;
  context?: string;
  escalationCriteria?: string[];
  channels?: string[];
}

type WizardPhase = 'conversation' | 'review' | 'creating';

export default function NewSessionManagerPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;

  const [phase, setPhase] = React.useState<WizardPhase>('conversation');
  const [isCreating, setIsCreating] = React.useState(false);

  const initialGreeting = `Hi! Let's create a new Session Manager for your workspace.

Session Managers handle specific contexts or channels, monitoring conversations and coordinating responses. They typically:
- **Monitor** specific channels (Slack, email, support tickets)
- **Handle** conversations within their domain
- **Escalate** complex issues to Orchestrators

What kind of conversations or context should this Session Manager handle?`;

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    extractedData,
    calculateCompletion,
    isComplete,
  } = useAIWizardChat({
    entityType: 'session-manager',
    workspaceSlug,
    initialGreeting,
  });

  const handleSuggestionSelect = (suggestion: string) => {
    setInput(suggestion);
    // Auto-submit after a short delay
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  const handleProceedToReview = () => {
    if (isComplete(['name', 'responsibilities'])) {
      setPhase('review');
    } else {
      toast.error('Please provide at least a name and responsibilities');
    }
  };

  const handleCreateSessionManager = async (
    data: ExtractedSessionManagerData
  ) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/wizard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'session-manager',
          data: { ...data, workspaceSlug },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || 'Failed to create session manager'
        );
      }

      const result = await response.json();
      toast.success('Session Manager created successfully!');
      router.push(`/${workspaceSlug}/session-managers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Creation failed');
      setIsCreating(false);
    }
  };

  const completionPercentage = calculateCompletion(
    ['name', 'responsibilities'],
    ['context', 'parentOrchestrator', 'escalationCriteria']
  );

  const isDataComplete = isComplete(['name', 'responsibilities']);

  return (
    <div className='container max-w-4xl py-8 space-y-6'>
      {/* Header */}
      <div className='space-y-2'>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>{workspaceSlug}</Badge>
        </div>
        <h1 className='text-3xl font-bold'>Create Session Manager</h1>
        <p className='text-muted-foreground'>
          Design an agent to handle specific contexts and conversations
        </p>
      </div>

      {/* Progress */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between text-sm'>
          <span className='font-medium'>
            {phase === 'conversation' && 'Defining Manager'}
            {phase === 'review' && 'Review Configuration'}
            {phase === 'creating' && 'Creating Manager'}
          </span>
          <Badge variant='outline'>{completionPercentage}% Complete</Badge>
        </div>
        <Progress value={completionPercentage} className='h-2' />
      </div>

      {/* Conversation Phase */}
      {phase === 'conversation' && (
        <Card className='h-[600px] flex flex-col'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Session Manager Design</CardTitle>
            <CardDescription>
              Describe what this session manager should handle
            </CardDescription>
          </CardHeader>

          <CardContent className='flex-1 flex flex-col overflow-hidden p-0'>
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
                        <Response isStreaming={false}>{content}</Response>
                      </MessageContent>

                      {/* Render tool invocations if any */}
                      {toolInvocations.length > 0 && (
                        <div className='mt-2 space-y-2'>
                          {toolInvocations.map(tool => (
                            <Tool
                              key={tool.toolCallId}
                              name={tool.toolName}
                              input={tool.input as Record<string, unknown>}
                              output={tool.output}
                              status={
                                tool.state === 'result'
                                  ? 'completed'
                                  : 'running'
                              }
                            />
                          ))}
                        </div>
                      )}
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
            {!isLoading && messages.length === 1 && (
              <div className='px-6 pb-2'>
                <Suggestions
                  suggestions={SESSION_MANAGER_SUGGESTIONS}
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
                    placeholder='Describe the session manager...'
                    disabled={isLoading}
                  />
                  <PromptInputToolbar>
                    <PromptInputTools>
                      {isDataComplete && (
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
            <CardTitle className='text-lg'>Manager Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              {extractedData.name != null && (
                <div>
                  <span className='font-medium'>Name:</span>{' '}
                  <span className='text-muted-foreground'>
                    {String(extractedData.name)}
                  </span>
                </div>
              )}
              {extractedData.responsibilities != null && (
                <div className='col-span-2'>
                  <span className='font-medium'>Responsibilities:</span>{' '}
                  <span className='text-muted-foreground'>
                    {String(extractedData.responsibilities)}
                  </span>
                </div>
              )}
              {extractedData.context != null && (
                <div>
                  <span className='font-medium'>Context:</span>{' '}
                  <span className='text-muted-foreground'>
                    {String(extractedData.context)}
                  </span>
                </div>
              )}
              {extractedData.parentOrchestrator != null && (
                <div>
                  <span className='font-medium'>Parent:</span>{' '}
                  <span className='text-muted-foreground'>
                    {String(extractedData.parentOrchestrator)}
                  </span>
                </div>
              )}
              {Array.isArray(extractedData.escalationCriteria) &&
                (extractedData.escalationCriteria as string[]).length > 0 && (
                  <div className='col-span-2'>
                    <span className='font-medium'>Escalation Criteria:</span>
                    <ul className='list-disc list-inside text-muted-foreground mt-1'>
                      {(extractedData.escalationCriteria as string[]).map(
                        (criteria: string, i: number) => (
                          <li key={i}>{criteria}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Phase */}
      {phase === 'review' && (
        <SessionManagerReviewForm
          initialData={extractedData}
          onSubmit={handleCreateSessionManager}
          onBack={() => setPhase('conversation')}
          isSubmitting={isCreating}
          workspaceSlug={workspaceSlug}
        />
      )}
    </div>
  );
}
