'use client';

/**
 * Workflow Template Configurator Component
 *
 * Allows users to configure template variables before creating a workflow.
 * Displays variable inputs with type-specific controls and validation.
 */

import { AlertCircle, CheckCircle2, Settings, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import type { WorkflowTemplate, WorkflowVariable } from '@/types/workflow';

interface TemplateConfiguratorProps {
  template: WorkflowTemplate;
  values: Record<string, string | number | boolean>;
  onValueChange: (name: string, value: string | number | boolean) => void;
  onComplete: (workflowName: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

export function TemplateConfigurator({
  template,
  values,
  onValueChange,
  onComplete,
  onCancel,
  isLoading = false,
  className,
}: TemplateConfiguratorProps) {
  const [workflowName, setWorkflowName] = useState(template.name);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const variables = template.variables || [];

  /**
   * Validate all variables before creating the workflow
   */
  const validateAndSubmit = () => {
    const newErrors: Record<string, string> = {};

    // Validate workflow name
    if (!workflowName.trim()) {
      newErrors.workflowName = 'Workflow name is required';
    }

    // Validate required variables
    variables.forEach(variable => {
      const value = values[variable.name];
      if (value === undefined || value === '') {
        newErrors[variable.name] = `${variable.name} is required`;
      }

      // Type-specific validation
      if (variable.type === 'number' && typeof value === 'string') {
        if (isNaN(Number(value))) {
          newErrors[variable.name] = 'Must be a valid number';
        }
      }
    });

    setErrors(newErrors);

    // If no errors, submit
    if (Object.keys(newErrors).length === 0) {
      onComplete(workflowName);
    }
  };

  const hasAllValues = variables.every(variable => {
    const value = values[variable.name];
    return value !== undefined && value !== '';
  });

  return (
    <div className={className}>
      <div className='space-y-6'>
        {/* Header */}
        <div>
          <div className='mb-2 flex items-center gap-2'>
            <Sparkles className='h-5 w-5 text-primary' />
            <h2 className='text-xl font-bold'>Configure Template</h2>
          </div>
          <p className='text-sm text-muted-foreground'>
            Fill in the required information to create your workflow from this
            template.
          </p>
        </div>

        {/* Workflow Name */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Workflow Name</CardTitle>
            <CardDescription className='text-xs'>
              Give your workflow a descriptive name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={workflowName}
              onChange={e => {
                setWorkflowName(e.target.value);
                if (errors.workflowName) {
                  setErrors(prev => {
                    const { workflowName: _, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              placeholder='Enter workflow name'
              className={errors.workflowName ? 'border-destructive' : ''}
            />
            {errors.workflowName && (
              <p className='mt-2 flex items-center gap-1 text-xs text-destructive'>
                <AlertCircle className='h-3 w-3' />
                {errors.workflowName}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Variables Configuration */}
        {variables.length > 0 && (
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Settings className='h-4 w-4' />
                <div>
                  <CardTitle className='text-base'>
                    Template Variables ({variables.length})
                  </CardTitle>
                  <CardDescription className='text-xs'>
                    Configure the variables for this workflow
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {variables.map(variable => (
                  <VariableInput
                    key={variable.name}
                    variable={variable}
                    value={values[variable.name]}
                    onChange={value => {
                      onValueChange(variable.name, value);
                      if (errors[variable.name]) {
                        setErrors(prev => {
                          const { [variable.name]: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    error={errors[variable.name]}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card
          className={
            hasAllValues
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
              : 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20'
          }
        >
          <CardContent className='pt-6'>
            <div className='flex items-center gap-3'>
              {hasAllValues ? (
                <>
                  <CheckCircle2 className='h-5 w-5 text-green-600 dark:text-green-400' />
                  <div>
                    <p className='font-semibold text-green-700 dark:text-green-400'>
                      Ready to create
                    </p>
                    <p className='text-xs text-green-600 dark:text-green-500'>
                      All required fields are filled
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                  <div>
                    <p className='font-semibold text-orange-700 dark:text-orange-400'>
                      Configuration incomplete
                    </p>
                    <p className='text-xs text-orange-600 dark:text-orange-500'>
                      Please fill in all required fields
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className='flex gap-3'>
          <Button
            variant='outline'
            onClick={onCancel}
            disabled={isLoading}
            className='flex-1'
          >
            Cancel
          </Button>
          <Button
            onClick={validateAndSubmit}
            disabled={isLoading}
            className='flex-1'
          >
            {isLoading ? 'Creating...' : 'Create Workflow'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Variable Input Component
 */
interface VariableInputProps {
  variable: Omit<WorkflowVariable, 'source'>;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  error?: string;
}

function VariableInput({
  variable,
  value,
  onChange,
  error,
}: VariableInputProps) {
  const renderInput = () => {
    switch (variable.type) {
      case 'number':
        return (
          <Input
            type='number'
            value={value !== undefined ? String(value) : ''}
            onChange={e => onChange(Number(e.target.value))}
            placeholder={
              variable.defaultValue !== undefined
                ? String(variable.defaultValue)
                : 'Enter a number'
            }
            className={error ? 'border-destructive' : ''}
          />
        );

      case 'boolean':
        return (
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              checked={Boolean(value)}
              onChange={e => onChange(e.target.checked)}
              className='h-4 w-4 rounded border-gray-300'
            />
            <span className='text-sm'>{value ? 'Enabled' : 'Disabled'}</span>
          </div>
        );

      case 'string':
      default:
        return (
          <Input
            type='text'
            value={value !== undefined ? String(value) : ''}
            onChange={e => onChange(e.target.value)}
            placeholder={
              variable.defaultValue !== undefined
                ? String(variable.defaultValue)
                : 'Enter a value'
            }
            className={error ? 'border-destructive' : ''}
          />
        );
    }
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>
            <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
              {variable.name}
            </code>
          </label>
          <Badge variant='outline' className='text-xs'>
            {variable.type}
          </Badge>
        </div>
      </div>

      {variable.description && (
        <p className='text-xs text-muted-foreground'>{variable.description}</p>
      )}

      {renderInput()}

      {error && (
        <p className='flex items-center gap-1 text-xs text-destructive'>
          <AlertCircle className='h-3 w-3' />
          {error}
        </p>
      )}
    </div>
  );
}
