/**
 * @neolith/core - Orchestrator Daemon Integration
 *
 * Integrates the orchestrator-daemon functionality into the Neolith app.
 * Orchestrators log in like normal users (email/password or Google OAuth),
 * and their Neolith instance runs the daemon in the background to handle
 * automated interactions.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import type { OrchestratorWithUser } from '../types/orchestrator';

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Daemon status enumeration
 */
export type DaemonStatus = 'stopped' | 'initializing' | 'running' | 'error' | 'stopping';

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Orchestrator user ID */
  orchestratorId: string;

  /** Orchestrator user data */
  orchestrator: OrchestratorWithUser;

  /** WebSocket endpoint for real-time communication */
  wsEndpoint?: string;

  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;

  /** Maximum concurrent conversations */
  maxConcurrentConversations?: number;

  /** Auto-respond to messages */
  autoRespond?: boolean;

  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Message received from channels
 */
export interface IncomingMessage {
  id: string;
  content: string;
  channelId: string;
  authorId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Response to be sent to channels
 */
export interface OutgoingMessage {
  content: string;
  channelId: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Orchestrator action to be executed
 */
export interface OrchestratorAction {
  type: 'send_message' | 'react' | 'update_status' | 'join_channel' | 'leave_channel';
  payload: Record<string, unknown>;
}

/**
 * Daemon health status
 */
export interface DaemonHealthStatus {
  status: DaemonStatus;
  uptime: number;
  activeConversations: number;
  totalMessagesProcessed: number;
  lastHeartbeat: Date;
  errors: string[];
}

// =============================================================================
// OrchestratorDaemon Class
// =============================================================================

/**
 * Orchestrator daemon for background automation.
 * Runs within the Neolith app when an orchestrator user is logged in.
 */
export class OrchestratorDaemon extends EventEmitter {
  private config: DaemonConfig;
  private status: DaemonStatus = 'stopped';
  private startTime: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: IncomingMessage[] = [];
  private activeConversations: Map<string, number> = new Map();
  private processedMessages = 0;
  private errors: string[] = [];

  constructor(config: DaemonConfig) {
    super();
    this.config = {
      heartbeatInterval: 30000, // 30 seconds default
      maxConcurrentConversations: 10,
      autoRespond: true,
      verbose: false,
      ...config,
    };
  }

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Start the orchestrator daemon
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      throw new Error('Daemon is already running');
    }

    this.status = 'initializing';
    this.emit('status:changed', this.status);

    try {
      this.log('Starting orchestrator daemon...');

      // Initialize connection to messaging system
      await this.initializeMessageHandler();

      // Start heartbeat
      this.startHeartbeat();

      this.status = 'running';
      this.startTime = Date.now();
      this.emit('status:changed', this.status);
      this.emit('started', this.getHealthStatus());

      this.log('Orchestrator daemon started successfully');
    } catch (error) {
      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push(errorMessage);
      this.emit('status:changed', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the orchestrator daemon gracefully
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return;
    }

    this.log('Stopping orchestrator daemon...');
    this.status = 'stopping';
    this.emit('status:changed', this.status);

    try {
      // Stop heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // Process remaining messages in queue
      await this.flushMessageQueue();

      // Clean up active conversations
      this.activeConversations.clear();

      this.status = 'stopped';
      this.emit('status:changed', this.status);
      this.emit('stopped');

      this.log('Orchestrator daemon stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push(errorMessage);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Restart the daemon
   */
  async restart(): Promise<void> {
    this.log('Restarting orchestrator daemon...');
    await this.stop();
    await this.start();
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Handle incoming message from a channel
   */
  async handleMessage(message: IncomingMessage): Promise<void> {
    if (this.status !== 'running') {
      this.log('Daemon not running, queuing message');
      this.messageQueue.push(message);
      return;
    }

    try {
      this.log(`Processing message: ${message.id} from channel ${message.channelId}`);

      // Check if this message mentions the orchestrator
      const isMentioned = this.isOrchestratorMentioned(message);

      // Check concurrent conversation limit
      const conversationCount = this.activeConversations.get(message.channelId) || 0;
      if (conversationCount >= (this.config.maxConcurrentConversations || 10)) {
        this.log(`Max concurrent conversations reached for channel ${message.channelId}`);
        return;
      }

      // Auto-respond if enabled and mentioned
      if (this.config.autoRespond && isMentioned) {
        this.activeConversations.set(message.channelId, conversationCount + 1);

        const response = await this.generateResponse(message);
        await this.sendResponse(response);

        this.activeConversations.set(message.channelId, conversationCount);
        this.processedMessages++;
      }

      this.emit('message:processed', message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push(`Message processing error: ${errorMessage}`);
      this.emit('message:error', { message, error });
    }
  }

  /**
   * Send response message to a channel
   */
  async sendResponse(message: OutgoingMessage): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Daemon not running');
    }

    this.log(`Sending response to channel ${message.channelId}`);
    this.emit('message:send', message);

    // Implementation will be provided by the integration layer
    // This would interact with the Neolith messaging service
  }

  /**
   * Execute an orchestrator action
   */
  async executeAction(action: OrchestratorAction): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Daemon not running');
    }

    this.log(`Executing action: ${action.type}`);
    this.emit('action:execute', action);

    // Implementation will be provided by the integration layer
    // This would interact with various Neolith services based on action type
  }

  // ===========================================================================
  // Status & Health
  // ===========================================================================

  /**
   * Get current daemon status
   */
  getStatus(): DaemonStatus {
    return this.status;
  }

  /**
   * Get detailed health status
   */
  getHealthStatus(): DaemonHealthStatus {
    return {
      status: this.status,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      activeConversations: Array.from(this.activeConversations.values()).reduce((a, b) => a + b, 0),
      totalMessagesProcessed: this.processedMessages,
      lastHeartbeat: new Date(),
      errors: [...this.errors],
    };
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return this.status === 'running';
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Initialize message handler
   */
  private async initializeMessageHandler(): Promise<void> {
    // This will be implemented by the integration layer
    // Subscribe to message events from Neolith channels
    this.log('Message handler initialized');
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.emit('heartbeat', this.getHealthStatus());
      this.log('Heartbeat', true);
    }, this.config.heartbeatInterval || 30000);
  }

  /**
   * Flush remaining messages in queue
   */
  private async flushMessageQueue(): Promise<void> {
    this.log(`Flushing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.handleMessage(message);
      }
    }
  }

  /**
   * Check if orchestrator is mentioned in message
   */
  private isOrchestratorMentioned(message: IncomingMessage): boolean {
    const { name, email } = this.config.orchestrator.user;
    const content = message.content.toLowerCase();

    // Check for @mentions or name references
    if (name && content.includes(name.toLowerCase())) {
      return true;
    }

    if (email && content.includes(email.toLowerCase())) {
      return true;
    }

    // Check for orchestrator role mentions
    if (this.config.orchestrator.role &&
        content.includes(this.config.orchestrator.role.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Generate AI response to a message
   */
  private async generateResponse(message: IncomingMessage): Promise<OutgoingMessage> {
    // This will be implemented by the integration layer
    // Use the orchestrator's charter and personality to generate responses
    // For now, return a placeholder

    return {
      content: `I'm ${this.config.orchestrator.user.name}, responding to your message.`,
      channelId: message.channelId,
      replyToId: message.id,
      metadata: {
        orchestratorId: this.config.orchestratorId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Log message
   */
  private log(message: string, debug = false): void {
    if (!debug || this.config.verbose) {
      const prefix = `[OrchestratorDaemon:${this.config.orchestrator.user.name}]`;
      console.log(`${prefix} ${message}`);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new orchestrator daemon instance
 */
export function createOrchestratorDaemon(config: DaemonConfig): OrchestratorDaemon {
  return new OrchestratorDaemon(config);
}

/**
 * Check if a user should have a daemon running
 */
export function shouldRunDaemon(user: { isOrchestrator?: boolean }): boolean {
  return user.isOrchestrator === true;
}
