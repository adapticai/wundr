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

import {
  Bot,
  Sparkles,
  Lightbulb,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Wand2,
  Plus,
  ListChecks,
} from 'lucide-react';
import * as React from 'react';

import { UnifiedChat } from '@/components/ai/unified-chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type {
  Workflow,
  ActionConfig,
  TriggerConfig,
  WorkflowExecution,
} from '@/types/workflow';

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
 * Parse tool call results for workflow data
 */
interface WorkflowData {
  name: string;
  description: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
}

function parseWorkflowFromToolCall(toolCall: unknown): WorkflowData | null {
  if (
    toolCall &&
    typeof toolCall === 'object' &&
    'toolName' in toolCall &&
    (toolCall as { toolName: string }).toolName === 'create_workflow' &&
    'args' in toolCall
  ) {
    return (toolCall as { args: WorkflowData }).args;
  }
  return null;
}

interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'best-practice';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

function parseOptimizationsFromToolCall(
  toolCall: unknown
): OptimizationSuggestion[] {
  if (
    toolCall &&
    typeof toolCall === 'object' &&
    'toolName' in toolCall &&
    (toolCall as { toolName: string }).toolName === 'suggest_optimizations' &&
    'args' in toolCall &&
    (toolCall as { args?: { suggestions?: unknown } }).args?.suggestions
  ) {
    return (toolCall as { args: { suggestions: OptimizationSuggestion[] } })
      .args.suggestions;
  }
  return [];
}

interface ErrorDiagnosis {
  cause: string;
  solution: string;
  preventionTips: string[];
}

function parseErrorDiagnosisFromToolCall(
  toolCall: unknown
): ErrorDiagnosis | null {
  if (
    toolCall &&
    typeof toolCall === 'object' &&
    'toolName' in toolCall &&
    (toolCall as { toolName: string }).toolName === 'diagnose_error' &&
    'args' in toolCall
  ) {
    return (toolCall as { args: ErrorDiagnosis }).args;
  }
  return null;
}

interface StepRecommendation {
  stepType: string;
  reason: string;
  configuration?: Record<string, unknown>;
}

function parseStepRecommendationsFromToolCall(
  toolCall: unknown
): StepRecommendation[] {
  if (
    toolCall &&
    typeof toolCall === 'object' &&
    'toolName' in toolCall &&
    (toolCall as { toolName: string }).toolName === 'recommend_steps' &&
    'args' in toolCall &&
    (toolCall as { args?: { recommendations?: unknown } }).args?.recommendations
  ) {
    return (toolCall as { args: { recommendations: StepRecommendation[] } })
      .args.recommendations;
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
  onWorkflowUpdate: _onWorkflowUpdate,
  className,
}: WorkflowAIAssistantProps) {
  const [activeSection, setActiveSection] = React.useState<
    'suggestions' | 'errors' | 'steps' | null
  >(null);
  const [optimizations, setOptimizations] = React.useState<
    OptimizationSuggestion[]
  >([]);
  const [errorDiagnosis, setErrorDiagnosis] =
    React.useState<ErrorDiagnosis | null>(null);
  const [stepRecommendations, setStepRecommendations] = React.useState<
    StepRecommendation[]
  >([]);

  // Handle tool call results surfaced by UnifiedChat via onDataExtracted
  // UnifiedChat fires onDataExtracted for extract_* tool calls; for workflow-specific
  // tool calls we intercept them here through the API response handling.
  const handleDataExtracted = React.useCallback(
    (data: Record<string, unknown>) => {
      // Workflow creation
      const workflowData = parseWorkflowFromToolCall(data['toolCall']);
      if (workflowData && onWorkflowCreate) {
        onWorkflowCreate(workflowData);
      }

      // Optimization suggestions
      const optimizationSuggestions = parseOptimizationsFromToolCall(
        data['toolCall']
      );
      if (optimizationSuggestions.length > 0) {
        setOptimizations(optimizationSuggestions);
        setActiveSection('suggestions');
      }

      // Error diagnosis
      const diagnosis = parseErrorDiagnosisFromToolCall(data['toolCall']);
      if (diagnosis) {
        setErrorDiagnosis(diagnosis);
        setActiveSection('errors');
      }

      // Step recommendations
      const recommendations = parseStepRecommendationsFromToolCall(
        data['toolCall']
      );
      if (recommendations.length > 0) {
        setStepRecommendations(recommendations);
        setActiveSection('steps');
      }
    },
    [onWorkflowCreate]
  );

  // Handle section toggle
  const toggleSection = (section: typeof activeSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const hasError = execution?.status === 'failed';

  const requestBody: Record<string, unknown> = {
    workflowId: workflow?.id,
    executionId: execution?.id,
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Card
      className={cn(
        'flex h-full w-[400px] flex-col border-l shadow-lg',
        className
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
                          <h4 className='font-medium text-sm'>
                            {suggestion.title}
                          </h4>
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
                    <Button size='sm' variant='secondary' className='w-full'>
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
                    <h4 className='font-medium text-sm mb-1'>
                      Prevention Tips
                    </h4>
                    <ul className='space-y-1'>
                      {errorDiagnosis.preventionTips.map((tip, index) => (
                        <li
                          key={index}
                          className='text-sm text-muted-foreground'
                        >
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
                        <h4 className='font-medium text-sm'>
                          {recommendation.stepType}
                        </h4>
                        <p className='text-sm text-muted-foreground mt-1'>
                          {recommendation.reason}
                        </p>
                      </div>
                    </div>
                    <Button size='sm' variant='secondary' className='w-full'>
                      <Plus className='h-3 w-3 mr-1' />
                      Add Step
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Section — powered by UnifiedChat */}
        <div className='flex flex-1 flex-col overflow-hidden min-h-0'>
          <UnifiedChat
            apiEndpoint={`/api/workspaces/${workspaceSlug}/workflows/ai`}
            variant='panel'
            persona={{
              name: 'Workflow Assistant',
              greeting:
                'I can help create, optimize, and debug workflows. What would you like to do?',
              suggestions: [
                'Create a new workflow',
                'Optimize current workflow',
                'Diagnose an error',
              ],
            }}
            showToolCalls
            requestBody={requestBody}
            onDataExtracted={handleDataExtracted}
            onClose={onClose}
            maxHeight='calc(100vh - 8rem)'
          />
        </div>
      </CardContent>
    </Card>
  );
}
