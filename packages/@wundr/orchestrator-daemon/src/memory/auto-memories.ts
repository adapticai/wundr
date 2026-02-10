/**
 * AutoMemories - Central coordinator for persistent learning
 *
 * Manages the lifecycle of automatic memory detection, storage, injection
 * into the system prompt, and maintenance (consolidation, decay, linking,
 * search, session summaries, and versioning).
 *
 * Inspired by Claude Code's persistent learning feature and enhanced with
 * patterns from OpenClaw's memory indexing system. Memories are stored
 * in scoped MEMORY.md files (user / project / local) as plain markdown that
 * users can inspect, edit, and version-control.
 *
 * Key capabilities:
 *   - MEMORY.md file management (read, write, update, truncation at line limit)
 *   - Topic-based memory organization (separate files: debugging.md, patterns.md)
 *   - Semantic deduplication (bag-of-words cosine similarity)
 *   - Memory relevance scoring based on current context
 *   - Memory pruning (remove outdated or contradicted memories)
 *   - Memory linking (cross-references between memory entries)
 *   - Session summary generation at session end
 *   - Memory import from conversation transcripts
 *   - Memory search with relevance ranking
 *   - Memory scopes (user-level, project-level, local/workspace)
 *   - Memory versioning and rollback
 *   - Memory size management (keep under limits)
 *   - Integration with session lifecycle hooks
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  LearningDetector,
  type ConversationTurn,
  type DetectedMemory,
  type MemoryScope,
} from './learning-detector';
import {
  MemoryFileManager,
  type ParsedMemoryFile,
  type ConsolidationResult,
  type MemoryVersion,
} from './memory-file-manager';
import {
  MemoryLinker,
  type LinkingResult,
} from './memory-linker';
import {
  MemorySearch,
  type MemorySearchResult,
  type MemorySearchOptions,
  type RelevanceContext,
} from './memory-search';
import {
  SessionSummaryGenerator,
  type SessionSummaryResult,
} from './session-summary';
import { Logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Merged memories from all scopes, ready for injection.
 */
export interface MergedMemories {
  /** Entries grouped by section title */
  sections: Map<string, string[]>;
  /** Total entry count across all scopes */
  totalEntries: number;
  /** Which scopes were loaded */
  loadedScopes: MemoryScope[];
  /** File paths that were loaded */
  loadedPaths: string[];
}

/**
 * Result of a decay check across all scopes.
 */
export interface DecayResult {
  /** Entries marked as stale */
  markedStale: number;
  /** Entries removed (previously stale and still not confirmed) */
  removed: number;
  /** Scopes checked */
  scopesChecked: MemoryScope[];
}

/**
 * Result of a pruning operation.
 */
export interface PruneResult {
  /** Entries that were contradicted and removed */
  contradicted: number;
  /** Entries that were outdated and removed */
  outdated: number;
  /** Total entries removed */
  totalRemoved: number;
}

/**
 * Statistics about the auto-memories system.
 */
export interface MemoryStats {
  /** Total entries across all scopes */
  totalEntries: number;
  /** Entries per scope */
  entriesByScope: Record<string, number>;
  /** Entries per section */
  entriesBySection: Record<string, number>;
  /** Total file size in bytes */
  totalSizeBytes: number;
  /** Number of overflow files */
  overflowFileCount: number;
  /** Number of stored versions */
  versionCount: number;
  /** Total links between entries */
  totalLinks: number;
}

/**
 * Configuration for the AutoMemories system.
 */
export interface AutoMemoriesConfig {
  /** Enable the auto-memories system */
  enabled: boolean;

  /** User home directory for user-scope memories */
  userHome: string;

  /** Project root directory for project/local-scope memories */
  projectRoot: string;

  /** Maximum lines per MEMORY.md file */
  maxLinesPerFile: number;

  /** Token budget for the memory section in the system prompt */
  injectionTokenBudget: number;

  /** Minimum detection confidence to auto-store */
  minConfidence: number;

  /** Enable memory decay checking */
  decayEnabled: boolean;

  /** Days before marking an entry as stale */
  decayDays: number;

  /** Enable topic overflow to memory/*.md files */
  overflowEnabled: boolean;

  /** Enable user-scope memories */
  userScopeEnabled: boolean;

  /** Enable project-scope memories */
  projectScopeEnabled: boolean;

  /** Enable local-scope memories */
  localScopeEnabled: boolean;

  /** Enable session summary generation */
  sessionSummaryEnabled: boolean;

  /** Enable automatic linking between entries */
  autoLinkEnabled: boolean;

  /** Enable versioning of memory files */
  versioningEnabled: boolean;

  /** Maximum versions per file */
  maxVersions: number;

  /** Maximum total size in bytes for all memory files */
  maxTotalSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AutoMemoriesConfig = {
  enabled: true,
  userHome: os.homedir(),
  projectRoot: process.cwd(),
  maxLinesPerFile: 200,
  injectionTokenBudget: 2000,
  minConfidence: 0.6,
  decayEnabled: true,
  decayDays: 90,
  overflowEnabled: true,
  userScopeEnabled: true,
  projectScopeEnabled: true,
  localScopeEnabled: true,
  sessionSummaryEnabled: true,
  autoLinkEnabled: true,
  versioningEnabled: true,
  maxVersions: 10,
  maxTotalSizeBytes: 512 * 1024,
};

/**
 * Priority order for sections when trimming to token budget.
 * Lower index = higher priority (kept first).
 */
const SECTION_PRIORITY: string[] = [
  'Corrections',
  'User Preferences',
  'Project Conventions',
  'Error Patterns',
  'Tool Usage',
  'Workflow',
  'Architecture Decisions',
  'People & Roles',
  'Links',
];

/** Approximate characters per token for budget estimation */
const CHARS_PER_TOKEN = 4;

const logger = new Logger('AutoMemories');

// ---------------------------------------------------------------------------
// AutoMemories
// ---------------------------------------------------------------------------

export class AutoMemories {
  private config: AutoMemoriesConfig;
  private fileManager: MemoryFileManager;
  private detector: LearningDetector;
  private searcher: MemorySearch;
  private summaryGenerator: SessionSummaryGenerator;
  private linker: MemoryLinker;

  /** Turns accumulated in the current session for summary generation */
  private sessionTurns: ConversationTurn[] = [];
  /** Count of memories stored in the current session */
  private sessionMemoriesStored = 0;

  constructor(config?: Partial<AutoMemoriesConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.fileManager = new MemoryFileManager({
      maxLines: this.config.maxLinesPerFile,
      overflowDirName: 'memory',
      overflowThreshold: 5,
      maxVersions: this.config.maxVersions,
      maxTotalSizeBytes: this.config.maxTotalSizeBytes,
    });

    this.detector = new LearningDetector({
      minConfidence: this.config.minConfidence,
    });

    this.searcher = new MemorySearch(this.fileManager);

    this.summaryGenerator = new SessionSummaryGenerator();

    this.linker = new MemoryLinker(this.fileManager);
  }

  // -------------------------------------------------------------------------
  // Scope Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve the file paths for all memory scopes.
   */
  resolvePaths(): {
    user: string;
    project: string;
    local: string;
  } {
    return {
      user: path.join(this.config.userHome, '.wundr', 'MEMORY.md'),
      project: path.join(this.config.projectRoot, '.wundr', 'MEMORY.md'),
      local: path.join(
        this.config.projectRoot,
        '.wundr',
        'local',
        'MEMORY.md',
      ),
    };
  }

  /**
   * Resolve the file path for a specific scope.
   */
  resolvePathForScope(scope: MemoryScope): string {
    const paths = this.resolvePaths();
    return paths[scope];
  }

  // -------------------------------------------------------------------------
  // Loading and Merging
  // -------------------------------------------------------------------------

  /**
   * Load and merge memories from all enabled scopes.
   *
   * Scopes are merged in priority order: user (lowest) < project < local
   * (highest). For conflicting entries (same normalized text in the same
   * section), the higher-priority scope wins.
   */
  async loadAll(): Promise<MergedMemories> {
    const paths = this.resolvePaths();
    const sections = new Map<string, string[]>();
    const loadedScopes: MemoryScope[] = [];
    const loadedPaths: string[] = [];
    let totalEntries = 0;

    const scopeOrder: Array<{
      scope: MemoryScope;
      enabled: boolean;
      path: string;
    }> = [
      { scope: 'user', enabled: this.config.userScopeEnabled, path: paths.user },
      { scope: 'project', enabled: this.config.projectScopeEnabled, path: paths.project },
      { scope: 'local', enabled: this.config.localScopeEnabled, path: paths.local },
    ];

    for (const { scope, enabled, path: filePath } of scopeOrder) {
      if (!enabled) {
        continue;
      }

      const file = await this.fileManager.read(filePath);
      if (!file.exists) {
        continue;
      }

      loadedScopes.push(scope);
      loadedPaths.push(filePath);

      for (const section of file.sections) {
        const existing = sections.get(section.title) ?? [];
        for (const entry of section.entries) {
          if (entry.metadata?.stale && section.title !== 'Corrections') {
            continue;
          }
          existing.push(entry.text);
          totalEntries++;
        }
        sections.set(section.title, existing);
      }
    }

    return { sections, totalEntries, loadedScopes, loadedPaths };
  }

  /**
   * Load the ParsedMemoryFile objects for all enabled scopes.
   */
  async loadAllParsed(): Promise<ParsedMemoryFile[]> {
    const paths = this.resolvePaths();
    const files: ParsedMemoryFile[] = [];

    const scopeOrder: Array<{ enabled: boolean; path: string }> = [
      { enabled: this.config.userScopeEnabled, path: paths.user },
      { enabled: this.config.projectScopeEnabled, path: paths.project },
      { enabled: this.config.localScopeEnabled, path: paths.local },
    ];

    for (const { enabled, path: filePath } of scopeOrder) {
      if (!enabled) {
        continue;
      }
      const file = await this.fileManager.read(filePath);
      if (file.exists) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Load all parsed files with their scope labels (for search).
   */
  private async loadAllWithScopes(): Promise<
    Array<{ file: ParsedMemoryFile; scope: string }>
  > {
    const paths = this.resolvePaths();
    const result: Array<{ file: ParsedMemoryFile; scope: string }> = [];

    const scopeOrder: Array<{
      scope: MemoryScope;
      enabled: boolean;
      path: string;
    }> = [
      { scope: 'user', enabled: this.config.userScopeEnabled, path: paths.user },
      { scope: 'project', enabled: this.config.projectScopeEnabled, path: paths.project },
      { scope: 'local', enabled: this.config.localScopeEnabled, path: paths.local },
    ];

    for (const { scope, enabled, path: filePath } of scopeOrder) {
      if (!enabled) {
        continue;
      }
      const file = await this.fileManager.read(filePath);
      if (file.exists) {
        result.push({ file, scope });
      }

      // Also load overflow files
      const overflowDir = path.join(path.dirname(filePath), 'memory');
      try {
        const overflowEntries = await fs.readdir(overflowDir);
        for (const entry of overflowEntries) {
          if (!entry.endsWith('.md')) {
            continue;
          }
          const overflowPath = path.join(overflowDir, entry);
          const overflowFile = await this.fileManager.read(overflowPath);
          if (overflowFile.exists) {
            result.push({ file: overflowFile, scope });
          }
        }
      } catch {
        // Overflow dir may not exist
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // System Prompt Injection
  // -------------------------------------------------------------------------

  /**
   * Format merged memories for injection into the system prompt.
   *
   * Returns a markdown string that fits within the configured token budget.
   * Sections are prioritized by the SECTION_PRIORITY order; lower-priority
   * sections are dropped first when the budget is exceeded.
   */
  formatForSystemPrompt(memories: MergedMemories): string {
    if (memories.totalEntries === 0) {
      return '';
    }

    const budgetChars = this.config.injectionTokenBudget * CHARS_PER_TOKEN;
    const lines: string[] = [
      '## Persistent Memories',
      '',
      'The following memories have been automatically learned from previous',
      'sessions. Use them to provide more personalized and accurate responses.',
      'If any memory seems outdated, update it.',
      '',
    ];

    let usedChars = lines.join('\n').length;

    // Build sections in priority order
    for (const sectionTitle of SECTION_PRIORITY) {
      const entries = memories.sections.get(sectionTitle);
      if (!entries || entries.length === 0) {
        continue;
      }

      const sectionLines = [`### ${sectionTitle}`];
      for (const entry of entries) {
        sectionLines.push(`- ${entry}`);
      }
      sectionLines.push('');

      const sectionText = sectionLines.join('\n');
      if (usedChars + sectionText.length > budgetChars) {
        const partialLines = [`### ${sectionTitle}`];
        let partialChars = partialLines.join('\n').length + 1;

        for (const entry of entries) {
          const entryLine = `- ${entry}\n`;
          if (usedChars + partialChars + entryLine.length > budgetChars) {
            break;
          }
          partialLines.push(`- ${entry}`);
          partialChars += entryLine.length;
        }

        if (partialLines.length > 1) {
          partialLines.push('');
          lines.push(...partialLines);
          usedChars += partialChars;
        }

        break;
      }

      lines.push(...sectionLines);
      usedChars += sectionText.length;
    }

    // Include any sections not in the priority list
    for (const [sectionTitle, entries] of memories.sections) {
      if (SECTION_PRIORITY.includes(sectionTitle)) {
        continue;
      }
      if (entries.length === 0) {
        continue;
      }

      const sectionLines = [`### ${sectionTitle}`];
      for (const entry of entries) {
        sectionLines.push(`- ${entry}`);
      }
      sectionLines.push('');

      const sectionText = sectionLines.join('\n');
      if (usedChars + sectionText.length > budgetChars) {
        break;
      }

      lines.push(...sectionLines);
      usedChars += sectionText.length;
    }

    return lines.join('\n');
  }

  /**
   * Convenience: load all memories and format for system prompt.
   */
  async buildSystemPromptSection(): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const memories = await this.loadAll();
    return this.formatForSystemPrompt(memories);
  }

  /**
   * Build a context-aware system prompt section.
   *
   * Uses relevance scoring to prioritize memories that are most relevant
   * to the current context (current file, task, recent errors, etc.).
   */
  async buildContextAwarePromptSection(
    context: RelevanceContext,
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const files = await this.loadAllWithScopes();
    const contextQuery = [
      context.taskDescription ?? '',
      context.currentFile ?? '',
      ...(context.recentErrors ?? []),
    ]
      .filter(Boolean)
      .join(' ');

    if (!contextQuery.trim()) {
      return this.buildSystemPromptSection();
    }

    const results = this.searcher.search(
      contextQuery,
      files,
      { maxResults: 20, minScore: 0.05, recencyBoost: 0.3 },
      context,
    );

    if (results.length === 0) {
      return this.buildSystemPromptSection();
    }

    const budgetChars = this.config.injectionTokenBudget * CHARS_PER_TOKEN;
    const outputLines: string[] = [
      '## Persistent Memories (context-relevant)',
      '',
    ];

    let usedChars = outputLines.join('\n').length;

    // Group results by section
    const bySection = new Map<string, MemorySearchResult[]>();
    for (const result of results) {
      const existing = bySection.get(result.section) ?? [];
      existing.push(result);
      bySection.set(result.section, existing);
    }

    for (const [section, sectionResults] of bySection) {
      const sectionLines = [`### ${section}`];
      for (const result of sectionResults) {
        const entryLine = `- ${result.text}`;
        if (usedChars + entryLine.length + 2 > budgetChars) {
          break;
        }
        sectionLines.push(entryLine);
        usedChars += entryLine.length + 1;
      }
      if (sectionLines.length > 1) {
        sectionLines.push('');
        outputLines.push(...sectionLines);
      }
    }

    return outputLines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Learning: Turn Processing
  // -------------------------------------------------------------------------

  /**
   * Process a conversation turn for learnable moments.
   *
   * Detects patterns, deduplicates against existing memories, and stores
   * any new detections above the confidence threshold.
   */
  async processTurn(turn: ConversationTurn): Promise<DetectedMemory[]> {
    if (!this.config.enabled) {
      return [];
    }

    this.sessionTurns.push(turn);

    const existingFiles = await this.loadAllParsed();
    const detections = this.detector.analyzeAndDeduplicate(turn, existingFiles);

    const stored: DetectedMemory[] = [];

    for (const detection of detections) {
      const success = await this.storeMemory(detection);
      if (success) {
        stored.push(detection);
        this.sessionMemoriesStored++;
        logger.info(
          `Auto-stored memory [${detection.category}] (${detection.confidence}): ` +
            `"${detection.text.slice(0, 80)}..."`,
        );
      }
    }

    return stored;
  }

  /**
   * Store a single detected memory to the appropriate scope file.
   */
  async storeMemory(memory: DetectedMemory): Promise<boolean> {
    const filePath = this.resolvePathForScope(memory.scope);
    return this.fileManager.append(filePath, memory.section, memory.text, {
      confidence: memory.confidence,
      category: memory.category,
      sourceSession: memory.sourceTurn.sessionId,
    });
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Search across all memory scopes with relevance ranking.
   */
  async search(
    query: string,
    options?: MemorySearchOptions,
    context?: RelevanceContext,
  ): Promise<MemorySearchResult[]> {
    const files = await this.loadAllWithScopes();
    return this.searcher.search(query, files, options, context);
  }

  // -------------------------------------------------------------------------
  // Maintenance: Consolidation
  // -------------------------------------------------------------------------

  /**
   * Run consolidation on a specific scope.
   */
  async consolidate(scope: MemoryScope): Promise<ConsolidationResult> {
    if (!this.config.overflowEnabled) {
      return { movedEntries: 0, overflowFiles: [], linesBefore: 0, linesAfter: 0 };
    }

    const filePath = this.resolvePathForScope(scope);
    const needsIt = await this.fileManager.needsConsolidation(filePath);

    if (!needsIt) {
      return { movedEntries: 0, overflowFiles: [], linesBefore: 0, linesAfter: 0 };
    }

    logger.info(`Consolidating ${scope} scope: ${filePath}`);
    return this.fileManager.consolidate(filePath);
  }

  /**
   * Run consolidation on all enabled scopes.
   */
  async consolidateAll(): Promise<Map<MemoryScope, ConsolidationResult>> {
    const results = new Map<MemoryScope, ConsolidationResult>();
    const scopes: Array<{ scope: MemoryScope; enabled: boolean }> = [
      { scope: 'user', enabled: this.config.userScopeEnabled },
      { scope: 'project', enabled: this.config.projectScopeEnabled },
      { scope: 'local', enabled: this.config.localScopeEnabled },
    ];

    for (const { scope, enabled } of scopes) {
      if (!enabled) {
        continue;
      }
      const result = await this.consolidate(scope);
      results.set(scope, result);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Maintenance: Decay
  // -------------------------------------------------------------------------

  /**
   * Run a decay check across all enabled scopes.
   *
   * Entries older than `decayDays` that have not been confirmed are marked
   * stale. Entries that were previously stale and still not confirmed are
   * removed.
   */
  async decayCheck(): Promise<DecayResult> {
    if (!this.config.decayEnabled) {
      return { markedStale: 0, removed: 0, scopesChecked: [] };
    }

    const now = new Date();
    const thresholdMs = this.config.decayDays * 24 * 60 * 60 * 1000;
    let markedStale = 0;
    let removed = 0;
    const scopesChecked: MemoryScope[] = [];

    const scopes: Array<{ scope: MemoryScope; enabled: boolean }> = [
      { scope: 'user', enabled: this.config.userScopeEnabled },
      { scope: 'project', enabled: this.config.projectScopeEnabled },
      { scope: 'local', enabled: this.config.localScopeEnabled },
    ];

    for (const { scope, enabled } of scopes) {
      if (!enabled) {
        continue;
      }

      const filePath = this.resolvePathForScope(scope);
      const file = await this.fileManager.read(filePath);

      if (!file.exists) {
        continue;
      }

      scopesChecked.push(scope);
      let modified = false;

      for (const section of file.sections) {
        if (section.title === 'Links') {
          continue;
        }

        const surviving: typeof section.entries = [];

        for (const entry of section.entries) {
          const dateStr = entry.metadata?.dateConfirmed ?? entry.metadata?.dateAdded;
          if (!dateStr) {
            surviving.push(entry);
            continue;
          }

          const entryDate = new Date(dateStr);
          const ageMs = now.getTime() - entryDate.getTime();

          if (entry.metadata?.stale) {
            if (ageMs > thresholdMs) {
              removed++;
              modified = true;
              continue;
            }
          } else if (ageMs > thresholdMs) {
            entry.metadata = { ...entry.metadata, stale: true };
            markedStale++;
            modified = true;
          }

          surviving.push(entry);
        }

        section.entries = surviving;
      }

      file.sections = file.sections.filter(s => s.entries.length > 0);

      if (modified) {
        await this.fileManager.write(filePath, file, {
          createVersion: this.config.versioningEnabled,
          versionReason: 'decay-check',
        });
        logger.info(
          `Decay check on ${scope}: ${markedStale} stale, ${removed} removed`,
        );
      }
    }

    return { markedStale, removed, scopesChecked };
  }

  // -------------------------------------------------------------------------
  // Maintenance: Pruning
  // -------------------------------------------------------------------------

  /**
   * Prune contradicted and outdated memories.
   *
   * Looks for entries that contradict each other (opposite statements)
   * and removes the older or lower-confidence one. Also removes entries
   * that have been explicitly superseded by newer entries with similar text.
   */
  async prune(scope: MemoryScope): Promise<PruneResult> {
    const filePath = this.resolvePathForScope(scope);
    const file = await this.fileManager.read(filePath);

    if (!file.exists) {
      return { contradicted: 0, outdated: 0, totalRemoved: 0 };
    }

    let contradicted = 0;
    let outdated = 0;
    let modified = false;

    for (const section of file.sections) {
      if (section.title === 'Links') {
        continue;
      }

      const toRemove = new Set<number>();

      for (let i = 0; i < section.entries.length; i++) {
        for (let j = i + 1; j < section.entries.length; j++) {
          const entryA = section.entries[i]!;
          const entryB = section.entries[j]!;

          if (this.areContradictory(entryA.text, entryB.text)) {
            const confA = entryA.metadata?.confidence ?? 0.5;
            const confB = entryB.metadata?.confidence ?? 0.5;
            const removeIdx = confA >= confB ? j : i;
            toRemove.add(removeIdx);
            contradicted++;
            continue;
          }

          if (this.fileManager.isSemanticDuplicate(entryA.text, [entryB], 0.85)) {
            const dateA = entryA.metadata?.dateAdded ?? '0000';
            const dateB = entryB.metadata?.dateAdded ?? '0000';
            const removeIdx = dateA >= dateB ? j : i;
            toRemove.add(removeIdx);
            outdated++;
          }
        }
      }

      if (toRemove.size > 0) {
        section.entries = section.entries.filter((_, idx) => !toRemove.has(idx));
        modified = true;
      }
    }

    file.sections = file.sections.filter(s => s.entries.length > 0);

    if (modified) {
      await this.fileManager.write(filePath, file, {
        createVersion: this.config.versioningEnabled,
        versionReason: 'pruning',
      });
    }

    const totalRemoved = contradicted + outdated;
    if (totalRemoved > 0) {
      logger.info(`Pruned ${scope}: ${contradicted} contradicted, ${outdated} outdated`);
    }

    return { contradicted, outdated, totalRemoved };
  }

  /**
   * Check if two entry texts are contradictory.
   */
  private areContradictory(textA: string, textB: string): boolean {
    const a = textA.toLowerCase();
    const b = textB.toLowerCase();

    const usePattern = /\b(?:use|prefer|always use)\s+(\S+)/;
    const dontUsePattern = /\b(?:don'?t use|never use|avoid)\s+(\S+)/;

    const useMatchA = usePattern.exec(a);
    const dontUseMatchB = dontUsePattern.exec(b);
    if (useMatchA && dontUseMatchB && useMatchA[1] === dontUseMatchB[1]) {
      return true;
    }

    const useMatchB = usePattern.exec(b);
    const dontUseMatchA = dontUsePattern.exec(a);
    if (useMatchB && dontUseMatchA && useMatchB[1] === dontUseMatchA[1]) {
      return true;
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Maintenance: Linking
  // -------------------------------------------------------------------------

  /**
   * Run auto-linking on all enabled scopes.
   */
  async linkAll(): Promise<Map<MemoryScope, LinkingResult>> {
    if (!this.config.autoLinkEnabled) {
      return new Map();
    }

    const results = new Map<MemoryScope, LinkingResult>();
    const scopes: Array<{ scope: MemoryScope; enabled: boolean }> = [
      { scope: 'user', enabled: this.config.userScopeEnabled },
      { scope: 'project', enabled: this.config.projectScopeEnabled },
      { scope: 'local', enabled: this.config.localScopeEnabled },
    ];

    for (const { scope, enabled } of scopes) {
      if (!enabled) {
        continue;
      }
      const filePath = this.resolvePathForScope(scope);
      const result = await this.linker.linkFile(filePath);
      results.set(scope, result);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Versioning
  // -------------------------------------------------------------------------

  /**
   * List versions for a specific scope's memory file.
   */
  async listVersions(scope: MemoryScope): Promise<MemoryVersion[]> {
    const filePath = this.resolvePathForScope(scope);
    return this.fileManager.listVersions(filePath);
  }

  /**
   * Rollback a scope's memory file to a specific version.
   */
  async rollback(scope: MemoryScope, version: number): Promise<boolean> {
    const filePath = this.resolvePathForScope(scope);
    return this.fileManager.rollback(filePath, version);
  }

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  /**
   * Import memories from a conversation transcript (JSONL format).
   *
   * Parses the transcript, runs the learning detector on each turn,
   * and stores any detected memories. Returns the session summary.
   */
  async importFromTranscript(
    jsonlContent: string,
    sessionId: string,
  ): Promise<{
    memoriesStored: DetectedMemory[];
    summary: SessionSummaryResult | null;
  }> {
    const turns = this.summaryGenerator.parseTurnsFromTranscript(
      jsonlContent,
      sessionId,
    );

    const memoriesStored: DetectedMemory[] = [];

    for (const turn of turns) {
      const detected = await this.processTurn(turn);
      memoriesStored.push(...detected);
    }

    const summary = this.summaryGenerator.generateSummary(
      sessionId,
      turns,
      memoriesStored.length,
    );

    if (summary) {
      const summaryMemory = this.summaryGenerator.summaryToMemoryEntry(summary);
      await this.storeMemory(summaryMemory);
    }

    return { memoriesStored, summary };
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Get statistics about the auto-memories system.
   */
  async getStats(): Promise<MemoryStats> {
    const files = await this.loadAllWithScopes();
    const entriesByScope: Record<string, number> = {};
    const entriesBySection: Record<string, number> = {};
    let totalEntries = 0;
    let totalLinks = 0;
    let overflowFileCount = 0;

    for (const { file, scope } of files) {
      let scopeCount = 0;
      for (const section of file.sections) {
        scopeCount += section.entries.length;
        entriesBySection[section.title] =
          (entriesBySection[section.title] ?? 0) + section.entries.length;

        for (const entry of section.entries) {
          totalLinks += entry.metadata?.links?.length ?? 0;
        }
      }
      entriesByScope[scope] = (entriesByScope[scope] ?? 0) + scopeCount;
      totalEntries += scopeCount;

      if (file.path.includes('/memory/')) {
        overflowFileCount++;
      }
    }

    const paths = this.resolvePaths();
    let totalSizeBytes = 0;
    for (const scopePath of Object.values(paths)) {
      const baseDir = path.dirname(scopePath);
      try {
        totalSizeBytes += await this.fileManager.getTotalSize(baseDir);
      } catch {
        // Skip inaccessible directories
      }
    }

    let versionCount = 0;
    for (const scope of ['user', 'project', 'local'] as MemoryScope[]) {
      const versions = await this.listVersions(scope);
      versionCount += versions.length;
    }

    return {
      totalEntries,
      entriesByScope,
      entriesBySection,
      totalSizeBytes,
      overflowFileCount,
      versionCount,
      totalLinks,
    };
  }

  // -------------------------------------------------------------------------
  // Direct File Access
  // -------------------------------------------------------------------------

  /** Get the underlying MemoryFileManager for direct file operations. */
  getFileManager(): MemoryFileManager {
    return this.fileManager;
  }

  /** Get the underlying LearningDetector. */
  getDetector(): LearningDetector {
    return this.detector;
  }

  /** Get the underlying MemorySearch. */
  getSearcher(): MemorySearch {
    return this.searcher;
  }

  /** Get the underlying SessionSummaryGenerator. */
  getSummaryGenerator(): SessionSummaryGenerator {
    return this.summaryGenerator;
  }

  /** Get the underlying MemoryLinker. */
  getLinker(): MemoryLinker {
    return this.linker;
  }

  /** Get the current configuration. */
  getConfig(): AutoMemoriesConfig {
    return { ...this.config };
  }

  /** Update configuration at runtime. */
  updateConfig(updates: Partial<AutoMemoriesConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.minConfidence !== undefined) {
      this.detector = new LearningDetector({
        minConfidence: this.config.minConfidence,
      });
    }
    if (
      updates.maxLinesPerFile !== undefined ||
      updates.maxVersions !== undefined ||
      updates.maxTotalSizeBytes !== undefined
    ) {
      this.fileManager = new MemoryFileManager({
        maxLines: this.config.maxLinesPerFile,
        overflowDirName: 'memory',
        overflowThreshold: 5,
        maxVersions: this.config.maxVersions,
        maxTotalSizeBytes: this.config.maxTotalSizeBytes,
      });
      this.searcher = new MemorySearch(this.fileManager);
      this.linker = new MemoryLinker(this.fileManager);
    }
  }

  /** Reset the learning detector's history. Typically called at session boundaries. */
  resetDetectorHistory(): void {
    this.detector.resetHistory();
  }

  // -------------------------------------------------------------------------
  // Session Lifecycle Hooks
  // -------------------------------------------------------------------------

  /**
   * Hook to call at session start.
   *
   * Returns the system prompt section to inject. Also runs consolidation
   * if any scope files are over the line limit.
   */
  async onSessionStart(context?: RelevanceContext): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    this.sessionTurns = [];
    this.sessionMemoriesStored = 0;

    // Run consolidation in the background (non-blocking)
    this.consolidateAll().catch(err => {
      logger.warn(`Background consolidation failed: ${String(err)}`);
    });

    // Check size limits in the background
    this.checkSizeLimits().catch(err => {
      logger.warn(`Size limit check failed: ${String(err)}`);
    });

    if (context) {
      return this.buildContextAwarePromptSection(context);
    }

    return this.buildSystemPromptSection();
  }

  /**
   * Hook to call at session end.
   *
   * Generates a session summary, runs decay check, auto-linking,
   * and resets detector history.
   */
  async onSessionEnd(sessionId?: string): Promise<SessionSummaryResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    let summary: SessionSummaryResult | null = null;

    if (this.config.sessionSummaryEnabled && this.sessionTurns.length > 0) {
      const sid = sessionId ?? this.sessionTurns[0]?.sessionId ?? 'unknown';
      summary = this.summaryGenerator.generateSummary(
        sid,
        this.sessionTurns,
        this.sessionMemoriesStored,
      );

      if (summary) {
        const summaryMemory = this.summaryGenerator.summaryToMemoryEntry(summary);
        await this.storeMemory(summaryMemory).catch(err => {
          logger.warn(`Failed to store session summary: ${String(err)}`);
        });
      }
    }

    this.resetDetectorHistory();

    try {
      await this.decayCheck();
    } catch (err) {
      logger.warn(`Decay check failed: ${String(err)}`);
    }

    if (this.config.autoLinkEnabled) {
      try {
        await this.linkAll();
      } catch (err) {
        logger.warn(`Auto-linking failed: ${String(err)}`);
      }
    }

    this.sessionTurns = [];
    this.sessionMemoriesStored = 0;

    return summary;
  }

  // -------------------------------------------------------------------------
  // Private: Size Management
  // -------------------------------------------------------------------------

  /**
   * Check if any scope's memory files exceed the size limit.
   */
  private async checkSizeLimits(): Promise<void> {
    const paths = this.resolvePaths();
    const scopes: Array<{
      scope: MemoryScope;
      enabled: boolean;
      path: string;
    }> = [
      { scope: 'user', enabled: this.config.userScopeEnabled, path: paths.user },
      { scope: 'project', enabled: this.config.projectScopeEnabled, path: paths.project },
      { scope: 'local', enabled: this.config.localScopeEnabled, path: paths.local },
    ];

    for (const { scope, enabled, path: filePath } of scopes) {
      if (!enabled) {
        continue;
      }

      const baseDir = path.dirname(filePath);
      const isOver = await this.fileManager.isOverSizeLimit(baseDir);

      if (isOver) {
        logger.warn(`${scope} scope memory files exceed size limit. Running consolidation.`);
        await this.consolidate(scope);

        const stillOver = await this.fileManager.isOverSizeLimit(baseDir);
        if (stillOver) {
          await this.prune(scope);
        }
      }
    }
  }
}
