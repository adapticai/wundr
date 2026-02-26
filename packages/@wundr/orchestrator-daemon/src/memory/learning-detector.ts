/**
 * LearningDetector - Conversation analysis for learnable moment detection
 *
 * Analyzes conversation turns to automatically detect patterns that should
 * be persisted as memories:
 *   - Repeated corrections from the user
 *   - Error patterns and their fixes
 *   - User preferences and conventions
 *   - Project-specific patterns
 *   - Tool usage patterns
 *
 * Each detection is scored with a confidence value and assigned to the
 * appropriate memory section and scope.
 *
 * @packageDocumentation
 */

import { Logger } from '../utils/logger';

import type { ParsedMemoryFile } from './memory-file-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single conversation turn to analyze.
 */
export interface ConversationTurn {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Tool calls and results in this turn (if any) */
  toolCalls?: ToolCallRecord[];
  /** Timestamp of the turn */
  timestamp: Date;
  /** Session identifier */
  sessionId: string;
}

/**
 * A tool call record, including the result.
 */
export interface ToolCallRecord {
  /** Tool name (e.g., "read", "write") */
  name: string;
  /** Tool arguments (stringified) */
  args: string;
  /** Tool result or output */
  result: string;
  /** Whether the tool call succeeded */
  success: boolean;
  /** Exit code for shell-type tools */
  exitCode?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Section types in the MEMORY.md file.
 */
export type MemorySectionType =
  | 'User Preferences'
  | 'Project Conventions'
  | 'Error Patterns'
  | 'Tool Usage'
  | 'Architecture Decisions'
  | 'Corrections'
  | 'Workflow'
  | 'People & Roles';

/**
 * Memory scope -- determines which MEMORY.md file to write to.
 */
export type MemoryScope = 'user' | 'project' | 'local';

/**
 * Detection category -- how the memory was detected.
 */
export type DetectionCategory =
  | 'repeated-correction'
  | 'error-pattern'
  | 'user-preference'
  | 'project-pattern'
  | 'tool-usage';

/**
 * A detected learnable moment ready for storage.
 */
export interface DetectedMemory {
  /** The memory entry text */
  text: string;
  /** Which section this belongs to */
  section: MemorySectionType;
  /** Target scope */
  scope: MemoryScope;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Detection category */
  category: DetectionCategory;
  /** Source turn that triggered detection */
  sourceTurn: ConversationTurn;
  /** Optional sub-entries for additional detail */
  children?: string[];
}

/**
 * Internal raw detection before scoring and deduplication.
 */
interface RawDetection {
  text: string;
  section: MemorySectionType;
  scope: MemoryScope;
  category: DetectionCategory;
  /** Base confidence before adjustments */
  baseConfidence: number;
  /** Number of times this pattern has been seen */
  repetitions: number;
  children?: string[];
}

/**
 * Configuration for the LearningDetector.
 */
export interface LearningDetectorConfig {
  /** Minimum confidence threshold to emit a detection */
  minConfidence: number;
  /** Maximum detections per turn */
  maxDetectionsPerTurn: number;
  /** Size of the rolling correction history window */
  correctionHistorySize: number;
  /** Size of the rolling error history window */
  errorHistorySize: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: LearningDetectorConfig = {
  minConfidence: 0.6,
  maxDetectionsPerTurn: 3,
  correctionHistorySize: 50,
  errorHistorySize: 30,
};

/**
 * Phrases that indicate the user is correcting the agent.
 */
const CORRECTION_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /^no[,.]?\s/i, weight: 0.5 },
  { pattern: /^not\s+that/i, weight: 0.6 },
  { pattern: /^actually[,.]?\s/i, weight: 0.6 },
  { pattern: /^wrong[,.]?\s/i, weight: 0.7 },
  { pattern: /\bdon'?t\s+(use|do|say|suggest|recommend)\b/i, weight: 0.7 },
  { pattern: /\binstead\s+of\b/i, weight: 0.5 },
  { pattern: /\bnot\s+\w+[,.]?\s+(use|it'?s|we\s+use)\b/i, weight: 0.6 },
  { pattern: /\buse\s+\w+\s+not\s+\w+/i, weight: 0.7 },
  { pattern: /\bI\s+said\b/i, weight: 0.6 },
  { pattern: /\bI\s+told\s+you\b/i, weight: 0.8 },
  { pattern: /\bstop\s+(doing|using|suggesting)\b/i, weight: 0.7 },
  { pattern: /\bplease\s+don'?t\b/i, weight: 0.6 },
  { pattern: /\bthat'?s\s+(wrong|incorrect|not\s+right)\b/i, weight: 0.7 },
];

/**
 * Phrases that indicate an explicit user preference.
 */
const PREFERENCE_PATTERNS: Array<{
  pattern: RegExp;
  scope: MemoryScope;
  weight: number;
}> = [
  { pattern: /\bI\s+prefer\b/i, scope: 'user', weight: 0.9 },
  { pattern: /\balways\s+use\b/i, scope: 'project', weight: 0.8 },
  { pattern: /\bnever\s+use\b/i, scope: 'project', weight: 0.8 },
  { pattern: /\bI\s+like\b/i, scope: 'user', weight: 0.7 },
  { pattern: /\bI\s+don'?t\s+like\b/i, scope: 'user', weight: 0.7 },
  { pattern: /\bplease\s+always\b/i, scope: 'user', weight: 0.85 },
  { pattern: /\bI\s+want\s+you\s+to\s+always\b/i, scope: 'user', weight: 0.9 },
  { pattern: /\bfrom\s+now\s+on\b/i, scope: 'user', weight: 0.85 },
  { pattern: /\bremember\s+that\b/i, scope: 'project', weight: 0.9 },
  { pattern: /\bkeep\s+in\s+mind\b/i, scope: 'project', weight: 0.85 },
  { pattern: /\bnote\s+that\b/i, scope: 'project', weight: 0.7 },
  { pattern: /\bfor\s+this\s+project\b/i, scope: 'project', weight: 0.8 },
  {
    pattern: /\bin\s+this\s+(repo|codebase|project)\b/i,
    scope: 'project',
    weight: 0.8,
  },
  { pattern: /\bon\s+this\s+machine\b/i, scope: 'local', weight: 0.8 },
  { pattern: /\blocally\b/i, scope: 'local', weight: 0.5 },
];

/**
 * Phrases indicating project-specific conventions or architecture.
 */
const PROJECT_PATTERNS: Array<{ pattern: RegExp; section: MemorySectionType }> =
  [
    {
      pattern: /\btests?\s+(?:are|go|live)\s+in\b/i,
      section: 'Project Conventions',
    },
    { pattern: /\bwe\s+use\b/i, section: 'Project Conventions' },
    { pattern: /\bthe\s+convention\s+is\b/i, section: 'Project Conventions' },
    {
      pattern: /\bour\s+(?:pattern|approach|style)\b/i,
      section: 'Project Conventions',
    },
    { pattern: /\barchitecture\b/i, section: 'Architecture Decisions' },
    { pattern: /\bdesign\s+decision\b/i, section: 'Architecture Decisions' },
    {
      pattern: /\bfollow\s+(?:the|this)\s+pattern\b/i,
      section: 'Project Conventions',
    },
    { pattern: /\bbuild\s+(?:with|using|by)\b/i, section: 'Workflow' },
    { pattern: /\bdeploy\s+(?:with|using|by|to)\b/i, section: 'Workflow' },
    {
      pattern: /\brun\s+(?:tests?|lint|build)\s+(?:with|using|by)\b/i,
      section: 'Workflow',
    },
  ];

/**
 * Patterns that indicate tool/command usage instructions.
 */
const TOOL_USAGE_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\brun\s+`[^`]+`/i, weight: 0.7 },
  { pattern: /\buse\s+`[^`]+`/i, weight: 0.7 },
  { pattern: /\b(?:the\s+)?command\s+(?:is|to)\b/i, weight: 0.6 },
  { pattern: /\b(?:npm|pnpm|yarn|bun)\s+\w+/i, weight: 0.5 },
  { pattern: /\bgit\s+\w+/i, weight: 0.5 },
  { pattern: /\bdocker\s+\w+/i, weight: 0.5 },
  { pattern: /\b\.\/scripts?\//i, weight: 0.6 },
  { pattern: /\bmake\s+\w+/i, weight: 0.5 },
];

const logger = new Logger('LearningDetector');

// ---------------------------------------------------------------------------
// LearningDetector
// ---------------------------------------------------------------------------

export class LearningDetector {
  private config: LearningDetectorConfig;

  /**
   * Rolling history of corrections for repetition detection.
   * Key: normalized correction text, Value: occurrence timestamps.
   */
  private correctionHistory: Map<string, Date[]> = new Map();

  /**
   * Rolling history of error patterns.
   * Key: error signature, Value: { error, fix, timestamps }.
   */
  private errorHistory: Map<
    string,
    { error: string; fix: string; timestamps: Date[] }
  > = new Map();

  constructor(config?: Partial<LearningDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Main Analysis
  // -------------------------------------------------------------------------

  /**
   * Analyze a conversation turn for learnable moments.
   *
   * Returns detected memories sorted by confidence (highest first),
   * limited to `maxDetectionsPerTurn`.
   */
  analyze(turn: ConversationTurn): DetectedMemory[] {
    if (turn.role !== 'user') {
      // Only analyze user turns for learning signals
      return [];
    }

    const rawDetections: RawDetection[] = [];

    rawDetections.push(...this.detectCorrections(turn));
    rawDetections.push(...this.detectPreferences(turn));
    rawDetections.push(...this.detectProjectPatterns(turn));
    rawDetections.push(...this.detectToolPatterns(turn));
    rawDetections.push(...this.detectErrorPatterns(turn));

    // Score, filter, sort, limit
    const scored = rawDetections
      .map(raw => this.toDetectedMemory(raw, turn))
      .filter(d => d.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxDetectionsPerTurn);

    return scored;
  }

  /**
   * Analyze a turn and deduplicate against existing memories.
   */
  analyzeAndDeduplicate(
    turn: ConversationTurn,
    existingFiles: ParsedMemoryFile[]
  ): DetectedMemory[] {
    const detections = this.analyze(turn);
    return this.deduplicate(detections, existingFiles);
  }

  // -------------------------------------------------------------------------
  // Detection: Corrections
  // -------------------------------------------------------------------------

  /**
   * Detect correction patterns in user messages.
   *
   * Tracks corrections over time to detect repetitions. A correction
   * that appears once gets medium confidence; twice or more gets high
   * confidence (indicating the agent keeps making the same mistake).
   */
  detectCorrections(turn: ConversationTurn): RawDetection[] {
    const detections: RawDetection[] = [];
    const content = turn.content.trim();

    for (const { pattern, weight } of CORRECTION_PATTERNS) {
      if (!pattern.test(content)) {
        continue;
      }

      // Extract the correction substance (heuristic: take the full sentence
      // containing the correction pattern, up to 200 chars)
      const correctionText = this.extractCorrectionText(content);
      if (!correctionText) {
        continue;
      }

      // Track in history for repetition detection
      const key = this.normalizeText(correctionText);
      const history = this.correctionHistory.get(key) ?? [];
      history.push(turn.timestamp);
      this.correctionHistory.set(key, history);

      // Prune old history
      this.pruneHistory(
        this.correctionHistory,
        this.config.correctionHistorySize
      );

      const repetitions = history.length;
      const baseConfidence =
        repetitions >= 2 ? Math.min(0.95, weight + 0.2) : weight;

      detections.push({
        text: correctionText,
        section: 'Corrections',
        scope: 'project',
        category: 'repeated-correction',
        baseConfidence,
        repetitions,
      });

      // Only take the first matching correction pattern per turn
      break;
    }

    return detections;
  }

  // -------------------------------------------------------------------------
  // Detection: Error Patterns
  // -------------------------------------------------------------------------

  /**
   * Detect error-fix patterns from tool call results.
   *
   * When a tool call fails and a subsequent action resolves the issue,
   * the error-fix pair is recorded as a learnable pattern.
   */
  detectErrorPatterns(turn: ConversationTurn): RawDetection[] {
    const detections: RawDetection[] = [];

    if (!turn.toolCalls || turn.toolCalls.length === 0) {
      return detections;
    }

    // Look for failed tool calls followed by guidance
    for (const tc of turn.toolCalls) {
      if (tc.success) {
        continue;
      }

      const errorSig = this.extractErrorSignature(tc);
      if (!errorSig) {
        continue;
      }

      // If the user's message contains fix guidance, pair them
      const fixText = this.extractFixFromContent(turn.content, errorSig);
      if (!fixText) {
        // Still record the error for future pairing
        const existing = this.errorHistory.get(errorSig);
        if (existing) {
          existing.timestamps.push(turn.timestamp);
        } else {
          this.errorHistory.set(errorSig, {
            error: errorSig,
            fix: '',
            timestamps: [turn.timestamp],
          });
        }
        continue;
      }

      // We have an error-fix pair
      const entryText = `When seeing \`${errorSig}\`, fix: ${fixText}`;
      const key = this.normalizeText(errorSig);
      const history = this.errorHistory.get(key);
      const repetitions = history ? history.timestamps.length : 1;

      detections.push({
        text: entryText,
        section: 'Error Patterns',
        scope: 'project',
        category: 'error-pattern',
        baseConfidence: repetitions >= 2 ? 0.8 : 0.7,
        repetitions,
      });
    }

    // Prune old error history
    this.pruneErrorHistory();

    return detections;
  }

  // -------------------------------------------------------------------------
  // Detection: User Preferences
  // -------------------------------------------------------------------------

  /**
   * Detect explicit preference statements from the user.
   */
  detectPreferences(turn: ConversationTurn): RawDetection[] {
    const detections: RawDetection[] = [];
    const content = turn.content.trim();

    for (const { pattern, scope, weight } of PREFERENCE_PATTERNS) {
      if (!pattern.test(content)) {
        continue;
      }

      // Extract the preference substance
      const preferenceText = this.extractPreferenceText(content, pattern);
      if (!preferenceText || preferenceText.length < 10) {
        continue;
      }

      detections.push({
        text: preferenceText,
        section: 'User Preferences',
        scope,
        category: 'user-preference',
        baseConfidence: weight,
        repetitions: 1,
      });

      // Take at most 2 preference detections per turn
      if (detections.length >= 2) {
        break;
      }
    }

    return detections;
  }

  // -------------------------------------------------------------------------
  // Detection: Project Patterns
  // -------------------------------------------------------------------------

  /**
   * Detect project-specific conventions from user messages.
   */
  detectProjectPatterns(turn: ConversationTurn): RawDetection[] {
    const detections: RawDetection[] = [];
    const content = turn.content.trim();

    for (const { pattern, section } of PROJECT_PATTERNS) {
      if (!pattern.test(content)) {
        continue;
      }

      const patternText = this.extractPatternText(content, pattern);
      if (!patternText || patternText.length < 10) {
        continue;
      }

      detections.push({
        text: patternText,
        section,
        scope: 'project',
        category: 'project-pattern',
        baseConfidence: 0.7,
        repetitions: 1,
      });

      if (detections.length >= 2) {
        break;
      }
    }

    return detections;
  }

  // -------------------------------------------------------------------------
  // Detection: Tool Usage
  // -------------------------------------------------------------------------

  /**
   * Detect tool/command usage instructions from user messages.
   */
  detectToolPatterns(turn: ConversationTurn): RawDetection[] {
    const detections: RawDetection[] = [];
    const content = turn.content.trim();

    for (const { pattern, weight } of TOOL_USAGE_PATTERNS) {
      if (!pattern.test(content)) {
        continue;
      }

      const toolText = this.extractToolText(content, pattern);
      if (!toolText || toolText.length < 8) {
        continue;
      }

      detections.push({
        text: toolText,
        section: 'Tool Usage',
        scope: 'project',
        category: 'tool-usage',
        baseConfidence: weight,
        repetitions: 1,
      });

      if (detections.length >= 2) {
        break;
      }
    }

    return detections;
  }

  // -------------------------------------------------------------------------
  // Scoring and Deduplication
  // -------------------------------------------------------------------------

  /**
   * Convert a raw detection to a scored DetectedMemory.
   */
  private toDetectedMemory(
    raw: RawDetection,
    turn: ConversationTurn
  ): DetectedMemory {
    let confidence = raw.baseConfidence;

    // Boost for repetitions
    if (raw.repetitions >= 3) {
      confidence = Math.min(0.98, confidence + 0.15);
    } else if (raw.repetitions >= 2) {
      confidence = Math.min(0.95, confidence + 0.1);
    }

    // Slight boost for explicit user turns (vs. inferred)
    if (raw.category === 'user-preference') {
      confidence = Math.min(0.99, confidence + 0.05);
    }

    return {
      text: raw.text,
      section: raw.section,
      scope: raw.scope,
      confidence: Math.round(confidence * 100) / 100,
      category: raw.category,
      sourceTurn: turn,
      children: raw.children,
    };
  }

  /**
   * Deduplicate detected memories against existing memory files.
   *
   * Removes detections that already exist (by normalized text match)
   * in any of the provided ParsedMemoryFiles.
   */
  deduplicate(
    detections: DetectedMemory[],
    existingFiles: ParsedMemoryFile[]
  ): DetectedMemory[] {
    const existingNormalized = new Set<string>();

    for (const file of existingFiles) {
      for (const section of file.sections) {
        for (const entry of section.entries) {
          existingNormalized.add(this.normalizeText(entry.text));
        }
      }
    }

    return detections.filter(d => {
      const key = this.normalizeText(d.text);
      if (existingNormalized.has(key)) {
        logger.debug(`Deduplicated detection: "${d.text.slice(0, 50)}..."`);
        return false;
      }
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // History Management
  // -------------------------------------------------------------------------

  /**
   * Reset all internal history (e.g., between sessions).
   */
  resetHistory(): void {
    this.correctionHistory.clear();
    this.errorHistory.clear();
  }

  /**
   * Get the current correction history size.
   */
  getCorrectionHistorySize(): number {
    return this.correctionHistory.size;
  }

  /**
   * Get the current error history size.
   */
  getErrorHistorySize(): number {
    return this.errorHistory.size;
  }

  // -------------------------------------------------------------------------
  // Private: Text Extraction Helpers
  // -------------------------------------------------------------------------

  /**
   * Extract the substance of a correction from the user's message.
   *
   * Strategy: take the sentence containing the correction pattern, clean
   * it up, and return a concise version (max 200 chars).
   */
  private extractCorrectionText(content: string): string | null {
    // Try to get the first 1-2 sentences
    const sentences = content.split(/[.!?\n]/).filter(s => s.trim().length > 5);
    if (sentences.length === 0) {
      return null;
    }

    let text = sentences.slice(0, 2).join('. ').trim();
    if (text.length > 200) {
      text = text.slice(0, 197) + '...';
    }

    // Clean up leading correction markers
    text = text
      .replace(/^(no|nope|wrong|actually|not that)[,.]?\s*/i, '')
      .trim();

    if (text.length < 5) {
      return null;
    }

    return text;
  }

  /**
   * Extract preference text from a user message.
   */
  private extractPreferenceText(
    content: string,
    pattern: RegExp
  ): string | null {
    const match = pattern.exec(content);
    if (!match) {
      return null;
    }

    // Take from the match to the end of the sentence
    const startIdx = match.index;
    const afterMatch = content.slice(startIdx);
    const endIdx = afterMatch.search(/[.!?\n]/);
    let text =
      endIdx > 0 ? afterMatch.slice(0, endIdx).trim() : afterMatch.trim();

    if (text.length > 200) {
      text = text.slice(0, 197) + '...';
    }

    return text.length >= 10 ? text : null;
  }

  /**
   * Extract project pattern text.
   */
  private extractPatternText(content: string, pattern: RegExp): string | null {
    return this.extractPreferenceText(content, pattern);
  }

  /**
   * Extract tool usage text.
   */
  private extractToolText(content: string, pattern: RegExp): string | null {
    return this.extractPreferenceText(content, pattern);
  }

  /**
   * Extract a stable error signature from a failed tool call.
   */
  private extractErrorSignature(tc: ToolCallRecord): string | null {
    const error = tc.error ?? tc.result;
    if (!error) {
      return null;
    }

    // Look for common error patterns
    const patterns = [
      /ECONNREFUSED\s+[\d.:]+/,
      /ENOENT[:\s]+['"]?([^'"]+)/,
      /Cannot find module\s+['"]([^'"]+)/,
      /command not found:\s+(\S+)/,
      /Error:\s+(.{10,80})/,
      /(?:fatal|error):\s+(.{10,80})/i,
    ];

    for (const p of patterns) {
      const match = p.exec(error);
      if (match) {
        return match[0].trim().slice(0, 100);
      }
    }

    // Fall back to first line of error, trimmed
    const firstLine = error.split('\n')[0]?.trim();
    if (firstLine && firstLine.length >= 10) {
      return firstLine.slice(0, 100);
    }

    return null;
  }

  /**
   * Attempt to extract a fix from the user's content that relates to an error.
   */
  private extractFixFromContent(
    content: string,
    _errorSig: string
  ): string | null {
    if (!content || content.length < 10) {
      return null;
    }

    // Check if the content references the error or provides a command
    const hasBacktick = /`[^`]+`/.test(content);
    const hasCommand = /\b(?:run|try|use|do)\b/i.test(content);

    if (!hasBacktick && !hasCommand) {
      return null;
    }

    // Take the relevant portion of the user's message
    const sentences = content.split(/[.!?\n]/).filter(s => s.trim().length > 5);
    const text = sentences.slice(0, 2).join('. ').trim();

    return text.length >= 10 ? text.slice(0, 200) : null;
  }

  // -------------------------------------------------------------------------
  // Private: Utilities
  // -------------------------------------------------------------------------

  /**
   * Normalize text for comparison.
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[`'"]/g, '');
  }

  /**
   * Prune a correction history map to keep within size limits.
   */
  private pruneHistory(history: Map<string, Date[]>, maxSize: number): void {
    if (history.size <= maxSize) {
      return;
    }

    // Remove oldest entries
    const entries = Array.from(history.entries()).sort((a, b) => {
      const lastA = a[1][a[1].length - 1]?.getTime() ?? 0;
      const lastB = b[1][b[1].length - 1]?.getTime() ?? 0;
      return lastA - lastB;
    });

    const toRemove = entries.slice(0, entries.length - maxSize);
    for (const [key] of toRemove) {
      history.delete(key);
    }
  }

  /**
   * Prune the error history to keep within size limits.
   */
  private pruneErrorHistory(): void {
    if (this.errorHistory.size <= this.config.errorHistorySize) {
      return;
    }

    const entries = Array.from(this.errorHistory.entries()).sort((a, b) => {
      const lastA = a[1].timestamps[a[1].timestamps.length - 1]?.getTime() ?? 0;
      const lastB = b[1].timestamps[b[1].timestamps.length - 1]?.getTime() ?? 0;
      return lastA - lastB;
    });

    const toRemove = entries.slice(
      0,
      entries.length - this.config.errorHistorySize
    );
    for (const [key] of toRemove) {
      this.errorHistory.delete(key);
    }
  }
}
