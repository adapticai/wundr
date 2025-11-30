/**
 * List Federated Orchestrators Tool
 *
 * Lists all federated orchestrators across the distributed cluster.
 * Supports filtering by region, capability, and status.
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const listFederatedOrchestratorsInputSchema = z.object({
  region: z.string().optional().describe('Filter by geographic region (e.g., us-east-1, eu-west-1)'),
  capability: z.string().optional().describe('Filter by orchestrator capability (e.g., nlp, vision, code-gen)'),
  status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'DEGRADED']).optional().describe('Filter by orchestrator status'),
  limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum number of orchestrators to return'),
  offset: z.number().int().min(0).optional().default(0).describe('Pagination offset'),
});

export type ListFederatedOrchestratorsInput = z.infer<typeof listFederatedOrchestratorsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface FederatedOrchestratorCapabilities {
  nlp?: boolean;
  vision?: boolean;
  codeGen?: boolean;
  dataAnalysis?: boolean;
  multimodal?: boolean;
  custom?: string[];
}

export interface FederatedOrchestratorMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  uptime: number;
}

export interface FederatedOrchestrator {
  id: string;
  name: string;
  region: string;
  endpoint: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'DEGRADED';
  capabilities: FederatedOrchestratorCapabilities;
  metrics: FederatedOrchestratorMetrics;
  load: {
    current: number;
    maximum: number;
    percentage: number;
  };
  version: string;
  lastHeartbeat: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListFederatedOrchestratorsResponse {
  orchestrators: FederatedOrchestrator[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// Tool Result Type
// ============================================================================

export interface McpToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function listFederatedOrchestrators(
  apiClient: NeolithAPIClient,
  input: ListFederatedOrchestratorsInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {
      limit: (input.limit ?? 20).toString(),
      offset: (input.offset ?? 0).toString(),
    };

    if (input.region) params.region = input.region;
    if (input.capability) params.capability = input.capability;
    if (input.status) params.status = input.status;

    // Make API request to federation endpoint
    const path = '/api/federation/orchestrators';
    const response = await apiClient.get<ListFederatedOrchestratorsResponse>(path, params);

    const onlineCount = response.orchestrators.filter(o => o.status === 'ONLINE').length;
    const busyCount = response.orchestrators.filter(o => o.status === 'BUSY').length;

    return {
      success: true,
      message: `Found ${response.orchestrators.length} federated orchestrator(s) - ${onlineCount} online, ${busyCount} busy`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to list federated orchestrators: ${errorMessage}`,
      error: {
        code: 'LIST_FEDERATED_ORCHESTRATORS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
