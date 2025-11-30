/**
 * @neolith/core - Session Manager Type Definitions
 *
 * Session Managers represent Claude Code/Flow sessions that can spawn up to 20 subagents.
 * Per THREE-TIER-ARCHITECTURE: 10 sessions per orchestrator, each dynamically compiled
 * with CLAUDE.md, workflow files, and subagent configurations.
 */

// =============================================================================
// Enums (must match Prisma)
// =============================================================================

export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';

export type AgentScope = 'UNIVERSAL' | 'DISCIPLINE' | 'WORKSPACE' | 'PRIVATE';

// =============================================================================
// Core Types
// =============================================================================

export interface SessionManagerGlobalConfig {
  invokeableBy: 'all' | string[];
}

export interface SessionManagerWorktreeConfig {
  enabled: boolean;
  basePath?: string;
  pattern?: string;
  fractionalMode?: boolean;  // Read-only vs write-access separation
}

export interface SessionManager {
  id: string;
  name: string;
  description?: string | null;
  charterId: string;
  charterData: Record<string, unknown>;
  disciplineId?: string | null;
  orchestratorId: string;
  isGlobal: boolean;
  globalConfig?: SessionManagerGlobalConfig | null;
  status: AgentStatus;
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
  worktreeConfig?: SessionManagerWorktreeConfig | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionManagerWithRelations extends SessionManager {
  orchestrator?: {
    id: string;
    userId: string;
    discipline?: string;
  };
  subagents?: Array<{
    id: string;
    name: string;
    status: AgentStatus;
    tier: number;
  }>;
}

// =============================================================================
// CRUD Input Types
// =============================================================================

export interface CreateSessionManagerInput {
  name: string;
  description?: string;
  charterId: string;
  charterData: Record<string, unknown>;
  disciplineId?: string;
  orchestratorId: string;
  isGlobal?: boolean;
  globalConfig?: SessionManagerGlobalConfig;
  maxConcurrentSubagents?: number;
  tokenBudgetPerHour?: number;
  worktreeConfig?: SessionManagerWorktreeConfig;
}

export interface UpdateSessionManagerInput {
  name?: string;
  description?: string | null;
  charterData?: Record<string, unknown>;
  isGlobal?: boolean;
  globalConfig?: SessionManagerGlobalConfig | null;
  status?: AgentStatus;
  maxConcurrentSubagents?: number;
  tokenBudgetPerHour?: number;
  worktreeConfig?: SessionManagerWorktreeConfig | null;
}

export interface ListSessionManagersOptions {
  orchestratorId?: string;
  disciplineId?: string;
  status?: AgentStatus;
  isGlobal?: boolean;
  includeInactive?: boolean;
  skip?: number;
  take?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedSessionManagerResult {
  data: SessionManagerWithRelations[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isSessionManager(obj: unknown): obj is SessionManager {
  if (!obj || typeof obj !== 'object') return false;
  const sm = obj as Partial<SessionManager>;

  return (
    typeof sm.id === 'string' &&
    typeof sm.name === 'string' &&
    typeof sm.charterId === 'string' &&
    typeof sm.orchestratorId === 'string' &&
    typeof sm.isGlobal === 'boolean' &&
    typeof sm.status === 'string' &&
    typeof sm.maxConcurrentSubagents === 'number' &&
    typeof sm.tokenBudgetPerHour === 'number' &&
    sm.createdAt instanceof Date &&
    sm.updatedAt instanceof Date
  );
}

// =============================================================================
// Legacy Types for Backward Compatibility
// =============================================================================

/**
 * @deprecated Use SessionManager instead
 */
export interface SessionManagerLimits {
  maxConcurrentSubagents: number;
  tokenBudgetPerHour: number;
}
