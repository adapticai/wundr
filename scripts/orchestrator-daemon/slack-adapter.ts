/**
 * SlackAdapter - Bolt.js Slack Integration for Orchestrator Daemon
 *
 * Implements Socket Mode Slack integration for the Orchestrator (Virtual Principal) daemon.
 * Handles app mentions, direct messages, and slash commands with Orchestrator persona.
 *
 * @requires @slack/bolt (optional dependency)
 */

// ============================================================================
// Slack Types (inline definitions for optional @slack/bolt dependency)
// ============================================================================

/**
 * Bolt.js App instance type
 * When @slack/bolt is installed, use the actual App type
 */
interface BoltApp {
  start(): Promise<void>;
  stop(): Promise<void>;
  event(eventName: string, handler: (args: unknown) => Promise<void>): void;
  message(handler: (args: unknown) => Promise<void>): void;
  command(commandName: string, handler: (args: unknown) => Promise<void>): void;
  client: {
    chat: {
      postMessage(args: {
        token: string;
        channel: string;
        text?: string;
        blocks?: Block[];
        thread_ts?: string;
      }): Promise<unknown>;
    };
  };
}

/**
 * Slack Message Event
 */
export interface MessageEvent {
  type: 'message';
  channel: string;
  user: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
}

/**
 * Slack App Mention Event
 */
export interface AppMentionEvent {
  type: 'app_mention';
  user: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  event_ts: string;
}

/**
 * Slack Slash Command
 */
export interface SlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

/**
 * Slack Block Kit Block
 */
export interface Block {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: string;
  }>;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SlackConfig {
  /** Slack Bot Token (xoxb-...) */
  botToken: string;
  /** Slack App Token for Socket Mode (xapp-...) */
  appToken: string;
  /** Slack Signing Secret */
  signingSecret: string;
  /** Optional: Default channel for Orchestrator messages */
  defaultChannel?: string;
  /** Optional: Orchestrator persona name for responses */
  vpName?: string;
  /** Optional: Enable debug logging */
  debug?: boolean;
}

export interface TriageEngine {
  /** Process incoming request and determine priority/routing */
  processRequest(request: TriageRequest): Promise<TriageResult>;
  /** Get current queue status */
  getQueueStatus(): Promise<QueueStatus>;
}

export interface TriageRequest {
  userId: string;
  channelId: string;
  message: string;
  threadTs?: string;
  timestamp: string;
}

export interface TriageResult {
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: string;
  suggestedAction: string;
  response: string;
}

export interface QueueStatus {
  totalInQueue: number;
  urgentCount: number;
  averageWaitTime: number;
  activeSlots: number;
  maxSlots: number;
}

export interface SessionSlotManager {
  /** Request a session slot for a user */
  requestSlot(userId: string, priority: string): Promise<SlotResult>;
  /** Release a session slot */
  releaseSlot(slotId: string): Promise<void>;
  /** Get current slot availability */
  getAvailability(): Promise<SlotAvailability>;
}

export interface SlotResult {
  granted: boolean;
  slotId?: string;
  position?: number;
  estimatedWait?: number;
}

export interface SlotAvailability {
  available: number;
  total: number;
  nextAvailable?: Date;
}

// ============================================================================
// Orchestrator Persona Response Templates
// ============================================================================

const VP_RESPONSES = {
  greeting: (name: string) =>
    `Hey there! I'm ${name}, your Virtual Principal. How can I help you today?`,
  acknowledgment: [
    'Got it! Let me look into that for you.',
    'On it! Give me a moment to review.',
    'Understood. Let me see what we can do.',
    'I hear you. Processing your request now.',
  ],
  queueStatus: (status: QueueStatus) =>
    'Current queue status:\n' +
    `- Items in queue: ${status.totalInQueue}\n` +
    `- Urgent items: ${status.urgentCount}\n` +
    `- Active sessions: ${status.activeSlots}/${status.maxSlots}\n` +
    `- Average wait time: ${Math.round(status.averageWaitTime / 60)} minutes`,
  slotGranted: (position: number) =>
    `You're in! Your session slot has been reserved. Position: ${position}`,
  slotWaiting: (position: number, wait: number) =>
    `You're in the queue at position ${position}. Estimated wait: ~${Math.round(wait / 60)} minutes.`,
  error:
    'Hmm, something went sideways. Let me try that again or get someone to help.',
  busy: "I'm juggling a lot right now, but I've noted your request. I'll get back to you shortly.",
  shutdown: "Signing off for now. I'll be back soon!",
};

// ============================================================================
// SlackAdapter Class
// ============================================================================

export class SlackAdapter {
  private app: BoltApp | null = null;
  private config: SlackConfig;
  private triageEngine: TriageEngine | null = null;
  private sessionManager: SessionSlotManager | null = null;
  private isRunning = false;
  private vpName: string;

  constructor(config: SlackConfig) {
    this.config = config;
    this.orchestratorName = config.orchestratorName || 'VP';
  }

  /**
   * Set the triage engine reference for processing requests
   */
  setTriageEngine(engine: TriageEngine): void {
    this.triageEngine = engine;
  }

  /**
   * Set the session slot manager reference
   */
  setSessionManager(manager: SessionSlotManager): void {
    this.sessionManager = manager;
  }

  /**
   * Initialize the Bolt.js Slack app with Socket Mode
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import to handle optional dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const boltModule = await (Function(
        'return import("@slack/bolt")',
      )() as Promise<{
        App: new (config: {
          token: string;
          appToken: string;
          signingSecret: string;
          socketMode: boolean;
          processBeforeResponse: boolean;
        }) => BoltApp;
      }>);

      this.app = new boltModule.App({
        token: this.config.botToken,
        appToken: this.config.appToken,
        signingSecret: this.config.signingSecret,
        socketMode: true,
        // Disable built-in acknowledgment for custom handling
        processBeforeResponse: true,
      });

      this.setupEventHandlers();

      if (this.config.debug) {
        console.log('[SlackAdapter] Initialized successfully');
      }
    } catch (error) {
      const err = error as Error & { code?: string };
      if (
        err.code === 'MODULE_NOT_FOUND' ||
        err.message?.includes('Cannot find module')
      ) {
        throw new Error(
          'SlackAdapter requires @slack/bolt package. Install with: npm install @slack/bolt',
        );
      }
      throw error;
    }
  }

  /**
   * Start Socket Mode connection to Slack
   */
  async start(): Promise<void> {
    if (!this.app) {
      throw new Error('SlackAdapter not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.warn('[SlackAdapter] Already running');
      return;
    }

    await this.app.start();
    this.isRunning = true;

    if (this.config.debug) {
      console.log('[SlackAdapter] Socket Mode started');
    }
  }

  /**
   * Gracefully shutdown the Slack connection
   */
  async stop(): Promise<void> {
    if (!this.app || !this.isRunning) {
      return;
    }

    // Send shutdown notification if default channel is configured
    if (this.config.defaultChannel) {
      try {
        await this.sendMessage(
          this.config.defaultChannel,
          VP_RESPONSES.shutdown,
        );
      } catch {
        // Ignore errors during shutdown notification
      }
    }

    await this.app.stop();
    this.isRunning = false;

    if (this.config.debug) {
      console.log('[SlackAdapter] Stopped gracefully');
    }
  }

  /**
   * Setup all Slack event handlers
   */
  private setupEventHandlers(): void {
    if (!this.app) {
      return;
    }

    // Handle app mentions (@VP)
    this.app.event('app_mention', async ({ event, say }) => {
      await this.handleMention(event as AppMentionEvent, say);
    });

    // Handle direct messages to VP
    this.app.message(async ({ event, say }) => {
      // Only handle DMs (channel type 'im')
      const msgEvent = event as MessageEvent & { channel_type?: string };
      if (msgEvent.channel_type === 'im') {
        await this.handleMessage(msgEvent, say);
      }
    });

    // Slash command: /orchestrator-status
    this.app.command('/orchestrator-status', async ({ command, ack, respond }) => {
      await ack();
      await this.handleSlashCommand(command, respond, 'status');
    });

    // Slash command: /orchestrator-queue
    this.app.command('/orchestrator-queue', async ({ command, ack, respond }) => {
      await ack();
      await this.handleSlashCommand(command, respond, 'queue');
    });

    if (this.config.debug) {
      console.log('[SlackAdapter] Event handlers configured');
    }
  }

  /**
   * Handle direct messages to VP
   */
  private async handleMessage(
    event: MessageEvent & { channel_type?: string },
    say: (message: string | object) => Promise<unknown>,
  ): Promise<void> {
    // Ignore bot messages and message edits
    if ('bot_id' in event || 'subtype' in event) {
      return;
    }

    const userId = event.user;
    const channelId = event.channel;
    const text = 'text' in event ? (event.text as string) : '';
    const threadTs =
      'thread_ts' in event ? (event.thread_ts as string) : undefined;

    if (this.config.debug) {
      console.log(`[SlackAdapter] DM from ${userId}: ${text}`);
    }

    try {
      // Process through triage engine if available
      if (this.triageEngine) {
        const result = await this.triageEngine.processRequest({
          userId,
          channelId,
          message: text,
          threadTs,
          timestamp: event.ts,
        });

        await say({
          text: this.formatVPResponse(result.response),
          thread_ts: threadTs,
        });

        // Request session slot if needed
        if (this.sessionManager && result.priority !== 'low') {
          const slotResult = await this.sessionManager.requestSlot(
            userId,
            result.priority,
          );
          if (slotResult.granted) {
            await say({
              text: VP_RESPONSES.slotGranted(slotResult.position || 1),
              thread_ts: threadTs,
            });
          } else if (slotResult.position) {
            await say({
              text: VP_RESPONSES.slotWaiting(
                slotResult.position,
                slotResult.estimatedWait || 0,
              ),
              thread_ts: threadTs,
            });
          }
        }
      } else {
        // Default response when triage engine not available
        const ack = this.getRandomAcknowledgment();
        await say({
          text: ack,
          thread_ts: threadTs,
        });
      }
    } catch (error) {
      console.error('[SlackAdapter] Error handling message:', error);
      await say({
        text: VP_RESPONSES.error,
        thread_ts: threadTs,
      });
    }
  }

  /**
   * Handle app mentions (@VP)
   */
  private async handleMention(
    event: AppMentionEvent,
    say: (message: string | object) => Promise<unknown>,
  ): Promise<void> {
    const userId = event.user;
    const channelId = event.channel;
    const text = event.text;
    const threadTs = event.thread_ts || event.ts;

    if (this.config.debug) {
      console.log(
        `[SlackAdapter] Mention from ${userId} in ${channelId}: ${text}`,
      );
    }

    try {
      // Strip the mention from the text
      const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

      if (!cleanText) {
        // Just mentioned with no message - send greeting
        await say({
          text: VP_RESPONSES.greeting(this.orchestratorName),
          thread_ts: threadTs,
        });
        return;
      }

      // Process through triage engine if available
      if (this.triageEngine) {
        const result = await this.triageEngine.processRequest({
          userId,
          channelId,
          message: cleanText,
          threadTs,
          timestamp: event.ts,
        });

        await say({
          text: this.formatVPResponse(result.response),
          thread_ts: threadTs,
        });
      } else {
        const ack = this.getRandomAcknowledgment();
        await say({
          text: ack,
          thread_ts: threadTs,
        });
      }
    } catch (error) {
      console.error('[SlackAdapter] Error handling mention:', error);
      await say({
        text: VP_RESPONSES.error,
        thread_ts: threadTs,
      });
    }
  }

  /**
   * Handle slash commands (/orchestrator-status, /orchestrator-queue)
   */
  private async handleSlashCommand(
    command: SlashCommand,
    respond: (message: string | object) => Promise<unknown>,
    type: 'status' | 'queue',
  ): Promise<void> {
    if (this.config.debug) {
      console.log(
        `[SlackAdapter] Slash command /${type} from ${command.user_id}`,
      );
    }

    try {
      switch (type) {
        case 'status': {
          // Get Orchestrator status information
          const statusBlocks = await this.buildStatusBlocks();
          await respond({
            blocks: statusBlocks,
            response_type: 'ephemeral', // Only visible to the user
          });
          break;
        }

        case 'queue': {
          // Get queue status
          if (this.triageEngine) {
            const queueStatus = await this.triageEngine.getQueueStatus();
            await respond({
              text: VP_RESPONSES.queueStatus(queueStatus),
              response_type: 'ephemeral',
            });
          } else {
            await respond({
              text: 'Queue status unavailable - triage engine not connected.',
              response_type: 'ephemeral',
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error(`[SlackAdapter] Error handling /${type} command:`, error);
      await respond({
        text: VP_RESPONSES.error,
        response_type: 'ephemeral',
      });
    }
  }

  /**
   * Send a text message to a channel
   */
  async sendMessage(
    channelId: string,
    text: string,
    thread_ts?: string,
  ): Promise<void> {
    if (!this.app) {
      throw new Error('SlackAdapter not initialized');
    }

    await this.app.client.chat.postMessage({
      token: this.config.botToken,
      channel: channelId,
      text: this.formatVPResponse(text),
      thread_ts,
    });
  }

  /**
   * Send Block Kit blocks to a channel
   */
  async sendBlocks(
    channelId: string,
    blocks: Block[],
    thread_ts?: string,
  ): Promise<void> {
    if (!this.app) {
      throw new Error('SlackAdapter not initialized');
    }

    await this.app.client.chat.postMessage({
      token: this.config.botToken,
      channel: channelId,
      blocks,
      thread_ts,
    });
  }

  /**
   * Build status blocks for /orchestrator-status command
   */
  private async buildStatusBlocks(): Promise<Block[]> {
    const availability = this.sessionManager
      ? await this.sessionManager.getAvailability()
      : { available: 0, total: 0 };

    const queueStatus = this.triageEngine
      ? await this.triageEngine.getQueueStatus()
      : {
          totalInQueue: 0,
          urgentCount: 0,
          averageWaitTime: 0,
          activeSlots: 0,
          maxSlots: 0,
        };

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${this.orchestratorName} Status`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:*\n${this.isRunning ? ':large_green_circle: Online' : ':red_circle: Offline'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Available Slots:*\n${availability.available}/${availability.total}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Queue Length:*\n${queueStatus.totalInQueue}`,
          },
          {
            type: 'mrkdwn',
            text: `*Urgent Items:*\n${queueStatus.urgentCount}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Avg Wait Time:*\n${Math.round(queueStatus.averageWaitTime / 60)} min`,
          },
          {
            type: 'mrkdwn',
            text: `*Active Sessions:*\n${queueStatus.activeSlots}/${queueStatus.maxSlots}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Last updated: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ] as Block[];
  }

  /**
   * Format response in Orchestrator persona/tone
   */
  private formatVPResponse(text: string): string {
    // Add Orchestrator signature style if not already present
    if (!text.startsWith('*') && !text.startsWith(':')) {
      return text;
    }
    return text;
  }

  /**
   * Get a random acknowledgment message for variety
   */
  private getRandomAcknowledgment(): string {
    const index = Math.floor(
      Math.random() * VP_RESPONSES.acknowledgment.length,
    );
    return VP_RESPONSES.acknowledgment[index];
  }

  /**
   * Check if adapter is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the Orchestrator name/persona
   */
  getVPName(): string {
    return this.orchestratorName;
  }
}

export default SlackAdapter;
