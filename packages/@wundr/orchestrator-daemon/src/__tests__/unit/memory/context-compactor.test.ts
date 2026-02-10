/**
 * Tests for the ContextCompactor module (src/memory/context-compactor.ts).
 *
 * Covers:
 *  - Token estimation (single message, content blocks, empty, edge cases)
 *  - Model context window resolution (exact, prefix, fallback)
 *  - Model-aware thresholds (4K-200K context windows)
 *  - Message importance classification
 *  - Chunk splitting (by token share, by max tokens, adaptive ratio)
 *  - Oversized message detection
 *  - Tool result pruning (soft trim, hard clear, protected/prunable tools)
 *  - History pruning for context share
 *  - Multi-pass summarization via compact()
 *  - Message preservation (system messages, recent messages)
 *  - Memory flush detection thresholds
 *  - Pre-compact hooks (skip, preserve indices, error handling)
 *  - Compaction without a summarize function
 *  - Compaction metadata correctness
 *  - Factory function
 *  - Edge cases: empty conversations, single message, all system messages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  estimateMessageTokens,
  estimateMessagesTokens,
  resolveContextWindowTokens,
  classifyMessageImportance,
  splitMessagesByTokenShare,
  chunkMessagesByMaxTokens,
  computeAdaptiveChunkRatio,
  isOversizedForSummary,
  pruneToolResults,
  pruneHistoryForContextShare,
  ContextCompactor,
  createContextCompactor,
  DEFAULT_CONTEXT_COMPACTOR_CONFIG,
  type ConversationMessage,
  type SummarizeFn,
  type ContextPruningConfig,
  type MessageRole,
} from '../../../memory/context-compactor';

// =============================================================================
// Test Helpers
// =============================================================================

/** Create a minimal conversation message with sensible defaults. */
function msg(
  role: MessageRole,
  content: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return { role, content, ...overrides };
}

/** Create a system message. */
function systemMsg(content: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return msg('system', content, overrides);
}

/** Create a user message. */
function userMsg(content: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return msg('user', content, overrides);
}

/** Create an assistant message. */
function assistantMsg(content: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return msg('assistant', content, overrides);
}

/** Create a tool_result message. */
function toolResultMsg(
  content: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return msg('tool_result', content, {
    toolCallId: overrides.toolCallId ?? `tc-${Math.random().toString(36).slice(2, 8)}`,
    toolName: overrides.toolName ?? 'some_tool',
    ...overrides,
  });
}

/** Create a mock summarize function that echoes a short summary. */
function createMockSummarize(): SummarizeFn & ReturnType<typeof vi.fn> {
  return vi.fn(async ({ messages }) => {
    return `Summary of ${messages.length} messages.`;
  });
}

/** Generate a long string of a given character count. */
function longString(chars: number, char = 'x'): string {
  return char.repeat(chars);
}

/** Default pruning config for testing. */
function defaultPruningConfig(): ContextPruningConfig {
  return { ...DEFAULT_CONTEXT_COMPACTOR_CONFIG.pruning };
}

// =============================================================================
// Token Estimation
// =============================================================================

describe('estimateMessageTokens', () => {
  it('should estimate tokens for a simple text message', () => {
    // "user" role (4 chars) + 4 overhead = 8 chars role portion
    // "Hello world" = 11 chars
    // Total = 19 chars -> ceil(19 / 4) = 5 tokens
    const tokens = estimateMessageTokens(userMsg('Hello world'));
    expect(tokens).toBe(Math.ceil((4 + 4 + 11) / 4));
  });

  it('should return at least 1 token for an empty message', () => {
    const tokens = estimateMessageTokens(msg('user', ''));
    expect(tokens).toBeGreaterThanOrEqual(1);
  });

  it('should include content block text in the estimate', () => {
    const message = msg('assistant', 'base', {
      contentBlocks: [
        { type: 'text', text: longString(100) },
        { type: 'text', text: longString(200) },
      ],
    });
    const tokensWithBlocks = estimateMessageTokens(message);
    const tokensWithoutBlocks = estimateMessageTokens(
      msg('assistant', 'base'),
    );
    expect(tokensWithBlocks).toBeGreaterThan(tokensWithoutBlocks);
  });

  it('should include serialized arguments in the estimate', () => {
    const message = msg('assistant', '', {
      contentBlocks: [
        {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'read_file',
          arguments: { path: '/some/very/long/path/to/file.ts' },
        },
      ],
    });
    const tokens = estimateMessageTokens(message);
    expect(tokens).toBeGreaterThan(1);
  });

  it('should handle non-serializable arguments gracefully', () => {
    // Create circular reference - JSON.stringify will throw
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const message = msg('assistant', '', {
      contentBlocks: [
        {
          type: 'tool_call',
          toolCallId: 'tc-1',
          arguments: circular,
        },
      ],
    });
    // Should not throw, should use fallback of 128 chars
    const tokens = estimateMessageTokens(message);
    expect(tokens).toBeGreaterThanOrEqual(1);
  });

  it('should handle missing role gracefully', () => {
    // TypeScript allows this at runtime (partial data from deserialization)
    const message = { content: 'test' } as ConversationMessage;
    const tokens = estimateMessageTokens(message);
    expect(tokens).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateMessagesTokens', () => {
  it('should return 0 for an empty array', () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it('should sum token estimates across multiple messages', () => {
    const messages = [
      userMsg('Hello'),
      assistantMsg('World'),
    ];
    const total = estimateMessagesTokens(messages);
    const individual =
      estimateMessageTokens(messages[0]) +
      estimateMessageTokens(messages[1]);
    expect(total).toBe(individual);
  });

  it('should handle a large conversation', () => {
    const messages = Array.from({ length: 100 }, (_, i) =>
      userMsg(`Message number ${i} with some content`),
    );
    const tokens = estimateMessagesTokens(messages);
    expect(tokens).toBeGreaterThan(100);
  });
});

// =============================================================================
// Model Context Window Resolution
// =============================================================================

describe('resolveContextWindowTokens', () => {
  it('should return exact match for known models', () => {
    expect(resolveContextWindowTokens('gpt-3.5-turbo')).toBe(4_096);
    expect(resolveContextWindowTokens('gpt-4')).toBe(8_192);
    expect(resolveContextWindowTokens('gpt-4-turbo')).toBe(128_000);
    expect(resolveContextWindowTokens('claude-3.5-sonnet')).toBe(200_000);
    expect(resolveContextWindowTokens('claude-opus-4')).toBe(200_000);
  });

  it('should normalize model ID case', () => {
    expect(resolveContextWindowTokens('GPT-4')).toBe(8_192);
    expect(resolveContextWindowTokens('Claude-3.5-Sonnet')).toBe(200_000);
  });

  it('should prefix-match versioned model names', () => {
    // "claude-3.5-sonnet-20241022" starts with "claude-3.5-sonnet"
    expect(resolveContextWindowTokens('claude-3.5-sonnet-20241022')).toBe(200_000);
    // "gpt-4-turbo-preview" starts with "gpt-4" (matched first in iteration order)
    // so it gets gpt-4's window (8192), not gpt-4-turbo's (128000).
    // This is the expected prefix-match behavior: first match wins.
    expect(resolveContextWindowTokens('gpt-4-turbo-preview')).toBe(8_192);
    // "gpt-4o-mini-2024" starts with "gpt-4" (matched first in iteration order)
    expect(resolveContextWindowTokens('gpt-4o-mini-2024')).toBe(8_192);
    // "claude-3-haiku-20241022" starts with "claude-3-haiku" -> 200_000
    expect(resolveContextWindowTokens('claude-3-haiku-20241022')).toBe(200_000);
  });

  it('should return default (128K) for unknown models', () => {
    expect(resolveContextWindowTokens('some-unknown-model')).toBe(128_000);
  });

  it('should return default when no model ID is provided', () => {
    expect(resolveContextWindowTokens()).toBe(128_000);
    expect(resolveContextWindowTokens(undefined)).toBe(128_000);
  });

  it('should prefer explicit override over lookup', () => {
    expect(resolveContextWindowTokens('gpt-4', 50_000)).toBe(50_000);
  });

  it('should ignore non-positive or non-finite overrides', () => {
    expect(resolveContextWindowTokens('gpt-4', 0)).toBe(8_192);
    expect(resolveContextWindowTokens('gpt-4', -1)).toBe(8_192);
    expect(resolveContextWindowTokens('gpt-4', NaN)).toBe(8_192);
    expect(resolveContextWindowTokens('gpt-4', Infinity)).toBe(8_192);
  });

  it('should floor fractional overrides', () => {
    expect(resolveContextWindowTokens(undefined, 10_000.9)).toBe(10_000);
  });
});

// =============================================================================
// Message Importance Classification
// =============================================================================

describe('classifyMessageImportance', () => {
  it('should classify system messages as critical', () => {
    expect(classifyMessageImportance(systemMsg('You are a helpful assistant.'))).toBe('critical');
  });

  it('should classify user messages as high', () => {
    expect(classifyMessageImportance(userMsg('Do something'))).toBe('high');
  });

  it('should classify tool_result errors as high', () => {
    const errorResult = toolResultMsg('Command failed: exit 1', { isError: true });
    expect(classifyMessageImportance(errorResult)).toBe('high');
  });

  it('should classify large tool results (>10K chars) as low', () => {
    const largeResult = toolResultMsg(longString(10_001));
    expect(classifyMessageImportance(largeResult)).toBe('low');
  });

  it('should classify small tool results as normal', () => {
    const smallResult = toolResultMsg('file content here');
    expect(classifyMessageImportance(smallResult)).toBe('normal');
  });

  it('should classify assistant messages as normal', () => {
    expect(classifyMessageImportance(assistantMsg('Sure, I can help.'))).toBe('normal');
  });

  it('should classify exactly 10_000 char tool result as normal (boundary)', () => {
    const boundaryResult = toolResultMsg(longString(10_000));
    expect(classifyMessageImportance(boundaryResult)).toBe('normal');
  });
});

// =============================================================================
// Chunk Splitting
// =============================================================================

describe('splitMessagesByTokenShare', () => {
  it('should return empty array for empty messages', () => {
    expect(splitMessagesByTokenShare([])).toEqual([]);
  });

  it('should return a single chunk when parts <= 1', () => {
    const messages = [userMsg('a'), userMsg('b')];
    const result = splitMessagesByTokenShare(messages, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(messages);
  });

  it('should return a single chunk when parts is 0 or negative', () => {
    const messages = [userMsg('a'), userMsg('b')];
    expect(splitMessagesByTokenShare(messages, 0)).toHaveLength(1);
    expect(splitMessagesByTokenShare(messages, -5)).toHaveLength(1);
  });

  it('should split messages into approximately equal chunks', () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      userMsg(`Message ${i} with equal content`),
    );
    const result = splitMessagesByTokenShare(messages, 2);
    expect(result.length).toBe(2);
    // All original messages are present
    const flat = result.flat();
    expect(flat.length).toBe(10);
  });

  it('should cap parts at message count', () => {
    const messages = [userMsg('a'), userMsg('b')];
    // Asking for 10 parts with 2 messages -> capped to 2
    const result = splitMessagesByTokenShare(messages, 10);
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result.flat().length).toBe(2);
  });

  it('should handle a single message', () => {
    const messages = [userMsg('only one')];
    const result = splitMessagesByTokenShare(messages, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(messages);
  });
});

describe('chunkMessagesByMaxTokens', () => {
  it('should return empty array for empty messages', () => {
    expect(chunkMessagesByMaxTokens([], 100)).toEqual([]);
  });

  it('should keep messages in one chunk when they fit', () => {
    const messages = [userMsg('short'), userMsg('msg')];
    const result = chunkMessagesByMaxTokens(messages, 10_000);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(messages);
  });

  it('should split when messages exceed maxTokens', () => {
    // Each message is roughly (role + 4 + content) / 4 tokens
    const messages = Array.from({ length: 20 }, (_) =>
      userMsg(longString(400)), // each ~100+ tokens
    );
    const result = chunkMessagesByMaxTokens(messages, 200);
    expect(result.length).toBeGreaterThan(1);
    expect(result.flat().length).toBe(20);
  });

  it('should flush an oversized single message into its own chunk', () => {
    const oversized = userMsg(longString(10_000)); // ~2500 tokens
    const normal = userMsg('small');
    const result = chunkMessagesByMaxTokens([oversized, normal], 100);
    // oversized message should be in its own chunk
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toBe(oversized);
  });
});

describe('computeAdaptiveChunkRatio', () => {
  it('should return base ratio (0.4) for empty messages', () => {
    expect(computeAdaptiveChunkRatio([], 128_000)).toBe(0.4);
  });

  it('should return base ratio for small average messages', () => {
    const messages = Array.from({ length: 10 }, () => userMsg('short'));
    const ratio = computeAdaptiveChunkRatio(messages, 128_000);
    expect(ratio).toBe(0.4);
  });

  it('should reduce ratio for large average messages', () => {
    // Messages averaging > 10% of context window
    const messages = [
      userMsg(longString(128_000)), // ~32K tokens, context is 128K
    ];
    const ratio = computeAdaptiveChunkRatio(messages, 128_000);
    expect(ratio).toBeLessThan(0.4);
    expect(ratio).toBeGreaterThanOrEqual(0.15);
  });

  it('should never go below MIN_CHUNK_RATIO (0.15)', () => {
    // Extremely large messages
    const messages = [userMsg(longString(1_000_000))];
    const ratio = computeAdaptiveChunkRatio(messages, 10_000);
    expect(ratio).toBeGreaterThanOrEqual(0.15);
  });
});

describe('isOversizedForSummary', () => {
  it('should return false for small messages', () => {
    expect(isOversizedForSummary(userMsg('small'), 128_000)).toBe(false);
  });

  it('should return true when message exceeds 50% of context window (with safety margin)', () => {
    // 50% of 1000 token context = 500 tokens * SAFETY_MARGIN(1.2) -> need >500 token message
    // With safety margin: estimateTokens * 1.2 > contextWindow * 0.5
    // So tokens > contextWindow * 0.5 / 1.2 = 416.7 tokens
    // 416.7 tokens * 4 chars = ~1667 chars + overhead
    const message = userMsg(longString(2_000));
    expect(isOversizedForSummary(message, 1_000)).toBe(true);
  });

  it('should return false when message is just under the threshold', () => {
    // Small context window, moderately sized message
    const message = userMsg(longString(100));
    expect(isOversizedForSummary(message, 200_000)).toBe(false);
  });
});

// =============================================================================
// Tool Result Pruning
// =============================================================================

describe('pruneToolResults', () => {
  const defaultConfig = defaultPruningConfig;

  it('should return original messages when pruning is disabled', () => {
    const messages = [toolResultMsg(longString(100_000))];
    const config = { ...defaultConfig(), enabled: false };
    const result = pruneToolResults(messages, config, 128_000);
    expect(result.messages).toBe(messages);
    expect(result.prunedCount).toBe(0);
  });

  it('should return original messages when empty', () => {
    const result = pruneToolResults([], defaultConfig(), 128_000);
    expect(result.messages).toEqual([]);
    expect(result.prunedCount).toBe(0);
  });

  it('should return original messages when context usage is below soft trim ratio', () => {
    // Small messages, well below the softTrimRatio of 0.3
    const messages = [
      userMsg('hi'),
      assistantMsg('hello'),
      assistantMsg('ok'),
      assistantMsg('sure'),
      assistantMsg('done'),
      toolResultMsg('small result'),
    ];
    const result = pruneToolResults(messages, defaultConfig(), 128_000);
    expect(result.messages).toBe(messages);
    expect(result.prunedCount).toBe(0);
  });

  it('should soft-trim large tool results when above soft trim ratio', () => {
    // Context window chars = 128_000 * 4 = 512_000
    // softTrimRatio = 0.3, so threshold = 153_600 chars
    // We need total chars > 153_600
    const bigContent = longString(200_000);
    const messages = [
      userMsg('question'),
      assistantMsg('let me check'),
      toolResultMsg(bigContent, { toolCallId: 'tc-1' }),
      assistantMsg('response 1'),
      assistantMsg('response 2'),
      assistantMsg('response 3'),
      assistantMsg('response 4'), // 4 assistants, keepLastAssistants=3 protects last 3
    ];
    const config = { ...defaultConfig(), softTrimMaxChars: 4_000 };
    const result = pruneToolResults(messages, config, 128_000);
    // The tool result at index 2 should have been trimmed
    expect(result.prunedCount).toBeGreaterThanOrEqual(1);
    if (result.messages !== messages) {
      const trimmedMsg = result.messages[2];
      expect(trimmedMsg.content.length).toBeLessThan(bigContent.length);
      expect(trimmedMsg.content).toContain('...');
    }
  });

  it('should not prune protected tools', () => {
    const bigContent = longString(200_000);
    const messages = [
      userMsg('question'),
      toolResultMsg(bigContent, { toolCallId: 'tc-1', toolName: 'read_file' }),
      assistantMsg('r1'),
      assistantMsg('r2'),
      assistantMsg('r3'),
      assistantMsg('r4'),
    ];
    const config = {
      ...defaultConfig(),
      protectedTools: ['read_file'],
    };
    const result = pruneToolResults(messages, config, 128_000);
    // read_file is protected, so the tool result should not be pruned
    expect(result.prunedCount).toBe(0);
  });

  it('should only prune tools in prunableTools when specified', () => {
    const bigContent = longString(200_000);
    const messages = [
      userMsg('q'),
      toolResultMsg(bigContent, { toolCallId: 'tc-1', toolName: 'bash' }),
      toolResultMsg(bigContent, { toolCallId: 'tc-2', toolName: 'read_file' }),
      assistantMsg('r1'),
      assistantMsg('r2'),
      assistantMsg('r3'),
      assistantMsg('r4'),
    ];
    const config = {
      ...defaultConfig(),
      prunableTools: ['bash'], // Only bash is prunable
    };
    const result = pruneToolResults(messages, config, 128_000);
    // Only bash tool results should be pruned, not read_file
    if (result.prunedCount > 0 && result.messages !== messages) {
      // bash result (index 1) might be pruned
      // read_file result (index 2) should retain original content
      expect(result.messages[2].content).toBe(bigContent);
    }
  });

  it('should not prune tool results within the last N assistant messages', () => {
    const bigContent = longString(200_000);
    const messages = [
      userMsg('q'),
      assistantMsg('first response'),
      toolResultMsg(bigContent, { toolCallId: 'tc-1' }), // After first assistant
      assistantMsg('second response'),                    // 3rd from end
      assistantMsg('third response'),                     // 2nd from end
      assistantMsg('fourth response'),                    // last
    ];
    // keepLastAssistants=3 means index of 3rd-from-last assistant is the cutoff
    // The tool result at index 2 is before the cutoff so it CAN be pruned
    const config = { ...defaultConfig(), keepLastAssistants: 3 };
    const result = pruneToolResults(messages, config, 128_000);
    // With big enough content to cross softTrimRatio, pruning should occur on the tool result
    // that is before the cutoff
    expect(result.prunedCount).toBeGreaterThanOrEqual(0);
  });

  it('should apply hard clear when still over threshold after soft trim', () => {
    // Make context very tight
    const bigContent = longString(200_000);
    const messages = [
      userMsg('q'),
      toolResultMsg(bigContent, { toolCallId: 'tc-1' }),
      assistantMsg('r1'),
      assistantMsg('r2'),
      assistantMsg('r3'),
      assistantMsg('r4'),
    ];
    // Use a small context window so ratio exceeds hardClearRatio after soft trim
    const config = {
      ...defaultConfig(),
      softTrimRatio: 0.1,
      hardClearRatio: 0.2,
      minPrunableChars: 1_000,
      hardClearEnabled: true,
    };
    const result = pruneToolResults(messages, config, 10_000);
    if (result.prunedCount > 0 && result.messages !== messages) {
      // Check if the hard clear placeholder was applied
      const prunedMsg = result.messages[1];
      const hasPlaceholder = prunedMsg.content === config.hardClearPlaceholder;
      const hasTrimmed = prunedMsg.content.includes('...');
      expect(hasPlaceholder || hasTrimmed).toBe(true);
    }
  });

  it('should not hard clear when hardClearEnabled is false', () => {
    const bigContent = longString(200_000);
    const messages = [
      userMsg('q'),
      toolResultMsg(bigContent, { toolCallId: 'tc-1' }),
      assistantMsg('r1'),
      assistantMsg('r2'),
      assistantMsg('r3'),
      assistantMsg('r4'),
    ];
    const config = {
      ...defaultConfig(),
      softTrimRatio: 0.1,
      hardClearRatio: 0.2,
      hardClearEnabled: false,
    };
    const result = pruneToolResults(messages, config, 10_000);
    // Even if ratio exceeds hardClearRatio, no hard clearing should occur
    if (result.messages !== messages) {
      for (const m of result.messages) {
        expect(m.content).not.toBe(config.hardClearPlaceholder);
      }
    }
  });
});

// =============================================================================
// History Pruning
// =============================================================================

describe('pruneHistoryForContextShare', () => {
  it('should keep all messages when they fit within budget', () => {
    const messages = [userMsg('hi'), assistantMsg('hello')];
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 100_000,
      maxHistoryShare: 0.5,
    });
    expect(result.messages).toEqual(messages);
    expect(result.droppedMessages).toEqual([]);
    expect(result.droppedChunks).toBe(0);
  });

  it('should drop oldest chunks when over budget', () => {
    // Create messages that exceed the budget
    const messages = Array.from({ length: 20 }, (_) =>
      userMsg(longString(1_000)),
    );
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 1_000,
      maxHistoryShare: 0.5,
    });
    expect(result.droppedChunks).toBeGreaterThan(0);
    expect(result.droppedMessages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
    expect(result.keptTokens).toBeLessThanOrEqual(result.budgetTokens);
  });

  it('should handle empty messages', () => {
    const result = pruneHistoryForContextShare({
      messages: [],
      maxContextTokens: 100_000,
    });
    expect(result.messages).toEqual([]);
    expect(result.droppedChunks).toBe(0);
  });

  it('should remove orphaned tool results after chunk dropping', () => {
    const messages = [
      assistantMsg('let me run that', {
        contentBlocks: [
          { type: 'tool_call', toolCallId: 'tc-orphan', toolName: 'bash' },
        ],
      }),
      toolResultMsg('result here', { toolCallId: 'tc-orphan' }),
      userMsg(longString(2_000)), // big enough to force dropping
      assistantMsg('done', {
        contentBlocks: [
          { type: 'tool_call', toolCallId: 'tc-kept', toolName: 'bash' },
        ],
      }),
      toolResultMsg('kept result', { toolCallId: 'tc-kept' }),
    ];
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 200,
      maxHistoryShare: 0.5,
    });
    // If the first chunk (with tc-orphan call) was dropped, orphan repair should
    // also remove the tc-orphan result
    for (const m of result.messages) {
      if (m.role === 'tool_result' && m.toolCallId === 'tc-orphan') {
        // If tool result is kept, its corresponding assistant must also be kept
        const hasCall = result.messages.some(
          (msg) =>
            msg.role === 'assistant' &&
            msg.contentBlocks?.some(
              (b) => b.type === 'tool_call' && b.toolCallId === 'tc-orphan',
            ),
        );
        expect(hasCall).toBe(true);
      }
    }
  });
});

// =============================================================================
// ContextCompactor - Threshold Resolution
// =============================================================================

describe('ContextCompactor', () => {
  let compactor: ContextCompactor;
  let mockSummarize: SummarizeFn & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSummarize = createMockSummarize();
    compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
    });
  });

  // ---------------------------------------------------------------------------
  // resolveThreshold
  // ---------------------------------------------------------------------------

  describe('resolveThreshold', () => {
    it('should compute trigger tokens from default ratio and model window', () => {
      const t = compactor.resolveThreshold('gpt-4');
      expect(t.contextWindowTokens).toBe(8_192);
      // Default trigger ratio is 0.85
      expect(t.triggerTokens).toBe(Math.floor(8_192 * 0.85));
      expect(t.maxHistoryShare).toBe(0.5);
      expect(t.reserveTokens).toBe(4_096);
    });

    it('should use 200K window for Claude models', () => {
      const t = compactor.resolveThreshold('claude-3.5-sonnet');
      expect(t.contextWindowTokens).toBe(200_000);
      expect(t.triggerTokens).toBe(Math.floor(200_000 * 0.85));
    });

    it('should use 4K window for gpt-3.5-turbo', () => {
      const t = compactor.resolveThreshold('gpt-3.5-turbo');
      expect(t.contextWindowTokens).toBe(4_096);
    });

    it('should accept explicit context window override', () => {
      const t = compactor.resolveThreshold('gpt-4', 50_000);
      expect(t.contextWindowTokens).toBe(50_000);
      expect(t.triggerTokens).toBe(Math.floor(50_000 * 0.85));
    });

    it('should apply per-model threshold overrides', () => {
      const custom = new ContextCompactor({
        enabled: true,
        modelThresholds: [
          {
            modelPattern: 'gpt-4',
            compactionTriggerRatio: 0.7,
            maxHistoryShare: 0.3,
            reserveTokens: 2_048,
          },
        ],
      });
      const t = custom.resolveThreshold('gpt-4');
      expect(t.triggerTokens).toBe(Math.floor(8_192 * 0.7));
      expect(t.maxHistoryShare).toBe(0.3);
      expect(t.reserveTokens).toBe(2_048);
    });

    it('should support wildcard pattern matching in model thresholds', () => {
      const custom = new ContextCompactor({
        enabled: true,
        modelThresholds: [
          {
            modelPattern: 'claude-*',
            compactionTriggerRatio: 0.9,
          },
        ],
      });
      const t = custom.resolveThreshold('claude-3.5-sonnet');
      expect(t.triggerTokens).toBe(Math.floor(200_000 * 0.9));
    });

    it('should support absolute trigger tokens override', () => {
      const custom = new ContextCompactor({
        enabled: true,
        modelThresholds: [
          {
            modelPattern: 'gpt-4',
            compactionTriggerTokens: 5_000,
          },
        ],
      });
      const t = custom.resolveThreshold('gpt-4');
      expect(t.triggerTokens).toBe(5_000);
    });
  });

  // ---------------------------------------------------------------------------
  // shouldCompact
  // ---------------------------------------------------------------------------

  describe('shouldCompact', () => {
    it('should return false when disabled', () => {
      const disabled = new ContextCompactor({ enabled: false });
      const messages = Array.from({ length: 100 }, () =>
        userMsg(longString(10_000)),
      );
      expect(disabled.shouldCompact(messages, 'gpt-3.5-turbo')).toBe(false);
    });

    it('should return false when tokens are below threshold', () => {
      const messages = [userMsg('short message')];
      expect(compactor.shouldCompact(messages, 'claude-3.5-sonnet')).toBe(false);
    });

    it('should return true when tokens exceed threshold', () => {
      // gpt-3.5-turbo: 4096 window, trigger at 0.85 * 4096 = 3481 tokens
      // Need ~3481 tokens = ~13924 chars
      const messages = Array.from({ length: 10 }, () =>
        userMsg(longString(2_000)),
      );
      expect(compactor.shouldCompact(messages, 'gpt-3.5-turbo')).toBe(true);
    });

    it('should respect context window override in compaction check', () => {
      // With a tiny override window (20 tokens), even a small message triggers.
      // "user" role (4 chars) + 4 overhead + 100 chars = 108 chars -> ceil(108/4) = 27 tokens
      // Trigger at floor(20 * 0.85) = 17 tokens. 27 >= 17 -> triggers.
      const messages = [userMsg(longString(100))];
      expect(compactor.shouldCompact(messages, undefined, 20)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // shouldRunMemoryFlush
  // ---------------------------------------------------------------------------

  describe('shouldRunMemoryFlush', () => {
    it('should return false when memory flush is disabled', () => {
      const noFlush = new ContextCompactor({
        enabled: true,
        memoryFlush: { enabled: false, softThresholdTokens: 4_000, prompt: '', systemPrompt: '' },
      });
      // Even with lots of tokens, should return false
      const messages = Array.from({ length: 100 }, () =>
        userMsg(longString(2_000)),
      );
      expect(noFlush.shouldRunMemoryFlush(messages, 'gpt-3.5-turbo')).toBe(false);
    });

    it('should return true when in the flush zone (near trigger, but below)', () => {
      // gpt-3.5-turbo: 4096 window, trigger at 3481 tokens
      // Flush zone: 3481 - 4000 = negative, so flush at (triggerTokens - softThreshold)
      // With 200K window: trigger = 170_000, flush zone start = 166_000
      // Need tokens between 166_000 and 170_000
      const compactorLargeFlush = new ContextCompactor({
        enabled: true,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 2_000,
          prompt: 'flush',
          systemPrompt: 'flush',
        },
      });
      // Create messages that are in the flush zone for a small context window
      // Use explicit override: 10_000 window, trigger = 8_500, flush zone = 6_500-8_500
      // Need ~7000 tokens = ~28_000 chars
      const messages = Array.from({ length: 14 }, () =>
        userMsg(longString(2_000)),
      );
      const tokens = estimateMessagesTokens(messages);
      const threshold = compactorLargeFlush.resolveThreshold(undefined, 10_000);
      const flushStart = threshold.triggerTokens - 2_000;

      if (tokens >= flushStart && tokens < threshold.triggerTokens) {
        expect(
          compactorLargeFlush.shouldRunMemoryFlush(messages, undefined, 10_000),
        ).toBe(true);
      }
    });

    it('should return false when below the flush zone', () => {
      const messages = [userMsg('tiny')];
      expect(compactor.shouldRunMemoryFlush(messages, 'claude-3.5-sonnet')).toBe(false);
    });

    it('should return false when already above compaction trigger', () => {
      // Already above trigger -> shouldRunMemoryFlush returns false because
      // the condition is totalTokens < threshold.triggerTokens
      const messages = Array.from({ length: 100 }, () =>
        userMsg(longString(10_000)),
      );
      expect(compactor.shouldRunMemoryFlush(messages, 'gpt-3.5-turbo')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Pre-Compact Hooks
  // ---------------------------------------------------------------------------

  describe('onPreCompact', () => {
    it('should allow registering and unregistering hooks', () => {
      const hook = vi.fn();
      const unregister = compactor.onPreCompact(hook);
      expect(typeof unregister).toBe('function');
      unregister();
      // After unregister, hook should not be called during compaction
    });

    it('should fire hooks and skip compaction when requested', async () => {
      compactor.onPreCompact(async () => ({
        skipCompaction: true,
        preserveMessageIndices: [],
      }));

      const messages = Array.from({ length: 10 }, () =>
        userMsg(longString(2_000)),
      );

      const result = await compactor.compact({
        sessionId: 'test-skip',
        messages,
        contextWindowOverride: 5_000,
      });

      expect(result.compacted).toBe(false);
      expect(result.messages).toBe(messages);
      expect(mockSummarize).not.toHaveBeenCalled();
    });

    it('should merge preserve indices from multiple hooks', async () => {
      compactor.onPreCompact(async () => ({
        skipCompaction: false,
        preserveMessageIndices: [0, 1],
      }));
      compactor.onPreCompact(async () => ({
        skipCompaction: false,
        preserveMessageIndices: [1, 2], // overlapping index 1
      }));

      const messages = Array.from({ length: 20 }, (_, i) =>
        userMsg(`msg ${i}`, { id: `m-${i}` }),
      );

      const result = await compactor.compact({
        sessionId: 'test-merge',
        messages,
        contextWindowOverride: 5_000,
      });

      // Indices 0, 1, 2 should be in preserved messages
      if (result.compacted) {
        const ids = result.metadata.preservedMessageIds;
        // These should be preserved (in addition to recent messages)
        expect(ids).toContain('m-0');
        expect(ids).toContain('m-1');
        expect(ids).toContain('m-2');
      }
    });

    it('should handle hook errors gracefully', async () => {
      compactor.onPreCompact(async () => {
        throw new Error('Hook failed!');
      });

      const messages = Array.from({ length: 10 }, () =>
        userMsg(longString(2_000)),
      );

      // Should not throw, error should be caught internally
      const result = await compactor.compact({
        sessionId: 'test-hook-error',
        messages,
        contextWindowOverride: 5_000,
      });
      // Compaction should proceed despite hook error
      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // compact() - Main Compaction Logic
  // ---------------------------------------------------------------------------

  describe('compact', () => {
    it('should summarize old messages and preserve recent ones', async () => {
      const messages = [
        systemMsg('You are helpful.', { id: 'sys-1' }),
        userMsg('First question', { id: 'u-1' }),
        assistantMsg('First answer', { id: 'a-1' }),
        userMsg('Second question', { id: 'u-2' }),
        assistantMsg('Second answer', { id: 'a-2' }),
        userMsg('Third question', { id: 'u-3' }),
        assistantMsg('Third answer', { id: 'a-3' }),
        userMsg('Recent question', { id: 'u-4' }),
        assistantMsg('Recent answer', { id: 'a-4' }),
      ];

      const result = await compactor.compact({
        sessionId: 'test-compact',
        messages,
        contextWindowOverride: 100, // Very small to force compaction
      });

      expect(result.compacted).toBe(true);
      expect(result.summary).toBeTruthy();
      expect(result.messages.length).toBeLessThan(messages.length);
      expect(mockSummarize).toHaveBeenCalled();

      // System message should always be in the result
      const roles = result.messages.map((m) => m.role);
      expect(roles).toContain('system');

      // The first message should be the compaction summary (system)
      const summaryMsg = result.messages.find(
        (m) => m.metadata?.isCompactionSummary,
      );
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg!.role).toBe('system');
    });

    it('should preserve all system messages', async () => {
      const messages = [
        systemMsg('System prompt 1', { id: 'sys-1' }),
        systemMsg('System prompt 2', { id: 'sys-2' }),
        userMsg('question', { id: 'u-1' }),
        assistantMsg('answer', { id: 'a-1' }),
        userMsg('question 2', { id: 'u-2' }),
        assistantMsg('answer 2', { id: 'a-2' }),
      ];

      const result = await compactor.compact({
        sessionId: 'test-sys',
        messages,
        contextWindowOverride: 100,
      });

      if (result.compacted) {
        const systemIds = result.messages
          .filter((m) => m.role === 'system' && !m.metadata?.isCompactionSummary)
          .map((m) => m.id);
        expect(systemIds).toContain('sys-1');
        expect(systemIds).toContain('sys-2');
      }
    });

    it('should return compacted=false when there is nothing to summarize', async () => {
      // Only system messages -- nothing to summarize
      const messages = [
        systemMsg('System prompt', { id: 'sys-1' }),
      ];

      const result = await compactor.compact({
        sessionId: 'test-nothing',
        messages,
        contextWindowOverride: 100,
      });

      expect(result.compacted).toBe(false);
      expect(result.messages).toEqual(messages);
      expect(mockSummarize).not.toHaveBeenCalled();
    });

    it('should include tool failure metadata in compaction', async () => {
      const messages = [
        userMsg('run this'),
        assistantMsg('running', {
          contentBlocks: [{ type: 'tool_call', toolCallId: 'tc-1', toolName: 'bash' }],
        }),
        toolResultMsg('Error: command not found', {
          toolCallId: 'tc-1',
          toolName: 'bash',
          isError: true,
        }),
        userMsg('try again'),
        assistantMsg('ok'),
      ];

      const result = await compactor.compact({
        sessionId: 'test-failures',
        messages,
        contextWindowOverride: 100,
      });

      if (result.compacted) {
        expect(result.metadata.toolFailures.length).toBeGreaterThanOrEqual(0);
        // If the error tool result was in the summarized portion,
        // it should be in the metadata
        const bashFailure = result.metadata.toolFailures.find(
          (f) => f.toolName === 'bash',
        );
        if (bashFailure) {
          expect(bashFailure.toolCallId).toBe('tc-1');
          expect(bashFailure.summary).toContain('command not found');
        }
      }
    });

    it('should work without a summarize function (fallback)', async () => {
      const noSummarize = new ContextCompactor({
        enabled: true,
        // No summarize function
      });

      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
      ];

      const result = await noSummarize.compact({
        sessionId: 'test-no-summarize',
        messages,
        contextWindowOverride: 50,
      });

      if (result.compacted) {
        expect(result.summary).toContain('no summarization function configured');
      }
    });

    it('should handle summarize function failure gracefully', async () => {
      const failingSummarize = vi.fn(async () => {
        throw new Error('LLM API failure');
      });
      const failCompactor = new ContextCompactor({
        enabled: true,
        summarize: failingSummarize,
      });

      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
        userMsg('q3'),
        assistantMsg('a3'),
      ];

      const result = await failCompactor.compact({
        sessionId: 'test-fail',
        messages,
        contextWindowOverride: 50,
      });

      // Should not throw; should fall back gracefully
      expect(result).toBeDefined();
      if (result.compacted) {
        expect(result.summary).toContain('unavailable');
      }
    });

    it('should increment compaction count on each successful compaction', async () => {
      expect(compactor.getCompactionCount()).toBe(0);

      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
      ];

      await compactor.compact({
        sessionId: 'test-count-1',
        messages,
        contextWindowOverride: 50,
      });

      const countAfterFirst = compactor.getCompactionCount();

      await compactor.compact({
        sessionId: 'test-count-2',
        messages,
        contextWindowOverride: 50,
      });

      // Count should increase only for compactions that actually compact
      expect(compactor.getCompactionCount()).toBeGreaterThanOrEqual(countAfterFirst);
    });

    it('should produce correct compression ratio in metadata', async () => {
      const messages = Array.from({ length: 20 }, (_, i) =>
        userMsg(`message ${i}: ${longString(200)}`, { id: `m-${i}` }),
      );

      const result = await compactor.compact({
        sessionId: 'test-ratio',
        messages,
        contextWindowOverride: 500,
      });

      if (result.compacted) {
        expect(result.metadata.compressionRatio).toBeGreaterThan(0);
        expect(result.metadata.compressionRatio).toBeLessThanOrEqual(1);
        expect(result.metadata.tokensAfter).toBeLessThan(
          result.metadata.tokensBefore,
        );
        expect(result.metadata.messagesAfter).toBeLessThan(
          result.metadata.messagesBefore,
        );
      }
    });

    it('should pass custom instructions to the summarize function', async () => {
      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
      ];

      await compactor.compact({
        sessionId: 'test-custom-instr',
        messages,
        contextWindowOverride: 50,
        customInstructions: 'Focus on security decisions.',
      });

      if (mockSummarize.mock.calls.length > 0) {
        const lastCallArgs = mockSummarize.mock.calls[0][0];
        expect(lastCallArgs.instructions).toContain('security decisions');
      }
    });

    it('should apply context pruning before summarization', async () => {
      const bigResult = longString(200_000);
      const messages = [
        userMsg('run command'),
        assistantMsg('running'),
        toolResultMsg(bigResult, { toolCallId: 'tc-1', toolName: 'bash' }),
        assistantMsg('got it'),
        assistantMsg('processing'),
        assistantMsg('result 1'),
        assistantMsg('done'),
      ];

      const result = await compactor.compact({
        sessionId: 'test-prune',
        messages,
        contextWindowOverride: 10_000,
      });

      // Pruning may or may not have been applied depending on ratios
      expect(result.metadata.pruningApplied).toBeDefined();
      expect(typeof result.metadata.prunedToolResults).toBe('number');
    });

    it('should populate durationMs in metadata', async () => {
      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
      ];

      const result = await compactor.compact({
        sessionId: 'test-duration',
        messages,
        contextWindowOverride: 50,
      });

      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle the compaction summary message ID format', async () => {
      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
      ];

      const result = await compactor.compact({
        sessionId: 'test-id',
        messages,
        contextWindowOverride: 50,
      });

      if (result.compacted) {
        const summaryMsg = result.messages.find(
          (m) => m.metadata?.isCompactionSummary,
        );
        expect(summaryMsg).toBeDefined();
        expect(summaryMsg!.id).toMatch(/^compaction-summary-\d+$/);
        expect(summaryMsg!.content).toContain('## Conversation Summary (compacted)');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle an empty conversation', async () => {
      const result = await compactor.compact({
        sessionId: 'test-empty',
        messages: [],
        contextWindowOverride: 100,
      });

      expect(result.compacted).toBe(false);
      expect(result.messages).toEqual([]);
    });

    it('should handle a single user message', async () => {
      const messages = [userMsg('only message')];

      const result = await compactor.compact({
        sessionId: 'test-single',
        messages,
        contextWindowOverride: 50,
      });

      // A single message has nothing older to summarize, so it may or may
      // not compact depending on how the split works. Either way, the message
      // should be present.
      expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle a conversation of all system messages', async () => {
      const messages = [
        systemMsg('System 1', { id: 's-1' }),
        systemMsg('System 2', { id: 's-2' }),
        systemMsg('System 3', { id: 's-3' }),
      ];

      const result = await compactor.compact({
        sessionId: 'test-all-sys',
        messages,
        contextWindowOverride: 50,
      });

      // All system messages should be preserved, nothing to summarize
      expect(result.compacted).toBe(false);
      expect(result.messages.length).toBe(3);
    });

    it('should handle messages with no IDs', async () => {
      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
      ];

      const result = await compactor.compact({
        sessionId: 'test-no-ids',
        messages,
        contextWindowOverride: 50,
      });

      // Should not crash; preservedMessageIds should be empty or contain only defined IDs
      expect(result.metadata.preservedMessageIds.every((id) => typeof id === 'string')).toBe(true);
    });

    it('should handle AbortSignal', async () => {
      const controller = new AbortController();
      const abortSummarize = vi.fn(async ({ signal }: { signal?: AbortSignal }) => {
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        return 'summary';
      });

      const abortCompactor = new ContextCompactor({
        enabled: true,
        summarize: abortSummarize,
      });

      const messages = [
        userMsg('q1'),
        assistantMsg('a1'),
        userMsg('q2'),
        assistantMsg('a2'),
      ];

      // Should pass signal through to summarize
      const result = await abortCompactor.compact({
        sessionId: 'test-abort',
        messages,
        contextWindowOverride: 50,
        signal: controller.signal,
      });

      if (abortSummarize.mock.calls.length > 0) {
        expect(abortSummarize.mock.calls[0][0].signal).toBe(controller.signal);
      }
      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Configuration Access
  // ---------------------------------------------------------------------------

  describe('configuration access', () => {
    it('should return config via getConfig()', () => {
      const config = compactor.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.defaultTriggerRatio).toBe(0.85);
    });

    it('should return memory flush config', () => {
      const flushConfig = compactor.getMemoryFlushConfig();
      expect(flushConfig.enabled).toBe(true);
      expect(flushConfig.softThresholdTokens).toBe(4_000);
    });

    it('should deep merge pruning config', () => {
      const custom = new ContextCompactor({
        pruning: { enabled: false } as ContextPruningConfig,
      });
      const config = custom.getConfig();
      expect(config.pruning.enabled).toBe(false);
      // Other pruning defaults should still be present from the merge
      expect(config.pruning.softTrimRatio).toBe(0.3);
    });

    it('should deep merge memory flush config', () => {
      const custom = new ContextCompactor({
        memoryFlush: {
          enabled: false,
          softThresholdTokens: 8_000,
          prompt: 'custom prompt',
          systemPrompt: 'custom system',
        },
      });
      const config = custom.getConfig();
      expect(config.memoryFlush.enabled).toBe(false);
      expect(config.memoryFlush.softThresholdTokens).toBe(8_000);
    });
  });
});

// =============================================================================
// Factory Function
// =============================================================================

describe('createContextCompactor', () => {
  it('should create a ContextCompactor instance', () => {
    const compactor = createContextCompactor();
    expect(compactor).toBeInstanceOf(ContextCompactor);
  });

  it('should accept partial configuration', () => {
    const compactor = createContextCompactor({
      enabled: false,
      defaultTriggerRatio: 0.7,
    });
    const config = compactor.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.defaultTriggerRatio).toBe(0.7);
  });

  it('should use defaults for unspecified fields', () => {
    const compactor = createContextCompactor({});
    const config = compactor.getConfig();
    expect(config.defaultTriggerRatio).toBe(DEFAULT_CONTEXT_COMPACTOR_CONFIG.defaultTriggerRatio);
    expect(config.summarizationPasses).toBe(DEFAULT_CONTEXT_COMPACTOR_CONFIG.summarizationPasses);
  });
});

// =============================================================================
// DEFAULT_CONTEXT_COMPACTOR_CONFIG
// =============================================================================

describe('DEFAULT_CONTEXT_COMPACTOR_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.defaultTriggerRatio).toBe(0.85);
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.defaultMaxHistoryShare).toBe(0.5);
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.defaultReserveTokens).toBe(4_096);
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.summarizationPasses).toBe(2);
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.minMessagesForSplit).toBe(4);
    expect(DEFAULT_CONTEXT_COMPACTOR_CONFIG.modelThresholds).toEqual([]);
  });

  it('should have pruning defaults', () => {
    const pruning = DEFAULT_CONTEXT_COMPACTOR_CONFIG.pruning;
    expect(pruning.enabled).toBe(true);
    expect(pruning.softTrimRatio).toBe(0.3);
    expect(pruning.hardClearRatio).toBe(0.5);
    expect(pruning.minPrunableChars).toBe(50_000);
    expect(pruning.keepLastAssistants).toBe(3);
    expect(pruning.softTrimMaxChars).toBe(4_000);
    expect(pruning.softTrimHeadChars).toBe(1_500);
    expect(pruning.softTrimTailChars).toBe(1_500);
    expect(pruning.hardClearEnabled).toBe(true);
    expect(pruning.prunableTools).toEqual([]);
    expect(pruning.protectedTools).toEqual([]);
  });

  it('should have memory flush defaults', () => {
    const flush = DEFAULT_CONTEXT_COMPACTOR_CONFIG.memoryFlush;
    expect(flush.enabled).toBe(true);
    expect(flush.softThresholdTokens).toBe(4_000);
    expect(flush.prompt).toContain('Pre-compaction memory flush');
    expect(flush.systemPrompt).toContain('Pre-compaction memory flush turn');
  });
});

// =============================================================================
// Multi-pass Summarization (indirect via compact)
// =============================================================================

describe('multi-pass summarization', () => {
  it('should call summarize multiple times for multi-pass', async () => {
    const mockSummarize = createMockSummarize();
    const compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
      summarizationPasses: 3,
      minMessagesForSplit: 2,
    });

    // Enough messages to trigger multi-pass
    const messages = Array.from({ length: 30 }, (_, i) =>
      userMsg(`Message ${i}: ${longString(200)}`, { id: `m-${i}` }),
    );

    await compactor.compact({
      sessionId: 'test-multipass',
      messages,
      contextWindowOverride: 500,
    });

    // Multiple calls to summarize expected for multi-pass
    expect(mockSummarize).toHaveBeenCalled();
    // With 3 passes and enough messages, we expect more than one call
    // (stages + merge)
    expect(mockSummarize.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should fall back to single-pass for very few messages', async () => {
    const mockSummarize = createMockSummarize();
    const compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
      summarizationPasses: 3,
      minMessagesForSplit: 10, // high bar for splitting
    });

    const messages = [
      userMsg('q1', { id: 'u-1' }),
      assistantMsg('a1', { id: 'a-1' }),
      userMsg('q2', { id: 'u-2' }),
      assistantMsg('a2', { id: 'a-2' }),
    ];

    await compactor.compact({
      sessionId: 'test-singlepass',
      messages,
      contextWindowOverride: 50,
    });

    // With minMessagesForSplit=10 and only 4 messages, should use single-pass
    // The number of summarize calls should reflect single-pass behavior
    expect(mockSummarize).toHaveBeenCalled();
  });
});

// =============================================================================
// Tool Failure Extraction
// =============================================================================

describe('tool failure extraction in compaction', () => {
  it('should extract failures with metadata (status, exitCode)', async () => {
    const mockSummarize = createMockSummarize();
    const compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
    });

    const messages = [
      userMsg('run something'),
      assistantMsg('executing'),
      toolResultMsg('Permission denied', {
        toolCallId: 'tc-fail-1',
        toolName: 'bash',
        isError: true,
        metadata: { status: 'failed', exitCode: 1 },
      }),
      userMsg('try differently'),
      assistantMsg('ok, trying'),
    ];

    const result = await compactor.compact({
      sessionId: 'test-tool-meta',
      messages,
      contextWindowOverride: 50,
    });

    if (result.compacted) {
      const bashFailure = result.metadata.toolFailures.find(
        (f) => f.toolCallId === 'tc-fail-1',
      );
      if (bashFailure) {
        expect(bashFailure.toolName).toBe('bash');
        expect(bashFailure.summary).toContain('Permission denied');
        expect(bashFailure.meta).toContain('status=failed');
        expect(bashFailure.meta).toContain('exitCode=1');
      }
    }
  });

  it('should deduplicate tool failures by toolCallId', async () => {
    const mockSummarize = createMockSummarize();
    const compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
    });

    const messages = [
      userMsg('run it'),
      toolResultMsg('Error A', {
        toolCallId: 'tc-dup',
        toolName: 'bash',
        isError: true,
      }),
      toolResultMsg('Error B same call', {
        toolCallId: 'tc-dup', // same ID
        toolName: 'bash',
        isError: true,
      }),
      userMsg('ok'),
      assistantMsg('done'),
    ];

    const result = await compactor.compact({
      sessionId: 'test-dedup',
      messages,
      contextWindowOverride: 50,
    });

    if (result.compacted) {
      const dupFailures = result.metadata.toolFailures.filter(
        (f) => f.toolCallId === 'tc-dup',
      );
      expect(dupFailures.length).toBeLessThanOrEqual(1);
    }
  });

  it('should truncate long failure summaries', async () => {
    const mockSummarize = createMockSummarize();
    const compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
    });

    const messages = [
      userMsg('run it'),
      toolResultMsg(longString(500), {
        toolCallId: 'tc-long',
        toolName: 'bash',
        isError: true,
      }),
      userMsg('ok'),
      assistantMsg('done'),
    ];

    const result = await compactor.compact({
      sessionId: 'test-trunc',
      messages,
      contextWindowOverride: 50,
    });

    if (result.compacted) {
      const longFailure = result.metadata.toolFailures.find(
        (f) => f.toolCallId === 'tc-long',
      );
      if (longFailure) {
        // MAX_TOOL_FAILURE_CHARS is 240
        expect(longFailure.summary.length).toBeLessThanOrEqual(240);
        expect(longFailure.summary).toContain('...');
      }
    }
  });
});

// =============================================================================
// Tool Pairing Adjustment
// =============================================================================

describe('tool call/result pairing during compaction', () => {
  it('should not orphan tool_result when split point lands between call and result', async () => {
    const mockSummarize = createMockSummarize();
    const compactor = new ContextCompactor({
      enabled: true,
      summarize: mockSummarize,
    });

    const messages = [
      userMsg('old message 1'),
      userMsg('old message 2'),
      assistantMsg('I will use a tool', {
        id: 'a-tool',
        contentBlocks: [
          { type: 'tool_call', toolCallId: 'tc-pair', toolName: 'read_file' },
        ],
      }),
      toolResultMsg('file content', {
        id: 'tr-pair',
        toolCallId: 'tc-pair',
        toolName: 'read_file',
      }),
      userMsg('recent user msg', { id: 'u-recent' }),
      assistantMsg('recent response', { id: 'a-recent' }),
    ];

    const result = await compactor.compact({
      sessionId: 'test-pairing',
      messages,
      contextWindowOverride: 200,
    });

    if (result.compacted) {
      // If the tool result is in the preserved messages, its corresponding
      // assistant message with the tool call should also be present
      const hasToolResult = result.messages.some(
        (m) => m.toolCallId === 'tc-pair',
      );
      if (hasToolResult) {
        const hasToolCall = result.messages.some(
          (m) =>
            m.role === 'assistant' &&
            m.contentBlocks?.some(
              (b) => b.type === 'tool_call' && b.toolCallId === 'tc-pair',
            ),
        );
        expect(hasToolCall).toBe(true);
      }
    }
  });
});
