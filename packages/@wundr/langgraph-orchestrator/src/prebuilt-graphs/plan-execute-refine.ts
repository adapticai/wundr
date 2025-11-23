/**
 * Plan-Execute-Refine Graph - Ready-to-use workflow pattern
 * @module @wundr.io/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { createDecisionNode, createIfElseNode } from '../nodes/decision-node';
import { createHumanNode } from '../nodes/human-node';
import { createLLMNode } from '../nodes/llm-node';
import { createToolRegistry } from '../nodes/tool-node';
import { StateGraph } from '../state-graph';

import type { HumanInputHandler } from '../nodes/human-node';
import type {
  AgentState,
  Tool,
  LLMProvider,
  NodeResult,
  NodeContext,
} from '../types';

/**
 * Extended state for plan-execute-refine workflow
 */
export interface PlanExecuteState extends AgentState {
  /** The current plan */
  readonly data: AgentState['data'] & {
    /** Original task/goal */
    task?: string;
    /** Generated plan steps */
    plan?: PlanStep[];
    /** Current step being executed */
    currentStepIndex?: number;
    /** Execution results for each step */
    stepResults?: StepResult[];
    /** Overall execution status */
    executionStatus?:
      | 'planning'
      | 'executing'
      | 'refining'
      | 'complete'
      | 'failed';
    /** Number of refinement iterations */
    refinementCount?: number;
    /** Maximum refinement iterations */
    maxRefinements?: number;
    /** Final result */
    finalResult?: unknown;
  };
}

/**
 * A step in the plan
 */
export interface PlanStep {
  /** Step identifier */
  id: string;
  /** Step description */
  description: string;
  /** Tool to use (if any) */
  tool?: string;
  /** Tool arguments */
  toolArgs?: Record<string, unknown>;
  /** Dependencies on other steps */
  dependsOn?: string[];
  /** Expected output description */
  expectedOutput?: string;
}

/**
 * Result of executing a step
 */
export interface StepResult {
  /** Step ID */
  stepId: string;
  /** Whether step succeeded */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution timestamp */
  timestamp: Date;
}

/**
 * Configuration for plan-execute-refine graph
 */
export interface PlanExecuteRefineConfig {
  /** LLM provider for planning and refinement */
  llmProvider: LLMProvider;
  /** Available tools */
  tools?: Tool[];
  /** Human input handler for approval steps */
  humanHandler?: HumanInputHandler;
  /** Maximum refinement iterations */
  maxRefinements?: number;
  /** Whether to require human approval before execution */
  requireApproval?: boolean;
  /** Custom planner prompt */
  plannerPrompt?: string;
  /** Custom executor prompt */
  executorPrompt?: string;
  /** Custom refiner prompt */
  refinerPrompt?: string;
  /** Model to use */
  model?: string;
}

/**
 * Schema for plan validation
 */
export const PlanSchema = z.array(
  z.object({
    id: z.string(),
    description: z.string(),
    tool: z.string().optional(),
    toolArgs: z.record(z.unknown()).optional(),
    dependsOn: z.array(z.string()).optional(),
    expectedOutput: z.string().optional(),
  })
);

/**
 * Create a plan-execute-refine workflow graph
 *
 * @example
 * ```typescript
 * const graph = createPlanExecuteRefineGraph({
 *   llmProvider: myLLMProvider,
 *   tools: [searchTool, calculatorTool],
 *   maxRefinements: 3,
 *   requireApproval: true,
 *   humanHandler: myHumanHandler
 * });
 *
 * const result = await graph.execute({
 *   initialState: {
 *     data: { task: 'Research and summarize the latest AI developments' }
 *   }
 * });
 * ```
 *
 * @param config - Graph configuration
 * @returns Configured StateGraph
 */
export function createPlanExecuteRefineGraph(
  config: PlanExecuteRefineConfig
): StateGraph<PlanExecuteState> {
  const graph = new StateGraph<PlanExecuteState>('plan-execute-refine');

  // Set up services
  const toolRegistry = createToolRegistry();
  config.tools?.forEach(tool => toolRegistry.register(tool));

  graph.setServices({
    llmProvider: config.llmProvider,
    toolRegistry,
  });

  // =========================================================================
  // Node: Planner - Creates the initial plan
  // =========================================================================
  const plannerNode = createLLMNode<PlanExecuteState>({
    id: 'planner',
    name: 'Planner',
    config: {
      model: config.model,
      systemPrompt: config.plannerPrompt ?? DEFAULT_PLANNER_PROMPT,
      promptTemplate: state => {
        const task = state.data.task ?? 'No task specified';
        const tools =
          config.tools?.map(t => `- ${t.name}: ${t.description}`).join('\n') ??
          'No tools available';
        return `Task: ${task}\n\nAvailable Tools:\n${tools}\n\nCreate a detailed plan to accomplish this task.`;
      },
      postProcess: (response, state) => {
        // Parse plan from response
        const plan = extractPlanFromResponse(response.message.content);
        return {
          data: {
            ...state.data,
            plan,
            currentStepIndex: 0,
            stepResults: [],
            executionStatus: 'planning' as const,
          },
        };
      },
    },
  });

  // =========================================================================
  // Node: Plan Validator - Validates the generated plan
  // =========================================================================
  const validatorNode = {
    id: 'validator',
    name: 'Plan Validator',
    type: 'transform' as const,
    config: {},
    execute: async (
      state: PlanExecuteState,
      context: NodeContext
    ): Promise<NodeResult<PlanExecuteState>> => {
      const plan = state.data.plan;

      if (!plan || plan.length === 0) {
        context.services.logger.warn('Empty or invalid plan generated');
        return {
          state: {
            ...state,
            data: {
              ...state.data,
              executionStatus: 'failed' as const,
            },
            error: {
              code: 'INVALID_PLAN',
              message: 'Failed to generate a valid plan',
              recoverable: true,
            },
          } as PlanExecuteState,
          next: 'refiner',
        };
      }

      // Validate plan structure
      try {
        PlanSchema.parse(plan);
      } catch (error) {
        context.services.logger.error('Plan validation failed', { error });
        return {
          state: {
            ...state,
            data: {
              ...state.data,
              executionStatus: 'failed' as const,
            },
          } as PlanExecuteState,
          next: 'refiner',
        };
      }

      // Validate tool references
      for (const step of plan) {
        if (step.tool && !toolRegistry.get(step.tool)) {
          context.services.logger.warn(`Unknown tool referenced: ${step.tool}`);
        }
      }

      context.services.logger.info(`Plan validated with ${plan.length} steps`);

      return {
        state: {
          ...state,
          data: {
            ...state.data,
            executionStatus: 'executing' as const,
          },
        } as PlanExecuteState,
        next: config.requireApproval ? 'approval' : 'executor',
      };
    },
  };

  // =========================================================================
  // Node: Approval - Human approval before execution (optional)
  // =========================================================================
  let approvalNode;
  if (config.humanHandler) {
    approvalNode = createHumanNode<PlanExecuteState>({
      id: 'approval',
      name: 'Plan Approval',
      config: {
        inputHandler: config.humanHandler,
        prompt: state => {
          const plan = (state.data['plan'] as PlanStep[] | undefined) ?? [];
          const planText = plan
            .map((s: PlanStep, i: number) => `${i + 1}. ${s.description}`)
            .join('\n');
          return `Please review the following plan:\n\n${planText}\n\nDo you approve this plan?`;
        },
        choices: [
          {
            value: 'approve',
            label: 'Approve',
            description: 'Proceed with execution',
          },
          { value: 'reject', label: 'Reject', description: 'Request new plan' },
          {
            value: 'modify',
            label: 'Modify',
            description: 'Provide feedback for refinement',
          },
        ],
        processResponse: (response, _state) => {
          if (response.value === 'reject') {
            return { planRejected: true };
          }
          if (response.value === 'modify') {
            return { planFeedback: response.metadata?.feedback };
          }
          return { planApproved: true };
        },
      },
    });
  }

  // =========================================================================
  // Node: Approval Router - Routes based on approval decision
  // =========================================================================
  const approvalRouterNode = createDecisionNode<PlanExecuteState>({
    id: 'approval-router',
    name: 'Approval Router',
    config: {
      branches: [
        {
          name: 'approved',
          target: 'executor',
          condition: {
            type: 'equals',
            field: 'data.planApproved',
            value: true,
          },
        },
        {
          name: 'rejected',
          target: 'planner',
          condition: {
            type: 'equals',
            field: 'data.planRejected',
            value: true,
          },
        },
      ],
      defaultBranch: 'refiner',
    },
  });

  // =========================================================================
  // Node: Executor - Executes plan steps
  // =========================================================================
  const executorNode = {
    id: 'executor',
    name: 'Step Executor',
    type: 'transform' as const,
    config: {},
    execute: async (
      state: PlanExecuteState,
      context: NodeContext
    ): Promise<NodeResult<PlanExecuteState>> => {
      const plan = state.data.plan ?? [];
      const currentIndex = state.data.currentStepIndex ?? 0;
      const stepResults = state.data.stepResults ?? [];

      if (currentIndex >= plan.length) {
        context.services.logger.info('All steps executed');
        return {
          state: {
            ...state,
            data: {
              ...state.data,
              executionStatus: 'refining' as const,
            },
          } as PlanExecuteState,
          next: 'evaluator',
        };
      }

      const step = plan[currentIndex];
      if (!step) {
        return {
          state: {
            ...state,
            data: {
              ...state.data,
              currentStepIndex: currentIndex + 1,
            },
          } as PlanExecuteState,
          next: 'executor', // Continue to next step
        };
      }

      context.services.logger.info(
        `Executing step ${currentIndex + 1}: ${step.description}`
      );

      let result: StepResult;

      try {
        // Check dependencies
        if (step.dependsOn?.length) {
          for (const depId of step.dependsOn) {
            const depResult = stepResults.find(r => r.stepId === depId);
            if (!depResult?.success) {
              throw new Error(`Dependency ${depId} not satisfied`);
            }
          }
        }

        // Execute tool if specified
        let stepOutput: unknown;
        if (step.tool) {
          const tool = toolRegistry.get(step.tool);
          if (!tool) {
            throw new Error(`Tool ${step.tool} not found`);
          }
          stepOutput = await tool.execute(step.toolArgs ?? {});
        } else {
          // For non-tool steps, use LLM
          const llmResponse = await config.llmProvider.generate({
            messages: [
              ...state.messages,
              {
                id: uuidv4(),
                role: 'user',
                content: `Execute step: ${step.description}`,
                timestamp: new Date(),
              },
            ],
            model: config.model,
          });
          stepOutput = llmResponse.message.content;
        }

        result = {
          stepId: step.id,
          success: true,
          result: stepOutput,
          timestamp: new Date(),
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        context.services.logger.error(`Step ${step.id} failed`, {
          error: err.message,
        });

        result = {
          stepId: step.id,
          success: false,
          error: err.message,
          timestamp: new Date(),
        };
      }

      return {
        state: {
          ...state,
          data: {
            ...state.data,
            currentStepIndex: currentIndex + 1,
            stepResults: [...stepResults, result],
          },
        } as PlanExecuteState,
        next: 'executor', // Continue to next step
      };
    },
  };

  // =========================================================================
  // Node: Evaluator - Evaluates execution results
  // =========================================================================
  const evaluatorNode = createLLMNode<PlanExecuteState>({
    id: 'evaluator',
    name: 'Result Evaluator',
    config: {
      model: config.model,
      systemPrompt: 'You are an expert at evaluating task execution results.',
      promptTemplate: state => {
        const task =
          (state.data['task'] as string | undefined) ?? 'Unknown task';
        const results =
          (state.data['stepResults'] as StepResult[] | undefined) ?? [];
        const resultsText = results
          .map(
            (r: StepResult) =>
              `Step ${r.stepId}: ${r.success ? 'Success' : 'Failed'}\n${r.success ? JSON.stringify(r.result) : r.error}`
          )
          .join('\n\n');

        return `Original Task: ${task}\n\nExecution Results:\n${resultsText}\n\nEvaluate if the task was completed successfully. If not, identify what needs to be refined.`;
      },
      postProcess: (response, state) => {
        const content = response.message.content.toLowerCase();
        const isComplete =
          content.includes('complete') || content.includes('success');

        return {
          data: {
            ...state.data,
            executionStatus: isComplete
              ? ('complete' as const)
              : ('refining' as const),
            evaluationResult: response.message.content,
          },
        };
      },
      router: (response, _state) => {
        const content = response.message.content.toLowerCase();
        if (content.includes('complete') || content.includes('success')) {
          return 'complete';
        }
        return 'refiner';
      },
    },
  });

  // =========================================================================
  // Node: Refiner - Refines the plan based on execution results
  // =========================================================================
  const refinerNode = createLLMNode<PlanExecuteState>({
    id: 'refiner',
    name: 'Plan Refiner',
    config: {
      model: config.model,
      systemPrompt: config.refinerPrompt ?? DEFAULT_REFINER_PROMPT,
      promptTemplate: state => {
        const task = state.data.task ?? 'Unknown task';
        const plan = (state.data['plan'] as PlanStep[] | undefined) ?? [];
        const results =
          (state.data['stepResults'] as StepResult[] | undefined) ?? [];
        const evaluation =
          (state.data['evaluationResult'] as string | undefined) ?? '';
        const feedback =
          (state.data['planFeedback'] as string | undefined) ?? '';

        return `Original Task: ${task}

Previous Plan:
${plan.map((s: PlanStep, i: number) => `${i + 1}. ${s.description}`).join('\n')}

Execution Results:
${results.map((r: StepResult) => `${r.stepId}: ${r.success ? 'Success' : 'Failed - ' + r.error}`).join('\n')}

Evaluation: ${evaluation}
${feedback ? `Human Feedback: ${feedback}` : ''}

Please refine the plan to address any issues and ensure task completion.`;
      },
      postProcess: (response, state) => {
        const refinedPlan = extractPlanFromResponse(response.message.content);
        const refinementCount =
          ((state.data['refinementCount'] as number | undefined) ?? 0) + 1;

        return {
          data: {
            ...state.data,
            plan: refinedPlan,
            currentStepIndex: 0,
            stepResults: [],
            refinementCount,
            executionStatus: 'planning' as const,
          },
        };
      },
    },
  });

  // =========================================================================
  // Node: Refinement Check - Checks if we've exceeded max refinements
  // =========================================================================
  const refinementCheckNode = createIfElseNode<PlanExecuteState>({
    id: 'refinement-check',
    name: 'Refinement Check',
    condition: {
      type: 'custom',
      evaluate: async (state: PlanExecuteState) => {
        const count = state.data.refinementCount ?? 0;
        const max = state.data.maxRefinements ?? config.maxRefinements ?? 3;
        return count < max;
      },
    },
    ifTrue: 'validator',
    ifFalse: 'failed',
  });

  // =========================================================================
  // Node: Complete - Final success node
  // =========================================================================
  const completeNode = {
    id: 'complete',
    name: 'Complete',
    type: 'end' as const,
    config: {},
    execute: async (
      state: PlanExecuteState,
      context: NodeContext
    ): Promise<NodeResult<PlanExecuteState>> => {
      context.services.logger.info('Workflow completed successfully');

      // Compile final result from step results
      const finalResult = state.data.stepResults?.map(r => r.result);

      return {
        state: {
          ...state,
          data: {
            ...state.data,
            executionStatus: 'complete' as const,
            finalResult,
          },
        } as PlanExecuteState,
        terminate: true,
      };
    },
  };

  // =========================================================================
  // Node: Failed - Final failure node
  // =========================================================================
  const failedNode = {
    id: 'failed',
    name: 'Failed',
    type: 'end' as const,
    config: {},
    execute: async (
      state: PlanExecuteState,
      context: NodeContext
    ): Promise<NodeResult<PlanExecuteState>> => {
      context.services.logger.error('Workflow failed after max refinements');

      return {
        state: {
          ...state,
          data: {
            ...state.data,
            executionStatus: 'failed' as const,
          },
          error: {
            code: 'MAX_REFINEMENTS',
            message: `Failed to complete task after ${state.data.refinementCount} refinement attempts`,
            recoverable: false,
          },
        } as PlanExecuteState,
        terminate: true,
      };
    },
  };

  // =========================================================================
  // Build the graph
  // =========================================================================
  graph
    .addNode('planner', plannerNode)
    .addNode('validator', validatorNode)
    .addNode('executor', executorNode)
    .addNode('evaluator', evaluatorNode)
    .addNode('refiner', refinerNode)
    .addNode('refinement-check', refinementCheckNode)
    .addNode('complete', completeNode)
    .addNode('failed', failedNode);

  if (approvalNode) {
    graph.addNode('approval', approvalNode);
    graph.addNode('approval-router', approvalRouterNode);
  }

  // Add edges
  graph.addEdge('planner', 'validator').addEdge('refiner', 'refinement-check');

  if (config.requireApproval && approvalNode) {
    graph
      .addEdge('validator', 'approval')
      .addEdge('approval', 'approval-router');
  }

  // Set entry point
  graph.setEntryPoint('planner');

  return graph;
}

/**
 * Extract plan from LLM response
 */
function extractPlanFromResponse(content: string): PlanStep[] {
  const steps: PlanStep[] = [];

  // Try to parse JSON if present
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: item.id ?? `step-${index + 1}`,
          description: item.description ?? item.step ?? String(item),
          tool: item.tool,
          toolArgs: item.toolArgs ?? item.args,
          dependsOn: item.dependsOn ?? item.dependencies,
          expectedOutput: item.expectedOutput ?? item.expected,
        }));
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Parse numbered list format
  const lines = content.split('\n');
  let stepIndex = 0;

  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)$/);
    if (match && match[1]) {
      stepIndex++;
      steps.push({
        id: `step-${stepIndex}`,
        description: match[1].trim(),
      });
    }
  }

  return steps;
}

/**
 * Default planner system prompt
 */
const DEFAULT_PLANNER_PROMPT = `You are an expert planner. Given a task, create a detailed step-by-step plan to accomplish it.

Your plan should:
1. Break down the task into clear, actionable steps
2. Identify which tools to use for each step (if applicable)
3. Consider dependencies between steps
4. Be specific about expected outputs

Output your plan as a JSON array of steps, each with:
- id: unique identifier
- description: what this step does
- tool: (optional) tool name to use
- toolArgs: (optional) arguments for the tool
- dependsOn: (optional) array of step IDs this depends on
- expectedOutput: (optional) description of expected result`;

/**
 * Default refiner system prompt
 */
const DEFAULT_REFINER_PROMPT = `You are an expert at analyzing execution results and refining plans.

Based on the execution results and any feedback, create an improved plan that:
1. Addresses any failed steps
2. Incorporates lessons learned
3. Optimizes the approach based on what worked
4. Includes any additional steps needed for success

Output your refined plan in the same JSON format as the original.`;

/**
 * Create a simple task executor graph (simplified version)
 *
 * @example
 * ```typescript
 * const graph = createSimpleTaskGraph({
 *   llmProvider: myProvider,
 *   tools: [searchTool]
 * });
 * ```
 */
export function createSimpleTaskGraph(
  config: Omit<PlanExecuteRefineConfig, 'requireApproval' | 'humanHandler'>
): StateGraph<PlanExecuteState> {
  return createPlanExecuteRefineGraph({
    ...config,
    requireApproval: false,
    maxRefinements: config.maxRefinements ?? 2,
  });
}
