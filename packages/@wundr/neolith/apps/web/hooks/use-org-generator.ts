/**
 * Organization Generator Hook
 *
 * Handles calling the generate-org API, tracking progress, and managing state
 * for the workspace creation wizard.
 *
 * @module hooks/use-org-generator
 */

import { useCallback, useState } from 'react';
import type { GenerateOrgInput } from '@/lib/validations/workspace-genesis';

/**
 * Generation states
 */
export type GenerationState =
  | 'idle'
  | 'creating-workspace'
  | 'creating-orchestrators'
  | 'creating-workflows'
  | 'complete'
  | 'error';

/**
 * Step information for progress tracking
 */
export interface GenerationStep {
  state: GenerationState;
  label: string;
  description: string;
}

/**
 * Generated workspace response
 */
export interface GeneratedWorkspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  channels?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  workspaceMembers?: Array<{
    user: {
      id: string;
      name: string | null;
      email: string;
      isOrchestrator: boolean;
    };
  }>;
  _count?: {
    workspaceMembers: number;
    channels: number;
  };
}

/**
 * Generation result from API
 */
export interface GenerationResult {
  data: GeneratedWorkspace;
  genesis: {
    manifestId: string;
    orchestratorCount: number;
    disciplineCount: number;
    agentCount: number;
    generationTimeMs: number;
  };
  migration: {
    status: string;
    orchestratorMappings: number;
    disciplineMappings: number;
    warnings: string[];
  };
  message: string;
  durationMs: number;
}

/**
 * Hook state
 */
interface UseOrgGeneratorState {
  isGenerating: boolean;
  currentState: GenerationState;
  progress: number;
  error: string | null;
  result: GenerationResult | null;
  warnings: string[];
}

/**
 * Hook return type
 */
interface UseOrgGeneratorReturn extends UseOrgGeneratorState {
  generateOrg: (input: GenerateOrgInput) => Promise<GenerationResult>;
  reset: () => void;
  retry: () => Promise<void>;
  getCurrentStep: () => GenerationStep;
  getAllSteps: () => GenerationStep[];
}

/**
 * Generation steps configuration
 */
const GENERATION_STEPS: Record<GenerationState, GenerationStep> = {
  idle: {
    state: 'idle',
    label: 'Ready',
    description: 'Waiting to start generation',
  },
  'creating-workspace': {
    state: 'creating-workspace',
    label: 'Creating Workspace',
    description: 'Setting up your workspace and organizational structure',
  },
  'creating-orchestrators': {
    state: 'creating-orchestrators',
    label: 'Creating Orchestrators',
    description: 'Generating Orchestrator orchestrators and assigning disciplines',
  },
  'creating-workflows': {
    state: 'creating-workflows',
    label: 'Creating Workflows',
    description: 'Setting up channels and workflow automations',
  },
  complete: {
    state: 'complete',
    label: 'Complete',
    description: 'Organization successfully generated',
  },
  error: {
    state: 'error',
    label: 'Error',
    description: 'Generation failed',
  },
};

/**
 * Calculate progress percentage based on state
 */
function calculateProgress(state: GenerationState): number {
  const progressMap: Record<GenerationState, number> = {
    idle: 0,
    'creating-workspace': 25,
    'creating-orchestrators': 50,
    'creating-workflows': 75,
    complete: 100,
    error: 0,
  };
  return progressMap[state] || 0;
}

/**
 * useOrgGenerator Hook
 *
 * Manages organization generation workflow with progress tracking
 *
 * @example
 * ```tsx
 * const { generateOrg, isGenerating, currentState, progress, error, result } = useOrgGenerator();
 *
 * const handleGenerate = async () => {
 *   try {
 *     const result = await generateOrg({
 *       organizationName: "Acme Corp",
 *       organizationId: "org_123",
 *       workspaceName: "Engineering",
 *       workspaceSlug: "engineering",
 *       // ... other fields
 *     });
 *     console.log("Generated workspace:", result.data.id);
 *   } catch (err) {
 *     console.error("Generation failed:", err);
 *   }
 * };
 * ```
 */
export function useOrgGenerator(): UseOrgGeneratorReturn {
  const [state, setState] = useState<UseOrgGeneratorState>({
    isGenerating: false,
    currentState: 'idle',
    progress: 0,
    error: null,
    result: null,
    warnings: [],
  });

  // Store last input for retry functionality
  const [lastInput, setLastInput] = useState<GenerateOrgInput | null>(null);

  /**
   * Update generation state with simulated progress
   */
  const updateState = useCallback((newState: GenerationState, warnings: string[] = []) => {
    setState((prev) => ({
      ...prev,
      currentState: newState,
      progress: calculateProgress(newState),
      warnings: [...prev.warnings, ...warnings],
    }));
  }, []);

  /**
   * Simulate progress through generation states
   * This provides user feedback while the backend does its work
   */
  const simulateProgress = useCallback(async () => {
    // Start with workspace creation
    updateState('creating-workspace');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Move to orchestrators
    updateState('creating-orchestrators');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Move to workflows
    updateState('creating-workflows');
    await new Promise((resolve) => setTimeout(resolve, 800));
  }, [updateState]);

  /**
   * Generate organization structure
   */
  const generateOrg = useCallback(
    async (input: GenerateOrgInput): Promise<GenerationResult> => {
      // Reset state
      setState({
        isGenerating: true,
        currentState: 'idle',
        progress: 0,
        error: null,
        result: null,
        warnings: [],
      });

      // Store input for potential retry
      setLastInput(input);

      try {
        // Start progress simulation
        const progressPromise = simulateProgress();

        // Call API
        const response = await fetch('/api/workspaces/generate-org', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        // Wait for progress simulation to complete
        await progressPromise;

        const data = await response.json();

        if (!response.ok) {
          const errorMessage =
            data.error?.message || `Generation failed with status ${response.status}`;
          throw new Error(errorMessage);
        }

        // Mark as complete
        updateState('complete', data.migration?.warnings || []);

        const result: GenerationResult = data;

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          result,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          currentState: 'error',
          error: errorMessage,
          progress: 0,
        }));

        throw error;
      }
    },
    [simulateProgress, updateState],
  );

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      currentState: 'idle',
      progress: 0,
      error: null,
      result: null,
      warnings: [],
    });
    setLastInput(null);
  }, []);

  /**
   * Retry last generation
   */
  const retry = useCallback(async () => {
    if (!lastInput) {
      throw new Error('No previous generation to retry');
    }
    await generateOrg(lastInput);
  }, [lastInput, generateOrg]);

  /**
   * Get current step information
   */
  const getCurrentStep = useCallback((): GenerationStep => {
    return GENERATION_STEPS[state.currentState];
  }, [state.currentState]);

  /**
   * Get all steps for progress display
   */
  const getAllSteps = useCallback((): GenerationStep[] => {
    return [
      GENERATION_STEPS['creating-workspace'],
      GENERATION_STEPS['creating-orchestrators'],
      GENERATION_STEPS['creating-workflows'],
      GENERATION_STEPS.complete,
    ];
  }, []);

  return {
    ...state,
    generateOrg,
    reset,
    retry,
    getCurrentStep,
    getAllSteps,
  };
}
