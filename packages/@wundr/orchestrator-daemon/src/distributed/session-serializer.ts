/**
 * Session Serializer - Serializes and deserializes session state for distributed session management
 * Supports compression, checkpointing, and validation for session migration
 */

import { z } from 'zod';
import { deflateSync, inflateSync } from 'zlib';

import type { Session, MemoryContext, SessionMetrics, Task } from '../types';

/**
 * Message interface for session communication
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool result interface
 */
export interface ToolResult {
  toolId: string;
  toolName: string;
  result: unknown;
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Session state type
 */
export type SessionState = 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'terminated';

/**
 * Serialized session format for transfer/storage
 */
export interface SerializedSession {
  sessionId: string;
  orchestratorId: string;
  state: SessionState;
  messages: Message[];
  context: Record<string, unknown>;
  toolResults: ToolResult[];
  createdAt: string;
  checkpointVersion: number;
  metadata: Record<string, unknown>;
  compressed?: boolean;
  compressionAlgorithm?: 'zlib';
  task: Task;
  sessionType: 'claude-code' | 'claude-flow';
  memoryContext: MemoryContext;
  metrics: SessionMetrics;
  startedAt: string;
  endedAt?: string;
}

/**
 * Incremental checkpoint for session migration
 */
export interface SessionCheckpoint {
  version: number;
  deltaMessages: Message[];
  deltaContext: Record<string, unknown>;
  timestamp: string;
  sessionId: string;
  baseVersion: number;
}

/**
 * Validation schemas
 */
const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const ToolResultSchema = z.object({
  toolId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
  timestamp: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

const SerializedSessionSchema = z.object({
  sessionId: z.string(),
  orchestratorId: z.string(),
  state: z.enum(['initializing', 'running', 'paused', 'completed', 'failed', 'terminated']),
  messages: z.array(MessageSchema),
  context: z.record(z.unknown()),
  toolResults: z.array(ToolResultSchema),
  createdAt: z.string(),
  checkpointVersion: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()),
  compressed: z.boolean().optional(),
  compressionAlgorithm: z.enum(['zlib']).optional(),
  task: z.any(), // Task schema from types
  sessionType: z.enum(['claude-code', 'claude-flow']),
  memoryContext: z.any(), // MemoryContext schema from types
  metrics: z.any(), // SessionMetrics schema from types
  startedAt: z.string(),
  endedAt: z.string().optional(),
});

const SessionCheckpointSchema = z.object({
  version: z.number().int().positive(),
  deltaMessages: z.array(MessageSchema),
  deltaContext: z.record(z.unknown()),
  timestamp: z.string(),
  sessionId: z.string(),
  baseVersion: z.number().int().nonnegative(),
});

/**
 * Session serializer for distributed session management
 */
export class SessionSerializer {
  private readonly compressionThreshold: number = 1024 * 1024; // 1MB
  private readonly maxSupportedVersion: number = 1;
  private checkpointVersions: Map<string, number> = new Map();

  /**
   * Serialize session state to transferable format
   */
  serialize(session: Session, messages: Message[] = [], toolResults: ToolResult[] = []): SerializedSession {
    const serialized: SerializedSession = {
      sessionId: session.id,
      orchestratorId: session.orchestratorId,
      state: session.status,
      messages,
      context: this.serializeContext(session.memoryContext),
      toolResults,
      createdAt: session.startedAt.toISOString(),
      checkpointVersion: this.getCurrentVersion(session.id),
      metadata: {
        taskId: session.task.id,
        taskType: session.task.type,
        taskPriority: session.task.priority,
      },
      task: session.task,
      sessionType: session.type,
      memoryContext: session.memoryContext,
      metrics: session.metrics,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
    };

    // Apply compression if data is large
    const dataSize = this.estimateSize(serialized);
    if (dataSize > this.compressionThreshold) {
      return this.compressSession(serialized);
    }

    return serialized;
  }

  /**
   * Deserialize session from serialized data
   */
  deserialize(data: SerializedSession): {
    session: Session;
    messages: Message[];
    toolResults: ToolResult[];
  } {
    // Validate schema
    this.validateSerializedSession(data);

    // Check version compatibility
    this.validateVersion(data.checkpointVersion);

    // Decompress if needed
    const decompressed = data.compressed ? this.decompressSession(data) : data;

    // Verify integrity
    this.verifyIntegrity(decompressed);

    // Reconstruct session
    const session: Session = {
      id: decompressed.sessionId,
      orchestratorId: decompressed.orchestratorId,
      task: decompressed.task,
      type: decompressed.sessionType,
      status: decompressed.state,
      startedAt: new Date(decompressed.startedAt),
      endedAt: decompressed.endedAt ? new Date(decompressed.endedAt) : undefined,
      memoryContext: decompressed.memoryContext,
      metrics: decompressed.metrics,
    };

    // Update checkpoint version
    this.checkpointVersions.set(session.id, decompressed.checkpointVersion);

    return {
      session,
      messages: decompressed.messages,
      toolResults: decompressed.toolResults,
    };
  }

  /**
   * Create incremental checkpoint
   */
  getCheckpoint(
    session: Session,
    newMessages: Message[],
    contextUpdates: Record<string, unknown> = {}
  ): SessionCheckpoint {
    const currentVersion = this.getCurrentVersion(session.id);
    const newVersion = currentVersion + 1;

    const checkpoint: SessionCheckpoint = {
      version: newVersion,
      deltaMessages: newMessages,
      deltaContext: contextUpdates,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      baseVersion: currentVersion,
    };

    // Update version tracking
    this.checkpointVersions.set(session.id, newVersion);

    return checkpoint;
  }

  /**
   * Apply checkpoint to session
   */
  applyCheckpoint(
    session: Session,
    checkpoint: SessionCheckpoint,
    currentMessages: Message[],
    currentContext: Record<string, unknown>
  ): {
    messages: Message[];
    context: Record<string, unknown>;
    session: Session;
  } {
    // Validate checkpoint schema
    this.validateCheckpoint(checkpoint);

    // Verify checkpoint version is sequential
    const currentVersion = this.getCurrentVersion(session.id);
    if (checkpoint.baseVersion !== currentVersion) {
      throw new Error(
        `Checkpoint version mismatch: expected base version ${currentVersion}, got ${checkpoint.baseVersion}`
      );
    }

    // Apply delta messages
    const updatedMessages = [...currentMessages, ...checkpoint.deltaMessages];

    // Apply delta context
    const updatedContext = {
      ...currentContext,
      ...checkpoint.deltaContext,
    };

    // Update session with checkpoint version
    this.checkpointVersions.set(session.id, checkpoint.version);

    return {
      messages: updatedMessages,
      context: updatedContext,
      session,
    };
  }

  /**
   * Serialize memory context to plain object
   */
  private serializeContext(memoryContext: MemoryContext): Record<string, unknown> {
    return {
      scratchpad: memoryContext.scratchpad,
      episodic: memoryContext.episodic.map((entry) => ({
        id: entry.id,
        content: entry.content,
        timestamp: entry.timestamp.toISOString(),
        type: entry.type,
        metadata: entry.metadata,
      })),
      semantic: memoryContext.semantic.map((entry) => ({
        id: entry.id,
        content: entry.content,
        timestamp: entry.timestamp.toISOString(),
        type: entry.type,
        metadata: entry.metadata,
      })),
    };
  }

  /**
   * Compress session data using zlib
   */
  private compressSession(session: SerializedSession): SerializedSession {
    const messagesJson = JSON.stringify(session.messages);
    const compressed = deflateSync(Buffer.from(messagesJson));

    return {
      ...session,
      messages: [
        {
          id: 'compressed',
          role: 'system',
          content: compressed.toString('base64'),
          timestamp: new Date().toISOString(),
        },
      ],
      compressed: true,
      compressionAlgorithm: 'zlib',
    };
  }

  /**
   * Decompress session data
   */
  private decompressSession(session: SerializedSession): SerializedSession {
    if (!session.compressed || session.compressionAlgorithm !== 'zlib') {
      return session;
    }

    const compressedMessage = session.messages[0];
    if (!compressedMessage || compressedMessage.id !== 'compressed') {
      throw new Error('Invalid compressed session format');
    }

    const compressedBuffer = Buffer.from(compressedMessage.content, 'base64');
    const decompressed = inflateSync(compressedBuffer);
    const messages = JSON.parse(decompressed.toString()) as Message[];

    return {
      ...session,
      messages,
      compressed: false,
      compressionAlgorithm: undefined,
    };
  }

  /**
   * Estimate serialized data size
   */
  private estimateSize(data: SerializedSession): number {
    return Buffer.byteLength(JSON.stringify(data.messages), 'utf8');
  }

  /**
   * Get current checkpoint version for session
   */
  private getCurrentVersion(sessionId: string): number {
    return this.checkpointVersions.get(sessionId) ?? 0;
  }

  /**
   * Validate serialized session schema
   */
  private validateSerializedSession(data: SerializedSession): void {
    try {
      SerializedSessionSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Session validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate checkpoint schema
   */
  private validateCheckpoint(checkpoint: SessionCheckpoint): void {
    try {
      SessionCheckpointSchema.parse(checkpoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Checkpoint validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate version compatibility
   */
  private validateVersion(version: number): void {
    if (version > this.maxSupportedVersion) {
      throw new Error(
        `Unsupported checkpoint version: ${version}. Maximum supported version: ${this.maxSupportedVersion}`
      );
    }

    if (version < 0) {
      throw new Error(`Invalid checkpoint version: ${version}. Version must be non-negative`);
    }
  }

  /**
   * Verify data integrity
   */
  private verifyIntegrity(data: SerializedSession): void {
    // Verify required fields are present
    if (!data.sessionId || !data.orchestratorId) {
      throw new Error('Session integrity check failed: missing required fields');
    }

    // Verify timestamps are valid
    const createdAt = new Date(data.createdAt);
    if (isNaN(createdAt.getTime())) {
      throw new Error('Session integrity check failed: invalid createdAt timestamp');
    }

    const startedAt = new Date(data.startedAt);
    if (isNaN(startedAt.getTime())) {
      throw new Error('Session integrity check failed: invalid startedAt timestamp');
    }

    if (data.endedAt) {
      const endedAt = new Date(data.endedAt);
      if (isNaN(endedAt.getTime())) {
        throw new Error('Session integrity check failed: invalid endedAt timestamp');
      }

      // Verify endedAt is after startedAt
      if (endedAt < startedAt) {
        throw new Error('Session integrity check failed: endedAt is before startedAt');
      }
    }

    // Verify messages have sequential IDs (if they follow a pattern)
    const messageIds = new Set<string>();
    for (const message of data.messages) {
      if (messageIds.has(message.id)) {
        throw new Error(`Session integrity check failed: duplicate message ID ${message.id}`);
      }
      messageIds.add(message.id);
    }

    // Verify tool results have unique IDs
    const toolResultIds = new Set<string>();
    for (const result of data.toolResults) {
      if (toolResultIds.has(result.toolId)) {
        throw new Error(`Session integrity check failed: duplicate tool result ID ${result.toolId}`);
      }
      toolResultIds.add(result.toolId);
    }
  }

  /**
   * Clear checkpoint version tracking for session
   */
  clearCheckpointVersions(sessionId: string): void {
    this.checkpointVersions.delete(sessionId);
  }

  /**
   * Get all tracked checkpoint versions
   */
  getAllCheckpointVersions(): Map<string, number> {
    return new Map(this.checkpointVersions);
  }
}
