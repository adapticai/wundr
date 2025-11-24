/**
 * @wundr/crew-orchestrator - CrewAI-style Role-Based Multi-Agent Team Orchestration
 *
 * This package provides a comprehensive framework for orchestrating multi-agent teams
 * using role-based coordination patterns inspired by CrewAI. It supports sequential,
 * hierarchical, and consensus-based process execution.
 *
 * @example
 * ```typescript
 * import { AgentCrew, CrewMemberInput, TaskInput } from '@wundr.io/crew-orchestrator';
 *
 * // Define crew members
 * const members: CrewMemberInput[] = [
 *   {
 *     name: 'Research Analyst',
 *     role: 'researcher',
 *     goal: 'Find and analyze relevant information',
 *     capabilities: ['search', 'analysis', 'summarization'],
 *   },
 *   {
 *     name: 'Technical Writer',
 *     role: 'writer',
 *     goal: 'Create clear and comprehensive documentation',
 *     capabilities: ['writing', 'editing', 'formatting'],
 *   },
 *   {
 *     name: 'Team Manager',
 *     role: 'manager',
 *     goal: 'Ensure quality and coordinate team efforts',
 *     capabilities: ['review', 'coordination', 'delegation'],
 *   },
 * ];
 *
 * // Create crew
 * const crew = new AgentCrew({
 *   name: 'Documentation Team',
 *   description: 'A team for creating technical documentation',
 *   members,
 *   process: 'hierarchical',
 * });
 *
 * await crew.initialize();
 *
 * // Define tasks
 * const tasks: TaskInput[] = [
 *   {
 *     title: 'Research Topic',
 *     description: 'Research the API documentation patterns',
 *     expectedOutput: 'Research summary document',
 *     priority: 'high',
 *   },
 *   {
 *     title: 'Write Documentation',
 *     description: 'Create comprehensive API documentation',
 *     expectedOutput: 'Complete API documentation',
 *     priority: 'high',
 *     dependencies: [], // Will depend on research task
 *   },
 * ];
 *
 * // Execute crew
 * const result = await crew.kickoff(tasks);
 * console.log('Crew completed:', result.success);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Main Orchestration Classes
// =============================================================================

// =============================================================================
// Utility Functions
// =============================================================================

import { AgentCrew } from './crew';
import { DelegationManager } from './delegation';
import { ReviewLoopManager } from './review-loop';
import { TaskManager } from './task-manager';

import type { CrewMemberInput, ProcessType } from './types';

export { AgentCrew } from './crew';
export type { AgentCrewOptions } from './crew';

export { TaskManager } from './task-manager';
export type { TaskManagerOptions } from './task-manager';

export { DelegationManager } from './delegation';
export type { DelegationManagerOptions } from './delegation';

export { ReviewLoopManager } from './review-loop';
export type { ReviewLoopOptions } from './review-loop';

// =============================================================================
// Type Definitions - Zod Schemas (runtime values)
// =============================================================================

export {
  // Zod Schemas for validation
  CrewMemberRoleSchema,
  CrewMemberStatusSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
  ProcessTypeSchema,
  ReviewDecisionSchema,
  CrewMemberSchema,
  TaskSchema,
  TaskResultSchema,
  StepCallbackDataSchema,
  TaskCallbackDataSchema,
  CrewConfigSchema,
  CrewResultSchema,
  // Error Handling (class is a runtime value)
  CrewErrorCode,
  CrewError,
} from './types';

// =============================================================================
// Type Definitions - TypeScript Types (type-only exports)
// =============================================================================

export type {
  // TypeScript Types
  CrewMemberRole,
  CrewMemberStatus,
  TaskPriority,
  TaskStatus,
  ProcessType,
  ReviewDecision,
  CrewMember,
  CrewMemberInput,
  Task,
  TaskInput,
  TaskResult,
  CrewConfig,
  CrewConfigInput,
  CrewResult,
  StepCallbackData,
  TaskCallbackData,
  // Additional Interfaces
  DelegationRequest,
  DelegationResponse,
  ReviewRequest,
  ReviewFeedback,
  ExecutionContext,
  ExecutionMetrics,
  CrewEvent,
  CrewEventType,
  // Function Types
  TaskExecutor,
  DelegationStrategy,
  ReviewStrategy,
} from './types';

/**
 * Creates a simple crew with default configuration
 *
 * @param name - Crew name
 * @param members - Array of member inputs
 * @param process - Process type (default: 'sequential')
 * @returns Configured AgentCrew instance
 *
 * @example
 * ```typescript
 * const crew = createSimpleCrew('My Crew', [
 *   { name: 'Worker', role: 'developer', goal: 'Write code', capabilities: ['coding'] },
 * ]);
 * ```
 */
export function createSimpleCrew(
  name: string,
  members: CrewMemberInput[],
  process: ProcessType = 'sequential',
): AgentCrew {
  return new AgentCrew({
    name,
    members,
    process,
  });
}

/**
 * Creates a hierarchical crew with a manager
 *
 * @param name - Crew name
 * @param manager - Manager member configuration
 * @param workers - Array of worker member inputs
 * @returns Configured AgentCrew instance with hierarchical process
 *
 * @example
 * ```typescript
 * const crew = createHierarchicalCrew(
 *   'Managed Team',
 *   { name: 'Manager', role: 'manager', goal: 'Oversee work', capabilities: ['review'] },
 *   [
 *     { name: 'Dev 1', role: 'developer', goal: 'Code', capabilities: ['coding'] },
 *     { name: 'Dev 2', role: 'developer', goal: 'Code', capabilities: ['coding'] },
 *   ]
 * );
 * ```
 */
export function createHierarchicalCrew(
  name: string,
  manager: CrewMemberInput,
  workers: CrewMemberInput[],
): AgentCrew {
  return new AgentCrew({
    name,
    members: [manager, ...workers],
    process: 'hierarchical',
  });
}

/**
 * Creates a consensus-based crew
 *
 * @param name - Crew name
 * @param members - Array of member inputs (minimum 3 recommended)
 * @returns Configured AgentCrew instance with consensus process
 *
 * @example
 * ```typescript
 * const crew = createConsensusCrew('Review Board', [
 *   { name: 'Reviewer 1', role: 'reviewer', goal: 'Review', capabilities: ['review'] },
 *   { name: 'Reviewer 2', role: 'reviewer', goal: 'Review', capabilities: ['review'] },
 *   { name: 'Reviewer 3', role: 'reviewer', goal: 'Review', capabilities: ['review'] },
 * ]);
 * ```
 */
export function createConsensusCrew(
  name: string,
  members: CrewMemberInput[],
): AgentCrew {
  if (members.length < 3) {
    console.warn('Consensus crews work best with at least 3 members');
  }
  return new AgentCrew({
    name,
    members,
    process: 'consensus',
  });
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Default export containing all main classes
 */
export default {
  AgentCrew,
  TaskManager,
  DelegationManager,
  ReviewLoopManager,
  createSimpleCrew,
  createHierarchicalCrew,
  createConsensusCrew,
};
