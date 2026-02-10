/**
 * Terminal (CLI) Channel Adapter
 *
 * A local-only channel adapter that uses Node.js readline for interactive
 * terminal I/O. Intended for:
 * - Local development and debugging
 * - Testing message routing and session management
 * - CLI-based agent interactions
 *
 * This adapter has no external dependencies and is always available.
 *
 * @packageDocumentation
 */

import * as readline from 'node:readline';

import { BaseChannelAdapter } from '../types.js';

import type {
  ChannelCapabilities,
  ChannelConfig,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelMeta,
  ChatType,
  DeliveryResult,
  NormalizedMessage,
  OutboundMessage,
  PairingConfig,
  SenderValidation,
} from '../types.js';

// ---------------------------------------------------------------------------
// Terminal-Specific Configuration
// ---------------------------------------------------------------------------

export interface TerminalChannelConfig extends ChannelConfig {
  /** Display name for the terminal user. */
  readonly userName?: string;
  /** User ID for the terminal user. */
  readonly userId?: string;
  /** Prompt string shown before user input. */
  readonly prompt?: string;
  /** Whether to show timestamps on messages. */
  readonly showTimestamps?: boolean;
  /** Whether to use colors in output. */
  readonly useColors?: boolean;
  /** Conversation ID for this terminal session. */
  readonly conversationId?: string;
}

// ---------------------------------------------------------------------------
// TerminalChannelAdapter
// ---------------------------------------------------------------------------

export class TerminalChannelAdapter extends BaseChannelAdapter {
  readonly id = 'terminal' as const;

  readonly meta: ChannelMeta = {
    id: 'terminal',
    label: 'Terminal',
    blurb: 'Local CLI channel for development and testing.',
    aliases: ['cli', 'tty', 'console'],
    order: 90,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct'],
    reactions: false,
    threads: false,
    media: false,
    edit: false,
    delete: false,
    typingIndicators: false,
    readReceipts: false,
    maxMessageLength: 0, // Unlimited
    maxMediaBytes: -1, // Unsupported
  };

  private rl: readline.Interface | null = null;
  private terminalConfig: TerminalChannelConfig | null = null;
  private messageCounter = 0;
  private lastMessageAt: Date | null = null;
  private conversationId = 'terminal:local';

  constructor(logger?: ChannelLogger) {
    super(logger);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(config: ChannelConfig): Promise<void> {
    if (this.connected) {
      this.logger.debug('Terminal adapter already connected, skipping.');
      return;
    }

    const terminalConfig = config as TerminalChannelConfig;
    this.terminalConfig = terminalConfig;
    this.conversationId =
      terminalConfig.conversationId ?? 'terminal:local';

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: terminalConfig.prompt ?? '> ',
    });

    this.setupEventHandlers();

    this.connected = true;
    this.config = config;

    const useColors = terminalConfig.useColors ?? true;
    const banner = useColors
      ? '\x1b[36m--- Wundr Terminal Channel ---\x1b[0m'
      : '--- Wundr Terminal Channel ---';

    process.stdout.write(`\n${banner}\n`);
    process.stdout.write(
      'Type messages to interact with the Orchestrator. Ctrl+C to exit.\n\n',
    );

    this.rl.prompt();

    this.emit('connected', { channelId: this.id });

    this.logger.info('Terminal adapter connected.');
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.rl) {
      return;
    }

    this.rl.close();
    this.rl = null;
    this.connected = false;

    process.stdout.write('\n--- Terminal Channel disconnected ---\n');

    this.emit('disconnected', { channelId: this.id });

    this.logger.info('Terminal adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    return {
      channelId: this.id,
      healthy: this.connected,
      connected: this.connected,
      lastMessageAt: this.lastMessageAt ?? undefined,
      details: {
        messageCount: this.messageCounter,
        ttyConnected: process.stdin.isTTY ?? false,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    if (!this.connected) {
      return { ok: false, error: 'Terminal adapter not connected.' };
    }

    const config = this.terminalConfig;
    const useColors = config?.useColors ?? true;
    const showTimestamps = config?.showTimestamps ?? false;

    const timestamp = showTimestamps
      ? `[${new Date().toLocaleTimeString()}] `
      : '';

    const prefix = useColors
      ? `\x1b[32m${timestamp}Orchestrator:\x1b[0m `
      : `${timestamp}Orchestrator: `;

    // Clear the current line and write the response.
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    const lines = message.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        process.stdout.write(`${prefix}${lines[i]}\n`);
      } else {
        const indent = ' '.repeat(
          showTimestamps
            ? timestamp.length + 'Orchestrator: '.length
            : 'Orchestrator: '.length,
        );
        process.stdout.write(`${indent}${lines[i]}\n`);
      }
    }

    // Re-show the prompt.
    if (this.rl) {
      this.rl.prompt();
    }

    this.messageCounter++;

    return {
      ok: true,
      messageId: `terminal:${this.messageCounter}`,
      conversationId: this.conversationId,
      timestamp: new Date(),
    };
  }

  // -----------------------------------------------------------------------
  // Security / Pairing
  // -----------------------------------------------------------------------

  async validateSender(
    _senderId: string,
    _chatType: ChatType,
  ): Promise<SenderValidation> {
    // Terminal is always local, always allowed.
    return { allowed: true };
  }

  getPairingConfig(): PairingConfig | null {
    // No pairing needed for local terminal.
    return null;
  }

  // -----------------------------------------------------------------------
  // Event Setup
  // -----------------------------------------------------------------------

  private setupEventHandlers(): void {
    if (!this.rl) {
return;
}

    this.rl.on('line', (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      // Handle special terminal commands.
      if (trimmed.startsWith('/')) {
        this.handleTerminalCommand(trimmed);
        return;
      }

      this.messageCounter++;
      this.lastMessageAt = new Date();

      const config = this.terminalConfig;
      const userId = config?.userId ?? 'terminal-user';
      const userName = config?.userName ?? 'User';

      const message: NormalizedMessage = {
        id: `terminal:${this.messageCounter}`,
        channelId: this.id,
        platformMessageId: `${this.messageCounter}`,
        conversationId: this.conversationId,
        sender: {
          id: userId,
          displayName: userName,
          username: userId,
          isSelf: false,
          isBot: false,
        },
        content: {
          text: trimmed,
          rawText: trimmed,
          attachments: [],
          mentions: [],
          mentionsSelf: false,
        },
        timestamp: new Date(),
        chatType: 'direct',
        raw: { type: 'terminal_input', text: trimmed },
      };

      this.emit('message', message);
    });

    this.rl.on('close', () => {
      if (this.connected) {
        this.connected = false;
        this.emit('disconnected', { channelId: this.id });
      }
    });
  }

  /**
   * Handle terminal-specific slash commands.
   */
  private handleTerminalCommand(input: string): void {
    const parts = input.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase();

    switch (command) {
      case 'quit':
      case 'exit':
        process.stdout.write('Exiting terminal channel...\n');
        void this.disconnect();
        break;

      case 'health':
        void this.healthCheck().then((status) => {
          process.stdout.write(
            `Health: ${JSON.stringify(status, null, 2)}\n`,
          );
          this.rl?.prompt();
        });
        break;

      case 'clear':
        process.stdout.write('\x1b[2J\x1b[H');
        this.rl?.prompt();
        break;

      case 'help':
        process.stdout.write(
          [
            'Terminal commands:',
            '  /help    - Show this help message',
            '  /health  - Show adapter health status',
            '  /clear   - Clear the terminal',
            '  /quit    - Disconnect and exit',
            '',
          ].join('\n'),
        );
        this.rl?.prompt();
        break;

      default:
        process.stdout.write(`Unknown command: /${command}. Type /help for available commands.\n`);
        this.rl?.prompt();
        break;
    }
  }
}
