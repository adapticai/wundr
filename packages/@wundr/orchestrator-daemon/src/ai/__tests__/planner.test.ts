/**
 * Planner Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Planner, createPlanner } from '../planner';

import type { ReasoningEngine } from '../reasoning-engine';
import type { ReasoningResult } from '../reasoning-engine';
import type { TaskPlan, PlanStep } from '../planner';

// =============================================================================
// Mock ReasoningEngine factory
// =============================================================================

function createMockReasoningEngine(): ReasoningEngine & {
  reason: ReturnType<typeof vi.fn>;
} {
  return {
    reason: vi.fn<
      [string, Record<string, unknown>?],
      Promise<ReasoningResult>
    >(),
    planTask: vi.fn(),
    evaluateAction: vi.fn(),
    summarize: vi.fn(),
  } as unknown as ReasoningEngine & { reason: ReturnType<typeof vi.fn> };
}

/**
 * Builds a minimal ReasoningResult whose decision text contains
 * the given numbered step lines.
 */
function makeReasoningResult(decision: string): ReasoningResult {
  return {
    decision,
    confidence: 0.85,
    steps: [
      {
        id: 'step-1',
        type: 'thought',
        content: 'Thinking...',
        timestamp: new Date(),
      },
      {
        id: 'step-2',
        type: 'decision',
        content: decision,
        timestamp: new Date(),
      },
    ],
    totalTokensUsed: 50,
    durationMs: 100,
  };
}

/**
 * Builds a TaskPlan with the specified steps for testing suggestNextStep.
 */
function makePlan(steps: PlanStep[], goal = 'Test goal'): TaskPlan {
  return {
    id: 'plan-1',
    goal,
    steps,
    requiredCapabilities: [],
    createdAt: new Date(),
  };
}

function makeStep(
  id: string,
  status: PlanStep['status'],
  dependencies: string[] = []
): PlanStep {
  return {
    id,
    description: `Step ${id}`,
    dependencies,
    status,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Planner', () => {
  let mockEngine: ReturnType<typeof createMockReasoningEngine>;
  let planner: Planner;

  beforeEach(() => {
    mockEngine = createMockReasoningEngine();
    planner = new Planner(mockEngine);
  });

  // ---------------------------------------------------------------------------
  // createPlan()
  // ---------------------------------------------------------------------------

  describe('createPlan', () => {
    it('should produce a TaskPlan with parsed steps', async () => {
      mockEngine.reason.mockResolvedValueOnce(
        makeReasoningResult(
          '1. Fetch market data [depends: none] [capability: market-data]\n' +
            '2. Calculate allocation [depends: 1] [capability: none]\n' +
            '3. Execute trades [depends: 2] [capability: order-execution]'
        )
      );

      const plan = await planner.createPlan('Rebalance portfolio');

      expect(plan).toHaveProperty('id');
      expect(plan.goal).toBe('Rebalance portfolio');
      expect(plan.steps).toHaveLength(3);
      expect(plan.steps[0].description).toContain('Fetch market data');
      expect(plan.steps[0].dependencies).toHaveLength(0);
      expect(plan.steps[1].dependencies).toHaveLength(1);
      expect(plan.steps[2].dependencies).toHaveLength(1);
      expect(plan.requiredCapabilities).toContain('market-data');
      expect(plan.requiredCapabilities).toContain('order-execution');
      expect(plan.createdAt).toBeInstanceOf(Date);
    });

    it('should pass constraints to the reasoning engine', async () => {
      mockEngine.reason.mockResolvedValueOnce(
        makeReasoningResult('1. Single step [depends: none]')
      );

      await planner.createPlan('Simple task', {
        maxSteps: 5,
        requiredCapabilities: ['data-fetch'],
        timeBudgetMs: 60_000,
      });

      expect(mockEngine.reason).toHaveBeenCalledTimes(1);
      const prompt = mockEngine.reason.mock.calls[0][0] as string;
      expect(prompt).toContain('Maximum 5 steps');
      expect(prompt).toContain('data-fetch');
      expect(prompt).toContain('60 seconds');
    });

    it('should create a fallback step when LLM returns unparseable text', async () => {
      mockEngine.reason.mockResolvedValueOnce(
        makeReasoningResult('Just do the thing, no numbered steps here.')
      );

      const plan = await planner.createPlan('Vague goal');

      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].description).toContain('Just do the thing');
      expect(plan.steps[0].status).toBe('pending');
    });
  });

  // ---------------------------------------------------------------------------
  // refinePlan()
  // ---------------------------------------------------------------------------

  describe('refinePlan', () => {
    it('should produce a new plan incorporating feedback', async () => {
      const originalPlan = makePlan(
        [makeStep('s1', 'completed'), makeStep('s2', 'pending', ['s1'])],
        'Original goal'
      );

      mockEngine.reason.mockResolvedValueOnce(
        makeReasoningResult(
          '1. Fetch data (already done) [depends: none]\n' +
            '2. Validate data [depends: 1]\n' +
            '3. Process data [depends: 2]'
        )
      );

      const refined = await planner.refinePlan(
        originalPlan,
        'Add a validation step'
      );

      expect(refined.id).not.toBe(originalPlan.id);
      expect(refined.goal).toBe('Original goal');
      expect(refined.steps).toHaveLength(3);

      // Verify the feedback was included in the prompt
      const prompt = mockEngine.reason.mock.calls[0][0] as string;
      expect(prompt).toContain('Add a validation step');
      expect(prompt).toContain('[completed]');
    });
  });

  // ---------------------------------------------------------------------------
  // suggestNextStep()
  // ---------------------------------------------------------------------------

  describe('suggestNextStep', () => {
    it('should return the first pending step with satisfied dependencies', async () => {
      const plan = makePlan([
        makeStep('s1', 'completed'),
        makeStep('s2', 'pending', ['s1']),
        makeStep('s3', 'pending', ['s2']),
      ]);

      const next = await planner.suggestNextStep(plan);

      expect(next).not.toBeNull();
      expect(next!.id).toBe('s2');
    });

    it('should return null when all steps are completed', async () => {
      const plan = makePlan([
        makeStep('s1', 'completed'),
        makeStep('s2', 'completed', ['s1']),
      ]);

      const next = await planner.suggestNextStep(plan);

      expect(next).toBeNull();
    });

    it('should return null when remaining steps are blocked by dependencies', async () => {
      const plan = makePlan([
        makeStep('s1', 'in_progress'),
        makeStep('s2', 'pending', ['s1']),
        makeStep('s3', 'pending', ['s2']),
      ]);

      const next = await planner.suggestNextStep(plan);

      expect(next).toBeNull();
    });

    it('should return null for an empty plan', async () => {
      const plan = makePlan([]);

      const next = await planner.suggestNextStep(plan);

      expect(next).toBeNull();
    });

    it('should return a step with no dependencies when it is pending', async () => {
      const plan = makePlan([
        makeStep('s1', 'pending'),
        makeStep('s2', 'pending', ['s1']),
      ]);

      const next = await planner.suggestNextStep(plan);

      expect(next).not.toBeNull();
      expect(next!.id).toBe('s1');
    });

    it('should skip failed steps and find the next actionable one', async () => {
      const plan = makePlan([
        makeStep('s1', 'completed'),
        makeStep('s2', 'failed', ['s1']),
        makeStep('s3', 'pending', ['s1']),
      ]);

      const next = await planner.suggestNextStep(plan);

      expect(next).not.toBeNull();
      expect(next!.id).toBe('s3');
    });
  });

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  describe('createPlanner', () => {
    it('should return a Planner instance', () => {
      const created = createPlanner(mockEngine);
      expect(created).toBeInstanceOf(Planner);
    });
  });
});
