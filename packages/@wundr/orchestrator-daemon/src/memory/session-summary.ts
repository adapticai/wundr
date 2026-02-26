/**
 * SessionSummary - Generate summaries of session interactions for memory
 *
 * At session end, this module extracts the key learnings, decisions,
 * and patterns from the conversation and stores them as structured
 * memory entries.
 *
 * Inspired by OpenClaw's pre-compaction memory flush approach, which
 * captures durable memories before the context window is compacted.
 *
 * @packageDocumentation
 */

import type {
  ConversationTurn,
  DetectedMemory,
  MemoryScope,
} from './learning-detector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A completed session's summary.
 */
export interface SessionSummaryResult {
  /** Session ID */
  sessionId: string;
  /** ISO timestamp when the session started */
  startedAt: string;
  /** ISO timestamp when the session ended */
  endedAt: string;
  /** Total number of conversation turns */
  turnCount: number;
  /** Number of user turns */
  userTurnCount: number;
  /** Number of assistant turns */
  assistantTurnCount: number;
  /** Key topics discussed */
  topics: string[];
  /** Tools used during the session */
  toolsUsed: string[];
  /** Errors encountered */
  errorsEncountered: string[];
  /** Decisions made (extracted from assistant turns) */
  decisions: string[];
  /** Files touched (from tool call arguments) */
  filesTouched: string[];
  /** Memories detected during the session */
  memoriesStored: number;
  /** Generated summary text */
  summaryText: string;
  /** Scope recommendation for storing the summary */
  recommendedScope: MemoryScope;
}

/**
 * Configuration for session summary generation.
 */
export interface SessionSummaryConfig {
  /** Minimum number of turns to generate a summary */
  minTurns: number;
  /** Maximum summary length in characters */
  maxSummaryLength: number;
  /** Whether to extract file paths from tool calls */
  extractFiles: boolean;
  /** Whether to extract error patterns from tool calls */
  extractErrors: boolean;
  /** Whether to extract decision keywords from assistant turns */
  extractDecisions: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SessionSummaryConfig = {
  minTurns: 3,
  maxSummaryLength: 500,
  extractFiles: true,
  extractErrors: true,
  extractDecisions: true,
};

/** Patterns that indicate a decision or conclusion. */
const DECISION_PATTERNS: RegExp[] = [
  /\bI(?:'ll| will)\s+(.{10,80})/i,
  /\bLet(?:'s| us)\s+(.{10,80})/i,
  /\bdecided to\s+(.{10,80})/i,
  /\bgoing to\s+(.{10,80})/i,
  /\bapproach:?\s+(.{10,80})/i,
  /\bsolution:?\s+(.{10,80})/i,
  /\bstrategy:?\s+(.{10,80})/i,
];

/** Patterns that extract file paths. */
const FILE_PATH_RE = /(?:^|[\s'"`])([./][\w./-]+\.\w{1,10})(?:[\s'"`]|$)/g;

// Logger available for future use: new Logger('SessionSummary')

// ---------------------------------------------------------------------------
// SessionSummaryGenerator
// ---------------------------------------------------------------------------

export class SessionSummaryGenerator {
  private config: SessionSummaryConfig;

  constructor(config?: Partial<SessionSummaryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Summary Generation
  // -------------------------------------------------------------------------

  /**
   * Generate a session summary from conversation turns.
   *
   * Analyzes the turns to extract topics, tools used, errors,
   * decisions, and file paths. Produces a concise textual summary.
   */
  generateSummary(
    sessionId: string,
    turns: ConversationTurn[],
    memoriesStored: number
  ): SessionSummaryResult | null {
    if (turns.length < this.config.minTurns) {
      return null;
    }

    const startedAt =
      turns[0]?.timestamp.toISOString() ?? new Date().toISOString();
    const endedAt =
      turns[turns.length - 1]?.timestamp.toISOString() ??
      new Date().toISOString();

    const userTurns = turns.filter(t => t.role === 'user');
    const assistantTurns = turns.filter(t => t.role === 'assistant');

    const topics = this.extractTopics(turns);
    const toolsUsed = this.extractToolsUsed(turns);
    const errorsEncountered = this.config.extractErrors
      ? this.extractErrors(turns)
      : [];
    const decisions = this.config.extractDecisions
      ? this.extractDecisions(assistantTurns)
      : [];
    const filesTouched = this.config.extractFiles
      ? this.extractFiles(turns)
      : [];
    const recommendedScope = this.recommendScope(turns, topics);

    const summaryText = this.buildSummaryText({
      sessionId,
      turnCount: turns.length,
      topics,
      toolsUsed,
      errorsEncountered,
      decisions,
      filesTouched,
      memoriesStored,
    });

    return {
      sessionId,
      startedAt,
      endedAt,
      turnCount: turns.length,
      userTurnCount: userTurns.length,
      assistantTurnCount: assistantTurns.length,
      topics,
      toolsUsed,
      errorsEncountered,
      decisions,
      filesTouched,
      memoriesStored,
      summaryText,
      recommendedScope,
    };
  }

  /**
   * Convert a session summary to a memory entry for storage.
   */
  summaryToMemoryEntry(summary: SessionSummaryResult): DetectedMemory {
    return {
      text: summary.summaryText,
      section: 'Workflow',
      scope: summary.recommendedScope,
      confidence: 0.75,
      category: 'project-pattern',
      sourceTurn: {
        role: 'system',
        content: `Session summary for ${summary.sessionId}`,
        timestamp: new Date(summary.endedAt),
        sessionId: summary.sessionId,
      },
      children: summary.decisions.slice(0, 3),
    };
  }

  // -------------------------------------------------------------------------
  // Import from Transcripts
  // -------------------------------------------------------------------------

  /**
   * Parse a JSONL transcript file and extract conversation turns.
   *
   * Follows the same format as OpenClaw's session transcript files:
   * each line is a JSON object with `type: "message"` and a `message`
   * field containing `role` and `content`.
   */
  parseTurnsFromTranscript(
    jsonlContent: string,
    sessionId: string
  ): ConversationTurn[] {
    const turns: ConversationTurn[] = [];
    const lines = jsonlContent.split('\n');

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let record: {
        type?: string;
        message?: { role?: string; content?: unknown };
        timestamp?: string;
      };
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }

      if (record.type !== 'message' || !record.message) {
        continue;
      }

      const { role, content } = record.message;
      if (role !== 'user' && role !== 'assistant') {
        continue;
      }

      const textContent = this.extractTextContent(content);
      if (!textContent) {
        continue;
      }

      turns.push({
        role: role as 'user' | 'assistant',
        content: textContent,
        timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
        sessionId,
      });
    }

    return turns;
  }

  // -------------------------------------------------------------------------
  // Private: Extraction
  // -------------------------------------------------------------------------

  /**
   * Extract key topics from conversation turns using term frequency.
   */
  private extractTopics(turns: ConversationTurn[]): string[] {
    const termCounts = new Map<string, number>();
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'that',
      'with',
      'this',
      'from',
      'not',
      'are',
      'was',
      'were',
      'been',
      'have',
      'has',
      'had',
      'will',
      'would',
      'could',
      'should',
      'can',
      'but',
      'its',
      'your',
      'use',
      'using',
      'used',
      'also',
      'just',
      'like',
      'make',
      'need',
      'want',
      'get',
      'let',
      'see',
      'try',
      'run',
    ]);

    for (const turn of turns) {
      const words = turn.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));

      for (const word of words) {
        termCounts.set(word, (termCounts.get(word) ?? 0) + 1);
      }
    }

    // Return top terms by frequency
    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term]) => term);
  }

  /**
   * Extract unique tools used from tool call records.
   */
  private extractToolsUsed(turns: ConversationTurn[]): string[] {
    const tools = new Set<string>();
    for (const turn of turns) {
      if (turn.toolCalls) {
        for (const tc of turn.toolCalls) {
          tools.add(tc.name);
        }
      }
    }
    return Array.from(tools).sort();
  }

  /**
   * Extract error messages from failed tool calls.
   */
  private extractErrors(turns: ConversationTurn[]): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const turn of turns) {
      if (!turn.toolCalls) {
        continue;
      }
      for (const tc of turn.toolCalls) {
        if (tc.success || !tc.error) {
          continue;
        }
        const firstLine = tc.error.split('\n')[0]?.trim().slice(0, 100);
        if (firstLine && !seen.has(firstLine)) {
          seen.add(firstLine);
          errors.push(firstLine);
        }
      }
    }

    return errors.slice(0, 5);
  }

  /**
   * Extract decision statements from assistant turns.
   */
  private extractDecisions(turns: ConversationTurn[]): string[] {
    const decisions: string[] = [];
    const seen = new Set<string>();

    for (const turn of turns) {
      for (const pattern of DECISION_PATTERNS) {
        const match = pattern.exec(turn.content);
        if (match && match[1]) {
          const decision = match[1].trim().replace(/[.!]$/, '');
          const key = decision.toLowerCase().replace(/\s+/g, ' ');
          if (!seen.has(key)) {
            seen.add(key);
            decisions.push(decision);
          }
        }
      }
    }

    return decisions.slice(0, 5);
  }

  /**
   * Extract file paths from tool call arguments.
   */
  private extractFiles(turns: ConversationTurn[]): string[] {
    const files = new Set<string>();

    for (const turn of turns) {
      if (!turn.toolCalls) {
        continue;
      }
      for (const tc of turn.toolCalls) {
        const copy = new RegExp(FILE_PATH_RE.source, FILE_PATH_RE.flags);
        let match: RegExpExecArray | null;
        while ((match = copy.exec(tc.args)) !== null) {
          if (match[1]) {
            files.add(match[1]);
          }
        }
      }
    }

    return Array.from(files).sort().slice(0, 20);
  }

  /**
   * Recommend a scope for the session summary.
   *
   * If the session discusses project-specific topics, use project scope.
   * If it discusses user preferences, use user scope.
   * Otherwise default to local.
   */
  private recommendScope(
    turns: ConversationTurn[],
    topics: string[]
  ): MemoryScope {
    const content = turns
      .map(t => t.content)
      .join(' ')
      .toLowerCase();

    // Check for user-preference signals
    const userPrefIndicators = [
      'i prefer',
      'i like',
      'i want you to',
      'from now on',
      'always',
    ];
    if (userPrefIndicators.some(p => content.includes(p))) {
      return 'user';
    }

    // Check for project signals
    const projectIndicators = [
      'in this project',
      'in this repo',
      'in this codebase',
      'our convention',
      'we use',
      'the architecture',
    ];
    if (projectIndicators.some(p => content.includes(p))) {
      return 'project';
    }

    // Default to project for multi-topic sessions, local for simple ones
    return topics.length > 3 ? 'project' : 'local';
  }

  /**
   * Build the summary text from extracted components.
   */
  private buildSummaryText(params: {
    sessionId: string;
    turnCount: number;
    topics: string[];
    toolsUsed: string[];
    errorsEncountered: string[];
    decisions: string[];
    filesTouched: string[];
    memoriesStored: number;
  }): string {
    const parts: string[] = [];

    parts.push(
      `Session ${params.sessionId.slice(0, 8)} ` + `(${params.turnCount} turns)`
    );

    if (params.topics.length > 0) {
      parts.push(`Topics: ${params.topics.slice(0, 5).join(', ')}`);
    }

    if (params.toolsUsed.length > 0) {
      parts.push(`Tools: ${params.toolsUsed.join(', ')}`);
    }

    if (params.decisions.length > 0) {
      parts.push(`Decisions: ${params.decisions[0]}`);
    }

    if (params.errorsEncountered.length > 0) {
      parts.push(`Errors: ${params.errorsEncountered.length} encountered`);
    }

    if (params.memoriesStored > 0) {
      parts.push(`${params.memoriesStored} memories stored`);
    }

    let text = parts.join('. ');
    if (text.length > this.config.maxSummaryLength) {
      text = text.slice(0, this.config.maxSummaryLength - 3) + '...';
    }

    return text;
  }

  /**
   * Extract text content from a message content field.
   */
  private extractTextContent(content: unknown): string | null {
    if (typeof content === 'string') {
      return content.trim() || null;
    }
    if (!Array.isArray(content)) {
      return null;
    }
    const parts: string[] = [];
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: string }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        parts.push((block as { text: string }).text);
      }
    }
    return parts.join(' ').trim() || null;
  }
}
