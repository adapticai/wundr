/**
 * Workflow AI Assistant Component
 *
 * AI-powered assistant for workflow creation and management:
 * - Natural language workflow creation
 * - Workflow optimization suggestions
 * - Error diagnosis and recommendations
 * - Step suggestions based on context
 *
 * @module components/workflow/workflow-ai-assistant
 */
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  Bot,
  Sparkles,
  Lightbulb,
  AlertCircle,
  X,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Wand2,
  Plus,
  ListChecks,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type {
  Workflow,
  ActionConfig,
  TriggerConfig,
  WorkflowExecution,
} from '@/types/workflow';
import type { UIMessage } from '@ai-sdk/react';

export interface WorkflowAIAssistantProps {
  workspaceSlug: string;
  workflow?: Workflow;
  execution?: WorkflowExecution;
  isOpen: boolean;
  onClose: () => void;
  onWorkflowCreate?: (workflow: Partial<Workflow>) => void;
  onWorkflowUpdate?: (updates: Partial<Workflow>) => void;
  className?: string;
}

/**
 * Extract text content from UIMessage
 */
function getMessageContent(message: UIMessage): string {
  if (!message.parts) {
    return '';
  }
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map(part => part.text)
    .join('');
}

/**
 * Parse tool call results for workflow data
 */
interface WorkflowData {
  name: string;
  description: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
}

function parseWorkflowFromToolCall(toolCall: any): WorkflowData | null {
  if (toolCall?.toolName === 'create_workflow' && toolCall?.args) {
    return toolCall.args as WorkflowData;
  }
  return null;
}

interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'best-practice';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

function parseOptimizationsFromToolCall(toolCall: any): OptimizationSuggestion[] {
  if (toolCall?.toolName === 'suggest_optimizations' && toolCall?.args?.suggestions) {
    return toolCall.args.suggestions as OptimizationSuggestion[];
  }
  return [];
}

interface ErrorDiagnosis {
  cause: string;
  solution: string;
  preventionTips: string[];
}

function parseErrorDiagnosisFromToolCall(toolCall: any): ErrorDiagnosis | null {
  if (toolCall?.toolName === 'diagnose_error' && toolCall?.args) {
    return toolCall.args as ErrorDiagnosis;
  }
  return null;
}

interface StepRecommendation {
  stepType: string;
  reason: string;
  configuration?: Record<string, unknown>;
}

function parseStepRecommendationsFromToolCall(toolCall: any): StepRecommendation[] {
  if (toolCall?.toolName === 'recommend_steps' && toolCall?.args?.recommendations) {
    return toolCall.args.recommendations as StepRecommendation[];
  }
  return [];
}

/**
 * WorkflowAIAssistant - AI-powered assistant panel for workflows
 *
 * Features:
 * - Natural language workflow creation
 * - Optimization suggestions
 * - Error diagnosis
 * - Step recommendations
 */
export function WorkflowAIAssistant({
  workspaceSlug,
  workflow,
  execution,
  isOpen,
  onClose,
  onWorkflowCreate,
  onWorkflowUpdate,
  className,
}: WorkflowAIAssistantProps) {
  const [input, setInput] = React.useState('');
  const [activeSection, setActiveSection] = React.useState<
    'chat' | 'suggestions' | 'errors' | 'steps' | null
  >('chat');
  const [optimizations, setOptimizations] = React.useState<OptimizationSuggestion[]>([]);
  const [errorDiagnosis, setErrorDiagnosis] = React.useState<ErrorDiagnosis | null>(null);
  const [stepRecommendations, setStepRecommendations] = React.useState<StepRecommendation[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Main chat interface
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: `/api/workspaces/${workspaceSlug}/workflows/ai`,
      body: {
        action: 'chat',
        workflowId: workflow?.id,
        executionId: execution?.id,
      },
    }),
    onToolCall: ({ toolCall }) => {
      // Handle workflow creation
      const workflowData = parseWorkflowFromToolCall(toolCall);
      if (workflowData && onWorkflowCreate) {
        onWorkflowCreate(workflowData);
      }

      // Handle optimization suggestions
      const optimizationSuggestions = parseOptimizationsFromToolCall(toolCall);
      if (optimizationSuggestions.length > 0) {
        setOptimizations(optimizationSuggestions);
        setActiveSection('suggestions');
      }

      // Handle error diagnosis
      const diagnosis = parseErrorDiagnosisFromToolCall(toolCall);
      if (diagnosis) {
        setErrorDiagnosis(diagnosis);
        setActiveSection('errors');
      }

      // Handle step recommendations
      const recommendations = parseStepRecommendationsFromToolCall(toolCall);
      if (recommendations.length > 0) {
        setStepRecommendations(recommendations);
        setActiveSection('steps');
      }
    },
  });

  // Auto-scroll to bottom of chat
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages]);

  // Handle quick action: Create workflow from description
  const handleQuickCreate = React.useCallback(async () => {
    setActiveSection('chat');
    const message = "I'll help you create a workflow. What would you like it to do?";
    await chat.sendMessage({ text: message });
  }, [chat]);

  // Handle quick action: Optimize workflow
  const handleOptimize = React.useCallback(async () => {
    if (!workflow) {
      return;
    }
    setActiveSection('suggestions');
    await chat.sendMessage({
      text: 'Please analyze this workflow and suggest optimizations.',
    });
  }, [workflow, chat]);

  // Handle quick action: Diagnose errors
  const handleDiagnoseErrors = React.useCallback(async () => {
    if (!execution) {
      return;
    }
    setActiveSection('errors');
    await chat.sendMessage({
      text: 'Please diagnose the errors in the latest execution.',
    });
  }, [execution, chat]);

  // Handle quick action: Recommend next steps
  const handleRecommendSteps = React.useCallback(async () => {
    if (!workflow) {
      return;
    }
    setActiveSection('steps');
    await chat.sendMessage({
      text: 'What steps would you recommend adding to this workflow?',
    });
  }, [workflow, chat]);

  // Handle chat submit
  const handleChatSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) {
        return;
      }

      setActiveSection('chat');
      const message = input;
      setInput('');
      await chat.sendMessage({ text: message });
    },
    [input, chat],
  );

  // Handle section toggle
  const toggleSection = (section: typeof activeSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  // Apply optimization suggestion
  const handleApplyOptimization = (suggestion: OptimizationSuggestion) => {
    // Send message to apply optimization
    chat.sendMessage({
      text: `Please apply this optimization: ${suggestion.title}`,
    });
  };

  if (!isOpen) {
    return null;
  }

  const isChatLoading = chat.status === 'streaming' || chat.status === 'submitted';
  const hasError = execution?.status === 'failed';

  return (
    <Card
      className={cn(
        'flex h-full w-[400px] flex-col border-l shadow-lg',
        className,
      )}
    >
      {/* Header */}
      <CardHeader className='flex-shrink-0 border-b'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='rounded-full bg-primary/10 p-2'>
              <Bot className='h-5 w-5 text-primary' />
            </div>
            <CardTitle className='text-lg'>Workflow AI</CardTitle>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
            <span className='sr-only'>Close Workflow AI</span>
          </Button>
        </div>
        <p className='text-sm text-muted-foreground'>
          Create, optimize, and troubleshoot workflows with AI
        </p>
      </CardHeader>

      {/* Content */}
      <CardContent className='flex flex-1 flex-col gap-4 overflow-hidden p-4'>
        {/* Quick Actions */}
        <div className='grid grid-cols-2 gap-2 flex-shrink-0'>
          {!workflow && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleQuickCreate}
              disabled={isChatLoading}
              className='flex items-center gap-2'
            >
              <Plus className='h-4 w-4' />
              <span>Create</span>
            </Button>
          )}
          {workflow && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleOptimize}
              disabled={isChatLoading}
              className='flex items-center gap-2'
            >
              <Sparkles className='h-4 w-4' />
              <span>Optimize</span>
            </Button>
          )}
          {hasError && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleDiagnoseErrors}
              disabled={isChatLoading}
              className='flex items-center gap-2'
            >
              <AlertCircle className='h-4 w-4' />
              <span>Diagnose</span>
            </Button>
          )}
          {workflow && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleRecommendSteps}
              disabled={isChatLoading}
              className='flex items-center gap-2'
            >
              <ListChecks className='h-4 w-4' />
              <span>Suggest Steps</span>
            </Button>
          )}
        </div>

        {/* Optimization Suggestions Section */}
        {optimizations.length > 0 && (
          <div className='flex-shrink-0'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => toggleSection('suggestions')}
              className='w-full justify-between'
            >
              <span className='font-semibold flex items-center gap-2'>
                <Lightbulb className='h-4 w-4' />
                Optimization Suggestions
                <Badge variant='secondary'>{optimizations.length}</Badge>
              </span>
              {activeSection === 'suggestions' ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </Button>
            {activeSection === 'suggestions' && (
              <div className='mt-2 space-y-2 max-h-[300px] overflow-y-auto'>
                {optimizations.map((suggestion, index) => (
                  <div
                    key={index}
                    className='rounded-lg border bg-card p-3 space-y-2'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <h4 className='font-medium text-sm'>{suggestion.title}</h4>
                          <Badge
                            variant={
                              suggestion.impact === 'high'
                                ? 'destructive'
                                : suggestion.impact === 'medium'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {suggestion.impact}
                          </Badge>
                        </div>
                        <p className='text-sm text-muted-foreground mt-1'>
                          {suggestion.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      size='sm'
                      variant='secondary'
                      onClick={() => handleApplyOptimization(suggestion)}
                      className='w-full'
                    >
                      <Wand2 className='h-3 w-3 mr-1' />
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Diagnosis Section */}
        {errorDiagnosis && (
          <div className='flex-shrink-0'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => toggleSection('errors')}
              className='w-full justify-between'
            >
              <span className='font-semibold flex items-center gap-2'>
                <AlertCircle className='h-4 w-4' />
                Error Diagnosis
              </span>
              {activeSection === 'errors' ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </Button>
            {activeSection === 'errors' && (
              <div className='mt-2 rounded-lg border bg-card p-3 space-y-3'>
                <div>
                  <h4 className='font-medium text-sm mb-1'>Cause</h4>
                  <p className='text-sm text-muted-foreground'>
                    {errorDiagnosis.cause}
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-1'>Solution</h4>
                  <p className='text-sm text-muted-foreground'>
                    {errorDiagnosis.solution}
                  </p>
                </div>
                {errorDiagnosis.preventionTips.length > 0 && (
                  <div>
                    <h4 className='font-medium text-sm mb-1'>Prevention Tips</h4>
                    <ul className='space-y-1'>
                      {errorDiagnosis.preventionTips.map((tip, index) => (
                        <li key={index} className='text-sm text-muted-foreground'>
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step Recommendations Section */}
        {stepRecommendations.length > 0 && (
          <div className='flex-shrink-0'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => toggleSection('steps')}
              className='w-full justify-between'
            >
              <span className='font-semibold flex items-center gap-2'>
                <ListChecks className='h-4 w-4' />
                Recommended Steps
                <Badge variant='secondary'>{stepRecommendations.length}</Badge>
              </span>
              {activeSection === 'steps' ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </Button>
            {activeSection === 'steps' && (
              <div className='mt-2 space-y-2 max-h-[300px] overflow-y-auto'>
                {stepRecommendations.map((recommendation, index) => (
                  <div
                    key={index}
                    className='rounded-lg border bg-card p-3 space-y-2'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex-1'>
                        <h4 className='font-medium text-sm'>{recommendation.stepType}</h4>
                        <p className='text-sm text-muted-foreground mt-1'>
                          {recommendation.reason}
                        </p>
                      </div>
                    </div>
                    <Button
                      size='sm'
                      variant='secondary'
                      onClick={() => chat.sendMessage({
                        text: `Add a ${recommendation.stepType} step to the workflow`,
                      })}
                      className='w-full'
                    >
                      <Plus className='h-3 w-3 mr-1' />
                      Add Step
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Section */}
        <div className='flex flex-1 flex-col overflow-hidden'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => toggleSection('chat')}
            className='w-full justify-between flex-shrink-0'
          >
            <span className='font-semibold'>Ask AI Assistant</span>
            {activeSection === 'chat' ? (
              <ChevronUp className='h-4 w-4' />
            ) : (
              <ChevronDown className='h-4 w-4' />
            )}
          </Button>

          {activeSection === 'chat' && (
            <div className='flex flex-1 flex-col overflow-hidden mt-2'>
              {/* Chat Messages */}
              <div ref={scrollRef} className='flex-1 overflow-y-auto pr-4'>
                <div className='space-y-4'>
                  {chat.messages.length === 0 ? (
                    <div className='flex flex-col items-center justify-center py-8 text-center'>
                      <Bot className='h-12 w-12 text-muted-foreground mb-2' />
                      <p className='text-sm text-muted-foreground max-w-[250px]'>
                        Describe what you want your workflow to do in natural language
                      </p>
                    </div>
                  ) : (
                    chat.messages.map(message => {
                      const content = getMessageContent(message);
                      const isUser = message.role === 'user';

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            'flex gap-2',
                            isUser ? 'flex-row-reverse' : 'flex-row',
                          )}
                        >
                          <div
                            className={cn(
                              'rounded-lg px-3 py-2 max-w-[85%]',
                              isUser
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted',
                            )}
                          >
                            <p className='text-sm whitespace-pre-wrap break-words'>
                              {content}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isChatLoading && (
                    <div className='flex gap-2'>
                      <div className='rounded-lg bg-muted px-3 py-2'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className='flex gap-2 mt-4 flex-shrink-0'>
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder='E.g., "When a message is received in #support, assign to on-call engineer"'
                  className='min-h-[60px] resize-none'
                  disabled={isChatLoading}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e);
                    }
                  }}
                />
                <Button
                  type='submit'
                  size='icon'
                  className='h-[60px] w-[60px] flex-shrink-0'
                  disabled={!input.trim() || isChatLoading}
                >
                  <Send className='h-4 w-4' />
                  <span className='sr-only'>Send message</span>
                </Button>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
