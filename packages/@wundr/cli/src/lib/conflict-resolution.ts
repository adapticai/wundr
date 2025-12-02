/**
 * Conflict Resolution - Stub implementation
 * TODO: Implement full conflict resolution system
 */

export interface ConflictResolver {
  resolve(conflict: UpdateConflict): Promise<ConflictResolutionResult>;
}

export interface UpdateConflict {
  type: string;
  description: string;
  localValue: unknown;
  remoteValue: unknown;
}

export interface ConflictResolutionResult {
  resolved: boolean;
  value: unknown;
}

export function createConflictResolver(): ConflictResolver {
  return {
    async resolve(
      _conflict: UpdateConflict
    ): Promise<ConflictResolutionResult> {
      throw new Error('Conflict resolution not yet implemented');
    },
  };
}
