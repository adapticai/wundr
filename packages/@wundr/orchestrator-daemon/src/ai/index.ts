/**
 * AI Module for Orchestrator Daemon
 *
 * Exports the reasoning engine, tool registry, and task planner used
 * by the orchestrator to drive autonomous decision-making and planning.
 */

// ---------------------------------------------------------------------------
// Reasoning Engine
// ---------------------------------------------------------------------------

export {
  ReasoningEngine,
  createReasoningEngine,
} from './reasoning-engine';

export type {
  ReasoningConfig,
  ReasoningStep,
  ReasoningResult,
  ActionEvaluation,
} from './reasoning-engine';

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

export {
  DefaultToolRegistry,
  createToolRegistry,
} from './tool-registry';

export type {
  ToolHandler,
  ToolDescription,
  ToolRegistry,
} from './tool-registry';

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export {
  Planner,
  createPlanner,
} from './planner';

export type {
  PlanConstraints,
  PlanStep,
  TaskPlan,
} from './planner';
