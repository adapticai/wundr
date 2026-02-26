/**
 * @neolith/core - CommunicationHub
 *
 * Unified outbound messaging interface that wraps all communication channels
 * (email, SMS, WhatsApp, internal agent messages). Provides a single entry
 * point for dispatching messages with automatic fallback channel support.
 *
 * @packageDocumentation
 */

import { emailService } from './email-service';
import { getTwilioService } from './twilio-service';
import { getAgentChannelService } from './agent-channel-service';

// =============================================================================
// Types
// =============================================================================

export type CommunicationChannel =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'voice'
  | 'slack'
  | 'internal';

export interface UnifiedOutboundMessage {
  channel: CommunicationChannel;
  orchestratorId: string;
  /** Agent/user ID for internal channel messages */
  recipientId?: string;
  /** Email address or phone number for external channels */
  recipientAddress?: string;
  /** Subject line for email messages */
  subject?: string;
  content: string;
  metadata?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Ordered list of channels to try if the primary channel fails */
  fallbackChannels?: CommunicationChannel[];
}

export interface DeliveryResult {
  success: boolean;
  channel: CommunicationChannel;
  /** Internal message ID (email, internal) */
  messageId?: string;
  /** External provider ID (Twilio SID) */
  externalId?: string;
  sentAt?: Date;
  error?: string;
  fallbackUsed?: boolean;
  fallbackChannel?: CommunicationChannel;
}

export interface ChannelHealth {
  channel: CommunicationChannel;
  available: boolean;
  latencyMs?: number;
  lastError?: string;
}

// =============================================================================
// Error Classes
// =============================================================================

export class CommunicationHubError extends Error {
  constructor(
    message: string,
    public channel?: CommunicationChannel,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CommunicationHubError';
  }
}

// =============================================================================
// ICommunicationHub Interface
// =============================================================================

export interface ICommunicationHub {
  /**
   * Send a single message through the specified channel with optional fallback.
   */
  send(message: UnifiedOutboundMessage): Promise<DeliveryResult>;

  /**
   * Broadcast a message to multiple recipients via the internal channel.
   *
   * @param orchestratorId - The orchestrator sending the broadcast
   * @param recipientIds - Agent/user IDs to send to
   * @param content - Message body
   * @param channel - Override channel (defaults to 'internal')
   */
  broadcast(
    orchestratorId: string,
    recipientIds: string[],
    content: string,
    channel?: CommunicationChannel
  ): Promise<DeliveryResult[]>;

  /**
   * Get the delivery status for a previously sent message.
   *
   * @param messageId - The message/SID returned from send
   * @param channel - The channel the message was sent through
   * @returns DeliveryResult if found, null otherwise
   */
  getDeliveryStatus(
    messageId: string,
    channel: CommunicationChannel
  ): Promise<DeliveryResult | null>;

  /**
   * Check availability of all supported channels.
   */
  getChannelHealth(): Promise<ChannelHealth[]>;
}

// =============================================================================
// CommunicationHubImpl
// =============================================================================

class CommunicationHubImpl implements ICommunicationHub {
  async send(message: UnifiedOutboundMessage): Promise<DeliveryResult> {
    try {
      return await this.sendViaChannel(message);
    } catch (primaryError) {
      if (message.fallbackChannels?.length) {
        for (const fallbackChannel of message.fallbackChannels) {
          try {
            const result = await this.sendViaChannel({
              ...message,
              channel: fallbackChannel,
            });
            return { ...result, fallbackUsed: true, fallbackChannel };
          } catch {
            continue;
          }
        }
      }

      const errorMessage =
        primaryError instanceof Error
          ? primaryError.message
          : String(primaryError);
      return { success: false, channel: message.channel, error: errorMessage };
    }
  }

  private async sendViaChannel(
    message: UnifiedOutboundMessage
  ): Promise<DeliveryResult> {
    switch (message.channel) {
      case 'email': {
        if (!message.recipientAddress) {
          throw new CommunicationHubError(
            'recipientAddress is required for email channel',
            'email'
          );
        }
        const result = await emailService.sendEmail(message.orchestratorId, {
          to: message.recipientAddress,
          subject: message.subject ?? 'Message from Wundr',
          body: message.content,
          metadata: message.metadata,
        });
        return {
          success: true,
          channel: 'email',
          messageId: result.messageId,
          sentAt: new Date(),
        };
      }

      case 'sms': {
        if (!message.recipientAddress) {
          throw new CommunicationHubError(
            'recipientAddress is required for sms channel',
            'sms'
          );
        }
        const result = await getTwilioService().sendSMS(
          message.orchestratorId,
          {
            to: message.recipientAddress,
            body: message.content,
            metadata: message.metadata,
          }
        );
        return {
          success: true,
          channel: 'sms',
          externalId: result.sid,
          sentAt: new Date(),
        };
      }

      case 'whatsapp': {
        if (!message.recipientAddress) {
          throw new CommunicationHubError(
            'recipientAddress is required for whatsapp channel',
            'whatsapp'
          );
        }
        const result = await getTwilioService().sendWhatsApp(
          message.orchestratorId,
          {
            to: message.recipientAddress,
            body: message.content,
          }
        );
        return {
          success: true,
          channel: 'whatsapp',
          externalId: result.sid,
          sentAt: new Date(),
        };
      }

      case 'internal': {
        if (!message.recipientId) {
          throw new CommunicationHubError(
            'recipientId is required for internal channel',
            'internal'
          );
        }
        const msg = await getAgentChannelService().sendAgentMessage(
          message.orchestratorId,
          message.recipientId,
          message.content
        );
        return {
          success: true,
          channel: 'internal',
          messageId: msg.id,
          sentAt: new Date(),
        };
      }

      default:
        throw new CommunicationHubError(
          `Unsupported channel: ${message.channel}`,
          message.channel
        );
    }
  }

  async broadcast(
    orchestratorId: string,
    recipientIds: string[],
    content: string,
    channel: CommunicationChannel = 'internal'
  ): Promise<DeliveryResult[]> {
    const results = await Promise.allSettled(
      recipientIds.map(recipientId =>
        this.send({ channel, orchestratorId, recipientId, content })
      )
    );

    return results.map((result, index): DeliveryResult => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const err = result.reason;
      return {
        success: false,
        channel,
        recipientId: recipientIds[index],
        error: err instanceof Error ? err.message : String(err),
      } as DeliveryResult;
    });
  }

  async getDeliveryStatus(
    messageId: string,
    channel: CommunicationChannel
  ): Promise<DeliveryResult | null> {
    switch (channel) {
      case 'email': {
        const status = await emailService.getDeliveryStatus(messageId);
        if (!status) return null;
        return {
          success: status.status !== 'failed',
          channel: 'email',
          messageId: status.messageId,
          sentAt: status.sentAt,
        };
      }

      case 'sms':
      case 'whatsapp': {
        const status = await getTwilioService().getMessageStatus(messageId);
        if (!status) return null;
        return {
          success:
            status.status !== 'failed' && status.status !== 'undelivered',
          channel,
          externalId: status.sid,
          sentAt: status.sentAt,
        };
      }

      default:
        return null;
    }
  }

  async getChannelHealth(): Promise<ChannelHealth[]> {
    const checks: Array<{
      channel: CommunicationChannel;
      check: () => Promise<void>;
    }> = [
      {
        channel: 'email',
        check: async () => {
          await emailService.listSentEmails('health-check', { limit: 0 });
        },
      },
      {
        channel: 'sms',
        check: async () => {
          await getTwilioService().getMessageStatus('health-check');
        },
      },
      {
        channel: 'whatsapp',
        check: async () => {
          await getTwilioService().getMessageStatus('health-check');
        },
      },
      {
        channel: 'internal',
        check: async () => {
          await getAgentChannelService().listAgentChannels('health-check');
        },
      },
    ];

    const results = await Promise.all(
      checks.map(async ({ channel, check }): Promise<ChannelHealth> => {
        const start = Date.now();
        try {
          await check();
          return { channel, available: true, latencyMs: Date.now() - start };
        } catch (err) {
          return {
            channel,
            available: false,
            latencyMs: Date.now() - start,
            lastError: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    return results;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new CommunicationHub instance.
 *
 * @returns ICommunicationHub instance
 *
 * @example
 * ```typescript
 * const hub = createCommunicationHub();
 *
 * const result = await hub.send({
 *   channel: 'email',
 *   orchestratorId: 'orch_123',
 *   recipientAddress: 'user@example.com',
 *   subject: 'Task update',
 *   content: 'Your task has been completed.',
 *   fallbackChannels: ['sms'],
 * });
 * ```
 */
export function createCommunicationHub(): ICommunicationHub {
  return new CommunicationHubImpl();
}

/**
 * Default CommunicationHub singleton.
 */
export const getCommunicationHub = (() => {
  let instance: ICommunicationHub | null = null;
  return (): ICommunicationHub => {
    if (!instance) {
      instance = createCommunicationHub();
    }
    return instance;
  };
})();
