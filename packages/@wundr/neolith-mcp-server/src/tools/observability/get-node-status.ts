/**
 * Get Node Status Tool
 *
 * Get the status of distributed nodes in the system.
 * If nodeId is provided, returns status for that specific node.
 * Otherwise, returns status for all nodes.
 * GET /api/observability/nodes/[nodeId]
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getNodeStatusInputSchema = z.object({
  nodeId: z.string().optional().describe('Optional node ID to get specific node status'),
});

export type GetNodeStatusInput = z.infer<typeof getNodeStatusInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface NodeStatus {
  nodeId: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  activeSessions: number;
  cpuLoad: number; // Percentage
  memoryUsage: number; // Percentage
  uptime: number; // Milliseconds
  lastHeartbeat: string;
  region?: string;
  version: string;
}

export interface GetNodeStatusResponse {
  data: NodeStatus | NodeStatus[];
}

// ============================================================================
// Tool Result Type
// ============================================================================

export interface McpToolResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errorDetails?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function getNodeStatus(
  apiClient: NeolithAPIClient,
  input: GetNodeStatusInput
): Promise<McpToolResult<NodeStatus | NodeStatus[]>> {
  try {
    // Make API request
    const path = input.nodeId
      ? `/api/observability/nodes/${input.nodeId}`
      : '/api/observability/nodes';

    const response = await apiClient.get<GetNodeStatusResponse>(path);

    const message = input.nodeId
      ? `Retrieved status for node ${input.nodeId}`
      : Array.isArray(response.data)
      ? `Retrieved status for ${response.data.length} node(s)`
      : 'Retrieved node status';

    return {
      success: true,
      message,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get node status: ${errorMessage}`,
      errorDetails: {
        code: 'GET_NODE_STATUS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
