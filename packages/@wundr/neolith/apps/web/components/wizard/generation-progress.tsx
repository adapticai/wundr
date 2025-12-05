/**
 * Generation Progress Component
 *
 * Shows animated progress indicators for workspace generation:
 * - Creating workspace
 * - Creating Orchestrators (VPs)
 * - Creating Workflows
 * - Done
 *
 * @module components/wizard/generation-progress
 */
'use client';

import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import type {
  GenerationState,
  GenerationStep,
} from '@/hooks/use-org-generator';

export interface GenerationProgressProps {
  /** Current generation state */
  state: GenerationState;
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if generation failed */
  error?: string | null;
  /** Warning messages */
  warnings?: string[];
  /** All generation steps */
  steps: GenerationStep[];
  /** Current step information */
  currentStep: GenerationStep;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Callback when user clicks cancel */
  onCancel?: () => void;
  /** Whether retry button should be disabled */
  isRetrying?: boolean;
}

/**
 * GenerationProgress Component
 *
 * Displays a visual progress indicator for workspace generation with:
 * - Animated step indicators
 * - Progress bar
 * - Error display with retry option
 * - Warning messages
 * - Success state
 *
 * @example
 * ```tsx
 * const { currentState, progress, error, warnings, getCurrentStep, getAllSteps, retry } = useOrgGenerator();
 *
 * <GenerationProgress
 *   state={currentState}
 *   progress={progress}
 *   error={error}
 *   warnings={warnings}
 *   steps={getAllSteps()}
 *   currentStep={getCurrentStep()}
 *   onRetry={retry}
 * />
 * ```
 */
export function GenerationProgress({
  state,
  progress,
  error,
  warnings = [],
  steps,
  currentStep,
  onRetry,
  onCancel,
  isRetrying = false,
}: GenerationProgressProps) {
  const isComplete = state === 'complete';
  const hasError = state === 'error' || !!error;
  const isGenerating = !isComplete && !hasError;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          {isGenerating && (
            <>
              <Loader2 className='h-5 w-5 animate-spin text-primary' />
              Generating Organization
            </>
          )}
          {isComplete && (
            <>
              <CheckCircle2 className='h-5 w-5 text-green-600' />
              Generation Complete
            </>
          )}
          {hasError && (
            <>
              <XCircle className='h-5 w-5 text-destructive' />
              Generation Failed
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isGenerating && currentStep.description}
          {isComplete &&
            'Your workspace and organization structure have been created successfully'}
          {hasError &&
            'An error occurred during generation. You can retry or go back to edit.'}
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Progress Bar */}
        {isGenerating && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span className='font-medium'>{currentStep.label}</span>
              <span className='text-muted-foreground'>
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className='h-2' />
          </div>
        )}

        {/* Error Display */}
        {hasError && error && (
          <Alert variant='destructive'>
            <XCircle className='h-4 w-4' />
            <AlertDescription className='ml-2'>
              <p className='font-medium'>Error</p>
              <p className='mt-1 text-sm'>{error}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Warning Display */}
        {warnings.length > 0 && (
          <Alert>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription className='ml-2'>
              <p className='font-medium'>Warnings</p>
              <ul className='mt-2 list-inside list-disc space-y-1 text-sm'>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Step Indicators */}
        <div className='space-y-3'>
          {steps.map((step, index) => {
            const currentIndex = steps.findIndex(
              s => s.state === currentStep.state,
            );
            const isPast = index < currentIndex;
            const isCurrent = step.state === currentStep.state;
            const isCompleteStep = step.state === 'complete' && isComplete;

            return (
              <StepIndicator
                key={step.state}
                label={step.label}
                description={step.description}
                status={
                  hasError && isCurrent
                    ? 'error'
                    : isCompleteStep
                      ? 'complete'
                      : isPast
                        ? 'complete'
                        : isCurrent
                          ? 'current'
                          : 'pending'
                }
                isLast={index === steps.length - 1}
              />
            );
          })}
        </div>

        {/* Success Summary */}
        {isComplete && (
          <div className='rounded-lg border bg-green-50 p-4 dark:bg-green-950/20'>
            <div className='flex items-start gap-3'>
              <CheckCircle2 className='h-5 w-5 text-green-600 dark:text-green-400' />
              <div className='flex-1 space-y-1'>
                <p className='font-medium text-green-900 dark:text-green-100'>
                  Organization Created Successfully
                </p>
                <p className='text-sm text-green-700 dark:text-green-300'>
                  Your workspace has been set up with VPs, disciplines, and
                  channels. You can now start using your organization.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer Actions */}
      {(hasError || onCancel) && (
        <CardFooter className='flex items-center justify-between border-t'>
          {onCancel && (
            <Button variant='ghost' onClick={onCancel} disabled={isRetrying}>
              {hasError ? 'Go Back' : 'Cancel'}
            </Button>
          )}
          {hasError && onRetry && (
            <Button onClick={onRetry} disabled={isRetrying}>
              {isRetrying ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Retrying...
                </>
              ) : (
                'Retry Generation'
              )}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Individual Step Indicator
 */
interface StepIndicatorProps {
  label: string;
  description: string;
  status: 'pending' | 'current' | 'complete' | 'error';
  isLast?: boolean;
}

function StepIndicator({
  label,
  description,
  status,
  isLast = false,
}: StepIndicatorProps) {
  const isPending = status === 'pending';
  const isCurrent = status === 'current';
  const isComplete = status === 'complete';
  const isError = status === 'error';

  return (
    <div className='flex gap-3'>
      {/* Icon Column */}
      <div className='flex flex-col items-center'>
        {/* Status Icon */}
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border-2',
            isPending && 'border-muted bg-muted/50',
            isCurrent && 'border-primary bg-primary/10',
            isComplete && 'border-green-600 bg-green-600',
            isError && 'border-destructive bg-destructive',
          )}
        >
          {isPending && (
            <div className='h-2 w-2 rounded-full bg-muted-foreground' />
          )}
          {isCurrent && (
            <Loader2 className='h-4 w-4 animate-spin text-primary' />
          )}
          {isComplete && <CheckCircle2 className='h-4 w-4 text-white' />}
          {isError && <XCircle className='h-4 w-4 text-white' />}
        </div>

        {/* Connector Line */}
        {!isLast && (
          <div
            className={cn(
              'mt-1 h-8 w-0.5',
              (isComplete || isCurrent) && 'bg-primary',
              isPending && 'bg-muted',
              isError && 'bg-destructive',
            )}
          />
        )}
      </div>

      {/* Content Column */}
      <div className='flex-1 pb-6'>
        <p
          className={cn(
            'font-medium',
            isPending && 'text-muted-foreground',
            isCurrent && 'text-foreground',
            isComplete && 'text-foreground',
            isError && 'text-destructive',
          )}
        >
          {label}
        </p>
        <p className='mt-0.5 text-sm text-muted-foreground'>{description}</p>
      </div>
    </div>
  );
}
