/**
 * Conflict Resolution Module
 *
 * Implements three-way merge conflict detection and resolution.
 * Supports auto-resolution for non-conflicting changes and conflict markers
 * for true line-level conflicts.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type ConflictSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ConflictResolution =
  | 'keep-user'
  | 'take-target'
  | 'keep-both'
  | 'manual';
export type ConflictCategory =
  | 'config'
  | 'template'
  | 'code'
  | 'dependency'
  | 'unknown';

export interface ResolutionSuggestion {
  resolution: ConflictResolution;
  confidence: number;
  reasoning: string;
  alternatives: ConflictResolution[];
}

export interface UpdateConflict {
  /** Unique identifier for this conflict */
  id: string;
  /** Absolute path of the conflicting file */
  filePath: string;
  /** Human-readable description of the conflict */
  description: string;
  /** Conflict category for grouping and auto-resolution */
  category: ConflictCategory;
  /** Whether this conflict can be automatically resolved */
  autoResolvable: boolean;
  /** Suggested resolution strategy */
  suggestion: ResolutionSuggestion;
  /** Severity level */
  severity: ConflictSeverity;
  /** Original base content (ancestor) */
  baseContent: string;
  /** User-modified content (ours) */
  userContent: string;
  /** Incoming target content (theirs) */
  targetContent: string;
  /** Generic local value (for non-textual conflicts) */
  localValue: unknown;
  /** Generic remote value (for non-textual conflicts) */
  remoteValue: unknown;
  /** Line number where the conflict originates, if known */
  line?: number;
  /** type field kept for backwards compatibility */
  type: string;
}

export interface ConflictResolutionResult {
  /** Whether the conflict was resolved */
  resolved: boolean;
  /** The resolved value / merged content */
  value: unknown;
  /** Which resolution strategy was applied */
  strategy?: ConflictResolution;
  /** Merged text content when applicable */
  mergedContent?: string;
  /** Conflict markers embedded in content (when strategy is 'manual') */
  conflictMarkers?: string[];
}

export interface ConflictResolverOptions {
  /** Prompt the user when a conflict cannot be auto-resolved */
  interactive?: boolean;
  /** Auto-resolve conflicts rated as 'low' severity */
  autoResolveLow?: boolean;
  /** Auto-resolve conflicts rated as 'medium' severity */
  autoResolveMedium?: boolean;
}

export interface ConflictResolver {
  resolve(conflict: UpdateConflict): Promise<ConflictResolutionResult>;
  startSession(conflicts: UpdateConflict[]): void;
  resolveAll(): Promise<ConflictResolutionResult[]>;
  createUpdateConflict(
    mergeConflict: { line: number; description: string },
    filePath: string
  ): UpdateConflict;
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

/**
 * Compute a line-level longest-common-subsequence between two string arrays.
 * Returns an array of "edit" objects describing the differences.
 */
type DiffOp = 'equal' | 'insert' | 'delete';

interface DiffEntry {
  op: DiffOp;
  line: string;
  indexA: number;
  indexB: number;
}

function lcsLength(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  // Use a flat Int32Array for performance
  const dp: number[] = new Array((m + 1) * (n + 1)).fill(0);
  const idx = (i: number, j: number) => i * (n + 1) + j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[idx(i, j)] =
        a[i - 1] === b[j - 1]
          ? dp[idx(i - 1, j - 1)] + 1
          : Math.max(dp[idx(i - 1, j)], dp[idx(i, j - 1)]);
    }
  }
  // Convert flat array back to 2D
  const table: number[][] = [];
  for (let i = 0; i <= m; i++) {
    table.push(dp.slice(i * (n + 1), (i + 1) * (n + 1)));
  }
  return table;
}

function diff(a: string[], b: string[]): DiffEntry[] {
  const table = lcsLength(a, b);
  const result: DiffEntry[] = [];

  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({
        op: 'equal',
        line: a[i - 1],
        indexA: i - 1,
        indexB: j - 1,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.unshift({
        op: 'insert',
        line: b[j - 1],
        indexA: i,
        indexB: j - 1,
      });
      j--;
    } else {
      result.unshift({
        op: 'delete',
        line: a[i - 1],
        indexA: i - 1,
        indexB: j,
      });
      i--;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Three-way merge core
// ---------------------------------------------------------------------------

export interface MergeHunk {
  /** Lines shared by all three versions */
  common: string[];
  /** Lines that only appear in base (deleted in both ours and theirs) */
  baseOnly: string[];
  /** Lines modified/added in ours */
  ours: string[];
  /** Lines modified/added in theirs */
  theirs: string[];
  /** Whether both sides changed the same base lines differently */
  isConflict: boolean;
  /** Starting line number in the base (0-indexed) */
  baseStartLine: number;
}

export interface ThreeWayMergeResult {
  /** Merged content (may contain conflict markers for unresolved conflicts) */
  mergedContent: string;
  /** True when there are no conflict markers */
  hasConflicts: boolean;
  /** Individual conflict hunks */
  conflictHunks: MergeHunk[];
  /** Auto-resolved hunks (non-conflicting changes applied) */
  resolvedHunks: number;
}

const CONFLICT_START = '<<<<<<< ours';
const CONFLICT_SEP = '=======';
const CONFLICT_END = '>>>>>>> theirs';

/**
 * Perform a three-way merge of text content.
 *
 * Strategy:
 *  1. Diff base -> ours to find what we changed.
 *  2. Diff base -> theirs to find what they changed.
 *  3. Walk through base lines. Where only one side changed, take that change
 *     (auto-resolve). Where both sides changed the same region differently,
 *     emit conflict markers.
 */
export function threeWayMergeText(
  base: string,
  ours: string,
  theirs: string
): ThreeWayMergeResult {
  const baseLines = base.split('\n');
  const oursLines = ours.split('\n');
  const theirsLines = theirs.split('\n');

  // Build change maps: baseIndex -> replacement lines (null = deleted)
  const oursChanges = buildChangeMap(baseLines, oursLines);
  const theirsChanges = buildChangeMap(baseLines, theirsLines);

  const mergedLines: string[] = [];
  const conflictHunks: MergeHunk[] = [];
  let resolvedHunks = 0;
  let hasConflicts = false;

  let baseIdx = 0;
  while (baseIdx < baseLines.length) {
    const oursChange = oursChanges.get(baseIdx);
    const theirsChange = theirsChanges.get(baseIdx);

    const oursModified = oursChange !== undefined;
    const theirsModified = theirsChange !== undefined;

    if (!oursModified && !theirsModified) {
      // Both sides kept the line unchanged
      mergedLines.push(baseLines[baseIdx]);
      baseIdx++;
      continue;
    }

    // Determine the extent of this change region on the base side
    const regionEnd = findRegionEnd(
      baseIdx,
      oursChanges,
      theirsChanges,
      baseLines.length
    );

    // Collect all base lines in the region
    const baseRegion: string[] = baseLines.slice(baseIdx, regionEnd);

    // Collect ours replacement for the whole region
    const oursRegion = collectRegionReplacement(
      baseIdx,
      regionEnd,
      oursChanges,
      baseLines
    );
    const theirsRegion = collectRegionReplacement(
      baseIdx,
      regionEnd,
      theirsChanges,
      baseLines
    );

    const oursChanged = !arraysEqual(baseRegion, oursRegion);
    const theirsChanged = !arraysEqual(baseRegion, theirsRegion);

    if (oursChanged && !theirsChanged) {
      // Only we changed this region - take ours
      mergedLines.push(...oursRegion);
      resolvedHunks++;
    } else if (!oursChanged && theirsChanged) {
      // Only they changed this region - take theirs
      mergedLines.push(...theirsRegion);
      resolvedHunks++;
    } else if (arraysEqual(oursRegion, theirsRegion)) {
      // Both changed identically - take either (ours)
      mergedLines.push(...oursRegion);
      resolvedHunks++;
    } else {
      // True conflict - both sides changed the same region differently
      hasConflicts = true;
      mergedLines.push(CONFLICT_START);
      mergedLines.push(...oursRegion);
      mergedLines.push(CONFLICT_SEP);
      mergedLines.push(...theirsRegion);
      mergedLines.push(CONFLICT_END);

      conflictHunks.push({
        common: [],
        baseOnly: baseRegion,
        ours: oursRegion,
        theirs: theirsRegion,
        isConflict: true,
        baseStartLine: baseIdx,
      });
    }

    baseIdx = regionEnd;
  }

  return {
    mergedContent: mergedLines.join('\n'),
    hasConflicts,
    conflictHunks,
    resolvedHunks,
  };
}

// ---------------------------------------------------------------------------
// Change map builder
// ---------------------------------------------------------------------------

/**
 * Represents what happened to a contiguous block of base lines.
 * baseStartIndex -> { baseCount, replacementLines }
 */
type ChangeMap = Map<number, { baseCount: number; lines: string[] }>;

function buildChangeMap(
  baseLines: string[],
  changedLines: string[]
): ChangeMap {
  const entries = diff(baseLines, changedLines);
  const map: ChangeMap = new Map();

  let baseIdx = 0;
  let entryIdx = 0;

  while (entryIdx < entries.length) {
    const entry = entries[entryIdx];

    if (entry.op === 'equal') {
      baseIdx++;
      entryIdx++;
      continue;
    }

    // Start of a change region
    const regionBaseStart = baseIdx;
    const deletedLines: string[] = [];
    const insertedLines: string[] = [];

    // Consume all consecutive non-equal ops
    while (entryIdx < entries.length && entries[entryIdx].op !== 'equal') {
      const e = entries[entryIdx];
      if (e.op === 'delete') {
        deletedLines.push(e.line);
        baseIdx++;
      } else {
        insertedLines.push(e.line);
      }
      entryIdx++;
    }

    map.set(regionBaseStart, {
      baseCount: deletedLines.length,
      lines: insertedLines,
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Region helpers
// ---------------------------------------------------------------------------

/**
 * Find the end (exclusive) of the change region starting at baseStart.
 * Expands to cover any overlapping changes from both sides.
 */
function findRegionEnd(
  baseStart: number,
  oursChanges: ChangeMap,
  theirsChanges: ChangeMap,
  baseLength: number
): number {
  let end = baseStart + 1;

  // Expand based on ours changes
  const oursChange = oursChanges.get(baseStart);
  if (oursChange) {
    end = Math.max(end, baseStart + Math.max(oursChange.baseCount, 1));
  }

  // Expand based on theirs changes
  const theirsChange = theirsChanges.get(baseStart);
  if (theirsChange) {
    end = Math.max(end, baseStart + Math.max(theirsChange.baseCount, 1));
  }

  return Math.min(end, baseLength);
}

/**
 * Collect the replacement lines for the base region [start, end).
 * Lines not covered by a change entry are taken as-is from base.
 */
function collectRegionReplacement(
  start: number,
  end: number,
  changes: ChangeMap,
  baseLines: string[]
): string[] {
  const result: string[] = [];
  let idx = start;

  while (idx < end) {
    const change = changes.get(idx);
    if (change) {
      result.push(...change.lines);
      idx += Math.max(change.baseCount, 1);
    } else {
      result.push(baseLines[idx]);
      idx++;
    }
  }

  return result;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Conflict resolver implementation
// ---------------------------------------------------------------------------

let conflictIdCounter = 0;

function nextConflictId(): string {
  conflictIdCounter++;
  return `conflict-${Date.now()}-${conflictIdCounter}`;
}

function inferCategory(filePath: string): ConflictCategory {
  const lower = filePath.toLowerCase();
  if (lower.includes('package.json') || lower.includes('.npmrc'))
    return 'dependency';
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.toml') ||
    lower.endsWith('.env')
  )
    return 'config';
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx')
  )
    return 'code';
  if (
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.html') ||
    lower.endsWith('.hbs')
  )
    return 'template';
  return 'unknown';
}

function buildSuggestion(
  category: ConflictCategory,
  severity: ConflictSeverity
): ResolutionSuggestion {
  let resolution: ConflictResolution;
  let confidence: number;
  let reasoning: string;
  const alternatives: ConflictResolution[] = [
    'keep-user',
    'take-target',
    'keep-both',
    'manual',
  ];

  switch (category) {
    case 'config':
      resolution = 'keep-both';
      confidence = 0.7;
      reasoning =
        'Config files often have user-specific values that should be preserved alongside new defaults.';
      break;
    case 'dependency':
      resolution = 'take-target';
      confidence = 0.8;
      reasoning =
        'Dependency updates typically should take the newer version from the target to ensure compatibility.';
      break;
    case 'template':
      resolution = 'keep-user';
      confidence = 0.75;
      reasoning =
        'Template customisations represent user intent and should be preserved by default.';
      break;
    case 'code':
      if (severity === 'low') {
        resolution = 'take-target';
        confidence = 0.65;
        reasoning =
          'Low-severity code conflicts can usually accept the incoming change safely.';
      } else {
        resolution = 'manual';
        confidence = 0.5;
        reasoning =
          'Code conflicts with significant changes require manual review to ensure correctness.';
      }
      break;
    default:
      resolution = 'manual';
      confidence = 0.4;
      reasoning =
        'Unable to determine a safe automatic resolution strategy for this file type.';
  }

  return {
    resolution,
    confidence,
    reasoning,
    alternatives: alternatives.filter(a => a !== resolution),
  };
}

function computeSeverity(
  baseContent: string,
  userContent: string,
  targetContent: string,
  category: ConflictCategory
): ConflictSeverity {
  if (category === 'dependency') return 'medium';

  const baseLinesCount = baseContent.split('\n').length;
  const oursLinesDelta = Math.abs(
    userContent.split('\n').length - baseLinesCount
  );
  const theirsLinesDelta = Math.abs(
    targetContent.split('\n').length - baseLinesCount
  );
  const combinedDelta = oursLinesDelta + theirsLinesDelta;

  if (category === 'code') {
    if (combinedDelta > 50) return 'critical';
    if (combinedDelta > 20) return 'high';
    if (combinedDelta > 5) return 'medium';
    return 'low';
  }

  if (combinedDelta > 30) return 'high';
  if (combinedDelta > 10) return 'medium';
  return 'low';
}

/**
 * Resolve a single conflict using the three-way merge strategy.
 *
 * - Strings: perform text three-way merge.
 * - Non-strings: compare localValue vs remoteValue and either auto-resolve
 *   or report a conflict.
 */
async function resolveConflict(
  conflict: UpdateConflict,
  options: ConflictResolverOptions
): Promise<ConflictResolutionResult> {
  // Text-based resolution (when content fields are populated)
  if (
    typeof conflict.baseContent === 'string' &&
    typeof conflict.userContent === 'string' &&
    typeof conflict.targetContent === 'string' &&
    (conflict.baseContent || conflict.userContent || conflict.targetContent)
  ) {
    return resolveTextConflict(conflict, options);
  }

  // Non-textual value conflict
  return resolveValueConflict(conflict, options);
}

function resolveTextConflict(
  conflict: UpdateConflict,
  options: ConflictResolverOptions
): ConflictResolutionResult {
  const {
    baseContent,
    userContent,
    targetContent,
    severity,
    suggestion,
    autoResolvable,
  } = conflict;

  // If content is identical between user and target, no real conflict
  if (userContent === targetContent) {
    return {
      resolved: true,
      value: userContent,
      strategy: 'keep-user',
      mergedContent: userContent,
    };
  }

  // If only the user changed it (base === theirs), keep user
  if (baseContent === targetContent) {
    return {
      resolved: true,
      value: userContent,
      strategy: 'keep-user',
      mergedContent: userContent,
    };
  }

  // If only the target changed it (base === ours), take target
  if (baseContent === userContent) {
    return {
      resolved: true,
      value: targetContent,
      strategy: 'take-target',
      mergedContent: targetContent,
    };
  }

  // Both sides changed - attempt three-way merge
  const mergeResult = threeWayMergeText(
    baseContent,
    userContent,
    targetContent
  );

  if (!mergeResult.hasConflicts) {
    // Clean merge - auto-resolved
    return {
      resolved: true,
      value: mergeResult.mergedContent,
      strategy: 'keep-both',
      mergedContent: mergeResult.mergedContent,
    };
  }

  // Remaining conflicts - check if we can auto-resolve
  const canAutoResolve =
    autoResolvable ||
    (severity === 'low' && options.autoResolveLow) ||
    (severity === 'medium' && options.autoResolveMedium);

  if (canAutoResolve) {
    // Apply the suggested resolution strategy
    const resolution = suggestion.resolution;
    let resolved: string;

    if (resolution === 'keep-user') {
      resolved = userContent;
    } else if (resolution === 'take-target') {
      resolved = targetContent;
    } else {
      // keep-both: use the content with conflict markers so callers can see what merged
      resolved = mergeResult.mergedContent;
    }

    return {
      resolved: true,
      value: resolved,
      strategy: resolution,
      mergedContent: resolved,
    };
  }

  // Cannot auto-resolve: return conflict markers for manual intervention
  return {
    resolved: false,
    value: mergeResult.mergedContent,
    strategy: 'manual',
    mergedContent: mergeResult.mergedContent,
    conflictMarkers: mergeResult.conflictHunks.map(
      h =>
        `${CONFLICT_START}\n${h.ours.join('\n')}\n${CONFLICT_SEP}\n${h.theirs.join('\n')}\n${CONFLICT_END}`
    ),
  };
}

function resolveValueConflict(
  conflict: UpdateConflict,
  options: ConflictResolverOptions
): ConflictResolutionResult {
  const { localValue, remoteValue, severity, suggestion, autoResolvable } =
    conflict;

  if (localValue === remoteValue) {
    return { resolved: true, value: localValue, strategy: 'keep-user' };
  }

  const canAutoResolve =
    autoResolvable ||
    (severity === 'low' && options.autoResolveLow) ||
    (severity === 'medium' && options.autoResolveMedium);

  if (canAutoResolve) {
    const value =
      suggestion.resolution === 'take-target' ? remoteValue : localValue;
    return { resolved: true, value, strategy: suggestion.resolution };
  }

  return { resolved: false, value: null, strategy: 'manual' };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

class ConflictResolverImpl implements ConflictResolver {
  private projectRoot: string;
  private options: ConflictResolverOptions;
  private sessionConflicts: UpdateConflict[] = [];

  constructor(projectRoot: string, options: ConflictResolverOptions = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      interactive: false,
      autoResolveLow: true,
      autoResolveMedium: false,
      ...options,
    };
  }

  /**
   * Resolve a single conflict.
   */
  async resolve(conflict: UpdateConflict): Promise<ConflictResolutionResult> {
    return resolveConflict(conflict, this.options);
  }

  /**
   * Begin a resolution session with a list of conflicts.
   */
  startSession(conflicts: UpdateConflict[]): void {
    this.sessionConflicts = [...conflicts];
  }

  /**
   * Resolve all conflicts registered with startSession().
   */
  async resolveAll(): Promise<ConflictResolutionResult[]> {
    const results: ConflictResolutionResult[] = [];
    for (const conflict of this.sessionConflicts) {
      const result = await this.resolve(conflict);
      results.push(result);
    }
    this.sessionConflicts = [];
    return results;
  }

  /**
   * Convert a raw merge conflict (line + description) into a full UpdateConflict.
   * The merge-strategy module produces minimal conflict objects; this method
   * enriches them with metadata for resolution.
   */
  createUpdateConflict(
    mergeConflict: { line: number; description: string },
    filePath: string
  ): UpdateConflict {
    const category = inferCategory(filePath);
    const severity = 'medium' as ConflictSeverity;
    const suggestion = buildSuggestion(category, severity);

    return {
      id: nextConflictId(),
      filePath,
      description: mergeConflict.description,
      type: 'merge',
      category,
      autoResolvable: false,
      suggestion,
      severity,
      baseContent: '',
      userContent: '',
      targetContent: '',
      localValue: null,
      remoteValue: null,
      line: mergeConflict.line,
    };
  }
}

/**
 * Create a ConflictResolver instance.
 *
 * Accepts an optional projectRoot and options object so the factory
 * signature matches the usage in project-update.ts:
 *
 *   createConflictResolver(projectRoot, { interactive, autoResolveLow, autoResolveMedium })
 *
 * and also the original zero-argument form:
 *
 *   createConflictResolver()
 */
export function createConflictResolver(
  projectRoot: string = process.cwd(),
  options: ConflictResolverOptions = {}
): ConflictResolver {
  return new ConflictResolverImpl(projectRoot, options);
}
