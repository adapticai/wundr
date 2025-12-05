'use client';

/**
 * Step Configuration Panel Component
 *
 * A comprehensive side panel for configuring workflow steps with:
 * - Real-time validation using React Hook Form + Zod
 * - Type-specific configuration forms
 * - Variable picker integration
 * - Preview and test capabilities
 * - Error handling and recovery
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save, AlertCircle, Info, Trash2, Copy } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  TriggerConfigForm,
  ActionConfigForm,
  ConditionConfigForm,
  LoopConfigForm,
  IntegrationConfigForm,
  DataConfigForm,
  UtilityConfigForm,
} from './step-config-forms';

import type { ScopedWorkflowVariable } from './variable-manager';
import type { StepType, StepCategory } from '@/lib/workflow/step-types';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  category: StepCategory;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  enabled?: boolean;
  notes?: string;
}

export interface StepConfigPanelProps {
  step: WorkflowStep | null;
  stepType?: StepType<unknown>;
  availableVariables?: ScopedWorkflowVariable[];
  onSave?: (stepId: string, config: Record<string, unknown>) => void;
  onDelete?: (stepId: string) => void;
  onDuplicate?: (stepId: string) => void;
  onClose?: () => void;
  className?: string;
  readOnly?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function StepConfigPanel({
  step,
  stepType,
  availableVariables = [],
  onSave,
  onDelete,
  onDuplicate,
  onClose,
  className,
  readOnly = false,
}: StepConfigPanelProps) {
  // Use the step type's config schema for validation
  const configSchema = useMemo(() => {
    if (!stepType) {
      return z.object({});
    }
    return z.object({
      config: stepType.configSchema,
      enabled: z.boolean().default(true),
      notes: z.string().optional(),
    });
  }, [stepType]);

  type FormData = z.infer<typeof configSchema>;

  const methods = useForm<FormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      config: step?.config || stepType?.defaultConfig || {},
      enabled: step?.enabled ?? true,
      notes: step?.notes || '',
    },
    mode: 'onChange',
  });

  const {
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = methods;

  // Reset form when step changes
  useEffect(() => {
    if (step && stepType) {
      reset({
        config: step.config || stepType.defaultConfig,
        enabled: step.enabled ?? true,
        notes: step.notes || '',
      });
    }
  }, [step, stepType, reset]);

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    if (!step) {
      return;
    }

    try {
      const configData =
        (data as { config?: Record<string, unknown> }).config ?? {};
      await onSave?.(step.id, configData);
      reset(data); // Reset dirty state
    } catch (error) {
      console.error('Failed to save step configuration:', error);
    }
  };

  const handleDelete = () => {
    if (!step) {
      return;
    }
    if (
      window.confirm(
        'Are you sure you want to delete this step? This action cannot be undone.'
      )
    ) {
      onDelete?.(step.id);
    }
  };

  const handleDuplicate = () => {
    if (!step) {
      return;
    }
    onDuplicate?.(step.id);
  };

  // Show empty state if no step selected
  if (!step || !stepType) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center bg-muted/30 p-8',
          className
        )}
      >
        <Info className='mb-4 h-12 w-12 text-muted-foreground/50' />
        <p className='text-center text-sm text-muted-foreground'>
          Select a step from the canvas to configure its settings
        </p>
      </div>
    );
  }

  const Icon = stepType.icon;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {/* Header */}
      <div className='flex items-center gap-3 border-b p-4'>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            'bg-primary/10'
          )}
        >
          <Icon className={cn('h-5 w-5', stepType.color)} />
        </div>
        <div className='min-w-0 flex-1'>
          <h2 className='truncate text-lg font-semibold text-foreground'>
            {step.name}
          </h2>
          <p className='truncate text-xs text-muted-foreground'>
            {stepType.description}
          </p>
        </div>
        <Button variant='ghost' size='icon' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Validation Error Banner */}
      {hasErrors && (
        <Alert variant='destructive' className='m-4 mb-0'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Please fix the validation errors below before saving
          </AlertDescription>
        </Alert>
      )}

      {/* Deprecated Warning */}
      {stepType.deprecated && (
        <Alert variant='destructive' className='m-4 mb-0'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            This step is deprecated and may be removed in a future version.
            Please consider using an alternative.
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className='flex flex-1 flex-col'
        >
          <ScrollArea className='flex-1'>
            <div className='space-y-6 p-4'>
              {/* Step Info */}
              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <Badge variant='secondary'>{stepType.category}</Badge>
                  {stepType.tags?.map(tag => (
                    <Badge key={tag} variant='outline' className='text-xs'>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Configuration Form based on category */}
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold text-foreground'>
                  Configuration
                </h3>
                {renderConfigForm(
                  stepType.category,
                  stepType,
                  availableVariables,
                  readOnly
                )}
              </div>

              {/* Advanced Settings */}
              <Accordion type='single' collapsible className='w-full'>
                <AccordionItem value='advanced'>
                  <AccordionTrigger className='text-sm font-semibold'>
                    Advanced Settings
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className='space-y-4 pt-2'>
                      {/* Notes field could go here */}
                      <p className='text-xs text-muted-foreground'>
                        Additional advanced settings will be available in future
                        updates.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          <div className='border-t bg-muted/30 p-4'>
            <div className='flex flex-col gap-2'>
              {/* Primary Actions */}
              <div className='flex gap-2'>
                <Button
                  type='submit'
                  className='flex-1'
                  disabled={!isDirty || !isValid || isSubmitting || readOnly}
                >
                  <Save className='mr-2 h-4 w-4' />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => reset()}
                  disabled={!isDirty}
                >
                  Reset
                </Button>
              </div>

              {/* Secondary Actions */}
              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleDuplicate}
                  disabled={readOnly}
                  className='flex-1'
                >
                  <Copy className='mr-2 h-4 w-4' />
                  Duplicate
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleDelete}
                  disabled={readOnly}
                  className='flex-1 text-destructive hover:bg-destructive/10'
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function renderConfigForm(
  category: StepCategory,
  stepType: StepType<unknown>,
  availableVariables: ScopedWorkflowVariable[],
  readOnly: boolean
) {
  const commonProps = {
    stepType,
    availableVariables,
    readOnly,
  };

  switch (category) {
    case 'triggers':
      return <TriggerConfigForm {...commonProps} />;
    case 'actions':
      return <ActionConfigForm {...commonProps} />;
    case 'conditions':
      return <ConditionConfigForm {...commonProps} />;
    case 'loops':
      return <LoopConfigForm {...commonProps} />;
    case 'integrations':
      return <IntegrationConfigForm {...commonProps} />;
    case 'data':
      return <DataConfigForm {...commonProps} />;
    case 'utilities':
      return <UtilityConfigForm {...commonProps} />;
    default:
      return (
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            Configuration form for {category} is not yet implemented.
          </AlertDescription>
        </Alert>
      );
  }
}
