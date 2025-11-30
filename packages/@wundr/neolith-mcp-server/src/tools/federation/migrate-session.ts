/**
 * Migrate Session Tool
 *
 * Migrates an active session from one node to another in the distributed cluster.
 * Useful for load balancing, maintenance, and failure recovery.
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const migrateSessionInputSchema = z.object({
  sessionId: z.string().describe('ID of the session to migrate'),
  targetNodeId: z.string().describe('ID of the target node to migrate to'),
  options: z.object({
    preserveState: z.boolean().optional().default(true).describe('Preserve session state during migration'),
    graceful: z.boolean().optional().default(true).describe('Use graceful migration (wait for current tasks)'),
    timeout: z.number().int().min(1000).optional().default(30000).describe('Migration timeout in milliseconds'),
    validateTarget: z.boolean().optional().default(true).describe('Validate target node capacity before migration'),
  }).optional().describe('Migration options'),
  metadata: z.record(z.unknown()).optional().describe('Additional migration metadata'),
});

export type MigrateSessionInput = z.infer<typeof migrateSessionInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface MigrationPhase {
  phase: 'VALIDATING' | 'PREPARING' | 'TRANSFERRING' | 'FINALIZING' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  message?: string;
}

export interface SessionState {
  size: number;
  checksum: string;
  compressed: boolean;
}

export interface MigrationDetails {
  sessionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  phases: MigrationPhase[];
  state?: SessionState;
  timing: {
    startedAt: string;
    completedAt?: string;
    duration?: number;
  };
  metrics: {
    dataTransferred: number;
    transferRate?: number;
    downtime?: number;
  };
  error?: {
    code: string;
    message: string;
    phase?: string;
    details?: unknown;
  };
}

export interface MigrateSessionResponse {
  migrationId: string;
  success: boolean;
  message: string;
  migrationDetails: MigrationDetails;
  warnings?: string[];
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
  warnings?: string[];
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function migrateSession(
  apiClient: NeolithAPIClient,
  input: MigrateSessionInput
): Promise<McpToolResult> {
  try {
    // Prepare migration request payload
    const payload = {
      sessionId: input.sessionId,
      targetNodeId: input.targetNodeId,
      options: {
        preserveState: input.options?.preserveState ?? true,
        graceful: input.options?.graceful ?? true,
        timeout: input.options?.timeout ?? 30000,
        validateTarget: input.options?.validateTarget ?? true,
      },
      ...(input.metadata && { metadata: input.metadata }),
    };

    // Make API request to session migration endpoint
    const path = '/api/federation/sessions/migrate';
    const response = await apiClient.post<MigrateSessionResponse>(path, payload);

    // Build comprehensive status message
    const messageParts = [response.message];

    if (response.migrationDetails.timing.duration) {
      messageParts.push(`Migration completed in ${response.migrationDetails.timing.duration}ms`);
    }

    if (response.migrationDetails.metrics.dataTransferred) {
      const mb = (response.migrationDetails.metrics.dataTransferred / (1024 * 1024)).toFixed(2);
      messageParts.push(`${mb} MB transferred`);
    }

    if (response.migrationDetails.metrics.downtime) {
      messageParts.push(`${response.migrationDetails.metrics.downtime}ms downtime`);
    }

    const finalMessage = messageParts.join(' | ');

    return {
      success: response.success,
      message: finalMessage,
      data: response,
      warnings: response.warnings,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to migrate session: ${errorMessage}`,
      error: {
        code: 'MIGRATE_SESSION_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
