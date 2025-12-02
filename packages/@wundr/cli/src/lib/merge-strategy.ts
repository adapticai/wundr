/**
 * Merge Strategy - Stub implementation
 * TODO: Implement full merge strategy system
 */

export interface MergeResult {
  success: boolean;
  content: string;
  conflicts: Array<{ line: number; description: string }>;
}

export class MergeStrategyManager {
  merge(_local: string, _remote: string, _base: string): MergeResult {
    throw new Error('Merge strategy not yet implemented');
  }
}

export function threeWayMerge(
  _local: string,
  _remote: string,
  _base: string
): MergeResult {
  throw new Error('Three-way merge not yet implemented');
}

export function detectFileType(_filePath: string): string {
  return 'unknown';
}
