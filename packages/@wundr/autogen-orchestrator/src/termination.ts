/**
 * Termination Condition Handlers for AutoGen-style Group Chat
 *
 * Implements various termination conditions for multi-agent conversations
 * including keyword-based, round-based, timeout, and custom evaluators.
 */

import type {
  Message,
  ChatParticipant,
  ChatContext,
  TerminationCondition,
  TerminationConditionType,
  TerminationResult,
  TerminationEvaluator,
} from './types';

/**
 * Handler interface for termination conditions
 */
export interface TerminationHandler {
  /**
   * Evaluate whether the termination condition is met
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  evaluate(
    messages: Message[],
    participants: ChatParticipant[],
    context: ChatContext
  ): Promise<TerminationResult>;
}

/**
 * Factory function to create termination handlers
 * @param condition - Termination condition configuration
 * @returns Appropriate termination handler
 */
export function createTerminationHandler(
  condition: TerminationCondition
): TerminationHandler {
  switch (condition.type) {
    case 'max_rounds':
      return new MaxRoundsHandler(condition.value as number);
    case 'max_messages':
      return new MaxMessagesHandler(condition.value as number);
    case 'keyword':
      return new KeywordHandler(condition.value as string | string[]);
    case 'timeout':
      return new TimeoutHandler(condition.value as number);
    case 'function':
      return new FunctionHandler(condition.evaluator!);
    case 'consensus':
      return new ConsensusHandler(condition.value as ConsensusConfig);
    case 'custom':
      return new CustomHandler(condition);
    default:
      throw new Error(`Unknown termination condition type: ${condition.type}`);
  }
}

/**
 * Handler for maximum rounds termination
 */
export class MaxRoundsHandler implements TerminationHandler {
  private maxRounds: number;

  /**
   * Create a max rounds handler
   * @param maxRounds - Maximum number of rounds allowed
   */
  constructor(maxRounds: number) {
    this.maxRounds = maxRounds;
  }

  /**
   * Evaluate if max rounds has been reached
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    _messages: Message[],
    _participants: ChatParticipant[],
    context: ChatContext
  ): Promise<TerminationResult> {
    const shouldTerminate = context.currentRound >= this.maxRounds;

    return {
      shouldTerminate,
      reason: shouldTerminate
        ? `Maximum rounds reached: ${context.currentRound}/${this.maxRounds}`
        : undefined,
      summary: shouldTerminate
        ? `Conversation ended after ${this.maxRounds} rounds.`
        : undefined,
    };
  }
}

/**
 * Handler for maximum messages termination
 */
export class MaxMessagesHandler implements TerminationHandler {
  private maxMessages: number;

  /**
   * Create a max messages handler
   * @param maxMessages - Maximum number of messages allowed
   */
  constructor(maxMessages: number) {
    this.maxMessages = maxMessages;
  }

  /**
   * Evaluate if max messages has been reached
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    messages: Message[],
    _participants: ChatParticipant[],
    _context: ChatContext
  ): Promise<TerminationResult> {
    const shouldTerminate = messages.length >= this.maxMessages;

    return {
      shouldTerminate,
      reason: shouldTerminate
        ? `Maximum messages reached: ${messages.length}/${this.maxMessages}`
        : undefined,
      summary: shouldTerminate
        ? `Conversation ended after ${this.maxMessages} messages.`
        : undefined,
    };
  }
}

/**
 * Handler for keyword-based termination
 */
export class KeywordHandler implements TerminationHandler {
  private keywords: string[];
  private caseSensitive: boolean;
  private requireAll: boolean;

  /**
   * Create a keyword handler
   * @param keywords - Keywords to detect
   * @param caseSensitive - Whether matching is case-sensitive
   * @param requireAll - Whether all keywords must be present
   */
  constructor(
    keywords: string | string[],
    caseSensitive = false,
    requireAll = false
  ) {
    this.keywords = Array.isArray(keywords) ? keywords : [keywords];
    this.caseSensitive = caseSensitive;
    this.requireAll = requireAll;
  }

  /**
   * Evaluate if termination keywords are found
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    messages: Message[],
    _participants: ChatParticipant[],
    _context: ChatContext
  ): Promise<TerminationResult> {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return { shouldTerminate: false };
    }

    const content = this.caseSensitive
      ? lastMessage.content
      : lastMessage.content.toLowerCase();

    const matchedKeywords: string[] = [];
    for (const keyword of this.keywords) {
      const searchKeyword = this.caseSensitive
        ? keyword
        : keyword.toLowerCase();
      if (content.includes(searchKeyword)) {
        matchedKeywords.push(keyword);
      }
    }

    const shouldTerminate = this.requireAll
      ? matchedKeywords.length === this.keywords.length
      : matchedKeywords.length > 0;

    return {
      shouldTerminate,
      reason: shouldTerminate
        ? `Termination keyword(s) detected: ${matchedKeywords.join(', ')}`
        : undefined,
      summary: shouldTerminate
        ? `Conversation terminated by keyword: "${matchedKeywords[0]}"`
        : undefined,
      data: shouldTerminate ? { matchedKeywords } : undefined,
    };
  }
}

/**
 * Handler for timeout-based termination
 */
export class TimeoutHandler implements TerminationHandler {
  private timeoutMs: number;

  /**
   * Create a timeout handler
   * @param timeoutMs - Timeout duration in milliseconds
   */
  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Evaluate if timeout has been reached
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    _messages: Message[],
    _participants: ChatParticipant[],
    context: ChatContext
  ): Promise<TerminationResult> {
    const elapsed = Date.now() - context.startTime.getTime();
    const shouldTerminate = elapsed >= this.timeoutMs;

    return {
      shouldTerminate,
      reason: shouldTerminate
        ? `Timeout reached: ${Math.round(elapsed / 1000)}s / ${Math.round(this.timeoutMs / 1000)}s`
        : undefined,
      summary: shouldTerminate
        ? `Conversation timed out after ${Math.round(elapsed / 1000)} seconds.`
        : undefined,
      data: shouldTerminate
        ? { elapsedMs: elapsed, timeoutMs: this.timeoutMs }
        : undefined,
    };
  }
}

/**
 * Handler for function-based termination
 */
export class FunctionHandler implements TerminationHandler {
  private evaluator: TerminationEvaluator;

  /**
   * Create a function handler
   * @param evaluator - Custom evaluation function
   */
  constructor(evaluator: TerminationEvaluator) {
    this.evaluator = evaluator;
  }

  /**
   * Evaluate using the custom function
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    messages: Message[],
    participants: ChatParticipant[],
    context: ChatContext
  ): Promise<TerminationResult> {
    try {
      return await this.evaluator(messages, participants, context);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        shouldTerminate: false,
        reason: `Function evaluator error: ${errorMessage}`,
      };
    }
  }
}

/**
 * Configuration for consensus-based termination
 */
export interface ConsensusConfig {
  /** Minimum agreement threshold (0-1) */
  threshold: number;
  /** Keywords indicating agreement */
  agreementKeywords: string[];
  /** Keywords indicating disagreement */
  disagreementKeywords: string[];
  /** Minimum participants required for consensus */
  minParticipants?: number;
  /** Number of recent messages to consider */
  windowSize?: number;
}

/**
 * Handler for consensus-based termination
 */
export class ConsensusHandler implements TerminationHandler {
  private config: ConsensusConfig;

  /**
   * Create a consensus handler
   * @param config - Consensus configuration
   */
  constructor(config: ConsensusConfig) {
    this.config = {
      threshold: config.threshold,
      agreementKeywords: config.agreementKeywords || [
        'agree',
        'consensus',
        'approved',
        'done',
        'complete',
        'finished',
      ],
      disagreementKeywords: config.disagreementKeywords || [
        'disagree',
        'no',
        'reject',
        'veto',
        'continue',
      ],
      minParticipants: config.minParticipants || 2,
      windowSize: config.windowSize || 10,
    };
  }

  /**
   * Evaluate if consensus has been reached
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    messages: Message[],
    _participants: ChatParticipant[],
    _context: ChatContext
  ): Promise<TerminationResult> {
    const windowSize = this.config.windowSize || 10;
    const recentMessages = messages.slice(-windowSize);

    // Track votes per participant
    const votes: Map<string, 'agree' | 'disagree' | 'neutral'> = new Map();

    for (const message of recentMessages) {
      const contentLower = message.content.toLowerCase();

      // Check for agreement keywords
      const hasAgreement = this.config.agreementKeywords.some(keyword =>
        contentLower.includes(keyword.toLowerCase())
      );

      // Check for disagreement keywords
      const hasDisagreement = this.config.disagreementKeywords.some(keyword =>
        contentLower.includes(keyword.toLowerCase())
      );

      if (hasAgreement && !hasDisagreement) {
        votes.set(message.name, 'agree');
      } else if (hasDisagreement) {
        votes.set(message.name, 'disagree');
      }
    }

    const totalVoters = votes.size;
    const agreements = Array.from(votes.values()).filter(
      v => v === 'agree'
    ).length;

    const minParticipants = this.config.minParticipants || 2;

    // Check if enough participants have voted
    if (totalVoters < minParticipants) {
      return {
        shouldTerminate: false,
        reason: `Not enough participants voted: ${totalVoters}/${minParticipants}`,
      };
    }

    const agreementRate = agreements / totalVoters;
    const shouldTerminate = agreementRate >= this.config.threshold;

    return {
      shouldTerminate,
      reason: shouldTerminate
        ? `Consensus reached: ${Math.round(agreementRate * 100)}% agreement (threshold: ${Math.round(this.config.threshold * 100)}%)`
        : `No consensus: ${Math.round(agreementRate * 100)}% agreement (need: ${Math.round(this.config.threshold * 100)}%)`,
      summary: shouldTerminate
        ? `Conversation ended with ${Math.round(agreementRate * 100)}% participant agreement.`
        : undefined,
      data: {
        agreementRate,
        totalVoters,
        agreements,
        threshold: this.config.threshold,
      },
    };
  }
}

/**
 * Handler for custom termination conditions
 */
export class CustomHandler implements TerminationHandler {
  private condition: TerminationCondition;

  /**
   * Create a custom handler
   * @param condition - Custom termination condition
   */
  constructor(condition: TerminationCondition) {
    this.condition = condition;
  }

  /**
   * Evaluate the custom condition
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Termination result
   */
  async evaluate(
    messages: Message[],
    participants: ChatParticipant[],
    context: ChatContext
  ): Promise<TerminationResult> {
    // If there's a custom evaluator, use it
    if (this.condition.evaluator) {
      return this.condition.evaluator(messages, participants, context);
    }

    // Otherwise, try to interpret the value
    const value = this.condition.value;

    if (typeof value === 'function') {
      return (value as TerminationEvaluator)(messages, participants, context);
    }

    // Default: no termination
    return {
      shouldTerminate: false,
      reason: 'Custom condition not properly configured',
    };
  }
}

/**
 * Manager for multiple termination conditions
 */
export class TerminationManager {
  private handlers: Map<string, TerminationHandler> = new Map();
  private conditions: TerminationCondition[] = [];

  /**
   * Create a termination manager
   * @param conditions - Initial termination conditions
   */
  constructor(conditions: TerminationCondition[] = []) {
    for (const condition of conditions) {
      this.addCondition(condition);
    }
  }

  /**
   * Add a termination condition
   * @param condition - Condition to add
   */
  addCondition(condition: TerminationCondition): void {
    const id = `${condition.type}-${this.conditions.length}`;
    const handler = createTerminationHandler(condition);
    this.handlers.set(id, handler);
    this.conditions.push(condition);
  }

  /**
   * Remove a termination condition by type
   * @param type - Condition type to remove
   */
  removeCondition(type: TerminationConditionType): void {
    const indicesToRemove: number[] = [];

    this.conditions.forEach((condition, index) => {
      if (condition.type === type) {
        indicesToRemove.push(index);
      }
    });

    // Remove in reverse order to maintain indices
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      const index = indicesToRemove[i];
      if (index !== undefined) {
        const id = `${type}-${index}`;
        this.handlers.delete(id);
        this.conditions.splice(index, 1);
      }
    }
  }

  /**
   * Clear all termination conditions
   */
  clearConditions(): void {
    this.handlers.clear();
    this.conditions = [];
  }

  /**
   * Evaluate all termination conditions
   * @param messages - Conversation messages
   * @param participants - Chat participants
   * @param context - Current chat context
   * @returns Combined termination result
   */
  async evaluate(
    messages: Message[],
    participants: ChatParticipant[],
    context: ChatContext
  ): Promise<TerminationResult> {
    const results: Array<TerminationResult & { type: string }> = [];

    for (const [id, handler] of this.handlers.entries()) {
      const result = await handler.evaluate(messages, participants, context);
      results.push({ ...result, type: id });

      // Early exit if any condition triggers termination
      if (result.shouldTerminate) {
        return {
          shouldTerminate: true,
          reason: result.reason,
          summary: result.summary,
          data: {
            triggeredBy: id,
            allResults: results,
          },
        };
      }
    }

    return {
      shouldTerminate: false,
      data: { allResults: results },
    };
  }

  /**
   * Get all configured conditions
   * @returns Array of termination conditions
   */
  getConditions(): TerminationCondition[] {
    return [...this.conditions];
  }

  /**
   * Check if a specific condition type is configured
   * @param type - Condition type to check
   * @returns Whether the condition type exists
   */
  hasCondition(type: TerminationConditionType): boolean {
    return this.conditions.some(c => c.type === type);
  }
}

/**
 * Common termination condition presets
 */
export const TerminationPresets = {
  /**
   * Create a preset for task completion detection
   */
  taskCompletion(): TerminationCondition {
    return {
      type: 'keyword',
      value: ['TASK_COMPLETE', 'DONE', 'FINISHED', 'COMPLETED', 'END_TASK'],
      description: 'Terminate when task completion keyword is detected',
    };
  },

  /**
   * Create a preset for approval workflows
   */
  approval(): TerminationCondition {
    return {
      type: 'consensus',
      value: {
        threshold: 0.75,
        agreementKeywords: ['approve', 'approved', 'lgtm', 'ship it'],
        disagreementKeywords: ['reject', 'denied', 'needs work'],
        minParticipants: 2,
      } as ConsensusConfig,
      description: 'Terminate when approval consensus is reached',
    };
  },

  /**
   * Create a preset for quick discussions
   * @param rounds - Maximum rounds
   */
  quickDiscussion(rounds = 5): TerminationCondition[] {
    return [
      {
        type: 'max_rounds',
        value: rounds,
        description: `Maximum ${rounds} rounds`,
      },
      {
        type: 'keyword',
        value: ['TERMINATE', 'END'],
        description: 'Manual termination keywords',
      },
    ];
  },

  /**
   * Create a preset for long-running tasks
   * @param timeoutMinutes - Timeout in minutes
   */
  longRunning(timeoutMinutes = 30): TerminationCondition[] {
    return [
      {
        type: 'timeout',
        value: timeoutMinutes * 60 * 1000,
        description: `${timeoutMinutes} minute timeout`,
      },
      {
        type: 'max_messages',
        value: 100,
        description: 'Maximum 100 messages',
      },
      {
        type: 'keyword',
        value: ['TERMINATE', 'ABORT', 'CANCEL'],
        description: 'Emergency termination keywords',
      },
    ];
  },
};
