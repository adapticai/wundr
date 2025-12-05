'use client';

/**
 * Workflow Template Hook
 *
 * React hook for working with workflow templates, including creating workflows
 * from templates, managing variables, and template selection.
 */

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import { getTemplateById } from '@/lib/workflow/templates';

import type { WorkflowTemplate, CreateWorkflowInput } from '@/types/workflow';


interface UseWorkflowTemplateOptions {
  /**
   * Callback when a workflow is successfully created from a template
   */
  onWorkflowCreated?: (workflowId: string) => void;
  /**
   * Callback when template creation fails
   */
  onError?: (error: Error) => void;
}

interface TemplateVariableValues {
  [key: string]: string | number | boolean;
}

export function useWorkflowTemplate(options: UseWorkflowTemplateOptions = {}) {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkflowTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<TemplateVariableValues>(
    {},
  );
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Select a template and initialize variable values with defaults
   */
  const selectTemplate = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template);

    // Initialize variable values with defaults
    const initialValues: TemplateVariableValues = {};
    template.variables?.forEach((variable) => {
      if (variable.defaultValue !== undefined) {
        initialValues[variable.name] = variable.defaultValue as
          | string
          | number
          | boolean;
      }
    });
    setVariableValues(initialValues);
  }, []);

  /**
   * Select a template by ID
   */
  const selectTemplateById = useCallback(
    (templateId: string) => {
      const template = getTemplateById(templateId);
      if (template) {
        selectTemplate(template);
      }
    },
    [selectTemplate],
  );

  /**
   * Update a variable value
   */
  const updateVariable = useCallback((name: string, value: string | number | boolean) => {
    setVariableValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  /**
   * Update multiple variables at once
   */
  const updateVariables = useCallback((values: TemplateVariableValues) => {
    setVariableValues((prev) => ({
      ...prev,
      ...values,
    }));
  }, []);

  /**
   * Clear the selected template
   */
  const clearTemplate = useCallback(() => {
    setSelectedTemplate(null);
    setVariableValues({});
  }, []);

  /**
   * Check if all required variables have values
   */
  const hasAllRequiredVariables = useCallback(() => {
    if (!selectedTemplate?.variables) {
return true;
}

    return selectedTemplate.variables.every((variable) => {
      const value = variableValues[variable.name];
      return value !== undefined && value !== '';
    });
  }, [selectedTemplate, variableValues]);

  /**
   * Substitute variables in a string value
   */
  const substituteVariables = useCallback(
    (value: string): string => {
      let result = value;

      // Replace all {{variable.name}} with actual values
      Object.entries(variableValues).forEach(([name, val]) => {
        const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
        result = result.replace(pattern, String(val));
      });

      return result;
    },
    [variableValues],
  );

  /**
   * Create a workflow from the selected template
   */
  const createFromTemplate = useCallback(
    async (workflowName?: string): Promise<string | null> => {
      if (!selectedTemplate) {
        throw new Error('No template selected');
      }

      if (!hasAllRequiredVariables()) {
        throw new Error('Not all required variables are filled');
      }

      setIsCreating(true);

      try {
        // Build the workflow input by substituting variables
        // Use type assertion since template actions may have looser typing than CreateWorkflowInput expects
        const workflowInput = {
          name: workflowName || selectedTemplate.name,
          description: selectedTemplate.description,
          trigger: selectedTemplate.trigger,
          actions: selectedTemplate.actions.map((action) => ({
            ...action,
            config: substituteConfigVariables(action.config as Record<string, unknown>, variableValues),
          })),
          variables: selectedTemplate.variables?.map((variable) => ({
            ...variable,
            defaultValue: variableValues[variable.name],
          })),
        } as unknown as CreateWorkflowInput;

        // Call the API to create the workflow
        const response = await fetch('/api/workflows', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workflowInput),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create workflow');
        }

        const { data } = await response.json();
        const workflowId = data.id;

        // Clear the template state
        clearTemplate();

        // Call success callback
        options.onWorkflowCreated?.(workflowId);

        return workflowId;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        options.onError?.(err);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [
      selectedTemplate,
      variableValues,
      hasAllRequiredVariables,
      clearTemplate,
      options,
    ],
  );

  /**
   * Create a workflow and navigate to its editor
   */
  const createAndEdit = useCallback(
    async (workflowName?: string) => {
      const workflowId = await createFromTemplate(workflowName);
      if (workflowId) {
        router.push(`/workflows/${workflowId}/edit`);
      }
    },
    [createFromTemplate, router],
  );

  return {
    // State
    selectedTemplate,
    variableValues,
    isCreating,

    // Actions
    selectTemplate,
    selectTemplateById,
    updateVariable,
    updateVariables,
    clearTemplate,
    createFromTemplate,
    createAndEdit,

    // Helpers
    hasAllRequiredVariables: hasAllRequiredVariables(),
  };
}

/**
 * Recursively substitute variables in a config object
 */
function substituteConfigVariables(
  config: Record<string, unknown>,
  variables: TemplateVariableValues,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      // Substitute variables in strings
      let substituted = value;
      Object.entries(variables).forEach(([name, val]) => {
        const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
        substituted = substituted.replace(pattern, String(val));
      });
      result[key] = substituted;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively substitute in nested objects
      result[key] = substituteConfigVariables(
        value as Record<string, unknown>,
        variables,
      );
    } else {
      // Keep other types as-is
      result[key] = value;
    }
  }

  return result;
}
