/**
 * Nested Chat Handling for AutoGen-style Group Chat
 *
 * Implements support for sub-discussions within a main conversation,
 * allowing focused interactions between subsets of participants.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import type {
  Message,
  ChatParticipant,
  ChatContext,
  ChatResult,
  ChatStatus,
  NestedChatConfig,
  NestedChatTrigger,
  NestedChatTriggerValue,
  NestedChatConditionFn,
  NestedChatResult,
  SummaryMethod,
  CreateMessageOptions,
} from './types';

// Re-export NestedChatResult from types
export type { NestedChatResult } from './types';

/**
 * Events emitted by the nested chat manager
 */
export interface NestedChatEvents {
  'nested:started': (data: {
    nestedChatId: string;
    config: NestedChatConfig;
    parentMessageId: string;
  }) => void;
  'nested:message': (data: { nestedChatId: string; message: Message }) => void;
  'nested:completed': (data: {
    nestedChatId: string;
    result: ChatResult;
  }) => void;
  'nested:error': (data: { nestedChatId: string; error: Error }) => void;
}

/**
 * State of a nested chat session
 */
interface NestedChatState {
  id: string;
  config: NestedChatConfig;
  parentChatId: string;
  parentMessageId: string;
  participants: ChatParticipant[];
  messages: Message[];
  status: ChatStatus;
  startedAt: Date;
  context: ChatContext;
}

/**
 * Manager for nested chat sessions within a group chat
 */
export class NestedChatManager extends EventEmitter<NestedChatEvents> {
  private configs: Map<string, NestedChatConfig> = new Map();
  private activeChats: Map<string, NestedChatState> = new Map();
  private completedChats: Map<string, NestedChatResult> = new Map();

  /**
   * Create a nested chat manager
   * @param configs - Initial nested chat configurations
   */
  constructor(configs: NestedChatConfig[] = []) {
    super();
    for (const config of configs) {
      this.addConfig(config);
    }
  }

  /**
   * Add a nested chat configuration
   * @param config - Configuration to add
   */
  addConfig(config: NestedChatConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Remove a nested chat configuration
   * @param configId - Configuration ID to remove
   */
  removeConfig(configId: string): void {
    this.configs.delete(configId);
  }

  /**
   * Get all configurations
   * @returns Array of nested chat configurations
   */
  getConfigs(): NestedChatConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Check if a message should trigger a nested chat
   * @param message - Message to check
   * @param participants - Current participants
   * @param context - Current chat context
   * @returns Triggered configuration or null
   */
  checkTrigger(
    message: Message,
    participants: ChatParticipant[],
    context: ChatContext
  ): NestedChatConfig | null {
    for (const config of this.configs.values()) {
      if (
        this.evaluateTrigger(config.trigger, message, participants, context)
      ) {
        return config;
      }
    }
    return null;
  }

  /**
   * Evaluate if a trigger condition is met
   * @param trigger - Trigger configuration
   * @param message - Current message
   * @param participants - Available participants
   * @param context - Chat context
   * @returns Whether the trigger is activated
   */
  private evaluateTrigger(
    trigger: NestedChatTrigger,
    message: Message,
    participants: ChatParticipant[],
    context: ChatContext
  ): boolean {
    switch (trigger.type) {
      case 'keyword':
        return this.evaluateKeywordTrigger(trigger.value, message);

      case 'participant':
        return this.evaluateParticipantTrigger(
          trigger.value,
          message,
          participants
        );

      case 'condition':
        return this.evaluateConditionTrigger(trigger.value, message, context);

      case 'manual':
        return this.evaluateManualTrigger(trigger.value, context);

      default:
        return false;
    }
  }

  /**
   * Evaluate keyword-based trigger
   * @param value - Keyword(s) to check
   * @param message - Message to check
   * @returns Whether keyword is found
   */
  private evaluateKeywordTrigger(
    value: NestedChatTriggerValue,
    message: Message
  ): boolean {
    const keywords: string[] = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? [value]
        : [];
    const contentLower = message.content.toLowerCase();

    return keywords.some(keyword =>
      contentLower.includes(keyword.toLowerCase())
    );
  }

  /**
   * Evaluate participant-based trigger
   * @param value - Participant name(s)
   * @param message - Current message
   * @param participants - Available participants
   * @returns Whether participant condition is met
   */
  private evaluateParticipantTrigger(
    value: NestedChatTriggerValue,
    message: Message,
    participants: ChatParticipant[]
  ): boolean {
    const targetParticipants: string[] = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? [value]
        : [];

    // Check if message is from one of the target participants
    if (targetParticipants.includes(message.name)) {
      return true;
    }

    // Check if message mentions target participants
    for (const targetName of targetParticipants) {
      const participant = participants.find(p => p.name === targetName);
      if (participant && message.content.includes(`@${targetName}`)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate condition-based trigger
   * @param value - Condition expression or function
   * @param message - Current message
   * @param context - Chat context
   * @returns Whether condition is met
   */
  private evaluateConditionTrigger(
    value: NestedChatTriggerValue,
    message: Message,
    context: ChatContext
  ): boolean {
    // Check if value is a function (NestedChatConditionFn)
    if (typeof value === 'function') {
      return (value as NestedChatConditionFn)(message, context);
    }

    if (typeof value === 'string') {
      // Simple condition parsing
      const condition = value.toLowerCase();

      if (condition.includes('round >')) {
        const parts = condition.split('>');
        const threshold = parseInt(parts[1]?.trim() || '0', 10);
        return context.currentRound > threshold;
      }

      if (condition.includes('messages >')) {
        const parts = condition.split('>');
        const threshold = parseInt(parts[1]?.trim() || '0', 10);
        return context.messageCount > threshold;
      }
    }

    return false;
  }

  /**
   * Evaluate manual trigger
   * @param value - Manual trigger value (state key to check)
   * @param context - Chat context
   * @returns Whether manual trigger is set
   */
  private evaluateManualTrigger(
    value: NestedChatTriggerValue,
    context: ChatContext
  ): boolean {
    // For manual triggers, value should be a string representing the state key
    const triggerKey = typeof value === 'string' ? value : String(value);
    return context.state[triggerKey] === true;
  }

  /**
   * Start a nested chat session
   * @param config - Nested chat configuration
   * @param parentChatId - Parent chat ID
   * @param parentMessageId - Message that triggered the nested chat
   * @param allParticipants - All available participants
   * @param parentContext - Parent chat context
   * @returns Nested chat ID
   */
  startNestedChat(
    config: NestedChatConfig,
    parentChatId: string,
    parentMessageId: string,
    allParticipants: ChatParticipant[],
    parentContext: ChatContext
  ): string {
    const nestedChatId = uuidv4();

    // Select participants for nested chat
    const nestedParticipants = allParticipants.filter(p =>
      config.participants.includes(p.name)
    );

    if (nestedParticipants.length < 2) {
      throw new Error(
        `Nested chat requires at least 2 participants, found ${nestedParticipants.length}`
      );
    }

    // Create nested context
    const nestedContext: ChatContext = {
      chatId: nestedChatId,
      currentRound: 0,
      messageCount: 0,
      activeParticipants: nestedParticipants.map(p => p.name),
      startTime: new Date(),
      state: config.shareContext ? { ...parentContext.state } : {},
      parentContext: parentContext,
    };

    // Create nested chat state
    const state: NestedChatState = {
      id: nestedChatId,
      config,
      parentChatId,
      parentMessageId,
      participants: nestedParticipants,
      messages: [],
      status: 'active',
      startedAt: new Date(),
      context: nestedContext,
    };

    this.activeChats.set(nestedChatId, state);

    // Add initial prompt message if configured
    if (config.prompt) {
      const systemMessage = this.createMessage({
        role: 'system',
        content: config.prompt,
        name: 'system',
      });
      state.messages.push(systemMessage);
    }

    this.emit('nested:started', {
      nestedChatId,
      config,
      parentMessageId,
    });

    return nestedChatId;
  }

  /**
   * Add a message to a nested chat
   * @param nestedChatId - Nested chat ID
   * @param message - Message to add
   */
  addMessage(nestedChatId: string, message: Message): void {
    const state = this.activeChats.get(nestedChatId);
    if (!state) {
      throw new Error(`Nested chat not found: ${nestedChatId}`);
    }

    if (state.status !== 'active') {
      throw new Error(`Nested chat is not active: ${state.status}`);
    }

    state.messages.push(message);
    state.context.messageCount = state.messages.length;

    this.emit('nested:message', { nestedChatId, message });
  }

  /**
   * End a nested chat session
   * @param nestedChatId - Nested chat ID
   * @param status - Final status
   * @param terminationReason - Reason for ending
   * @returns Nested chat result
   */
  async endNestedChat(
    nestedChatId: string,
    status: ChatStatus = 'completed',
    terminationReason?: string
  ): Promise<NestedChatResult> {
    const state = this.activeChats.get(nestedChatId);
    if (!state) {
      throw new Error(`Nested chat not found: ${nestedChatId}`);
    }

    state.status = status;

    // Generate summary
    const summary = await this.generateSummary(
      state.messages,
      state.config.summaryMethod || 'last'
    );

    // Create chat result
    const endedAt = new Date();
    const chatResult: ChatResult = {
      chatId: nestedChatId,
      status,
      messages: state.messages,
      summary,
      terminationReason,
      totalRounds: state.context.currentRound,
      totalMessages: state.messages.length,
      participants: state.participants.map(p => p.name),
      durationMs: endedAt.getTime() - state.startedAt.getTime(),
      startedAt: state.startedAt,
      endedAt,
    };

    const result: NestedChatResult = {
      nestedChatId,
      configId: state.config.id,
      result: chatResult,
      summary,
      parentMessageId: state.parentMessageId,
    };

    // Move from active to completed
    this.activeChats.delete(nestedChatId);
    this.completedChats.set(nestedChatId, result);

    this.emit('nested:completed', { nestedChatId, result: chatResult });

    return result;
  }

  /**
   * Generate a summary of the nested chat
   * @param messages - Chat messages
   * @param method - Summary method
   * @returns Generated summary
   */
  private async generateSummary(
    messages: Message[],
    method: SummaryMethod
  ): Promise<string> {
    switch (method) {
      case 'last':
        return this.generateLastMessageSummary(messages);

      case 'llm':
        return this.generateLLMSummary(messages);

      case 'reflection':
        return this.generateReflectionSummary(messages);

      case 'custom':
        return this.generateCustomSummary(messages);

      default:
        return this.generateLastMessageSummary(messages);
    }
  }

  /**
   * Generate summary from the last message
   * @param messages - Chat messages
   * @returns Last message content as summary
   */
  private generateLastMessageSummary(messages: Message[]): string {
    const lastNonSystemMessage = [...messages]
      .reverse()
      .find(m => m.role !== 'system');

    if (!lastNonSystemMessage) {
      return 'No substantive messages in nested chat.';
    }

    return `${lastNonSystemMessage.name}: ${lastNonSystemMessage.content}`;
  }

  /**
   * Generate summary using LLM (placeholder)
   * @param messages - Chat messages
   * @returns LLM-generated summary
   */
  private async generateLLMSummary(messages: Message[]): Promise<string> {
    // In a real implementation, this would call an LLM
    // For now, generate a structured summary

    const participantMessages = new Map<string, number>();
    const topics: string[] = [];

    for (const message of messages) {
      if (message.role !== 'system') {
        participantMessages.set(
          message.name,
          (participantMessages.get(message.name) || 0) + 1
        );

        // Extract potential topics (simplified)
        const words = message.content.split(/\s+/).filter(w => w.length > 5);
        topics.push(...words.slice(0, 3));
      }
    }

    const participantSummary = Array.from(participantMessages.entries())
      .map(([name, count]) => `${name} (${count} messages)`)
      .join(', ');

    const uniqueTopics = [...new Set(topics)].slice(0, 5).join(', ');

    return `Nested discussion with ${participantMessages.size} participants (${participantSummary}). Key topics: ${uniqueTopics || 'general discussion'}. Total ${messages.length} messages exchanged.`;
  }

  /**
   * Generate a reflection-style summary
   * @param messages - Chat messages
   * @returns Reflection summary
   */
  private generateReflectionSummary(messages: Message[]): string {
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    if (nonSystemMessages.length === 0) {
      return 'No discussion occurred.';
    }

    const firstMessage = nonSystemMessages[0]!;
    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1]!;

    // Check for resolution indicators
    const resolutionKeywords = [
      'agree',
      'resolved',
      'decided',
      'conclusion',
      'done',
    ];
    const hasResolution = nonSystemMessages.some(m =>
      resolutionKeywords.some(k => m.content.toLowerCase().includes(k))
    );

    const participants = [...new Set(nonSystemMessages.map(m => m.name))];

    return (
      `Discussion started with ${firstMessage.name}: "${firstMessage.content.slice(0, 50)}...". ` +
      `${participants.length} participants contributed ${nonSystemMessages.length} messages. ` +
      `${hasResolution ? 'A resolution was reached.' : 'Discussion ongoing.'} ` +
      `Final message from ${lastMessage.name}: "${lastMessage.content.slice(0, 50)}..."`
    );
  }

  /**
   * Generate a custom summary (placeholder)
   * @param messages - Chat messages
   * @returns Custom summary
   */
  private generateCustomSummary(messages: Message[]): string {
    // Default to last message summary
    return this.generateLastMessageSummary(messages);
  }

  /**
   * Get the state of an active nested chat
   * @param nestedChatId - Nested chat ID
   * @returns Nested chat state or undefined
   */
  getActiveChat(nestedChatId: string): NestedChatState | undefined {
    return this.activeChats.get(nestedChatId);
  }

  /**
   * Get a completed nested chat result
   * @param nestedChatId - Nested chat ID
   * @returns Nested chat result or undefined
   */
  getCompletedChat(nestedChatId: string): NestedChatResult | undefined {
    return this.completedChats.get(nestedChatId);
  }

  /**
   * Get all active nested chat IDs
   * @returns Array of active nested chat IDs
   */
  getActiveChats(): string[] {
    return Array.from(this.activeChats.keys());
  }

  /**
   * Get all completed nested chat results
   * @returns Array of nested chat results
   */
  getCompletedChats(): NestedChatResult[] {
    return Array.from(this.completedChats.values());
  }

  /**
   * Check if there are any active nested chats
   * @returns Whether there are active nested chats
   */
  hasActiveChats(): boolean {
    return this.activeChats.size > 0;
  }

  /**
   * Increment the round counter for a nested chat
   * @param nestedChatId - Nested chat ID
   */
  incrementRound(nestedChatId: string): void {
    const state = this.activeChats.get(nestedChatId);
    if (state) {
      state.context.currentRound++;
    }
  }

  /**
   * Get the current context for a nested chat
   * @param nestedChatId - Nested chat ID
   * @returns Chat context or undefined
   */
  getContext(nestedChatId: string): ChatContext | undefined {
    return this.activeChats.get(nestedChatId)?.context;
  }

  /**
   * Update state in a nested chat context
   * @param nestedChatId - Nested chat ID
   * @param key - State key
   * @param value - State value
   */
  updateState(nestedChatId: string, key: string, value: unknown): void {
    const state = this.activeChats.get(nestedChatId);
    if (state) {
      state.context.state[key] = value;
    }
  }

  /**
   * Create a message object
   * @param options - Message creation options
   * @returns Created message
   */
  private createMessage(options: CreateMessageOptions): Message {
    return {
      id: uuidv4(),
      role: options.role,
      content: options.content,
      name: options.name,
      timestamp: new Date(),
      contentType: options.contentType || 'text',
      functionCall: options.functionCall,
      metadata: options.metadata,
      status: 'delivered',
    };
  }

  /**
   * Clear all nested chat data
   */
  clear(): void {
    this.configs.clear();
    this.activeChats.clear();
    this.completedChats.clear();
  }
}

/**
 * Builder for creating nested chat configurations
 */
export class NestedChatConfigBuilder {
  private config: Partial<NestedChatConfig> = {};

  /**
   * Set the config ID
   * @param id - Configuration ID
   */
  withId(id: string): this {
    this.config.id = id;
    return this;
  }

  /**
   * Set the config name
   * @param name - Configuration name
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Set a keyword trigger
   * @param keywords - Keywords to trigger the nested chat
   */
  withKeywordTrigger(keywords: string | string[]): this {
    this.config.trigger = {
      type: 'keyword',
      value: keywords,
      description: `Triggered by keyword(s): ${Array.isArray(keywords) ? keywords.join(', ') : keywords}`,
    };
    return this;
  }

  /**
   * Set a participant trigger
   * @param participants - Participants that trigger the nested chat
   */
  withParticipantTrigger(participants: string | string[]): this {
    this.config.trigger = {
      type: 'participant',
      value: participants,
      description: `Triggered by participant(s): ${Array.isArray(participants) ? participants.join(', ') : participants}`,
    };
    return this;
  }

  /**
   * Set a condition trigger
   * @param condition - Condition expression or function
   */
  withConditionTrigger(
    condition: string | ((message: Message, context: ChatContext) => boolean)
  ): this {
    this.config.trigger = {
      type: 'condition',
      value: condition,
      description: 'Triggered by condition',
    };
    return this;
  }

  /**
   * Set a manual trigger
   * @param stateKey - State key to check for manual trigger
   */
  withManualTrigger(stateKey: string): this {
    this.config.trigger = {
      type: 'manual',
      value: stateKey,
      description: `Manually triggered via state key: ${stateKey}`,
    };
    return this;
  }

  /**
   * Set the participants for the nested chat
   * @param participants - Participant names
   */
  withParticipants(participants: string[]): this {
    this.config.participants = participants;
    return this;
  }

  /**
   * Set the maximum rounds
   * @param maxRounds - Maximum number of rounds
   */
  withMaxRounds(maxRounds: number): this {
    this.config.maxRounds = maxRounds;
    return this;
  }

  /**
   * Set the summary method
   * @param method - Summary method
   */
  withSummaryMethod(method: SummaryMethod): this {
    this.config.summaryMethod = method;
    return this;
  }

  /**
   * Set the initial prompt
   * @param prompt - Prompt for the nested chat
   */
  withPrompt(prompt: string): this {
    this.config.prompt = prompt;
    return this;
  }

  /**
   * Enable context sharing with parent
   */
  withSharedContext(): this {
    this.config.shareContext = true;
    return this;
  }

  /**
   * Build the configuration
   * @returns Built nested chat configuration
   */
  build(): NestedChatConfig {
    if (!this.config.id) {
      this.config.id = uuidv4();
    }
    if (!this.config.name) {
      this.config.name = `nested-chat-${this.config.id}`;
    }
    if (!this.config.trigger) {
      throw new Error('Nested chat config requires a trigger');
    }
    if (!this.config.participants || this.config.participants.length < 2) {
      throw new Error('Nested chat requires at least 2 participants');
    }

    return this.config as NestedChatConfig;
  }
}
