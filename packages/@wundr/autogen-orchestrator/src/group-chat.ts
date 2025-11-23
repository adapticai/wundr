/**
 * GroupChatManager - Core orchestration for AutoGen-style multi-agent conversations
 *
 * Implements conversational patterns for coordinating multiple AI agents in a
 * group chat setting with configurable speaker selection and termination conditions.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { NestedChatManager } from './nested-chat';
import { SpeakerSelectionManager } from './speaker-selection';
import { TerminationManager } from './termination';
import { GroupChatConfigSchema } from './types';

import type { NestedChatResult } from './nested-chat';
import type {
  Message,
  ChatParticipant,
  ChatContext,
  ChatResult,
  ChatStatus,
  ChatMetrics,
  ChatError,
  ChatEvent,
  ChatEventType,
  ChatEventDataMap,
  GroupChatConfig,
  TerminationCondition,
  NestedChatConfig,
  CreateMessageOptions,
  AddParticipantOptions,
  StartChatOptions,
  ParticipantStatus,
} from './types';

/**
 * Events emitted by the GroupChatManager
 */
export interface GroupChatEvents {
  'chat:started': (data: { chatId: string; config: GroupChatConfig }) => void;
  'chat:ended': (data: { chatId: string; result: ChatResult }) => void;
  'chat:error': (data: { chatId: string; error: ChatError }) => void;
  'message:sent': (data: { chatId: string; message: Message }) => void;
  'message:received': (data: { chatId: string; message: Message }) => void;
  'speaker:selected': (data: {
    chatId: string;
    speaker: string;
    reason?: string;
  }) => void;
  'round:started': (data: { chatId: string; round: number }) => void;
  'round:ended': (data: { chatId: string; round: number }) => void;
  'termination:triggered': (data: { chatId: string; reason: string }) => void;
  'nested:started': (data: { chatId: string; nestedChatId: string }) => void;
  'nested:ended': (data: {
    chatId: string;
    nestedChatId: string;
    result: NestedChatResult;
  }) => void;
}

/**
 * Response generator function type
 * Used to generate responses for participants
 */
export type ResponseGenerator = (
  participant: ChatParticipant,
  messages: Message[],
  context: ChatContext
) => Promise<string>;

/**
 * GroupChatManager - Orchestrates multi-agent conversations
 */
export class GroupChatManager extends EventEmitter<GroupChatEvents> {
  private config: GroupChatConfig;
  private participants: Map<string, ChatParticipant> = new Map();
  private messages: Message[] = [];
  private context: ChatContext;
  private status: ChatStatus = 'initializing';
  private startTime?: Date;
  private endTime?: Date;
  private chatId: string;

  private speakerManager: SpeakerSelectionManager;
  private terminationManager: TerminationManager;
  private nestedChatManager: NestedChatManager;

  private responseGenerator?: ResponseGenerator;
  private metrics: ChatMetrics;
  private nestedResults: NestedChatResult[] = [];

  /**
   * Create a new GroupChatManager
   * @param config - Group chat configuration
   */
  constructor(config: GroupChatConfig) {
    super();

    // Validate configuration
    const validationResult = GroupChatConfigSchema.safeParse(config);
    if (!validationResult.success) {
      throw new Error(
        `Invalid GroupChatConfig: ${validationResult.error.message}`
      );
    }

    this.config = config;
    this.chatId = config.id || uuidv4();

    // Initialize participants
    for (const participant of config.participants) {
      this.participants.set(participant.name, { ...participant });
    }

    // Initialize context
    this.context = {
      chatId: this.chatId,
      currentRound: 0,
      messageCount: 0,
      activeParticipants: config.participants.map(p => p.name),
      startTime: new Date(),
      state: {},
    };

    // Initialize managers
    this.speakerManager = new SpeakerSelectionManager(
      config.speakerSelectionMethod
    );
    this.terminationManager = new TerminationManager(
      config.terminationConditions || []
    );
    this.nestedChatManager = new NestedChatManager(
      config.nestedChatConfigs || []
    );

    // Initialize metrics
    this.metrics = {
      totalTokens: 0,
      avgResponseTimeMs: 0,
      messagesPerParticipant: {},
      tokensPerParticipant: {},
      successfulResponses: 0,
      failedResponses: 0,
    };

    // Setup nested chat event forwarding
    this.setupNestedChatEvents();
  }

  /**
   * Setup event forwarding from nested chat manager
   */
  private setupNestedChatEvents(): void {
    this.nestedChatManager.on('nested:started', ({ nestedChatId }) => {
      this.emit('nested:started', { chatId: this.chatId, nestedChatId });
    });

    this.nestedChatManager.on(
      'nested:completed',
      ({ nestedChatId, result }) => {
        const nestedResult: NestedChatResult = {
          nestedChatId,
          configId: '', // Will be filled properly
          result,
          parentMessageId: '',
        };
        this.nestedResults.push(nestedResult);
        this.emit('nested:ended', {
          chatId: this.chatId,
          nestedChatId,
          result: nestedResult,
        });
      }
    );
  }

  /**
   * Set the response generator function
   * @param generator - Function to generate participant responses
   */
  setResponseGenerator(generator: ResponseGenerator): void {
    this.responseGenerator = generator;
  }

  /**
   * Start the group chat
   * @param options - Optional start options
   * @returns Chat result when completed
   */
  async start(options: StartChatOptions = {}): Promise<ChatResult> {
    if (this.status !== 'initializing') {
      throw new Error(`Cannot start chat in status: ${this.status}`);
    }

    this.status = 'active';
    this.startTime = new Date();
    this.context.startTime = this.startTime;

    // Initialize state if provided
    if (options.initialState) {
      this.context.state = { ...options.initialState };
    }

    this.emitEvent('chat_started', { config: this.config });
    this.emit('chat:started', { chatId: this.chatId, config: this.config });

    try {
      // Add initial message if provided
      if (options.initialMessage) {
        const senderName =
          options.initialSender || this.config.adminName || 'user';
        await this.addMessage({
          role: 'user',
          content: options.initialMessage,
          name: senderName,
        });
      }

      // Run the conversation loop
      const result = await this.runConversationLoop(options);

      return result;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Run the main conversation loop
   * @param options - Start options
   * @returns Chat result
   */
  private async runConversationLoop(
    options: StartChatOptions
  ): Promise<ChatResult> {
    const maxRounds = this.config.maxRounds || 100;
    const maxMessages = this.config.maxMessages || 1000;

    while (this.status === 'active') {
      // Check termination conditions
      const terminationResult = await this.terminationManager.evaluate(
        this.messages,
        Array.from(this.participants.values()),
        this.context
      );

      if (terminationResult.shouldTerminate) {
        return this.endChat('completed', terminationResult.reason);
      }

      // Check limits
      if (this.context.currentRound >= maxRounds) {
        return this.endChat(
          'terminated',
          `Maximum rounds reached: ${maxRounds}`
        );
      }

      if (this.messages.length >= maxMessages) {
        return this.endChat(
          'terminated',
          `Maximum messages reached: ${maxMessages}`
        );
      }

      // Start new round
      this.context.currentRound++;
      this.emitEvent('round_started', { round: this.context.currentRound });
      this.emit('round:started', {
        chatId: this.chatId,
        round: this.context.currentRound,
      });

      // Select next speaker
      const skipSelection =
        options.skipInitialSelection && this.context.currentRound === 1;

      if (!skipSelection) {
        const selectionResult = await this.speakerManager.selectSpeaker(
          Array.from(this.participants.values()),
          this.messages,
          this.context,
          this.config.speakerSelectionConfig
        );

        this.context.previousSpeaker = this.context.currentSpeaker;
        this.context.currentSpeaker = selectionResult.speaker;

        this.emitEvent('speaker_selected', {
          speaker: selectionResult.speaker,
          reason: selectionResult.reason,
        });
        this.emit('speaker:selected', {
          chatId: this.chatId,
          speaker: selectionResult.speaker,
          reason: selectionResult.reason,
        });

        // Generate and add response
        const participant = this.participants.get(selectionResult.speaker);
        if (participant) {
          const response = await this.generateResponse(participant);

          if (response) {
            const message = await this.addMessage({
              role: 'assistant',
              content: response,
              name: participant.name,
            });

            // Check for nested chat triggers
            if (this.config.allowNestedChats) {
              await this.checkNestedChatTriggers(message);
            }
          }
        }
      }

      // End round
      this.emitEvent('round_ended', { round: this.context.currentRound });
      this.emit('round:ended', {
        chatId: this.chatId,
        round: this.context.currentRound,
      });
    }

    // If we exit the loop due to status change
    return this.endChat(this.status as ChatStatus, 'Chat stopped');
  }

  /**
   * Generate a response for a participant
   * @param participant - Participant to generate response for
   * @returns Generated response content
   */
  private async generateResponse(
    participant: ChatParticipant
  ): Promise<string | null> {
    const startTime = Date.now();

    try {
      // Update participant status
      participant.status = 'busy';

      let response: string;

      if (this.responseGenerator) {
        response = await this.responseGenerator(
          participant,
          this.messages,
          this.context
        );
      } else {
        // Default placeholder response
        response = this.generatePlaceholderResponse(participant);
      }

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(participant.name, latency, response.length);

      participant.status = 'idle';
      this.metrics.successfulResponses++;

      return response;
    } catch (error) {
      participant.status = 'error';
      this.metrics.failedResponses++;

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error generating response for ${participant.name}: ${errorMessage}`
      );

      return null;
    }
  }

  /**
   * Generate a placeholder response when no generator is set
   * @param participant - Participant to generate for
   * @returns Placeholder response
   */
  private generatePlaceholderResponse(participant: ChatParticipant): string {
    const prompts = [
      `[${participant.name}]: I acknowledge the message and am ready to contribute.`,
      `[${participant.name}]: Based on my expertise in ${participant.capabilities.join(', ')}, I suggest we proceed.`,
      `[${participant.name}]: Let me analyze this from my perspective.`,
    ];

    return prompts[Math.floor(Math.random() * prompts.length)]!;
  }

  /**
   * Update metrics after a response
   * @param participantName - Name of the participant
   * @param latencyMs - Response latency
   * @param tokenEstimate - Estimated token count
   */
  private updateMetrics(
    participantName: string,
    latencyMs: number,
    tokenEstimate: number
  ): void {
    // Update per-participant metrics
    this.metrics.messagesPerParticipant[participantName] =
      (this.metrics.messagesPerParticipant[participantName] || 0) + 1;

    const estimatedTokens = Math.ceil(tokenEstimate / 4); // Rough estimate
    this.metrics.tokensPerParticipant[participantName] =
      (this.metrics.tokensPerParticipant[participantName] || 0) +
      estimatedTokens;

    this.metrics.totalTokens += estimatedTokens;

    // Update average response time
    const totalResponses =
      this.metrics.successfulResponses + this.metrics.failedResponses;
    this.metrics.avgResponseTimeMs =
      (this.metrics.avgResponseTimeMs * (totalResponses - 1) + latencyMs) /
      totalResponses;
  }

  /**
   * Check if a message triggers a nested chat
   * @param message - Message to check
   */
  private async checkNestedChatTriggers(message: Message): Promise<void> {
    const triggeredConfig = this.nestedChatManager.checkTrigger(
      message,
      Array.from(this.participants.values()),
      this.context
    );

    if (triggeredConfig) {
      await this.runNestedChat(triggeredConfig, message.id);
    }
  }

  /**
   * Run a nested chat session
   * @param config - Nested chat configuration
   * @param triggerMessageId - ID of the triggering message
   */
  private async runNestedChat(
    config: NestedChatConfig,
    triggerMessageId: string
  ): Promise<void> {
    const nestedChatId = this.nestedChatManager.startNestedChat(
      config,
      this.chatId,
      triggerMessageId,
      Array.from(this.participants.values()),
      this.context
    );

    // Run nested chat rounds
    const maxRounds = config.maxRounds || 5;
    let round = 0;

    while (round < maxRounds && this.nestedChatManager.hasActiveChats()) {
      const nestedContext = this.nestedChatManager.getContext(nestedChatId);
      if (!nestedContext) {
        break;
      }

      // Select speaker for nested chat
      const nestedState = this.nestedChatManager.getActiveChat(nestedChatId);
      if (!nestedState) {
        break;
      }

      const selectionResult = await this.speakerManager.selectSpeaker(
        nestedState.participants,
        nestedState.messages,
        nestedContext
      );

      // Generate response
      const participant = nestedState.participants.find(
        p => p.name === selectionResult.speaker
      );

      if (participant && this.responseGenerator) {
        const response = await this.responseGenerator(
          participant,
          nestedState.messages,
          nestedContext
        );

        if (response) {
          this.nestedChatManager.addMessage(nestedChatId, {
            id: uuidv4(),
            role: 'assistant',
            content: response,
            name: participant.name,
            timestamp: new Date(),
            status: 'delivered',
          });
        }
      }

      this.nestedChatManager.incrementRound(nestedChatId);
      round++;
    }

    // End nested chat
    const result = await this.nestedChatManager.endNestedChat(
      nestedChatId,
      'completed',
      `Completed after ${round} rounds`
    );

    this.nestedResults.push(result);

    // Add summary to main chat if available
    if (result.summary) {
      await this.addMessage({
        role: 'system',
        content: `[Nested Chat Summary]: ${result.summary}`,
        name: 'system',
      });
    }
  }

  /**
   * Add a message to the chat
   * @param options - Message options
   * @returns Created message
   */
  async addMessage(options: CreateMessageOptions): Promise<Message> {
    const message: Message = {
      id: uuidv4(),
      role: options.role,
      content: options.content,
      name: options.name,
      timestamp: new Date(),
      contentType: options.contentType || 'text',
      functionCall: options.functionCall,
      metadata: {
        ...options.metadata,
        tokenCount: Math.ceil(options.content.length / 4),
      },
      status: 'delivered',
    };

    this.messages.push(message);
    this.context.messageCount = this.messages.length;

    this.emitEvent('message_received', { message });
    this.emit('message:received', { chatId: this.chatId, message });

    return message;
  }

  /**
   * Add a participant to the chat
   * @param options - Participant options
   * @returns Created participant
   */
  addParticipant(options: AddParticipantOptions): ChatParticipant {
    const participant: ChatParticipant = {
      id: uuidv4(),
      name: options.name,
      type: options.type,
      systemPrompt: options.systemPrompt,
      status: 'active',
      capabilities: options.capabilities || [],
      modelConfig: options.modelConfig,
      functions: options.functions,
      maxConsecutiveReplies: options.maxConsecutiveReplies,
      description: options.description,
    };

    this.participants.set(participant.name, participant);
    this.context.activeParticipants.push(participant.name);

    return participant;
  }

  /**
   * Remove a participant from the chat
   * @param name - Participant name
   */
  removeParticipant(name: string): void {
    this.participants.delete(name);
    this.context.activeParticipants = this.context.activeParticipants.filter(
      n => n !== name
    );
  }

  /**
   * Update a participant's status
   * @param name - Participant name
   * @param status - New status
   */
  updateParticipantStatus(name: string, status: ParticipantStatus): void {
    const participant = this.participants.get(name);
    if (participant) {
      participant.status = status;
    }
  }

  /**
   * Add a termination condition
   * @param condition - Condition to add
   */
  addTerminationCondition(condition: TerminationCondition): void {
    this.terminationManager.addCondition(condition);
  }

  /**
   * Add a nested chat configuration
   * @param config - Nested chat config
   */
  addNestedChatConfig(config: NestedChatConfig): void {
    this.nestedChatManager.addConfig(config);
  }

  /**
   * Pause the chat
   */
  pause(): void {
    if (this.status === 'active') {
      this.status = 'paused';
    }
  }

  /**
   * Resume the chat
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'active';
    }
  }

  /**
   * Stop the chat
   * @param reason - Reason for stopping
   * @returns Chat result
   */
  async stop(reason?: string): Promise<ChatResult> {
    return this.endChat('terminated', reason || 'Manually stopped');
  }

  /**
   * End the chat and produce a result
   * @param status - Final status
   * @param reason - Termination reason
   * @returns Chat result
   */
  private endChat(status: ChatStatus, reason?: string): ChatResult {
    this.status = status;
    this.endTime = new Date();

    const durationMs =
      this.endTime.getTime() -
      (this.startTime?.getTime() || this.endTime.getTime());

    const result: ChatResult = {
      chatId: this.chatId,
      status,
      messages: [...this.messages],
      summary: this.generateSummary(),
      terminationReason: reason,
      totalRounds: this.context.currentRound,
      totalMessages: this.messages.length,
      participants: Array.from(this.participants.keys()),
      durationMs,
      metrics: { ...this.metrics },
      nestedResults: [...this.nestedResults],
      startedAt: this.startTime || new Date(),
      endedAt: this.endTime,
    };

    if (reason) {
      this.emitEvent('termination_triggered', { reason });
      this.emit('termination:triggered', { chatId: this.chatId, reason });
    }

    this.emitEvent('chat_ended', { result });
    this.emit('chat:ended', { chatId: this.chatId, result });

    return result;
  }

  /**
   * Handle an error during chat execution
   * @param error - Error that occurred
   * @returns Chat result with error
   */
  private handleError(error: unknown): ChatResult {
    const chatError: ChatError = {
      code: 'CHAT_ERROR',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        round: this.context.currentRound,
        messageCount: this.messages.length,
      },
      recoverable: false,
    };

    this.emit('chat:error', { chatId: this.chatId, error: chatError });

    const result = this.endChat('error', chatError.message);
    result.error = chatError;

    return result;
  }

  /**
   * Generate a summary of the conversation
   * @returns Summary string
   */
  private generateSummary(): string {
    const participantCounts = this.metrics.messagesPerParticipant;
    const topContributors = Object.entries(participantCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`)
      .join(', ');

    return (
      `Chat completed with ${this.messages.length} messages over ${this.context.currentRound} rounds. ` +
      `Top contributors: ${topContributors || 'none'}. ` +
      `Duration: ${Math.round((this.endTime?.getTime() || Date.now()) - (this.startTime?.getTime() || Date.now())) / 1000}s.`
    );
  }

  /**
   * Emit a chat event
   * @param type - Event type
   * @param data - Event data typed based on event type
   */
  private emitEvent<T extends ChatEventType>(
    type: T,
    data: T extends keyof ChatEventDataMap
      ? ChatEventDataMap[T]
      : Record<string, unknown>
  ): void {
    const event: ChatEvent<T> = {
      type,
      timestamp: new Date(),
      chatId: this.chatId,
      data,
    };

    // Internal event tracking if needed
    this.context.state['lastEvent'] = event;
  }

  /**
   * Get the current chat status
   * @returns Current status
   */
  getStatus(): ChatStatus {
    return this.status;
  }

  /**
   * Get the chat ID
   * @returns Chat ID
   */
  getChatId(): string {
    return this.chatId;
  }

  /**
   * Get all messages
   * @returns Message array
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get all participants
   * @returns Participant array
   */
  getParticipants(): ChatParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get the current context
   * @returns Chat context
   */
  getContext(): ChatContext {
    return { ...this.context };
  }

  /**
   * Get current metrics
   * @returns Chat metrics
   */
  getMetrics(): ChatMetrics {
    return { ...this.metrics };
  }

  /**
   * Update context state
   * @param key - State key
   * @param value - State value (typed for common use cases)
   */
  updateState<T extends string | number | boolean | object | null>(
    key: string,
    value: T
  ): void {
    this.context.state[key] = value;
  }

  /**
   * Get context state value
   * @param key - State key
   * @returns State value
   */
  getState<T>(key: string): T | undefined {
    return this.context.state[key] as T | undefined;
  }
}

/**
 * Builder for creating GroupChatManager instances
 */
export class GroupChatBuilder {
  private config: Partial<GroupChatConfig> = {
    participants: [],
    terminationConditions: [],
    nestedChatConfigs: [],
  };

  /**
   * Set the chat name
   * @param name - Chat name
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Set the chat description
   * @param description - Chat description
   */
  withDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  /**
   * Add a participant
   * @param participant - Participant to add
   */
  withParticipant(participant: ChatParticipant): this {
    this.config.participants = this.config.participants || [];
    this.config.participants.push(participant);
    return this;
  }

  /**
   * Set the speaker selection method
   * @param method - Selection method
   */
  withSpeakerSelection(
    method: GroupChatConfig['speakerSelectionMethod']
  ): this {
    this.config.speakerSelectionMethod = method;
    return this;
  }

  /**
   * Set maximum rounds
   * @param maxRounds - Maximum rounds
   */
  withMaxRounds(maxRounds: number): this {
    this.config.maxRounds = maxRounds;
    return this;
  }

  /**
   * Set maximum messages
   * @param maxMessages - Maximum messages
   */
  withMaxMessages(maxMessages: number): this {
    this.config.maxMessages = maxMessages;
    return this;
  }

  /**
   * Add a termination condition
   * @param condition - Termination condition
   */
  withTerminationCondition(condition: TerminationCondition): this {
    this.config.terminationConditions = this.config.terminationConditions || [];
    this.config.terminationConditions.push(condition);
    return this;
  }

  /**
   * Enable nested chats
   */
  withNestedChats(): this {
    this.config.allowNestedChats = true;
    return this;
  }

  /**
   * Add a nested chat configuration
   * @param config - Nested chat config
   */
  withNestedChatConfig(config: NestedChatConfig): this {
    this.config.nestedChatConfigs = this.config.nestedChatConfigs || [];
    this.config.nestedChatConfigs.push(config);
    return this;
  }

  /**
   * Set the admin name
   * @param name - Admin name
   */
  withAdmin(name: string): this {
    this.config.adminName = name;
    return this;
  }

  /**
   * Set timeout
   * @param timeoutMs - Timeout in milliseconds
   */
  withTimeout(timeoutMs: number): this {
    this.config.timeoutMs = timeoutMs;
    return this;
  }

  /**
   * Build the GroupChatManager
   * @returns Configured GroupChatManager
   */
  build(): GroupChatManager {
    if (!this.config.name) {
      this.config.name = `group-chat-${uuidv4().slice(0, 8)}`;
    }

    if (!this.config.speakerSelectionMethod) {
      this.config.speakerSelectionMethod = 'round_robin';
    }

    if (!this.config.participants || this.config.participants.length < 2) {
      throw new Error('GroupChat requires at least 2 participants');
    }

    return new GroupChatManager(this.config as GroupChatConfig);
  }
}

/**
 * Create a simple participant configuration
 * @param name - Participant name
 * @param systemPrompt - System prompt
 * @param capabilities - Participant capabilities
 * @returns Participant configuration
 */
export function createParticipant(
  name: string,
  systemPrompt: string,
  capabilities: string[] = []
): ChatParticipant {
  return {
    id: uuidv4(),
    name,
    type: 'agent',
    systemPrompt,
    status: 'active',
    capabilities,
  };
}
