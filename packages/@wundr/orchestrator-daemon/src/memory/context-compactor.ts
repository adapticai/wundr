/**
 * Context Compactor - Ported from OpenClaw's compaction system
 *
 * Manages long conversations by automatically compacting context when
 * approaching model context window limits. Implements multi-pass
 * summarization, sliding window with summary prefix, important message
 * preservation, and configurable per-model thresholds.
 *
 * Architecture mirrors OpenClaw's three-layer approach:
 *   1. Context pruning: trim large tool results (soft trim, then hard clear)
 *   2. Compaction: summarize older messages into a condensed prefix
 *   3. Memory flush: pre-compaction hook to persist durable knowledge
 *
 * @see OpenClaw src/agents/compaction.ts
 * @see OpenClaw src/agents/pi-extensions/compaction-safeguard.ts
 * @see OpenClaw src/agents/pi-extensions/context-pruning/pruner.ts
 * @see OpenClaw src/auto-reply/reply/memory-flush.ts
 */

import { Logger } from '../utils/logger';

// =============================================================================
// Constants (ported from OpenClaw's compaction.ts)
// =============================================================================

/** Base ratio of context window used per summarization chunk */
const BASE_CHUNK_RATIO = 0.4;

/** Floor ratio - never go below this to avoid degenerate tiny chunks */
const MIN_CHUNK_RATIO = 0.15;

/** Buffer for token estimation inaccuracy (~4 chars/token heuristic is rough) */
const SAFETY_MARGIN = 1.2;

/** Approximate characters per token for fast estimation */
const CHARS_PER_TOKEN = 4;

/** Default summary when nothing is available */
const DEFAULT_SUMMARY_FALLBACK = 'No prior history.';

/** Default number of passes for multi-stage summarization */
const DEFAULT_PARTS = 2;

/** Maximum tool failures to include in compaction metadata */
const MAX_TOOL_FAILURES = 8;

/** Maximum characters per tool failure summary */
const MAX_TOOL_FAILURE_CHARS = 240;

/** Placeholder for hard-cleared tool results */
const HARD_CLEAR_PLACEHOLDER = '[Tool result content cleared during context pruning]';

// =============================================================================
// Model Context Window Presets
// =============================================================================

/**
 * Known model context window sizes in tokens.
 * Used when a model's context window is not explicitly configured.
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // 4K models
  'gpt-3.5-turbo': 4_096,

  // 8K models
  'gpt-4': 8_192,

  // 16K models
  'gpt-3.5-turbo-16k': 16_384,

  // 32K models
  'gpt-4-32k': 32_768,

  // 128K models
  'gpt-4-turbo': 128_000,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'claude-3-haiku': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-opus': 200_000,
  'claude-3.5-sonnet': 200_000,
  'claude-3.5-haiku': 200_000,
  'claude-4-sonnet': 200_000,
  'claude-opus-4': 200_000,

  // 200K models
  'claude-3': 200_000,
};

/** Default context window when model is unknown */
const DEFAULT_CONTEXT_WINDOW = 128_000;

// =============================================================================
// Types
// =============================================================================

/** Role of a conversation message */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool_result';

/**
 * Minimal conversation message interface.
 * Kept intentionally generic so it can wrap any LLM provider's message format.
 */
export interface ConversationMessage {
  role: MessageRole;
  content: string;
  /** Optional structured content blocks (tool calls, images, etc.) */
  contentBlocks?: ContentBlock[];
  /** Unique message identifier */
  id?: string;
  /** Timestamp of when the message was created */
  timestamp?: number;
  /** Tool-related metadata */
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  /** Arbitrary metadata attached to the message */
  metadata?: Record<string, unknown>;
}

/** Structured content block within a message */
export interface ContentBlock {
  type: 'text' | 'tool_call' | 'tool_result' | 'image' | 'thinking';
  text?: string;
  toolCallId?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
}

/**
 * Importance classification for messages during compaction.
 * Higher importance = more likely to be preserved verbatim.
 */
export type MessageImportance =
  | 'critical'    // Never compacted: system prompts, user instructions
  | 'high'        // Preserved when possible: key decisions, tool results with errors
  | 'normal'      // Standard messages: regular conversation turns
  | 'low';        // First to compact: verbose tool output, thinking blocks

/**
 * Per-model compaction threshold configuration.
 * Allows tuning compaction behavior for different context window sizes.
 */
export interface ModelCompactionThreshold {
  /** Model name or pattern (supports '*' wildcard) */
  modelPattern: string;
  /** Context window size in tokens (overrides lookup table) */
  contextWindowTokens?: number;
  /** Token count that triggers compaction (absolute). Computed from ratio if not set. */
  compactionTriggerTokens?: number;
  /** Fraction of context window that triggers compaction (default: 0.85) */
  compactionTriggerRatio?: number;
  /** Maximum fraction of context window to use for history summary (default: 0.5) */
  maxHistoryShare?: number;
  /** Tokens to reserve for the model's response (default: 4096) */
  reserveTokens?: number;
}

/**
 * Full configuration for the context compactor.
 */
export interface ContextCompactorConfig {
  /** Master enable switch */
  enabled: boolean;

  /** Default compaction trigger ratio (fraction of context window). Default: 0.85 */
  defaultTriggerRatio: number;

  /** Default max share of context window for history. Default: 0.5 */
  defaultMaxHistoryShare: number;

  /** Tokens reserved for model response generation. Default: 4096 */
  defaultReserveTokens: number;

  /** Number of summarization passes. Default: 2 */
  summarizationPasses: number;

  /** Minimum messages before multi-pass split is worthwhile. Default: 4 */
  minMessagesForSplit: number;

  /** Per-model threshold overrides */
  modelThresholds: ModelCompactionThreshold[];

  /** Context pruning settings (pre-compaction tool result trimming) */
  pruning: ContextPruningConfig;

  /** Memory flush settings (pre-compaction memory persistence) */
  memoryFlush: MemoryFlushConfig;

  /** Custom summarization instructions appended to the LLM prompt */
  customSummarizationInstructions?: string;

  /**
   * Callback to generate summaries via an LLM.
   * The compactor does not call LLMs directly; callers must provide this.
   */
  summarize?: SummarizeFn;
}

/** Configuration for context pruning (tool result trimming) */
export interface ContextPruningConfig {
  /** Enable context pruning. Default: true */
  enabled: boolean;
  /** Context usage ratio at which soft trimming begins. Default: 0.3 */
  softTrimRatio: number;
  /** Context usage ratio at which hard clearing begins. Default: 0.5 */
  hardClearRatio: number;
  /** Minimum tool result characters before pruning is considered. Default: 50000 */
  minPrunableChars: number;
  /** Number of recent assistant messages to protect from pruning. Default: 3 */
  keepLastAssistants: number;
  /** Maximum characters to retain in soft-trimmed tool results. Default: 4000 */
  softTrimMaxChars: number;
  /** Characters to keep from the head of trimmed results. Default: 1500 */
  softTrimHeadChars: number;
  /** Characters to keep from the tail of trimmed results. Default: 1500 */
  softTrimTailChars: number;
  /** Enable hard clear (replace entire content). Default: true */
  hardClearEnabled: boolean;
  /** Placeholder text for hard-cleared tool results */
  hardClearPlaceholder: string;
  /** Tool names that are eligible for pruning. Empty = all prunable. */
  prunableTools: string[];
  /** Tool names that are never pruned. Takes precedence over prunableTools. */
  protectedTools: string[];
}

/** Configuration for pre-compaction memory flush */
export interface MemoryFlushConfig {
  /** Enable memory flush hook. Default: true */
  enabled: boolean;
  /** Extra tokens before compaction threshold to trigger flush. Default: 4000 */
  softThresholdTokens: number;
  /** Prompt sent to LLM for memory flush. */
  prompt: string;
  /** System prompt appended during memory flush turn. */
  systemPrompt: string;
}

/**
 * Function that the caller provides to generate summaries via an LLM.
 * The compactor orchestrates when and what to summarize, but the actual
 * LLM call is delegated to this function.
 */
export type SummarizeFn = (params: {
  messages: ConversationMessage[];
  instructions: string;
  previousSummary?: string;
  maxTokens: number;
  signal?: AbortSignal;
}) => Promise<string>;

/**
 * Result of a compaction operation.
 */
export interface CompactionResult {
  /** Whether compaction actually occurred */
  compacted: boolean;
  /** Generated summary of compacted messages */
  summary: string;
  /** Messages retained after compaction (summary prefix + recent messages) */
  messages: ConversationMessage[];
  /** Compaction metadata for tracking and debugging */
  metadata: CompactionMetadata;
}

/**
 * Metadata about a compaction operation for tracking and debugging.
 */
export interface CompactionMetadata {
  /** When compaction occurred */
  timestamp: number;
  /** Token count before compaction */
  tokensBefore: number;
  /** Token count after compaction */
  tokensAfter: number;
  /** Compression ratio (tokensAfter / tokensBefore) */
  compressionRatio: number;
  /** Number of messages before compaction */
  messagesBefore: number;
  /** Number of messages after compaction */
  messagesAfter: number;
  /** Number of messages that were summarized */
  messagesSummarized: number;
  /** Number of messages preserved verbatim */
  messagesPreserved: number;
  /** Number of multi-pass summarization stages used */
  summarizationPasses: number;
  /** Model context window used for this compaction */
  contextWindowTokens: number;
  /** Token threshold that triggered compaction */
  triggerTokens: number;
  /** Which compaction pass this is for the session (1-indexed) */
  compactionCount: number;
  /** Time taken for the compaction operation in ms */
  durationMs: number;
  /** IDs of messages that were preserved */
  preservedMessageIds: string[];
  /** Tool failures extracted from compacted messages */
  toolFailures: ToolFailureInfo[];
  /** Files referenced in compacted context */
  fileReferences: {
    read: string[];
    modified: string[];
  };
  /** Whether context pruning was applied before compaction */
  pruningApplied: boolean;
  /** Number of tool results pruned */
  prunedToolResults: number;
}

/** Summary of a tool failure found in compacted messages */
export interface ToolFailureInfo {
  toolCallId: string;
  toolName: string;
  summary: string;
  meta?: string;
}

/** Result from the pre-compact hook system */
export interface PreCompactHookResult {
  /** If true, skip compaction this cycle */
  skipCompaction: boolean;
  /** Override compaction strategy */
  strategy?: string;
  /** Message indices to preserve */
  preserveMessageIndices: number[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_MEMORY_FLUSH_PROMPT =
  'Pre-compaction memory flush. ' +
  'Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed). ' +
  'If nothing to store, reply with [NO_ACTION].';

const DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT =
  'Pre-compaction memory flush turn. ' +
  'The session is near auto-compaction; capture durable memories to disk. ' +
  'You may reply, but usually [NO_ACTION] is correct.';

export const DEFAULT_CONTEXT_COMPACTOR_CONFIG: ContextCompactorConfig = {
  enabled: true,
  defaultTriggerRatio: 0.85,
  defaultMaxHistoryShare: 0.5,
  defaultReserveTokens: 4096,
  summarizationPasses: DEFAULT_PARTS,
  minMessagesForSplit: 4,
  modelThresholds: [],
  pruning: {
    enabled: true,
    softTrimRatio: 0.3,
    hardClearRatio: 0.5,
    minPrunableChars: 50_000,
    keepLastAssistants: 3,
    softTrimMaxChars: 4_000,
    softTrimHeadChars: 1_500,
    softTrimTailChars: 1_500,
    hardClearEnabled: true,
    hardClearPlaceholder: HARD_CLEAR_PLACEHOLDER,
    prunableTools: [],
    protectedTools: [],
  },
  memoryFlush: {
    enabled: true,
    softThresholdTokens: 4_000,
    prompt: DEFAULT_MEMORY_FLUSH_PROMPT,
    systemPrompt: DEFAULT_MEMORY_FLUSH_SYSTEM_PROMPT,
  },
};

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate the token count for a single message.
 *
 * Uses the ~4 chars/token heuristic. This matches OpenClaw's approach:
 * fast and good enough for threshold decisions, but not exact.
 */
export function estimateMessageTokens(message: ConversationMessage): number {
  let chars = 0;

  // Role overhead (~4 tokens)
  chars += (message.role?.length ?? 0) + 4;

  // Main content
  if (message.content) {
    chars += message.content.length;
  }

  // Structured content blocks
  if (message.contentBlocks) {
    for (const block of message.contentBlocks) {
      if (block.text) {
        chars += block.text.length;
      }
      if (block.arguments) {
        try {
          chars += JSON.stringify(block.arguments).length;
        } catch {
          chars += 128;
        }
      }
    }
  }

  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
}

/**
 * Estimate total token count for a list of messages.
 */
export function estimateMessagesTokens(messages: ConversationMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

// =============================================================================
// Model Context Window Resolution
// =============================================================================

/**
 * Resolve the context window size for a given model.
 * Checks the lookup table first, then falls back to the default.
 */
export function resolveContextWindowTokens(
  modelId?: string,
  explicitOverride?: number,
): number {
  if (
    typeof explicitOverride === 'number' &&
    Number.isFinite(explicitOverride) &&
    explicitOverride > 0
  ) {
    return Math.floor(explicitOverride);
  }

  if (modelId) {
    const normalized = modelId.toLowerCase().trim();

    // Exact match
    if (MODEL_CONTEXT_WINDOWS[normalized] !== undefined) {
      return MODEL_CONTEXT_WINDOWS[normalized];
    }

    // Prefix match (e.g., "claude-3.5-sonnet-20241022" matches "claude-3.5-sonnet")
    for (const [pattern, tokens] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (normalized.startsWith(pattern)) {
        return tokens;
      }
    }
  }

  return DEFAULT_CONTEXT_WINDOW;
}

// =============================================================================
// Message Importance Classification
// =============================================================================

/**
 * Classify a message's importance for compaction decisions.
 *
 * Mirrors OpenClaw's approach where system prompts and user instructions
 * are never compacted, tool errors are preserved when possible, and
 * verbose tool output is the first to go.
 */
export function classifyMessageImportance(
  message: ConversationMessage,
): MessageImportance {
  // System messages are always critical
  if (message.role === 'system') {
    return 'critical';
  }

  // User messages are high importance (contain instructions/decisions)
  if (message.role === 'user') {
    return 'high';
  }

  // Tool results with errors are high importance
  if (message.role === 'tool_result' && message.isError) {
    return 'high';
  }

  // Large tool results are low importance (verbose output)
  if (message.role === 'tool_result' && message.content.length > 10_000) {
    return 'low';
  }

  return 'normal';
}

// =============================================================================
// Chunk Splitting (ported from OpenClaw's compaction.ts)
// =============================================================================

/**
 * Normalize part count to a sane range.
 */
function normalizeParts(parts: number, messageCount: number): number {
  if (!Number.isFinite(parts) || parts <= 1) {
    return 1;
  }
  return Math.min(Math.max(1, Math.floor(parts)), Math.max(1, messageCount));
}

/**
 * Split messages into approximately equal token-weight chunks.
 *
 * Ported from OpenClaw's `splitMessagesByTokenShare`. Used for multi-pass
 * summarization: each chunk is summarized independently, then the partial
 * summaries are merged.
 */
export function splitMessagesByTokenShare(
  messages: ConversationMessage[],
  parts: number = DEFAULT_PARTS,
): ConversationMessage[][] {
  if (messages.length === 0) {
    return [];
  }

  const normalizedParts = normalizeParts(parts, messages.length);
  if (normalizedParts <= 1) {
    return [messages];
  }

  const totalTokens = estimateMessagesTokens(messages);
  const targetTokens = totalTokens / normalizedParts;
  const chunks: ConversationMessage[][] = [];
  let current: ConversationMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateMessageTokens(message);
    if (
      chunks.length < normalizedParts - 1 &&
      current.length > 0 &&
      currentTokens + messageTokens > targetTokens
    ) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(message);
    currentTokens += messageTokens;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Split messages into chunks where each chunk does not exceed maxTokens.
 *
 * Ported from OpenClaw's `chunkMessagesByMaxTokens`. Used to ensure each
 * summarization call stays within the model's input limits.
 */
export function chunkMessagesByMaxTokens(
  messages: ConversationMessage[],
  maxTokens: number,
): ConversationMessage[][] {
  if (messages.length === 0) {
    return [];
  }

  const chunks: ConversationMessage[][] = [];
  let currentChunk: ConversationMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateMessageTokens(message);

    if (currentChunk.length > 0 && currentTokens + messageTokens > maxTokens) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(message);
    currentTokens += messageTokens;

    // Oversized single message: flush immediately to avoid unbounded growth
    if (messageTokens > maxTokens) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Compute an adaptive chunk ratio based on average message size.
 *
 * Ported from OpenClaw's `computeAdaptiveChunkRatio`. When messages are
 * large (e.g., big tool results), we use smaller chunks so each
 * summarization call stays within model limits.
 */
export function computeAdaptiveChunkRatio(
  messages: ConversationMessage[],
  contextWindow: number,
): number {
  if (messages.length === 0) {
    return BASE_CHUNK_RATIO;
  }

  const totalTokens = estimateMessagesTokens(messages);
  const avgTokens = totalTokens / messages.length;
  const safeAvgTokens = avgTokens * SAFETY_MARGIN;
  const avgRatio = safeAvgTokens / contextWindow;

  // If average message is > 10% of context, reduce chunk ratio
  if (avgRatio > 0.1) {
    const reduction = Math.min(
      avgRatio * 2,
      BASE_CHUNK_RATIO - MIN_CHUNK_RATIO,
    );
    return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
  }

  return BASE_CHUNK_RATIO;
}

/**
 * Check if a single message is too large to summarize safely.
 * If a message exceeds 50% of the context window, it cannot be included
 * in a summarization call without risking overflow.
 */
export function isOversizedForSummary(
  message: ConversationMessage,
  contextWindow: number,
): boolean {
  const tokens = estimateMessageTokens(message) * SAFETY_MARGIN;
  return tokens > contextWindow * 0.5;
}

// =============================================================================
// Tool Failure Extraction (ported from OpenClaw's compaction-safeguard.ts)
// =============================================================================

/**
 * Collect tool failures from messages being compacted.
 * These are included in the compaction metadata so important errors
 * are not lost during summarization.
 */
function collectToolFailures(messages: ConversationMessage[]): ToolFailureInfo[] {
  const failures: ToolFailureInfo[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (message.role !== 'tool_result' || !message.isError) {
      continue;
    }

    const toolCallId = message.toolCallId ?? '';
    if (!toolCallId || seen.has(toolCallId)) {
      continue;
    }
    seen.add(toolCallId);

    const toolName = message.toolName?.trim() || 'tool';
    let summary = message.content.replace(/\s+/g, ' ').trim();
    if (summary.length > MAX_TOOL_FAILURE_CHARS) {
      summary = summary.slice(0, MAX_TOOL_FAILURE_CHARS - 3) + '...';
    }
    if (!summary) {
      summary = 'failed (no output)';
    }

    const meta = extractToolFailureMeta(message.metadata);
    failures.push({ toolCallId, toolName, summary, meta });
  }

  return failures;
}

function extractToolFailureMeta(
  details: Record<string, unknown> | undefined,
): string | undefined {
  if (!details) {
    return undefined;
  }
  const parts: string[] = [];
  if (typeof details['status'] === 'string') {
    parts.push(`status=${details['status']}`);
  }
  if (typeof details['exitCode'] === 'number' && Number.isFinite(details['exitCode'])) {
    parts.push(`exitCode=${details['exitCode']}`);
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Format tool failures into a markdown section for inclusion in summaries.
 */
function formatToolFailuresSection(failures: ToolFailureInfo[]): string {
  if (failures.length === 0) {
    return '';
  }
  const lines = failures.slice(0, MAX_TOOL_FAILURES).map((f) => {
    const meta = f.meta ? ` (${f.meta})` : '';
    return `- ${f.toolName}${meta}: ${f.summary}`;
  });
  if (failures.length > MAX_TOOL_FAILURES) {
    lines.push(`- ...and ${failures.length - MAX_TOOL_FAILURES} more`);
  }
  return `\n\n## Tool Failures\n${lines.join('\n')}`;
}

// =============================================================================
// Context Pruning (ported from OpenClaw's context-pruning/pruner.ts)
// =============================================================================

/**
 * Apply context pruning to tool results before compaction.
 *
 * Two-phase approach ported from OpenClaw:
 * 1. Soft trim: Keep head + tail of large tool results, remove the middle
 * 2. Hard clear: Replace entire tool result content with a placeholder
 *
 * Returns a new array (or the original if no changes were needed).
 */
export function pruneToolResults(
  messages: ConversationMessage[],
  config: ContextPruningConfig,
  contextWindowTokens: number,
): { messages: ConversationMessage[]; prunedCount: number } {
  if (!config.enabled || messages.length === 0) {
    return { messages, prunedCount: 0 };
  }

  const charWindow = contextWindowTokens * CHARS_PER_TOKEN;
  if (charWindow <= 0) {
    return { messages, prunedCount: 0 };
  }

  // Find the cutoff: protect the last N assistant messages from pruning
  const cutoffIndex = findAssistantCutoffIndex(messages, config.keepLastAssistants);
  if (cutoffIndex === null) {
    return { messages, prunedCount: 0 };
  }

  // Protect everything before the first user message (initial context/identity)
  const firstUserIndex = findFirstUserIndex(messages);
  const pruneStartIndex = firstUserIndex === null ? messages.length : firstUserIndex;

  let totalChars = estimateContextChars(messages);
  let ratio = totalChars / charWindow;

  if (ratio < config.softTrimRatio) {
    return { messages, prunedCount: 0 };
  }

  let result: ConversationMessage[] | null = null;
  let prunedCount = 0;
  const prunableIndices: number[] = [];

  // Phase 1: Soft trim
  for (let i = pruneStartIndex; i < cutoffIndex; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool_result') {
continue;
}
    if (!isToolPrunable(msg, config)) {
continue;
}

    prunableIndices.push(i);

    const trimmed = softTrimMessage(msg, config);
    if (!trimmed) {
continue;
}

    const beforeChars = msg.content.length;
    const afterChars = trimmed.content.length;
    totalChars += afterChars - beforeChars;
    prunedCount++;

    if (!result) {
      result = messages.slice();
    }
    result[i] = trimmed;
  }

  const afterSoftTrim = result ?? messages;
  ratio = totalChars / charWindow;

  // Phase 2: Hard clear (if still over threshold)
  if (ratio >= config.hardClearRatio && config.hardClearEnabled) {
    let prunableToolChars = 0;
    for (const i of prunableIndices) {
      const msg = afterSoftTrim[i];
      if (msg.role === 'tool_result') {
        prunableToolChars += msg.content.length;
      }
    }

    if (prunableToolChars >= config.minPrunableChars) {
      for (const i of prunableIndices) {
        if (ratio < config.hardClearRatio) {
break;
}

        const msg = (result ?? messages)[i];
        if (msg.role !== 'tool_result') {
continue;
}

        const beforeChars = msg.content.length;
        const cleared: ConversationMessage = {
          ...msg,
          content: config.hardClearPlaceholder,
        };

        if (!result) {
          result = messages.slice();
        }
        result[i] = cleared;
        prunedCount++;

        totalChars += config.hardClearPlaceholder.length - beforeChars;
        ratio = totalChars / charWindow;
      }
    }
  }

  return { messages: result ?? messages, prunedCount };
}

function isToolPrunable(
  msg: ConversationMessage,
  config: ContextPruningConfig,
): boolean {
  const toolName = msg.toolName ?? '';

  // Protected tools are never pruned
  if (config.protectedTools.length > 0 && config.protectedTools.includes(toolName)) {
    return false;
  }

  // If prunableTools is specified, only those tools are pruned
  if (config.prunableTools.length > 0) {
    return config.prunableTools.includes(toolName);
  }

  // Default: all tool results are prunable
  return true;
}

function softTrimMessage(
  msg: ConversationMessage,
  config: ContextPruningConfig,
): ConversationMessage | null {
  if (msg.content.length <= config.softTrimMaxChars) {
    return null;
  }

  const headChars = Math.max(0, config.softTrimHeadChars);
  const tailChars = Math.max(0, config.softTrimTailChars);
  if (headChars + tailChars >= msg.content.length) {
    return null;
  }

  const head = msg.content.slice(0, headChars);
  const tail = msg.content.slice(msg.content.length - tailChars);
  const trimmed = `${head}\n...\n${tail}`;
  const note = `\n\n[Tool result trimmed: kept first ${headChars} chars and last ${tailChars} chars of ${msg.content.length} chars.]`;

  return { ...msg, content: trimmed + note };
}

function findAssistantCutoffIndex(
  messages: ConversationMessage[],
  keepLastAssistants: number,
): number | null {
  if (keepLastAssistants <= 0) {
    return messages.length;
  }

  let remaining = keepLastAssistants;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      remaining--;
      if (remaining === 0) {
        return i;
      }
    }
  }

  return null;
}

function findFirstUserIndex(messages: ConversationMessage[]): number | null {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      return i;
    }
  }
  return null;
}

function estimateContextChars(messages: ConversationMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += msg.content.length;
    if (msg.contentBlocks) {
      for (const block of msg.contentBlocks) {
        if (block.text) {
total += block.text.length;
}
      }
    }
  }
  return total;
}

// =============================================================================
// History Pruning (ported from OpenClaw's pruneHistoryForContextShare)
// =============================================================================

/**
 * Result of pruning history to fit within a token budget.
 */
export interface PruneHistoryResult {
  /** Messages retained after pruning */
  messages: ConversationMessage[];
  /** Messages that were dropped (for summarization) */
  droppedMessages: ConversationMessage[];
  /** Number of chunk drops performed */
  droppedChunks: number;
  /** Total tokens dropped */
  droppedTokens: number;
  /** Tokens remaining in kept messages */
  keptTokens: number;
  /** Token budget used for the pruning decision */
  budgetTokens: number;
}

/**
 * Prune history to fit within a fraction of the context window.
 *
 * Ported from OpenClaw's `pruneHistoryForContextShare`. Iteratively drops
 * the oldest chunk of messages until the remaining history fits within
 * `maxContextTokens * maxHistoryShare`.
 */
export function pruneHistoryForContextShare(params: {
  messages: ConversationMessage[];
  maxContextTokens: number;
  maxHistoryShare?: number;
  parts?: number;
}): PruneHistoryResult {
  const maxHistoryShare = params.maxHistoryShare ?? 0.5;
  const budgetTokens = Math.max(
    1,
    Math.floor(params.maxContextTokens * maxHistoryShare),
  );

  let keptMessages = params.messages;
  const allDropped: ConversationMessage[] = [];
  let droppedChunks = 0;
  let droppedTokens = 0;
  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, keptMessages.length);

  while (
    keptMessages.length > 0 &&
    estimateMessagesTokens(keptMessages) > budgetTokens
  ) {
    const chunks = splitMessagesByTokenShare(keptMessages, parts);
    if (chunks.length <= 1) {
      break;
    }

    const [dropped, ...rest] = chunks;
    const flatRest = rest.flat();

    // Repair orphaned tool results (tool_result without its tool_call)
    const repaired = repairOrphanedToolResults(flatRest);

    droppedChunks++;
    droppedTokens += estimateMessagesTokens(dropped);
    allDropped.push(...dropped);
    keptMessages = repaired;
  }

  return {
    messages: keptMessages,
    droppedMessages: allDropped,
    droppedChunks,
    droppedTokens,
    keptTokens: estimateMessagesTokens(keptMessages),
    budgetTokens,
  };
}

/**
 * Remove orphaned tool_result messages whose corresponding tool_call
 * was dropped. This prevents "unexpected tool_use_id" API errors.
 *
 * Ported from OpenClaw's `repairToolUseResultPairing`.
 */
function repairOrphanedToolResults(
  messages: ConversationMessage[],
): ConversationMessage[] {
  // Collect all tool call IDs from assistant messages
  const toolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.contentBlocks) {
      for (const block of msg.contentBlocks) {
        if (block.type === 'tool_call' && block.toolCallId) {
          toolCallIds.add(block.toolCallId);
        }
      }
    }
  }

  // Filter out tool_result messages whose toolCallId is not in the set
  return messages.filter((msg) => {
    if (msg.role !== 'tool_result' || !msg.toolCallId) {
      return true;
    }
    return toolCallIds.has(msg.toolCallId);
  });
}

// =============================================================================
// Multi-Pass Summarization (ported from OpenClaw's summarizeInStages)
// =============================================================================

const MERGE_SUMMARIES_INSTRUCTIONS =
  'Merge these partial summaries into a single cohesive summary. Preserve decisions,' +
  ' TODOs, open questions, and any constraints.';

/**
 * Summarize messages through chunked passes with fallback for oversized messages.
 *
 * Ported from OpenClaw's `summarizeWithFallback`. Tries full summarization first,
 * then falls back to excluding oversized messages and noting their presence.
 */
async function summarizeWithFallback(params: {
  messages: ConversationMessage[];
  summarize: SummarizeFn;
  contextWindow: number;
  maxChunkTokens: number;
  reserveTokens: number;
  instructions: string;
  previousSummary?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { messages, summarize, contextWindow, maxChunkTokens, instructions } = params;

  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  // Try full summarization
  try {
    const chunks = chunkMessagesByMaxTokens(messages, maxChunkTokens);
    let summary = params.previousSummary;

    for (const chunk of chunks) {
      summary = await summarize({
        messages: chunk,
        instructions,
        previousSummary: summary,
        maxTokens: params.reserveTokens,
        signal: params.signal,
      });
    }

    return summary ?? DEFAULT_SUMMARY_FALLBACK;
  } catch (fullError) {
    // Fall through to partial summarization
    const errorMsg =
      fullError instanceof Error ? fullError.message : String(fullError);
    console.warn(`Full summarization failed, trying partial: ${errorMsg}`);
  }

  // Fallback: summarize only small messages
  const smallMessages: ConversationMessage[] = [];
  const oversizedNotes: string[] = [];

  for (const msg of messages) {
    if (isOversizedForSummary(msg, contextWindow)) {
      const tokens = estimateMessageTokens(msg);
      oversizedNotes.push(
        `[Large ${msg.role} (~${Math.round(tokens / 1000)}K tokens) omitted from summary]`,
      );
    } else {
      smallMessages.push(msg);
    }
  }

  if (smallMessages.length > 0) {
    try {
      const chunks = chunkMessagesByMaxTokens(smallMessages, maxChunkTokens);
      let summary = params.previousSummary;

      for (const chunk of chunks) {
        summary = await summarize({
          messages: chunk,
          instructions,
          previousSummary: summary,
          maxTokens: params.reserveTokens,
          signal: params.signal,
        });
      }

      const notes =
        oversizedNotes.length > 0 ? `\n\n${oversizedNotes.join('\n')}` : '';
      return (summary ?? DEFAULT_SUMMARY_FALLBACK) + notes;
    } catch (partialError) {
      const errorMsg =
        partialError instanceof Error
          ? partialError.message
          : String(partialError);
      console.warn(`Partial summarization also failed: ${errorMsg}`);
    }
  }

  // Final fallback: note what was there without summarizing
  return (
    `Context contained ${messages.length} messages (${oversizedNotes.length} oversized). ` +
    'Summary unavailable due to size limits.'
  );
}

/**
 * Multi-stage summarization: split messages, summarize each stage,
 * then merge the partial summaries.
 *
 * Ported from OpenClaw's `summarizeInStages`. This is the primary
 * summarization strategy used during compaction.
 */
async function summarizeInStages(params: {
  messages: ConversationMessage[];
  summarize: SummarizeFn;
  contextWindow: number;
  maxChunkTokens: number;
  reserveTokens: number;
  instructions: string;
  previousSummary?: string;
  parts?: number;
  minMessagesForSplit?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const { messages } = params;

  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  const minMessagesForSplit = Math.max(2, params.minMessagesForSplit ?? 4);
  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, messages.length);
  const totalTokens = estimateMessagesTokens(messages);

  // If small enough or too few messages, use single-pass
  if (
    parts <= 1 ||
    messages.length < minMessagesForSplit ||
    totalTokens <= params.maxChunkTokens
  ) {
    return summarizeWithFallback(params);
  }

  const splits = splitMessagesByTokenShare(messages, parts).filter(
    (chunk) => chunk.length > 0,
  );
  if (splits.length <= 1) {
    return summarizeWithFallback(params);
  }

  // Summarize each split independently
  const partialSummaries: string[] = [];
  for (const chunk of splits) {
    partialSummaries.push(
      await summarizeWithFallback({
        ...params,
        messages: chunk,
        previousSummary: undefined,
      }),
    );
  }

  if (partialSummaries.length === 1) {
    return partialSummaries[0];
  }

  // Merge partial summaries into a single cohesive summary
  const summaryMessages: ConversationMessage[] = partialSummaries.map(
    (summary) => ({
      role: 'user' as MessageRole,
      content: summary,
      timestamp: Date.now(),
    }),
  );

  const mergeInstructions = params.instructions
    ? `${MERGE_SUMMARIES_INSTRUCTIONS}\n\nAdditional focus:\n${params.instructions}`
    : MERGE_SUMMARIES_INSTRUCTIONS;

  return summarizeWithFallback({
    ...params,
    messages: summaryMessages,
    instructions: mergeInstructions,
  });
}

// =============================================================================
// Pre-Compact Hook Emitter
// =============================================================================

/**
 * Listener function for pre-compact events.
 */
export type PreCompactListener = (params: {
  sessionId: string;
  messageCount: number;
  tokenCount: number;
  contextWindowTokens: number;
  strategy: string;
}) => Promise<PreCompactHookResult | void> | PreCompactHookResult | void;

// =============================================================================
// Context Compactor
// =============================================================================

/**
 * Context Compactor manages long conversations by automatically compacting
 * context when approaching model limits.
 *
 * Usage:
 * ```ts
 * const compactor = new ContextCompactor({
 *   ...DEFAULT_CONTEXT_COMPACTOR_CONFIG,
 *   summarize: async ({ messages, instructions, previousSummary, maxTokens }) => {
 *     // Call your LLM here
 *     return await llm.summarize(messages, instructions);
 *   },
 * });
 *
 * // Check if compaction is needed
 * if (compactor.shouldCompact(messages, 'claude-3.5-sonnet')) {
 *   const result = await compactor.compact({
 *     sessionId: 'session-123',
 *     messages,
 *     modelId: 'claude-3.5-sonnet',
 *   });
 * }
 * ```
 */
export class ContextCompactor {
  private readonly config: ContextCompactorConfig;
  private readonly logger: Logger;
  private readonly preCompactListeners: PreCompactListener[] = [];
  private compactionCount = 0;

  constructor(config: Partial<ContextCompactorConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_COMPACTOR_CONFIG, ...config };

    // Deep merge nested configs
    if (config.pruning) {
      this.config.pruning = {
        ...DEFAULT_CONTEXT_COMPACTOR_CONFIG.pruning,
        ...config.pruning,
      };
    }
    if (config.memoryFlush) {
      this.config.memoryFlush = {
        ...DEFAULT_CONTEXT_COMPACTOR_CONFIG.memoryFlush,
        ...config.memoryFlush,
      };
    }

    this.logger = new Logger('ContextCompactor');
  }

  // ---------------------------------------------------------------------------
  // Pre-Compact Hook Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a listener that fires before compaction occurs.
   * Listeners can request that compaction be skipped or specify messages
   * to preserve.
   */
  onPreCompact(listener: PreCompactListener): () => void {
    this.preCompactListeners.push(listener);
    return () => {
      const idx = this.preCompactListeners.indexOf(listener);
      if (idx >= 0) {
        this.preCompactListeners.splice(idx, 1);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Threshold Checks
  // ---------------------------------------------------------------------------

  /**
   * Resolve the compaction threshold for a given model.
   */
  resolveThreshold(
    modelId?: string,
    contextWindowOverride?: number,
  ): {
    contextWindowTokens: number;
    triggerTokens: number;
    maxHistoryShare: number;
    reserveTokens: number;
  } {
    const contextWindowTokens = resolveContextWindowTokens(
      modelId,
      contextWindowOverride,
    );

    // Check per-model overrides
    const override = this.findModelThreshold(modelId);

    const triggerRatio =
      override?.compactionTriggerRatio ?? this.config.defaultTriggerRatio;
    const maxHistoryShare =
      override?.maxHistoryShare ?? this.config.defaultMaxHistoryShare;
    const reserveTokens =
      override?.reserveTokens ?? this.config.defaultReserveTokens;

    const triggerTokens =
      override?.compactionTriggerTokens ??
      Math.floor(contextWindowTokens * triggerRatio);

    return {
      contextWindowTokens,
      triggerTokens,
      maxHistoryShare,
      reserveTokens,
    };
  }

  /**
   * Check whether compaction should be triggered for the given messages.
   */
  shouldCompact(
    messages: ConversationMessage[],
    modelId?: string,
    contextWindowOverride?: number,
  ): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const threshold = this.resolveThreshold(modelId, contextWindowOverride);
    const totalTokens = estimateMessagesTokens(messages);
    return totalTokens >= threshold.triggerTokens;
  }

  /**
   * Check whether a pre-compaction memory flush should run.
   *
   * Ported from OpenClaw's `shouldRunMemoryFlush`. Returns true when
   * token usage is within `softThresholdTokens` of the compaction trigger.
   */
  shouldRunMemoryFlush(
    messages: ConversationMessage[],
    modelId?: string,
    contextWindowOverride?: number,
  ): boolean {
    if (!this.config.memoryFlush.enabled) {
      return false;
    }

    const threshold = this.resolveThreshold(modelId, contextWindowOverride);
    const totalTokens = estimateMessagesTokens(messages);
    const flushThreshold =
      threshold.triggerTokens - this.config.memoryFlush.softThresholdTokens;

    return totalTokens >= flushThreshold && totalTokens < threshold.triggerTokens;
  }

  // ---------------------------------------------------------------------------
  // Compaction
  // ---------------------------------------------------------------------------

  /**
   * Compact a conversation's context.
   *
   * Steps (mirroring OpenClaw's compaction pipeline):
   * 1. Fire pre-compact hooks (listeners can skip or customize)
   * 2. Apply context pruning (trim/clear large tool results)
   * 3. Determine which messages to summarize vs. preserve
   * 4. Run multi-pass summarization on older messages
   * 5. Construct result: summary prefix + preserved recent messages
   * 6. Track compaction metadata
   */
  async compact(params: {
    sessionId: string;
    messages: ConversationMessage[];
    modelId?: string;
    contextWindowOverride?: number;
    customInstructions?: string;
    signal?: AbortSignal;
  }): Promise<CompactionResult> {
    const startTime = Date.now();
    const threshold = this.resolveThreshold(
      params.modelId,
      params.contextWindowOverride,
    );
    const tokensBefore = estimateMessagesTokens(params.messages);

    this.logger.info(
      `Starting compaction for session ${params.sessionId}: ` +
        `${tokensBefore} tokens, ${params.messages.length} messages, ` +
        `window=${threshold.contextWindowTokens}, trigger=${threshold.triggerTokens}`,
    );

    // Step 1: Fire pre-compact hooks
    const hookResult = await this.firePreCompactHooks({
      sessionId: params.sessionId,
      messageCount: params.messages.length,
      tokenCount: tokensBefore,
      contextWindowTokens: threshold.contextWindowTokens,
    });

    if (hookResult.skipCompaction) {
      this.logger.info(
        `Compaction skipped for session ${params.sessionId} (pre-compact hook)`,
      );
      return {
        compacted: false,
        summary: '',
        messages: params.messages,
        metadata: this.buildMetadata({
          startTime,
          tokensBefore,
          tokensAfter: tokensBefore,
          messagesBefore: params.messages.length,
          messagesAfter: params.messages.length,
          messagesSummarized: 0,
          messagesPreserved: params.messages.length,
          summarizationPasses: 0,
          contextWindowTokens: threshold.contextWindowTokens,
          triggerTokens: threshold.triggerTokens,
          preservedMessageIds: [],
          toolFailures: [],
          fileReferences: { read: [], modified: [] },
          pruningApplied: false,
          prunedToolResults: 0,
        }),
      };
    }

    // Step 2: Apply context pruning
    let workingMessages = params.messages;
    let pruningApplied = false;
    let prunedToolResults = 0;

    if (this.config.pruning.enabled) {
      const pruneResult = pruneToolResults(
        workingMessages,
        this.config.pruning,
        threshold.contextWindowTokens,
      );
      if (pruneResult.messages !== workingMessages) {
        workingMessages = pruneResult.messages;
        pruningApplied = true;
        prunedToolResults = pruneResult.prunedCount;
        this.logger.info(
          `Context pruning applied: ${prunedToolResults} tool results pruned`,
        );
      }
    }

    // Step 3: Determine split point (preserve recent messages, summarize older)
    const {
      messagesToSummarize,
      messagesToPreserve,
      preservedMessageIds,
    } = this.splitForCompaction(
      workingMessages,
      threshold,
      hookResult.preserveMessageIndices,
    );

    if (messagesToSummarize.length === 0) {
      this.logger.info(
        `Nothing to summarize for session ${params.sessionId}`,
      );
      return {
        compacted: false,
        summary: '',
        messages: workingMessages,
        metadata: this.buildMetadata({
          startTime,
          tokensBefore,
          tokensAfter: estimateMessagesTokens(workingMessages),
          messagesBefore: params.messages.length,
          messagesAfter: workingMessages.length,
          messagesSummarized: 0,
          messagesPreserved: workingMessages.length,
          summarizationPasses: 0,
          contextWindowTokens: threshold.contextWindowTokens,
          triggerTokens: threshold.triggerTokens,
          preservedMessageIds,
          toolFailures: [],
          fileReferences: { read: [], modified: [] },
          pruningApplied,
          prunedToolResults,
        }),
      };
    }

    // Step 4: Collect metadata from messages being summarized
    const toolFailures = collectToolFailures(messagesToSummarize);
    const toolFailureSection = formatToolFailuresSection(toolFailures);

    // Step 5: Run multi-pass summarization
    const summarize = this.config.summarize;
    let summary: string;
    let summarizationPasses = 0;

    if (summarize) {
      const adaptiveRatio = computeAdaptiveChunkRatio(
        messagesToSummarize,
        threshold.contextWindowTokens,
      );
      const maxChunkTokens = Math.max(
        1,
        Math.floor(threshold.contextWindowTokens * adaptiveRatio),
      );

      const instructions =
        this.config.customSummarizationInstructions ??
        'Summarize the conversation history. Preserve key decisions, action items, ' +
          'open questions, constraints, and any technical details that are still relevant.';

      const fullInstructions = params.customInstructions
        ? `${instructions}\n\nAdditional context:\n${params.customInstructions}`
        : instructions;

      try {
        summary = await summarizeInStages({
          messages: messagesToSummarize,
          summarize,
          contextWindow: threshold.contextWindowTokens,
          maxChunkTokens,
          reserveTokens: threshold.reserveTokens,
          instructions: fullInstructions,
          parts: this.config.summarizationPasses,
          minMessagesForSplit: this.config.minMessagesForSplit,
          signal: params.signal,
        });
        summarizationPasses = this.config.summarizationPasses;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Summarization failed for session ${params.sessionId}: ${errorMsg}. ` +
            'Falling back to truncation.',
        );
        summary =
          'Summary unavailable due to context limits. Older messages were truncated.' +
          toolFailureSection;
      }

      // Append tool failure section to summary
      if (toolFailureSection && !summary.includes('## Tool Failures')) {
        summary += toolFailureSection;
      }
    } else {
      // No summarize function provided; use a basic fallback
      summary =
        `[Compacted ${messagesToSummarize.length} messages (` +
        `~${estimateMessagesTokens(messagesToSummarize)} tokens). ` +
        'Details unavailable - no summarization function configured.]' +
        toolFailureSection;
    }

    // Step 6: Construct result - summary as system message + preserved messages
    this.compactionCount++;
    const summaryMessage: ConversationMessage = {
      role: 'system',
      content: `## Conversation Summary (compacted)\n\n${summary}`,
      timestamp: Date.now(),
      id: `compaction-summary-${this.compactionCount}`,
      metadata: {
        isCompactionSummary: true,
        compactionCount: this.compactionCount,
        messagesSummarized: messagesToSummarize.length,
      },
    };

    const resultMessages = [summaryMessage, ...messagesToPreserve];
    const tokensAfter = estimateMessagesTokens(resultMessages);

    this.logger.info(
      `Compaction complete for session ${params.sessionId}: ` +
        `${tokensBefore} -> ${tokensAfter} tokens ` +
        `(${((tokensAfter / tokensBefore) * 100).toFixed(1)}%), ` +
        `${params.messages.length} -> ${resultMessages.length} messages`,
    );

    return {
      compacted: true,
      summary,
      messages: resultMessages,
      metadata: this.buildMetadata({
        startTime,
        tokensBefore,
        tokensAfter,
        messagesBefore: params.messages.length,
        messagesAfter: resultMessages.length,
        messagesSummarized: messagesToSummarize.length,
        messagesPreserved: messagesToPreserve.length,
        summarizationPasses,
        contextWindowTokens: threshold.contextWindowTokens,
        triggerTokens: threshold.triggerTokens,
        preservedMessageIds,
        toolFailures,
        fileReferences: { read: [], modified: [] },
        pruningApplied,
        prunedToolResults,
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration Access
  // ---------------------------------------------------------------------------

  /** Get the current compaction count for this instance. */
  getCompactionCount(): number {
    return this.compactionCount;
  }

  /** Get the current configuration (read-only). */
  getConfig(): Readonly<ContextCompactorConfig> {
    return this.config;
  }

  /** Get memory flush configuration. */
  getMemoryFlushConfig(): Readonly<MemoryFlushConfig> {
    return this.config.memoryFlush;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Find a matching model threshold configuration.
   */
  private findModelThreshold(
    modelId?: string,
  ): ModelCompactionThreshold | undefined {
    if (!modelId || this.config.modelThresholds.length === 0) {
      return undefined;
    }

    const normalized = modelId.toLowerCase().trim();

    for (const threshold of this.config.modelThresholds) {
      const pattern = threshold.modelPattern.toLowerCase().trim();

      // Exact match
      if (pattern === normalized) {
        return threshold;
      }

      // Wildcard match (simple glob: * matches any sequence)
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*') + '$',
        );
        if (regex.test(normalized)) {
          return threshold;
        }
      }

      // Prefix match
      if (normalized.startsWith(pattern)) {
        return threshold;
      }
    }

    return undefined;
  }

  /**
   * Split messages into "to summarize" and "to preserve" groups.
   *
   * Strategy:
   * 1. System messages are always preserved (critical)
   * 2. Recent messages within the history budget are preserved
   * 3. Messages at hook-specified indices are preserved
   * 4. Everything else is summarized
   */
  private splitForCompaction(
    messages: ConversationMessage[],
    threshold: {
      contextWindowTokens: number;
      maxHistoryShare: number;
      reserveTokens: number;
    },
    hookPreserveIndices: number[],
  ): {
    messagesToSummarize: ConversationMessage[];
    messagesToPreserve: ConversationMessage[];
    preservedMessageIds: string[];
  } {
    // Separate system messages (always preserved)
    const systemMessages: ConversationMessage[] = [];
    const nonSystemMessages: ConversationMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg);
      } else {
        nonSystemMessages.push(msg);
      }
    }

    if (nonSystemMessages.length === 0) {
      return {
        messagesToSummarize: [],
        messagesToPreserve: messages,
        preservedMessageIds: messages
          .map((m) => m.id)
          .filter((id): id is string => id !== undefined),
      };
    }

    // Calculate how many tokens are available for history
    const systemTokens = estimateMessagesTokens(systemMessages);
    const availableForHistory = Math.max(
      0,
      Math.floor(
        threshold.contextWindowTokens * threshold.maxHistoryShare -
          systemTokens -
          threshold.reserveTokens,
      ),
    );

    // Find the split point: keep as many recent messages as fit in the budget
    let preserveFromIndex = nonSystemMessages.length;
    let preserveTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateMessageTokens(nonSystemMessages[i]);
      if (preserveTokens + msgTokens > availableForHistory) {
        break;
      }
      preserveTokens += msgTokens;
      preserveFromIndex = i;
    }

    // Ensure we don't split in the middle of a tool_call/tool_result pair
    preserveFromIndex = this.adjustSplitForToolPairing(
      nonSystemMessages,
      preserveFromIndex,
    );

    // Build sets from hook-specified indices
    const hookPreservedSet = new Set(hookPreserveIndices);

    const messagesToSummarize: ConversationMessage[] = [];
    const messagesToPreserve: ConversationMessage[] = [...systemMessages];

    for (let i = 0; i < nonSystemMessages.length; i++) {
      const msg = nonSystemMessages[i];
      if (i >= preserveFromIndex || hookPreservedSet.has(i)) {
        messagesToPreserve.push(msg);
      } else {
        messagesToSummarize.push(msg);
      }
    }

    const preservedMessageIds = messagesToPreserve
      .map((m) => m.id)
      .filter((id): id is string => id !== undefined);

    return { messagesToSummarize, messagesToPreserve, preservedMessageIds };
  }

  /**
   * Adjust split point so we don't orphan tool_result messages.
   * If the split lands between a tool_call and its result, move the
   * split back to include the tool_call in the preserved section.
   */
  private adjustSplitForToolPairing(
    messages: ConversationMessage[],
    splitIndex: number,
  ): number {
    if (splitIndex <= 0 || splitIndex >= messages.length) {
      return splitIndex;
    }

    // If the first preserved message is a tool_result, move split back
    // to include the corresponding assistant message with the tool_call
    const firstPreserved = messages[splitIndex];
    if (firstPreserved.role === 'tool_result' && firstPreserved.toolCallId) {
      // Walk backwards to find the assistant message with the matching tool_call
      for (let i = splitIndex - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && msg.contentBlocks) {
          const hasToolCall = msg.contentBlocks.some(
            (b) =>
              b.type === 'tool_call' &&
              b.toolCallId === firstPreserved.toolCallId,
          );
          if (hasToolCall) {
            return i;
          }
        }
        // Don't walk back too far
        if (msg.role === 'user') {
break;
}
      }
    }

    return splitIndex;
  }

  /**
   * Fire all pre-compact listeners and merge their results.
   */
  private async firePreCompactHooks(params: {
    sessionId: string;
    messageCount: number;
    tokenCount: number;
    contextWindowTokens: number;
  }): Promise<PreCompactHookResult> {
    const merged: PreCompactHookResult = {
      skipCompaction: false,
      preserveMessageIndices: [],
    };

    for (const listener of this.preCompactListeners) {
      try {
        const result = await listener({
          ...params,
          strategy: 'multi-pass-summarization',
        });

        if (result) {
          if (result.skipCompaction) {
            merged.skipCompaction = true;
          }
          if (result.preserveMessageIndices.length > 0) {
            merged.preserveMessageIndices.push(
              ...result.preserveMessageIndices,
            );
          }
          if (result.strategy) {
            merged.strategy = result.strategy;
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Pre-compact hook failed for session ${params.sessionId}: ${errorMsg}`,
        );
      }
    }

    // Deduplicate preserve indices
    merged.preserveMessageIndices = [...new Set(merged.preserveMessageIndices)];

    return merged;
  }

  /**
   * Build compaction metadata from operation parameters.
   */
  private buildMetadata(params: {
    startTime: number;
    tokensBefore: number;
    tokensAfter: number;
    messagesBefore: number;
    messagesAfter: number;
    messagesSummarized: number;
    messagesPreserved: number;
    summarizationPasses: number;
    contextWindowTokens: number;
    triggerTokens: number;
    preservedMessageIds: string[];
    toolFailures: ToolFailureInfo[];
    fileReferences: { read: string[]; modified: string[] };
    pruningApplied: boolean;
    prunedToolResults: number;
  }): CompactionMetadata {
    return {
      timestamp: Date.now(),
      tokensBefore: params.tokensBefore,
      tokensAfter: params.tokensAfter,
      compressionRatio:
        params.tokensBefore > 0
          ? params.tokensAfter / params.tokensBefore
          : 1,
      messagesBefore: params.messagesBefore,
      messagesAfter: params.messagesAfter,
      messagesSummarized: params.messagesSummarized,
      messagesPreserved: params.messagesPreserved,
      summarizationPasses: params.summarizationPasses,
      contextWindowTokens: params.contextWindowTokens,
      triggerTokens: params.triggerTokens,
      compactionCount: this.compactionCount,
      durationMs: Date.now() - params.startTime,
      preservedMessageIds: params.preservedMessageIds,
      toolFailures: params.toolFailures,
      fileReferences: params.fileReferences,
      pruningApplied: params.pruningApplied,
      prunedToolResults: params.prunedToolResults,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ContextCompactor with the given configuration.
 *
 * @example
 * ```ts
 * const compactor = createContextCompactor({
 *   enabled: true,
 *   modelThresholds: [
 *     { modelPattern: 'gpt-4', compactionTriggerRatio: 0.8 },
 *     { modelPattern: 'claude-*', compactionTriggerRatio: 0.9 },
 *   ],
 *   summarize: myLlmSummarizer,
 * });
 * ```
 */
export function createContextCompactor(
  config?: Partial<ContextCompactorConfig>,
): ContextCompactor {
  return new ContextCompactor(config);
}
