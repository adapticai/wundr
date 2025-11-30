/**
 * Store Orchestrator Memory Tool
 *
 * Store a new memory entry for a specific orchestrator.
 * POST /api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/memory
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { OrchestratorMemory } from './get-orchestrator-memory';

// ============================================================================
// Input Schema
// ============================================================================

export const storeOrchestratorMemoryInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug'),
  orchestratorId: z.string().describe('The orchestrator ID'),
  memoryType: z.enum(['conversation', 'task_completion', 'learned_pattern', 'preference']).describe('Type of memory'),
  content: z.string().min(1).describe('Memory content text'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata as JSON object'),
  importance: z.number().min(0).max(1).optional().describe('Importance score (0.0-1.0, default: 0.5)'),
  expiresAt: z.string().datetime().optional().describe('Expiration date (ISO 8601 format)'),
});

export type StoreOrchestratorMemoryInput = z.infer<typeof storeOrchestratorMemoryInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface StoreOrchestratorMemoryResponse {
  data: OrchestratorMemory;
  message: string;
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

export async function storeOrchestratorMemory(
  apiClient: NeolithAPIClient,
  input: StoreOrchestratorMemoryInput
): Promise<McpToolResult> {
  try {
    const { workspaceSlug, orchestratorId, ...memoryData } = input;

    // Make API request
    const path = `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/memory`;
    const response = await apiClient.post<StoreOrchestratorMemoryResponse>(path, memoryData);

    return {
      success: true,
      message: response.message || `Successfully stored memory for orchestrator ${orchestratorId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to store orchestrator memory: ${errorMessage}`,
      error: {
        code: 'STORE_ORCHESTRATOR_MEMORY_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
