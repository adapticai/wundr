/**
 * Task Planner for AI Reasoning Engine
 *
 * Converts high-level goals into structured, dependency-aware execution plans
 * using the ReasoningEngine. Plans can be iteratively refined based on
 * feedback and queried for the next actionable step.
 */

import { randomUUID } from 'crypto';

import type { ReasoningEngine } from './reasoning-engine';

// =============================================================================
// Types
// =============================================================================

/**
 * Constraints that govern how a plan may be structured.
 */
export interface PlanConstraints {
  /** Hard upper bound on the number of plan steps. */
  maxSteps?: number;
  /** Names of capabilities that must be available for the plan to be executable. */
  requiredCapabilities?: string[];
  /**
   * Rough wall-clock budget for the entire plan in milliseconds.
   * Used as a hint to the LLM when estimating step durations.
   */
  timeBudgetMs?: number;
  /** Free-text restrictions appended verbatim to the planning prompt. */
  additionalConstraints?: string[];
}

/**
 * A single executable step within a TaskPlan.
 */
export interface PlanStep {
  /** Unique identifier for this step. */
  id: string;
  /** Human-readable description of the work to be done. */
  description: string;
  /** IDs of steps that must complete before this one can start. */
  dependencies: string[];
  /** Optional agent or service identifier that should perform this step. */
  assignee?: string;
  /** Current execution status. */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Output produced by this step once completed. */
  output?: unknown;
}

/**
 * A complete, dependency-aware execution plan.
 */
export interface TaskPlan {
  /** Unique identifier for this plan. */
  id: string;
  /** The high-level goal this plan is intended to achieve. */
  goal: string;
  /** Ordered (by dependency) list of steps. */
  steps: PlanStep[];
  /**
   * Rough estimate of the total duration in milliseconds.
   * Derived from the LLM's output; may be absent if the LLM did not provide one.
   */
  estimatedDuration?: number;
  /** Names of capabilities required to execute this plan end-to-end. */
  requiredCapabilities: string[];
  /** When this plan was created. */
  createdAt: Date;
}

// =============================================================================
// Planner
// =============================================================================

/**
 * High-level task planner backed by a ReasoningEngine.
 *
 * @example
 * ```typescript
 * const engine  = new ReasoningEngine(client, { model: 'gpt-4o' });
 * const planner = new Planner(engine);
 *
 * const plan = await planner.createPlan('Rebalance the hedge-fund portfolio', {
 *   maxSteps: 10,
 *   requiredCapabilities: ['market-data', 'order-execution'],
 * });
 *
 * let next = await planner.suggestNextStep(plan);
 * while (next) {
 *   await execute(next);
 *   next.status = 'completed';
 *   next = await planner.suggestNextStep(plan);
 * }
 * ```
 */
export class Planner {
  constructor(private readonly engine: ReasoningEngine) {}

  // ===========================================================================
  // Plan Creation
  // ===========================================================================

  /**
   * Creates a structured execution plan for the provided goal.
   *
   * The engine reasons about the goal and constraints, then produces a
   * numbered step list which is parsed into a TaskPlan.
   *
   * @param goal - Natural-language description of what needs to be accomplished.
   * @param constraints - Optional constraints that shape the plan.
   * @returns A fully populated TaskPlan ready for execution.
   */
  async createPlan(
    goal: string,
    constraints: PlanConstraints = {}
  ): Promise<TaskPlan> {
    const constraintLines = this.buildConstraintLines(constraints);
    const prompt = this.buildPlanningPrompt(goal, constraintLines);

    const result = await this.engine.reason(prompt, {
      goal,
      constraints,
    });

    const steps = this.parseSteps(result.decision);
    const capabilities = this.extractCapabilities(result.decision, constraints);

    return {
      id: randomUUID(),
      goal,
      steps,
      estimatedDuration: constraints.timeBudgetMs,
      requiredCapabilities: capabilities,
      createdAt: new Date(),
    };
  }

  // ===========================================================================
  // Plan Refinement
  // ===========================================================================

  /**
   * Refines an existing plan based on textual feedback.
   *
   * The original plan steps are serialised and included in the prompt so the
   * engine can reason about what to change. Returns a new plan rather than
   * mutating the original.
   *
   * @param plan - The existing TaskPlan to refine.
   * @param feedback - Natural-language feedback describing what to change.
   * @returns A new TaskPlan incorporating the requested changes.
   */
  async refinePlan(plan: TaskPlan, feedback: string): Promise<TaskPlan> {
    const existingStepsSummary = plan.steps
      .map((s, i) => `${i + 1}. [${s.status}] ${s.description}`)
      .join('\n');

    const prompt =
      `You have an existing execution plan for the goal: "${plan.goal}".\n\n` +
      `Current steps:\n${existingStepsSummary}\n\n` +
      `Feedback to incorporate:\n${feedback}\n\n` +
      `Produce a revised numbered list of steps that addresses the feedback. ` +
      `Preserve completed steps where possible. ` +
      `Return only the revised step list in the same numbered format.`;

    const result = await this.engine.reason(prompt, {
      originalGoal: plan.goal,
      existingStepCount: plan.steps.length,
      feedback,
    });

    const revisedSteps = this.parseSteps(result.decision);
    const capabilities = this.extractCapabilities(result.decision, {
      requiredCapabilities: plan.requiredCapabilities,
    });

    return {
      id: randomUUID(),
      goal: plan.goal,
      steps: revisedSteps,
      estimatedDuration: plan.estimatedDuration,
      requiredCapabilities: capabilities,
      createdAt: new Date(),
    };
  }

  // ===========================================================================
  // Step Suggestion
  // ===========================================================================

  /**
   * Identifies the next actionable step in a plan.
   *
   * A step is actionable when:
   * - Its status is 'pending'.
   * - All steps it depends on have status 'completed'.
   *
   * If no actionable step exists (all done, all blocked, or plan is empty),
   * `null` is returned.
   *
   * @param plan - The TaskPlan to inspect.
   * @returns The next PlanStep to execute, or null if none is available.
   */
  async suggestNextStep(plan: TaskPlan): Promise<PlanStep | null> {
    if (plan.steps.length === 0) {
      return null;
    }

    const completedIds = new Set(
      plan.steps.filter(s => s.status === 'completed').map(s => s.id)
    );

    // Find the first pending step whose dependencies are all satisfied
    const actionable = plan.steps.find(step => {
      if (step.status !== 'pending') {
        return false;
      }

      return step.dependencies.every(depId => completedIds.has(depId));
    });

    return actionable ?? null;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Builds the initial planning prompt string.
   */
  private buildPlanningPrompt(goal: string, constraintLines: string[]): string {
    const constraintSection =
      constraintLines.length > 0
        ? `\n\nConstraints:\n${constraintLines.join('\n')}`
        : '';

    return (
      `Create a detailed, dependency-aware execution plan for the following goal.\n\n` +
      `Goal: ${goal}${constraintSection}\n\n` +
      `Format your response as a numbered list where each step follows this pattern:\n` +
      `N. <description> [depends: <step-numbers-or-none>] [capability: <capability-name-or-none>]\n\n` +
      `Example:\n` +
      `1. Fetch current market prices [depends: none] [capability: market-data]\n` +
      `2. Calculate target allocation [depends: 1] [capability: none]\n` +
      `3. Submit rebalancing orders [depends: 2] [capability: order-execution]\n\n` +
      `Be specific and actionable. Keep the plan focused on the goal.`
    );
  }

  /**
   * Converts constraint fields into human-readable bullet lines.
   */
  private buildConstraintLines(constraints: PlanConstraints): string[] {
    const lines: string[] = [];

    if (constraints.maxSteps) {
      lines.push(`- Maximum ${constraints.maxSteps} steps`);
    }

    if (
      constraints.requiredCapabilities &&
      constraints.requiredCapabilities.length > 0
    ) {
      lines.push(
        `- Required capabilities: ${constraints.requiredCapabilities.join(', ')}`
      );
    }

    if (constraints.timeBudgetMs) {
      const seconds = Math.round(constraints.timeBudgetMs / 1000);
      lines.push(`- Time budget: approximately ${seconds} seconds`);
    }

    if (constraints.additionalConstraints) {
      for (const c of constraints.additionalConstraints) {
        lines.push(`- ${c}`);
      }
    }

    return lines;
  }

  /**
   * Parses a numbered step list from the LLM's decision text.
   *
   * Expected format per line:
   *   N. <description> [depends: <n,m,...|none>] [capability: <name|none>]
   *
   * The parser is lenient: any line that starts with a number followed by
   * a dot/parenthesis is treated as a step, with dependency and capability
   * annotations extracted via regex when present.
   */
  private parseSteps(text: string): PlanStep[] {
    const steps: PlanStep[] = [];
    const idByIndex = new Map<number, string>();

    // Match lines starting with a number (e.g. "1.", "2)", "  3.")
    const lines = text.split('\n').filter(l => /^\s*\d+[\.)]\s+/.test(l));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const stepId = randomUUID();
      idByIndex.set(i + 1, stepId);

      // Extract description: everything after the leading "N. " up to the first "["
      const descMatch = line.match(/^\d+[\.)]\s+([^\[]+)/);
      const rawDescription = descMatch ? descMatch[1].trim() : line;

      // Extract depends annotation: [depends: 1,2,3] or [depends: none]
      const dependsMatch = line.match(/\[depends:\s*([^\]]+)\]/i);
      const dependsRaw = dependsMatch
        ? dependsMatch[1].trim().toLowerCase()
        : 'none';

      // Parse dependency step indices (we resolve to IDs after all steps are created)
      const dependencyIndices: number[] =
        dependsRaw === 'none' || dependsRaw === ''
          ? []
          : dependsRaw
              .split(',')
              .map(s => parseInt(s.trim(), 10))
              .filter(n => !isNaN(n));

      // Extract capability annotation: [capability: market-data] or [capability: none]
      const capabilityMatch = line.match(/\[capability:\s*([^\]]+)\]/i);
      const capability = capabilityMatch
        ? capabilityMatch[1].trim().toLowerCase()
        : undefined;

      steps.push({
        id: stepId,
        description: rawDescription,
        dependencies: dependencyIndices as unknown as string[], // resolved below
        assignee: capability && capability !== 'none' ? capability : undefined,
        status: 'pending',
      });
    }

    // Resolve dependency indices to actual UUIDs
    for (let i = 0; i < steps.length; i++) {
      const raw = steps[i].dependencies as unknown as number[];
      steps[i].dependencies = raw
        .map(idx => idByIndex.get(idx))
        .filter((id): id is string => id !== undefined);
    }

    // Fallback: if no steps were parsed, create a single placeholder step
    if (steps.length === 0) {
      steps.push({
        id: randomUUID(),
        description: text.trim() || 'Execute plan',
        dependencies: [],
        status: 'pending',
      });
    }

    return steps;
  }

  /**
   * Extracts capability names mentioned in the plan text and merges them
   * with any already declared in the constraints.
   */
  private extractCapabilities(
    text: string,
    constraints: PlanConstraints
  ): string[] {
    const found = new Set<string>(constraints.requiredCapabilities ?? []);

    // Extract all [capability: X] annotations, ignoring "none"
    const matches = text.matchAll(/\[capability:\s*([^\]]+)\]/gi);
    for (const match of matches) {
      const cap = match[1].trim().toLowerCase();
      if (cap && cap !== 'none') {
        found.add(cap);
      }
    }

    return Array.from(found);
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a Planner backed by the provided ReasoningEngine.
 *
 * @param engine - The ReasoningEngine instance to use for plan generation.
 */
export function createPlanner(engine: ReasoningEngine): Planner {
  return new Planner(engine);
}
