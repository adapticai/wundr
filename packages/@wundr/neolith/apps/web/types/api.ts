/**
 * API Response Types
 *
 * Common type definitions for API responses and data transformations
 */

import type { TaskPriority, TaskStatus } from '@prisma/client';

/**
 * Generic API response structure for dashboard activity
 */
export interface DashboardActivityApiResponse {
  id: string;
  type: string;
  actor: {
    name: string;
    displayName: string;
  };
  target?: {
    type: string;
    name: string;
  } | null;
  content?: string;
  timestamp: string;
}

/**
 * Admin activity API response
 */
export interface AdminActivityApiResponse {
  id: string;
  action: string;
  actorId?: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  ipAddress?: string;
}

/**
 * Orchestrator data from API (Genesis result format)
 * @deprecated Use OrchestratorApiResponse instead
 */
export interface VPApiResponse {
  id?: string;
  title?: string;
  role?: string;
  description?: string;
  discipline?: string;
  status?: string;
  userId?: string;
  identity?: {
    name: string;
    persona?: string;
  };
  coreDirective?: string;
  charter?: {
    mission?: string;
    vision?: string;
    values?: string[];
    expertise?: string[];
  };
  capabilities?: string[] | Record<string, unknown>;
  disciplineIds?: string[];
  modelConfig?: Record<string, unknown>;
  systemPrompt?: string;
  organizationId?: string;
  avatarUrl?: string;
  lastActivityAt?: string | Date;
  messageCount?: number;
  agentCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  user?: {
    bio?: string;
    avatarUrl?: string;
  };
}

/**
 * Orchestrator data from API (Genesis result format)
 */
export interface OrchestratorApiResponse {
  id?: string;
  title?: string;
  role?: string;
  description?: string;
  discipline?: string;
  status?: string;
  userId?: string;
  identity?: {
    name: string;
    persona?: string;
  };
  coreDirective?: string;
  charter?: {
    mission?: string;
    vision?: string;
    values?: string[];
    expertise?: string[];
  };
  capabilities?: string[] | Record<string, unknown>;
  disciplineIds?: string[];
  modelConfig?: Record<string, unknown>;
  systemPrompt?: string;
  organizationId?: string;
  avatarUrl?: string;
  lastActivityAt?: string | Date;
  messageCount?: number;
  agentCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  user?: {
    bio?: string;
    avatarUrl?: string;
  };
}

/**
 * Discipline data from API (Genesis result format)
 */
export interface DisciplineApiResponse {
  id?: string;
  name: string;
  description?: string;
  slug?: string;
  parentVpId?: string;
  hooks?: Array<{
    description: string;
    [key: string]: unknown;
  }>;
  claudeMd?: {
    objectives?: string[];
    [key: string]: unknown;
  };
  agentIds?: string[];
  vpId?: string;
  [key: string]: unknown;
}

/**
 * Agent data from API (Genesis result format)
 */
export interface AgentApiResponse {
  id?: string;
  name: string;
  type?: string;
  description?: string;
  status?: string;
  config?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  charter?: string;
  usedByDisciplines?: string[];
  vpId?: string;
  disciplineId?: string;
  [key: string]: unknown;
}

/**
 * Genesis API result structure
 */
export interface GenesisApiResult {
  orchestrators: VPApiResponse[];
  disciplines: DisciplineApiResponse[];
  agents: AgentApiResponse[];
  [key: string]: unknown;
}

/**
 * Prisma where clause for dynamic queries
 */
export interface PrismaWhereClause {
  [key: string]: unknown;
  vpId?: string; // @deprecated Use orchestratorId instead
  orchestratorId?: string;
  workspaceId?: string;
  status?: {
    in?: TaskStatus[] | string[];
    [key: string]: unknown;
  };
  priority?: {
    in?: TaskPriority[] | string[];
    [key: string]: unknown;
  };
  channelId?: string | { in: string[] };
  assignedToId?: string | null;
}

/**
 * Prisma update data for dynamic updates
 */
export interface PrismaUpdateData {
  [key: string]: unknown;
  status?: TaskStatus | string;
  priority?: TaskPriority | string;
  title?: string;
  description?: string;
  assignedToId?: string | null;
  completedAt?: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Prisma order by clause
 */
export interface PrismaOrderBy {
  [key: string]: 'asc' | 'desc' | PrismaOrderBy;
}

/**
 * Memory check response for Orchestrator memory access
 */
export interface MemoryAccessResponse {
  allowed: boolean;
  memory?: {
    id: string;
    content: string;
    [key: string]: unknown;
  };
}

/**
 * Analytics chart data point
 */
export interface ChartDataPoint {
  [key: string]: string | number | boolean | null | undefined;
}
