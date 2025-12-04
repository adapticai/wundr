/**
 * Task Metadata Type Definitions
 *
 * Defines the structure for the metadata JSON field in the Task model.
 * This provides type safety for task metadata operations.
 *
 * @module lib/types/task-metadata
 */

/**
 * Assignment history entry tracking task assignments over time
 */
export interface TaskAssignmentHistoryEntry {
  /** ISO 8601 timestamp of the assignment */
  timestamp: string;
  /** User ID of the previous assignee (null if unassigned) */
  fromUserId: string | null;
  /** User ID of the new assignee */
  toUserId: string;
  /** Type of assignee (ORCHESTRATOR or USER) */
  assigneeType: 'ORCHESTRATOR' | 'USER';
  /** User ID of who made the assignment */
  assignedBy: string;
  /** Optional notes about the assignment */
  notes?: string;
}

/**
 * Task completion information
 */
export interface TaskCompletionMetadata {
  /** User ID who completed the task */
  completedBy: string;
  /** ISO 8601 timestamp of completion */
  completedAt: string;
  /** Optional completion result data */
  result?: Record<string, unknown>;
  /** Optional completion notes */
  notes?: string;
  /** Optional artifact URLs or file IDs */
  artifacts?: string[];
  /** Additional completion-specific metadata */
  [key: string]: unknown;
}

/**
 * Complete task metadata structure
 *
 * This interface defines the expected structure of the metadata JSON field
 * in the Task model. All fields are optional as metadata can be partially populated.
 */
export interface TaskMetadata {
  /** History of task assignments */
  assignmentHistory?: TaskAssignmentHistoryEntry[];
  /** Completion information (present when task is completed) */
  completion?: TaskCompletionMetadata;
  /** Custom metadata fields */
  [key: string]: unknown;
}

/**
 * Type guard to check if metadata has assignment history
 */
export function hasAssignmentHistory(
  metadata: unknown
): metadata is { assignmentHistory: TaskAssignmentHistoryEntry[] } {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'assignmentHistory' in metadata &&
    Array.isArray(
      (metadata as { assignmentHistory: unknown }).assignmentHistory
    )
  );
}

/**
 * Type guard to check if metadata has completion info
 */
export function hasCompletionMetadata(
  metadata: unknown
): metadata is { completion: TaskCompletionMetadata } {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'completion' in metadata &&
    typeof (metadata as { completion: unknown }).completion === 'object'
  );
}

/**
 * Helper to safely get assignment history from metadata
 */
export function getAssignmentHistory(
  metadata: unknown
): TaskAssignmentHistoryEntry[] {
  if (hasAssignmentHistory(metadata)) {
    return metadata.assignmentHistory;
  }
  return [];
}

/**
 * Helper to safely get completion metadata
 */
export function getCompletionMetadata(
  metadata: unknown
): TaskCompletionMetadata | null {
  if (hasCompletionMetadata(metadata)) {
    return metadata.completion;
  }
  return null;
}
