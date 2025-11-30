/**
 * @neolith/core - Subagent Type Definitions
 *
 * Type definitions for Subagent entities that perform specialized
 * tasks under Session Manager coordination.
 *
 * @packageDocumentation
 */

import type { AgentStatus, AgentScope } from './agent-enums';

// =============================================================================
// Subagent Types
// =============================================================================

/**
 * Core Subagent entity.
 */
export interface Subagent {
  id: string;
  name: string;
  description?: string | null;
  charterId: string;
  charterData: Record<string, unknown>;
  sessionManagerId?: string | null;
  isGlobal: boolean;
  scope: AgentScope;
  tier: number;
  capabilities: string[];
  mcpTools: string[];
  maxTokensPerTask: number;
  worktreeRequirement: 'none' | 'read' | 'write';
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subagent with related entities.
 */
export interface SubagentWithRelations extends Subagent {
  sessionManager?: {
    id: string;
    name: string;
    orchestratorId: string;
  } | null;
}

// =============================================================================
// CRUD Input Types
// =============================================================================

/**
 * Input for creating a new Subagent.
 */
export interface CreateSubagentInput {
  name: string;
  description?: string;
  charterId: string;
  charterData: Record<string, unknown>;
  sessionManagerId?: string;
  isGlobal?: boolean;
  scope?: AgentScope;
  tier?: number;
  capabilities?: string[];
  mcpTools?: string[];
  maxTokensPerTask?: number;
  worktreeRequirement?: 'none' | 'read' | 'write';
}

/**
 * Input for updating a Subagent.
 */
export interface UpdateSubagentInput {
  name?: string;
  description?: string | null;
  charterData?: Record<string, unknown>;
  sessionManagerId?: string | null;
  isGlobal?: boolean;
  scope?: AgentScope;
  capabilities?: string[];
  mcpTools?: string[];
  maxTokensPerTask?: number;
  worktreeRequirement?: 'none' | 'read' | 'write';
  status?: AgentStatus;
}

/**
 * Options for listing Subagents.
 */
export interface ListSubagentsOptions {
  sessionManagerId?: string;
  scope?: AgentScope;
  tier?: number;
  status?: AgentStatus;
  isGlobal?: boolean;
  includeInactive?: boolean;
  skip?: number;
  take?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'tier';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated Subagent result.
 */
export interface PaginatedSubagentResult {
  data: SubagentWithRelations[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

// =============================================================================
// Predefined Universal Subagents
// =============================================================================

/**
 * Predefined universal subagent configurations.
 * These are available to all session managers by default.
 */
export const UNIVERSAL_SUBAGENTS = {
  researcher: {
    name: 'researcher',
    description: 'Deep-dive information gathering and analysis',
    scope: 'UNIVERSAL' as AgentScope,
    tier: 3,
    capabilities: ['web_search', 'document_analysis', 'data_extraction'],
    mcpTools: ['web_fetch', 'file_search', 'rag_search'],
    worktreeRequirement: 'read' as const,
  },
  scribe: {
    name: 'scribe',
    description: 'Documentation writing and knowledge capture',
    scope: 'UNIVERSAL' as AgentScope,
    tier: 3,
    capabilities: ['documentation', 'summarization', 'formatting'],
    mcpTools: ['file_write', 'markdown_render'],
    worktreeRequirement: 'write' as const,
  },
  reviewer: {
    name: 'reviewer',
    description: 'Code review and quality assurance',
    scope: 'UNIVERSAL' as AgentScope,
    tier: 3,
    capabilities: ['code_review', 'style_check', 'security_scan'],
    mcpTools: ['file_read', 'git_diff', 'lint_check'],
    worktreeRequirement: 'read' as const,
  },
  tester: {
    name: 'tester',
    description: 'Test creation and execution',
    scope: 'UNIVERSAL' as AgentScope,
    tier: 3,
    capabilities: ['test_generation', 'test_execution', 'coverage_analysis'],
    mcpTools: ['test_runner', 'coverage_report'],
    worktreeRequirement: 'write' as const,
  },
  'code-surgeon': {
    name: 'code-surgeon',
    description: 'Precise code modifier for refactoring and bug fixing',
    scope: 'UNIVERSAL' as AgentScope,
    tier: 3,
    capabilities: ['refactoring', 'bug_fixing', 'implementation'],
    mcpTools: ['edit', 'bash', 'git'],
    worktreeRequirement: 'write' as const,
  },
} as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a valid Subagent.
 */
export function isSubagent(value: unknown): value is Subagent {
  if (typeof value !== 'object' || value === null) {
return false;
}
  const sa = value as Record<string, unknown>;
  return (
    typeof sa.id === 'string' &&
    typeof sa.name === 'string' &&
    typeof sa.charterId === 'string' &&
    typeof sa.tier === 'number'
  );
}
