/**
 * Checkpointing - State persistence and time-travel debugging
 * @module @wundr.io/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type {
  AgentState,
  Checkpoint,
  CheckpointSummary,
  GraphCheckpointer,
} from './types';

/**
 * In-memory checkpointer implementation
 * Useful for development and testing
 */
export class MemoryCheckpointer implements GraphCheckpointer {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private executionIndex: Map<string, string[]> = new Map();

  /**
   * Save a checkpoint
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, checkpoint);

    // Update execution index
    const executionCheckpoints =
      this.executionIndex.get(checkpoint.executionId) ?? [];
    executionCheckpoints.push(checkpoint.id);
    this.executionIndex.set(checkpoint.executionId, executionCheckpoints);
  }

  /**
   * Load a checkpoint by ID
   */
  async load(checkpointId: string): Promise<Checkpoint | null> {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  /**
   * List checkpoints for an execution
   */
  async list(executionId: string): Promise<CheckpointSummary[]> {
    const checkpointIds = this.executionIndex.get(executionId) ?? [];
    return checkpointIds
      .map(id => {
        const cp = this.checkpoints.get(id);
        if (!cp) {
          return null;
        }
        return {
          id: cp.id,
          executionId: cp.executionId,
          stepNumber: cp.stepNumber,
          nodeName: cp.nodeName,
          timestamp: cp.timestamp,
        };
      })
      .filter((cp): cp is CheckpointSummary => cp !== null)
      .sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      this.checkpoints.delete(checkpointId);

      // Update execution index
      const executionCheckpoints =
        this.executionIndex.get(checkpoint.executionId) ?? [];
      const index = executionCheckpoints.indexOf(checkpointId);
      if (index > -1) {
        executionCheckpoints.splice(index, 1);
        this.executionIndex.set(checkpoint.executionId, executionCheckpoints);
      }
    }
  }

  /**
   * Get the latest checkpoint for an execution
   */
  async getLatest(executionId: string): Promise<Checkpoint | null> {
    const checkpointIds = this.executionIndex.get(executionId) ?? [];
    if (checkpointIds.length === 0) {
      return null;
    }

    // Get the most recent checkpoint
    let latest: Checkpoint | null = null;
    for (const id of checkpointIds) {
      const cp = this.checkpoints.get(id);
      if (cp && (!latest || cp.stepNumber > latest.stepNumber)) {
        latest = cp;
      }
    }

    return latest;
  }

  /**
   * Clear all checkpoints
   */
  clear(): void {
    this.checkpoints.clear();
    this.executionIndex.clear();
  }

  /**
   * Get statistics about stored checkpoints
   */
  getStats(): { totalCheckpoints: number; totalExecutions: number } {
    return {
      totalCheckpoints: this.checkpoints.size,
      totalExecutions: this.executionIndex.size,
    };
  }
}

/**
 * File-based checkpointer implementation
 * Persists checkpoints to the filesystem
 */
export class FileCheckpointer implements GraphCheckpointer {
  private readonly basePath: string;
  private readonly fs: FileSystem;

  /**
   * Create a file-based checkpointer
   * @param basePath - Directory to store checkpoints
   * @param fs - FileSystem interface (allows for mocking)
   */
  constructor(basePath: string, fs?: FileSystem) {
    this.basePath = basePath;
    this.fs = fs ?? createNodeFileSystem();
  }

  /**
   * Save a checkpoint
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    const executionDir = `${this.basePath}/${checkpoint.executionId}`;
    await this.fs.mkdir(executionDir, { recursive: true });

    const filePath = `${executionDir}/${checkpoint.id}.json`;
    await this.fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));

    // Update index
    const indexPath = `${executionDir}/index.json`;
    const index = await this.loadIndex(indexPath);
    index.push({
      id: checkpoint.id,
      stepNumber: checkpoint.stepNumber,
      nodeName: checkpoint.nodeName,
      timestamp: checkpoint.timestamp.toISOString(),
    });
    await this.fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Load a checkpoint by ID
   */
  async load(checkpointId: string): Promise<Checkpoint | null> {
    // Search all execution directories
    const executions = await this.fs.readdir(this.basePath).catch(() => []);

    for (const executionId of executions) {
      const filePath = `${this.basePath}/${executionId}/${checkpointId}.json`;
      try {
        const content = await this.fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        return {
          ...data,
          timestamp: new Date(data.timestamp),
          state: {
            ...data.state,
            createdAt: new Date(data.state.createdAt),
            updatedAt: new Date(data.state.updatedAt),
          },
        };
      } catch {
        // Continue searching
      }
    }

    return null;
  }

  /**
   * List checkpoints for an execution
   */
  async list(executionId: string): Promise<CheckpointSummary[]> {
    const indexPath = `${this.basePath}/${executionId}/index.json`;
    const index = await this.loadIndex(indexPath);

    return index.map(item => ({
      id: item.id,
      executionId,
      stepNumber: item.stepNumber,
      nodeName: item.nodeName,
      timestamp: new Date(item.timestamp),
    }));
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<void> {
    const checkpoint = await this.load(checkpointId);
    if (!checkpoint) {
      return;
    }

    const filePath = `${this.basePath}/${checkpoint.executionId}/${checkpointId}.json`;
    await this.fs.unlink(filePath).catch(() => {});

    // Update index
    const indexPath = `${this.basePath}/${checkpoint.executionId}/index.json`;
    const index = await this.loadIndex(indexPath);
    const filtered = index.filter(item => item.id !== checkpointId);
    await this.fs.writeFile(indexPath, JSON.stringify(filtered, null, 2));
  }

  /**
   * Get the latest checkpoint for an execution
   */
  async getLatest(executionId: string): Promise<Checkpoint | null> {
    const summaries = await this.list(executionId);
    if (summaries.length === 0) {
      return null;
    }

    const latest = summaries.reduce((a, b) =>
      a.stepNumber > b.stepNumber ? a : b,
    );

    return this.load(latest.id);
  }

  /**
   * Load index file
   */
  private async loadIndex(path: string): Promise<
    Array<{
      id: string;
      stepNumber: number;
      nodeName: string;
      timestamp: string;
    }>
  > {
    try {
      const content = await this.fs.readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
}

/**
 * FileSystem interface for abstraction
 */
export interface FileSystem {
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/**
 * Create a Node.js filesystem implementation
 */
function createNodeFileSystem(): FileSystem {
  // Lazy import to avoid issues in browser environments
  return {
    async readFile(path: string, encoding: string): Promise<string> {
      const fs = await import('fs').then(m => m.promises);
      return fs.readFile(path, encoding as BufferEncoding);
    },
    async writeFile(path: string, data: string): Promise<void> {
      const fs = await import('fs').then(m => m.promises);
      await fs.writeFile(path, data);
    },
    async mkdir(
      path: string,
      options?: { recursive?: boolean },
    ): Promise<void> {
      const fs = await import('fs').then(m => m.promises);
      await fs.mkdir(path, options);
    },
    async readdir(path: string): Promise<string[]> {
      const fs = await import('fs').then(m => m.promises);
      return fs.readdir(path);
    },
    async unlink(path: string): Promise<void> {
      const fs = await import('fs').then(m => m.promises);
      await fs.unlink(path);
    },
    async exists(path: string): Promise<boolean> {
      const fs = await import('fs').then(m => m.promises);
      try {
        await fs.access(path);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Time-travel debugger for workflow state
 */
export class TimeTravelDebugger<TState extends AgentState = AgentState> {
  private readonly checkpointer: GraphCheckpointer;

  /**
   * Create a time-travel debugger
   * @param checkpointer - Checkpointer to use for state access
   */
  constructor(checkpointer: GraphCheckpointer) {
    this.checkpointer = checkpointer;
  }

  /**
   * Get the execution timeline
   * @param executionId - Execution to get timeline for
   * @returns Array of checkpoint summaries
   */
  async getTimeline(executionId: string): Promise<CheckpointSummary[]> {
    return this.checkpointer.list(executionId);
  }

  /**
   * Travel to a specific checkpoint
   * @param checkpointId - Checkpoint to travel to
   * @returns The state at that checkpoint
   */
  async travelTo(checkpointId: string): Promise<TState | null> {
    const checkpoint = await this.checkpointer.load(checkpointId);
    return (checkpoint?.state as TState) ?? null;
  }

  /**
   * Get state at a specific step number
   * @param executionId - Execution ID
   * @param stepNumber - Step number to travel to
   * @returns The state at that step
   */
  async travelToStep(
    executionId: string,
    stepNumber: number,
  ): Promise<TState | null> {
    const summaries = await this.checkpointer.list(executionId);
    const summary = summaries.find(s => s.stepNumber === stepNumber);
    if (!summary) {
      return null;
    }
    return this.travelTo(summary.id);
  }

  /**
   * Compare two checkpoints
   * @param checkpointId1 - First checkpoint
   * @param checkpointId2 - Second checkpoint
   * @returns Differences between the checkpoints
   */
  async compare(
    checkpointId1: string,
    checkpointId2: string,
  ): Promise<StateDiff[]> {
    const [cp1, cp2] = await Promise.all([
      this.checkpointer.load(checkpointId1),
      this.checkpointer.load(checkpointId2),
    ]);

    if (!cp1 || !cp2) {
      throw new Error('One or both checkpoints not found');
    }

    return this.diffStates(cp1.state, cp2.state);
  }

  /**
   * Get the state history (changes over time)
   * @param executionId - Execution ID
   * @returns Array of state changes
   */
  async getStateHistory(
    executionId: string,
  ): Promise<StateHistoryItem<TState>[]> {
    const summaries = await this.checkpointer.list(executionId);
    const history: StateHistoryItem<TState>[] = [];

    let previousState: AgentState | null = null;

    for (const summary of summaries) {
      const checkpoint = await this.checkpointer.load(summary.id);
      if (!checkpoint) {
        continue;
      }

      const changes = previousState
        ? this.diffStates(previousState, checkpoint.state)
        : [];

      history.push({
        checkpoint: summary,
        state: checkpoint.state as TState,
        changes,
      });

      previousState = checkpoint.state;
    }

    return history;
  }

  /**
   * Find checkpoints where a condition became true
   * @param executionId - Execution ID
   * @param condition - Condition to check
   * @returns Checkpoints where condition became true
   */
  async findTransitions(
    executionId: string,
    condition: (state: TState) => boolean,
  ): Promise<CheckpointSummary[]> {
    const summaries = await this.checkpointer.list(executionId);
    const transitions: CheckpointSummary[] = [];

    let previousResult = false;

    for (const summary of summaries) {
      const checkpoint = await this.checkpointer.load(summary.id);
      if (!checkpoint) {
        continue;
      }

      const currentResult = condition(checkpoint.state as TState);

      if (currentResult && !previousResult) {
        transitions.push(summary);
      }

      previousResult = currentResult;
    }

    return transitions;
  }

  /**
   * Compute differences between two states
   */
  private diffStates(state1: AgentState, state2: AgentState): StateDiff[] {
    const diffs: StateDiff[] = [];

    // Compare data fields
    const allKeys = new Set([
      ...Object.keys(state1.data),
      ...Object.keys(state2.data),
    ]);

    for (const key of allKeys) {
      const val1 = state1.data[key];
      const val2 = state2.data[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diffs.push({
          path: `data.${key}`,
          type:
            val1 === undefined
              ? 'added'
              : val2 === undefined
                ? 'removed'
                : 'changed',
          oldValue: val1,
          newValue: val2,
        });
      }
    }

    // Compare message counts
    if (state1.messages.length !== state2.messages.length) {
      diffs.push({
        path: 'messages.length',
        type: 'changed',
        oldValue: state1.messages.length,
        newValue: state2.messages.length,
      });
    }

    // Compare current step
    if (state1.currentStep !== state2.currentStep) {
      diffs.push({
        path: 'currentStep',
        type: 'changed',
        oldValue: state1.currentStep,
        newValue: state2.currentStep,
      });
    }

    return diffs;
  }
}

/**
 * State difference record
 */
export interface StateDiff {
  /** Path to the changed value */
  path: string;
  /** Type of change */
  type: 'added' | 'removed' | 'changed';
  /** Previous value */
  oldValue?: unknown;
  /** New value */
  newValue?: unknown;
}

/**
 * State history item
 */
export interface StateHistoryItem<TState extends AgentState = AgentState> {
  /** Checkpoint summary */
  checkpoint: CheckpointSummary;
  /** Full state at this point */
  state: TState;
  /** Changes from previous state */
  changes: StateDiff[];
}

/**
 * Create a checkpoint
 *
 * @example
 * ```typescript
 * const checkpoint = createCheckpoint({
 *   executionId: 'exec-123',
 *   stepNumber: 5,
 *   nodeName: 'process-node',
 *   state: currentState
 * });
 *
 * await checkpointer.save(checkpoint);
 * ```
 *
 * @param options - Checkpoint options
 * @returns Checkpoint object
 */
export function createCheckpoint<
  TState extends AgentState = AgentState,
>(options: {
  executionId: string;
  stepNumber: number;
  nodeName: string;
  state: TState;
  parentId?: string;
  metadata?: Record<string, unknown>;
}): Checkpoint {
  return {
    id: uuidv4(),
    executionId: options.executionId,
    stepNumber: options.stepNumber,
    nodeName: options.nodeName,
    state: options.state,
    timestamp: new Date(),
    parentId: options.parentId,
    metadata: options.metadata,
  };
}

/**
 * Checkpoint retention policy
 */
export interface RetentionPolicy {
  /** Maximum number of checkpoints to keep per execution */
  maxCheckpointsPerExecution?: number;
  /** Maximum age of checkpoints in milliseconds */
  maxAge?: number;
  /** Keep every Nth checkpoint (for sampling) */
  keepEveryN?: number;
  /** Always keep checkpoints for these nodes */
  alwaysKeepNodes?: string[];
}

/**
 * Apply retention policy to checkpoints
 *
 * @example
 * ```typescript
 * await applyRetentionPolicy(checkpointer, 'exec-123', {
 *   maxCheckpointsPerExecution: 100,
 *   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   keepEveryN: 10,
 *   alwaysKeepNodes: ['decision', 'error-handler']
 * });
 * ```
 *
 * @param checkpointer - Checkpointer to clean up
 * @param executionId - Execution to apply policy to
 * @param policy - Retention policy
 * @returns Number of checkpoints deleted
 */
export async function applyRetentionPolicy(
  checkpointer: GraphCheckpointer,
  executionId: string,
  policy: RetentionPolicy,
): Promise<number> {
  const summaries = await checkpointer.list(executionId);
  let deleted = 0;

  const toDelete: string[] = [];
  const now = Date.now();

  for (let i = 0; i < summaries.length; i++) {
    const summary = summaries[i];
    if (!summary) {
      continue;
    }

    // Check if node is in always-keep list
    if (policy.alwaysKeepNodes?.includes(summary.nodeName)) {
      continue;
    }

    // Check age
    if (policy.maxAge) {
      const age = now - summary.timestamp.getTime();
      if (age > policy.maxAge) {
        toDelete.push(summary.id);
        continue;
      }
    }

    // Check keepEveryN
    if (policy.keepEveryN && (i + 1) % policy.keepEveryN !== 0) {
      // Don't delete the latest few checkpoints
      if (i < summaries.length - 5) {
        toDelete.push(summary.id);
      }
    }
  }

  // Apply maxCheckpointsPerExecution
  if (policy.maxCheckpointsPerExecution) {
    const remaining = summaries.filter(s => !toDelete.includes(s.id));
    if (remaining.length > policy.maxCheckpointsPerExecution) {
      const excess = remaining.length - policy.maxCheckpointsPerExecution;
      // Delete oldest checkpoints first (but not those in toDelete already)
      for (let i = 0; i < excess && i < remaining.length; i++) {
        const item = remaining[i];
        if (item && !toDelete.includes(item.id)) {
          toDelete.push(item.id);
        }
      }
    }
  }

  // Delete marked checkpoints
  for (const id of toDelete) {
    await checkpointer.delete(id);
    deleted++;
  }

  return deleted;
}

/**
 * Schema for checkpoint validation
 */
export const CheckpointSchema = z.object({
  id: z.string().uuid(),
  executionId: z.string(),
  stepNumber: z.number().int().min(0),
  nodeName: z.string(),
  timestamp: z.date(),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Validate a checkpoint
 */
export function validateCheckpoint(
  checkpoint: unknown,
): checkpoint is Checkpoint {
  try {
    CheckpointSchema.parse(checkpoint);
    return true;
  } catch {
    return false;
  }
}
