'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import { cn } from '@/lib/utils';

import { StepDisciplines } from './step-disciplines';
import { StepOrchestratorConfig } from './step-orchestrator-config';
import { StepOrgSetup } from './step-org-setup';
import { StepResults } from './step-results';
import { StepReview } from './step-review';

import type { GenerationResult } from './step-results';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const orchestratorConfigSchema = z.object({
  name: z.string().min(1, 'Orchestrator name is required'),
  persona: z.string().min(10, 'Persona must be at least 10 characters'),
  maxConcurrentSessions: z
    .number()
    .min(1, 'Must be at least 1')
    .max(100, 'Cannot exceed 100'),
  tokenBudgetPerHour: z
    .number()
    .min(10000, 'Minimum budget is 10,000 tokens/hour'),
});

const genesisSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  mission: z
    .string()
    .min(10, 'Mission statement must be at least 10 characters'),
  description: z.string().optional(),
  industry: z.string().min(1, 'Please select an industry'),
  size: z.enum(['small', 'medium', 'large', 'enterprise'], {
    required_error: 'Please select an organization size',
  }),
  disciplines: z
    .array(z.string())
    .min(1, 'Please select at least one discipline'),
  orchestratorConfigs: z.record(orchestratorConfigSchema).optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenesisFormValues = z.infer<typeof genesisSchema>;

export interface OrchestratorConfig {
  name: string;
  persona: string;
  maxConcurrentSessions: number;
  tokenBudgetPerHour: number;
}

// ---------------------------------------------------------------------------
// Steps configuration
// ---------------------------------------------------------------------------

interface WizardStep {
  id: string;
  label: string;
  description: string;
  fields: (keyof GenesisFormValues)[];
}

const STEPS: WizardStep[] = [
  {
    id: 'org-setup',
    label: 'Organization',
    description: 'Name, mission, industry, size',
    fields: ['name', 'mission', 'industry', 'size'],
  },
  {
    id: 'disciplines',
    label: 'Disciplines',
    description: 'Select active disciplines',
    fields: ['disciplines'],
  },
  {
    id: 'orchestrator-config',
    label: 'Orchestrators',
    description: 'Configure per-discipline orchestrators',
    fields: ['orchestratorConfigs'],
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Preview structure',
    fields: [],
  },
  {
    id: 'results',
    label: 'Results',
    description: 'Generation outcome',
    fields: [],
  },
];

const LAST_CONFIG_STEP = 3; // 0-indexed: the "review" step index, generate happens here
const RESULTS_STEP = 4;

// ---------------------------------------------------------------------------
// Progress Indicator
// ---------------------------------------------------------------------------

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function ProgressIndicator({
  currentStep,
  totalSteps,
}: ProgressIndicatorProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className='space-y-3'>
      {/* Step labels */}
      <div className='flex items-start gap-1'>
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex flex-1 flex-col items-center',
              index < STEPS.length - 1 && 'relative'
            )}
          >
            {/* Circle */}
            <div
              className={cn(
                'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                index < currentStep
                  ? 'border-primary bg-primary text-primary-foreground'
                  : index === currentStep
                    ? 'border-primary bg-background text-primary'
                    : 'border-muted bg-background text-muted-foreground'
              )}
            >
              {index < currentStep ? (
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='3'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='h-3 w-3'
                >
                  <polyline points='20 6 9 17 4 12' />
                </svg>
              ) : (
                index + 1
              )}
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div className='absolute top-3.5 left-1/2 h-0.5 w-full bg-muted'>
                <div
                  className='h-full bg-primary transition-all duration-300'
                  style={{
                    width: index < currentStep ? '100%' : '0%',
                  }}
                />
              </div>
            )}

            {/* Step label - hidden on mobile */}
            <span
              className={cn(
                'mt-1 hidden text-center text-[10px] font-medium sm:block',
                index <= currentStep
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className='h-1 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className='h-full bg-primary transition-all duration-300'
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current step description */}
      <p className='text-xs text-muted-foreground'>
        Step {currentStep + 1} of {totalSteps} &mdash;{' '}
        <span className='font-medium text-foreground'>
          {STEPS[currentStep]?.label}
        </span>
        : {STEPS[currentStep]?.description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Genesis Wizard
// ---------------------------------------------------------------------------

interface GenesisWizardProps {
  workspaceSlug: string;
}

export function GenesisWizard({ workspaceSlug }: GenesisWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] =
    useState<GenerationResult | null>(null);

  const methods = useForm<GenesisFormValues>({
    resolver: zodResolver(genesisSchema),
    defaultValues: {
      name: '',
      mission: '',
      description: '',
      industry: '' as GenesisFormValues['industry'],
      size: undefined,
      disciplines: [],
      orchestratorConfigs: {},
    },
    mode: 'onTouched',
  });

  const { trigger, getValues } = methods;

  // Validate the fields for the current step before advancing
  const validateCurrentStep = useCallback(async () => {
    const stepConfig = STEPS[currentStep];
    if (!stepConfig || stepConfig.fields.length === 0) {
      return true;
    }
    return trigger(stepConfig.fields as (keyof GenesisFormValues)[]);
  }, [currentStep, trigger]);

  const handleNext = useCallback(async () => {
    const valid = await validateCurrentStep();
    if (!valid) {
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  }, [validateCurrentStep]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleGenerate = useCallback(async () => {
    const values = getValues();
    setIsGenerating(true);
    setCurrentStep(RESULTS_STEP);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/generate-org`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            mission: values.mission,
            description: values.description,
            industry: values.industry,
            size: values.size,
            disciplines: values.disciplines,
            orchestratorConfigs: values.orchestratorConfigs,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody?.message ?? `Request failed with status ${response.status}`
        );
      }

      const data = await response.json();
      setGenerationResult({
        success: true,
        organizationId: data.organizationId,
        orchestrators: data.orchestrators ?? [],
        sessionManagers: data.sessionManagers ?? [],
        agentCount: data.agentCount ?? 0,
        disciplineCount: values.disciplines.length,
      });
    } catch (err) {
      setGenerationResult({
        success: false,
        error: err instanceof Error ? err.message : 'An unknown error occurred',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [getValues, workspaceSlug]);

  const handleRetry = useCallback(async () => {
    setGenerationResult(null);
    await handleGenerate();
  }, [handleGenerate]);

  const handleReset = useCallback(() => {
    methods.reset();
    setCurrentStep(0);
    setGenerationResult(null);
    setIsGenerating(false);
  }, [methods]);

  const isOnResultsStep = currentStep === RESULTS_STEP;
  const isOnReviewStep = currentStep === LAST_CONFIG_STEP;

  return (
    <FormProvider {...methods}>
      <div className='flex flex-col gap-6'>
        {/* Progress Indicator — hidden on results step */}
        {!isOnResultsStep && (
          <div className='rounded-lg border bg-card p-4'>
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={STEPS.length}
            />
          </div>
        )}

        {/* Step Content */}
        <div className='rounded-lg border bg-card p-6'>
          {currentStep === 0 && <StepOrgSetup />}
          {currentStep === 1 && <StepDisciplines />}
          {currentStep === 2 && <StepOrchestratorConfig />}
          {currentStep === 3 && <StepReview />}
          {currentStep === 4 && (
            <StepResults
              result={generationResult}
              isLoading={isGenerating}
              onRetry={handleRetry}
              onReset={handleReset}
            />
          )}
        </div>

        {/* Navigation Buttons — hidden during loading and on results step */}
        {!isOnResultsStep && (
          <div className='flex items-center justify-between'>
            {/* Back */}
            <button
              type='button'
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn(
                'flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors',
                currentStep === 0
                  ? 'cursor-not-allowed opacity-40 text-muted-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <ChevronLeftIcon className='h-4 w-4' />
              Back
            </button>

            {/* Right side */}
            {isOnReviewStep ? (
              <button
                type='button'
                onClick={handleGenerate}
                disabled={isGenerating}
                className='flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
              >
                <SparklesIcon className='h-4 w-4' />
                {isGenerating ? 'Generating...' : 'Generate Organization'}
              </button>
            ) : (
              <button
                type='button'
                onClick={handleNext}
                className='flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                Next
                <ChevronRightIcon className='h-4 w-4' />
              </button>
            )}
          </div>
        )}
      </div>
    </FormProvider>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
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
      <polyline points='15 18 9 12 15 6' />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <polyline points='9 18 15 12 9 6' />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
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
      <path d='m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' />
      <path d='M5 3v4' />
      <path d='M19 17v4' />
      <path d='M3 5h4' />
      <path d='M17 19h4' />
    </svg>
  );
}
