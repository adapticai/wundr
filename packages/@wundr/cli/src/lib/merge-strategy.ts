/**
 * Merge Strategy Module
 *
 * Implements two-way and three-way text merge with line-based diff (LCS).
 * Conflict markers follow the standard git format:
 *   <<<<<<< OURS
 *   ...ours lines...
 *   =======
 *   ...theirs lines...
 *   >>>>>>> THEIRS
 */

import * as path from 'path';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface MergeResult {
  success: boolean;
  content: string;
  conflicts: Array<{ line: number; description: string }>;
}

export interface ThreeWayMergeOptions {
  /** Original ancestor content */
  base: string;
  /** Local / user-modified content */
  user: string;
  /** Incoming / target content */
  target: string;
  /** Optional file path for type-specific strategies */
  filePath?: string;
  /** Explicit file type override */
  fileType?: string;
}

export interface MergeStrategyOptions {
  /** Automatically resolve conflicts by favouring the user side */
  autoResolve?: boolean;
  /** Preserve comment-only lines during merge */
  preserveComments?: boolean;
}

// ---------------------------------------------------------------------------
// LCS (Longest Common Subsequence) helpers
// ---------------------------------------------------------------------------

/**
 * Compute the LCS table for two arrays of strings using classic DP.
 * Returns the table so callers can reconstruct diffs.
 */
function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  // Allocate (m+1) x (n+1) table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

type DiffOp =
  | { op: 'equal'; line: string }
  | { op: 'insert'; line: string }
  | { op: 'delete'; line: string };

/**
 * Produce a sequence of diff operations between arrays `a` (old) and `b` (new)
 * using the LCS table.
 */
function diffLines(a: string[], b: string[]): DiffOp[] {
  const dp = buildLcsTable(a, b);
  const ops: DiffOp[] = [];

  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ op: 'equal', line: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ op: 'insert', line: b[j - 1] });
      j--;
    } else {
      ops.push({ op: 'delete', line: a[i - 1] });
      i--;
    }
  }

  ops.reverse();
  return ops;
}

// ---------------------------------------------------------------------------
// Two-way merge
// ---------------------------------------------------------------------------

/**
 * Apply changes from `modified` onto `base` using a two-way line diff.
 * Lines deleted in `modified` are removed from the result; lines added in
 * `modified` are appended at the appropriate positions.
 *
 * Parameters follow the convention in the original stub:
 *   merge(base, modified) - local alias: _local = base, _remote = modified
 */
function applyTwoWayMerge(base: string, modified: string): MergeResult {
  const baseLines = base.split('\n');
  const modLines = modified.split('\n');

  const ops = diffLines(baseLines, modLines);
  const result: string[] = [];

  for (const op of ops) {
    if (op.op === 'equal' || op.op === 'insert') {
      result.push(op.line);
    }
    // Deleted lines are simply dropped
  }

  return {
    success: true,
    content: result.join('\n'),
    conflicts: [],
  };
}

// ---------------------------------------------------------------------------
// Three-way merge
// ---------------------------------------------------------------------------

/**
 * Represents a chunk of lines from one side that differs from the base.
 */
interface Chunk {
  /** Index in the base where this chunk starts (0-based) */
  baseStart: number;
  /** Index in the base where this chunk ends (exclusive) */
  baseEnd: number;
  /** Lines from this side (empty for pure deletions) */
  lines: string[];
  /** Which side produced this chunk */
  side: 'ours' | 'theirs';
}

/**
 * Extract changed chunks from a diff between base lines and side lines.
 * Each contiguous run of non-equal operations becomes one chunk.
 */
function extractChunks(
  baseLines: string[],
  sideLines: string[],
  side: 'ours' | 'theirs'
): Chunk[] {
  const ops = diffLines(baseLines, sideLines);
  const chunks: Chunk[] = [];

  // Map operations back to base indices
  let baseIdx = 0;
  let opIdx = 0;

  while (opIdx < ops.length) {
    const op = ops[opIdx];

    if (op.op === 'equal') {
      baseIdx++;
      opIdx++;
      continue;
    }

    // Start of a non-equal run
    const chunkBaseStart = baseIdx;
    const chunkLines: string[] = [];

    while (opIdx < ops.length && ops[opIdx].op !== 'equal') {
      const cur = ops[opIdx];
      if (cur.op === 'delete') {
        baseIdx++;
      } else {
        // insert
        chunkLines.push(cur.line);
      }
      opIdx++;
    }

    chunks.push({
      baseStart: chunkBaseStart,
      baseEnd: baseIdx,
      lines: chunkLines,
      side,
    });
  }

  return chunks;
}

/**
 * Core three-way merge implementation.
 *
 * Algorithm:
 * 1. Compute diffs of `ours` vs `base` and `theirs` vs `base`.
 * 2. Walk the base line-by-line, applying non-overlapping chunks from each side.
 * 3. When both sides modify the same base region differently, emit conflict markers.
 */
function performThreeWayMerge(
  base: string,
  ours: string,
  theirs: string,
  autoResolve = false
): MergeResult {
  // Fast-path: all identical
  if (base === ours && base === theirs) {
    return { success: true, content: base, conflicts: [] };
  }
  // Fast-path: only one side changed
  if (base === ours) {
    return { success: true, content: theirs, conflicts: [] };
  }
  if (base === theirs) {
    return { success: true, content: ours, conflicts: [] };
  }
  // Fast-path: both sides are identical to each other (regardless of base)
  if (ours === theirs) {
    return { success: true, content: ours, conflicts: [] };
  }

  const baseLines = base.split('\n');
  const oursLines = ours.split('\n');
  const theirsLines = theirs.split('\n');

  const ourChunks = extractChunks(baseLines, oursLines, 'ours');
  const theirChunks = extractChunks(baseLines, theirsLines, 'theirs');

  // Build a map: baseLineIndex -> list of chunks that START at that index
  const ourChunkMap = new Map<number, Chunk>();
  const theirChunkMap = new Map<number, Chunk>();

  for (const c of ourChunks) {
    ourChunkMap.set(c.baseStart, c);
  }
  for (const c of theirChunks) {
    theirChunkMap.set(c.baseStart, c);
  }

  const result: string[] = [];
  const conflicts: Array<{ line: number; description: string }> = [];

  let i = 0; // current base line index

  while (i <= baseLines.length) {
    const ourChunk = ourChunkMap.get(i);
    const theirChunk = theirChunkMap.get(i);

    if (!ourChunk && !theirChunk) {
      // No changes at this position - emit base line if it exists
      if (i < baseLines.length) {
        result.push(baseLines[i]);
      }
      i++;
      continue;
    }

    if (ourChunk && !theirChunk) {
      // Only ours changed this region
      for (const line of ourChunk.lines) {
        result.push(line);
      }
      i = ourChunk.baseEnd;
      continue;
    }

    if (!ourChunk && theirChunk) {
      // Only theirs changed this region
      for (const line of theirChunk.lines) {
        result.push(line);
      }
      i = theirChunk.baseEnd;
      continue;
    }

    // Both sides have a chunk starting here - check for real conflict
    // They conflict if they modify overlapping base regions differently
    const ourEnd = ourChunk!.baseEnd;
    const theirEnd = theirChunk!.baseEnd;

    // If the resulting content is the same, no conflict
    if (ourChunk!.lines.join('\n') === theirChunk!.lines.join('\n')) {
      for (const line of ourChunk!.lines) {
        result.push(line);
      }
      i = Math.max(ourEnd, theirEnd);
      continue;
    }

    if (autoResolve) {
      // Prefer ours when auto-resolving
      for (const line of ourChunk!.lines) {
        result.push(line);
      }
      i = Math.max(ourEnd, theirEnd);
      continue;
    }

    // Emit conflict markers
    const conflictLineNumber = result.length + 1;
    result.push('<<<<<<< OURS');
    for (const line of ourChunk!.lines) {
      result.push(line);
    }
    result.push('=======');
    for (const line of theirChunk!.lines) {
      result.push(line);
    }
    result.push('>>>>>>> THEIRS');

    conflicts.push({
      line: conflictLineNumber,
      description: `Conflict at base line ${i + 1}: both sides modified this region differently`,
    });

    i = Math.max(ourEnd, theirEnd);
  }

  return {
    success: conflicts.length === 0,
    content: result.join('\n'),
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// JSON deep merge helper
// ---------------------------------------------------------------------------

function deepMergeJson(
  base: Record<string, unknown>,
  user: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target };

  // Preserve user-added keys and user-modified values
  for (const key of Object.keys(user)) {
    if (!(key in target)) {
      // User added this key; target doesn't have it - keep user's value
      merged[key] = user[key];
    } else if (
      typeof user[key] === 'object' &&
      user[key] !== null &&
      !Array.isArray(user[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      // Both are objects - recurse
      const baseVal =
        typeof base[key] === 'object' &&
        base[key] !== null &&
        !Array.isArray(base[key])
          ? (base[key] as Record<string, unknown>)
          : {};
      merged[key] = deepMergeJson(
        baseVal,
        user[key] as Record<string, unknown>,
        target[key] as Record<string, unknown>
      );
    } else if (
      key in base &&
      base[key] !== user[key] &&
      base[key] === target[key]
    ) {
      // User changed the value; target kept the base value - take user's change
      merged[key] = user[key];
    }
    // If target also changed the value from base, target wins (already in merged)
  }

  return merged;
}

function mergeJson(base: string, user: string, target: string): MergeResult {
  try {
    const baseObj = JSON.parse(base);
    const userObj = JSON.parse(user);
    const targetObj = JSON.parse(target);

    if (
      typeof baseObj !== 'object' ||
      baseObj === null ||
      typeof userObj !== 'object' ||
      userObj === null ||
      typeof targetObj !== 'object' ||
      targetObj === null
    ) {
      // Primitive JSON - fall back to text merge
      return performThreeWayMerge(base, user, target);
    }

    const merged = deepMergeJson(baseObj, userObj, targetObj);
    return {
      success: true,
      content: JSON.stringify(merged, null, 2),
      conflicts: [],
    };
  } catch {
    // Invalid JSON - fall back to text merge
    return performThreeWayMerge(base, user, target);
  }
}

// ---------------------------------------------------------------------------
// detectFileType
// ---------------------------------------------------------------------------

const EXT_MAP: Record<string, string> = {
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.toml': 'toml',
  '.ini': 'ini',
  '.env': 'env',
  '.txt': 'text',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'css',
};

export function detectFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_MAP[ext] ?? 'text';
}

// ---------------------------------------------------------------------------
// MergeStrategyManager class
// ---------------------------------------------------------------------------

export class MergeStrategyManager {
  private autoResolve: boolean;
  private preserveComments: boolean;

  constructor(options: MergeStrategyOptions = {}) {
    this.autoResolve = options.autoResolve ?? false;
    this.preserveComments = options.preserveComments ?? false;
  }

  /**
   * Two-way merge: apply changes from `_remote` (modified) onto `_local` (base).
   * The third `_base` parameter is accepted for backwards-compatibility but is
   * unused in the two-way variant - use `threeWayMerge` when the ancestor is
   * meaningful.
   */
  merge(_local: string, _remote: string, _base?: string): MergeResult {
    return applyTwoWayMerge(_local, _remote);
  }

  /**
   * Three-way merge using the ancestor `base`, local `user` changes and
   * incoming `target` changes.
   *
   * Accepts either an options object (used by project-update.ts) or three
   * positional strings for simpler call-sites.
   */
  threeWayMerge(
    optionsOrBase: ThreeWayMergeOptions | string,
    user?: string,
    target?: string
  ): MergeResult {
    let base: string;
    let userContent: string;
    let targetContent: string;
    let fileType: string | undefined;

    if (typeof optionsOrBase === 'object') {
      base = optionsOrBase.base;
      userContent = optionsOrBase.user;
      targetContent = optionsOrBase.target;
      fileType =
        optionsOrBase.fileType ??
        (optionsOrBase.filePath
          ? detectFileType(optionsOrBase.filePath)
          : undefined);
    } else {
      base = optionsOrBase;
      userContent = user ?? '';
      targetContent = target ?? '';
    }

    if (fileType === 'json') {
      return mergeJson(base, userContent, targetContent);
    }

    return performThreeWayMerge(
      base,
      userContent,
      targetContent,
      this.autoResolve
    );
  }
}

// ---------------------------------------------------------------------------
// Standalone exported functions (original stubs)
// ---------------------------------------------------------------------------

/**
 * Standalone three-way merge function.
 *
 * Parameter order matches the original stub signature:
 *   threeWayMerge(local, remote, base)
 * where `local` is ours, `remote` is theirs, and `base` is the common ancestor.
 */
export function threeWayMerge(
  _local: string,
  _remote: string,
  _base: string
): MergeResult {
  return performThreeWayMerge(_base, _local, _remote);
}

// ---------------------------------------------------------------------------
// Factory helper (used by tests)
// ---------------------------------------------------------------------------

export function createMergeManager(
  options: MergeStrategyOptions = {}
): MergeStrategyManager {
  return new MergeStrategyManager(options);
}
