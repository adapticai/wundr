/**
 * Orchestrator Creation Wizard Page
 *
 * AI-powered conversational interface for creating new orchestrators in a workspace.
 * Uses the wizard chat API to guide users through defining agent capabilities.
 *
 * @module app/[workspaceSlug]/orchestrators/new/page
 */
'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { use } from 'react';
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
import {
  Suggestions,
  ORCHESTRATOR_SUGGESTIONS,
} from '@/components/ai/suggestion';
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
import {
  OrchestratorReviewForm,
  type OrchestratorFormData,
} from '@/components/wizard/orchestrator-review-form';
import {
  useAIWizardChat,
  getMessageContent,
  getToolInvocations,
} from '@/hooks/use-ai-wizard-chat';

type WizardPhase = 'conversation' | 'review' | 'creating';

interface PageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default function NewOrchestratorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const workspaceSlug = resolvedParams.workspaceSlug;

  const [phase, setPhase] = React.useState<WizardPhase>('conversation');
  const [isCreating, setIsCreating] = React.useState(false);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    append,
    extractedData: rawExtractedData,
  } = useAIWizardChat({
    entityType: 'orchestrator',
    workspaceSlug,
    initialGreeting: `Hi! Let's create a new Orchestrator (AI agent) for your workspace.

Orchestrators are autonomous agents that handle specific roles. For example:
- **Customer Support Lead** - Handles inquiries and manages support tickets
- **Research Analyst** - Gathers and analyzes information
- **Project Manager** - Coordinates tasks and team communication

What kind of agent would you like to create? Tell me about their role and what they should do.`,
  });

  const extractedData = rawExtractedData as Partial<OrchestratorFormData>;

  const handleSuggestionSelect = (suggestion: string) => {
    append({ role: 'user', content: suggestion });
  };

  const handleProceedToReview = () => {
    if (extractedData.name && extractedData.role && extractedData.description) {
      setPhase('review');
    } else {
      toast.error('Please provide name, role, and description first');
    }
  };

  const handleCreateOrchestrator = async (data: OrchestratorFormData) => {
    setIsCreating(true);
    setPhase('creating');

    try {
      // Get workspace ID from slug
      const workspaceResponse = await fetch(`/api/workspaces/${workspaceSlug}`);

      if (!workspaceResponse.ok) {
        throw new Error('Failed to fetch workspace');
      }

      const workspaceData = await workspaceResponse.json();
      const workspaceId = workspaceData.data?.id;

      if (!workspaceId) {
        throw new Error('Workspace not found');
      }

      // Create orchestrator
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/orchestrators`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            role: data.role || 'Agent',
            description: data.description,
            model:
              process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL ||
              'claude-sonnet-4-20250514',
            capabilities: data.capabilities || [],
            goals: data.goals || [],
            channels: data.channels || [],
            communicationStyle: data.communicationStyle || 'professional',
            workspaceId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || 'Failed to create orchestrator'
        );
      }

      const result = await response.json();
      toast.success('Orchestrator created successfully!');
      router.push(`/${workspaceSlug}/orchestrators/${result.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Creation failed');
      setPhase('review');
      setIsCreating(false);
    }
  };

  const completionPercentage = React.useMemo(() => {
    const required = ['name', 'role', 'description'];
    const optional = [
      'capabilities',
      'communicationStyle',
      'goals',
      'channels',
    ];
    const requiredFilled = required.filter(
      f => extractedData[f as keyof OrchestratorFormData]
    );
    const optionalFilled = optional.filter(f => {
      const val = extractedData[f as keyof OrchestratorFormData];
      return val && (Array.isArray(val) ? val.length > 0 : true);
    });
    return Math.round(
      ((requiredFilled.length * 2 + optionalFilled.length) /
        (required.length * 2 + optional.length)) *
        100
    );
  }, [extractedData]);

  const isDataComplete =
    extractedData.name && extractedData.role && extractedData.description;

  return (
    <div className='container max-w-4xl py-8 space-y-6'>
      {/* Header */}
      <div className='space-y-2'>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>{workspaceSlug}</Badge>
        </div>
        <h1 className='text-3xl font-bold'>Create New Orchestrator</h1>
        <p className='text-muted-foreground'>
          Design an AI agent to handle specific tasks in your workspace
        </p>
      </div>

      {/* Progress */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between text-sm'>
          <span className='font-medium'>
            {phase === 'conversation' && 'Defining Agent'}
            {phase === 'review' && 'Review Configuration'}
            {phase === 'creating' && 'Creating Agent'}
          </span>
          <Badge variant='outline'>{completionPercentage}% Complete</Badge>
        </div>
        <Progress value={completionPercentage} className='h-2' />
      </div>

      {/* Main Content */}
      {phase === 'conversation' && (
        <Card className='h-[600px] flex flex-col'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Agent Design</CardTitle>
            <CardDescription>
              Describe the agent you want to create
            </CardDescription>
          </CardHeader>

          <CardContent className='flex-1 flex flex-col overflow-hidden p-0'>
            <Conversation className='flex-1 px-6'>
              {messages.map(message => {
                const messageContent = getMessageContent(message);
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
                            {messageContent}
                          </Response>
                        ) : (
                          messageContent
                        )}
                      </MessageContent>

                      {toolInvocations.map(tool => (
                        <Tool
                          key={tool.toolCallId}
                          name={tool.toolName}
                          status={
                            tool.state === 'result' ? 'completed' : 'running'
                          }
                          input={tool.input as Record<string, unknown>}
                          output={tool.output}
                        />
                      ))}
                    </Message>

                    {message.role === 'assistant' && !isLoading && (
                      <Actions
                        content={messageContent}
                        className='ml-12 mt-1'
                      />
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
                  suggestions={ORCHESTRATOR_SUGGESTIONS}
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
                    placeholder='Describe your agent...'
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
            <CardTitle className='text-lg'>Agent Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              {extractedData.name && (
                <div>
                  <span className='font-medium'>Name:</span>{' '}
                  <span className='text-muted-foreground'>
                    {extractedData.name}
                  </span>
                </div>
              )}
              {extractedData.role && (
                <div>
                  <span className='font-medium'>Role:</span>{' '}
                  <span className='text-muted-foreground'>
                    {extractedData.role}
                  </span>
                </div>
              )}
              {extractedData.description && (
                <div className='col-span-2'>
                  <span className='font-medium'>Description:</span>{' '}
                  <span className='text-muted-foreground'>
                    {extractedData.description}
                  </span>
                </div>
              )}
              {extractedData.capabilities &&
                extractedData.capabilities.length > 0 && (
                  <div className='col-span-2'>
                    <span className='font-medium'>Capabilities:</span>{' '}
                    <div className='flex flex-wrap gap-1 mt-1'>
                      {extractedData.capabilities.map(
                        (cap: string, i: number) => (
                          <Badge key={i} variant='secondary'>
                            {cap}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
              {extractedData.communicationStyle && (
                <div>
                  <span className='font-medium'>Style:</span>{' '}
                  <span className='text-muted-foreground capitalize'>
                    {extractedData.communicationStyle}
                  </span>
                </div>
              )}
              {extractedData.goals && extractedData.goals.length > 0 && (
                <div className='col-span-2'>
                  <span className='font-medium'>Goals:</span>{' '}
                  <div className='flex flex-wrap gap-1 mt-1'>
                    {extractedData.goals.map((goal: string, i: number) => (
                      <Badge key={i} variant='secondary'>
                        {goal}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Phase */}
      {phase === 'review' && (
        <OrchestratorReviewForm
          initialData={extractedData}
          onSubmit={handleCreateOrchestrator}
          onBack={() => setPhase('conversation')}
          isSubmitting={isCreating}
        />
      )}

      {/* Creating Phase */}
      {phase === 'creating' && (
        <Card>
          <CardContent className='py-12 text-center space-y-4'>
            <Loader size={48} className='mx-auto' />
            <div>
              <h3 className='text-lg font-semibold'>
                Creating Orchestrator...
              </h3>
              <p className='text-sm text-muted-foreground'>
                Please wait while we set up your agent
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
