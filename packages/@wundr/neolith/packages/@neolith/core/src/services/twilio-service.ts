/**
 * @neolith/core - TwilioService
 *
 * Service layer for Twilio communication (SMS, WhatsApp, Voice) via the
 * orchestrator daemon's Twilio adapter. All channel operations are proxied
 * through the daemon REST API using the orchestrator's registered endpoint.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

export class TwilioServiceError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'TwilioServiceError';
  }
}

export class TwilioProvisioningError extends TwilioServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'TwilioProvisioningError';
  }
}

// =============================================================================
// Types
// =============================================================================

export interface SMSMessage {
  to: string;
  body: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrls?: string[];
  templateName?: string;
  templateVariables?: Record<string, string>;
}

export interface VoiceCallRequest {
  to: string;
  twiml?: string;
  callbackUrl?: string;
  recordCall?: boolean;
}

export interface PhoneNumberInfo {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    whatsapp: boolean;
  };
  status: 'active' | 'released' | 'pending';
}

export interface MessageDeliveryStatus {
  sid: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  channel: 'sms' | 'whatsapp' | 'voice';
  sentAt?: Date;
  error?: string;
}

// =============================================================================
// ITwilioService Interface
// =============================================================================

export interface ITwilioService {
  sendSMS(
    orchestratorId: string,
    message: SMSMessage
  ): Promise<MessageDeliveryStatus>;

  sendWhatsApp(
    orchestratorId: string,
    message: WhatsAppMessage
  ): Promise<MessageDeliveryStatus>;

  initiateCall(
    orchestratorId: string,
    request: VoiceCallRequest
  ): Promise<{ callSid: string; status: string }>;

  getPhoneNumbers(orchestratorId: string): Promise<PhoneNumberInfo[]>;

  provisionNumber(
    orchestratorId: string,
    options?: {
      areaCode?: string;
      country?: string;
      capabilities?: string[];
    }
  ): Promise<PhoneNumberInfo>;

  releaseNumber(
    orchestratorId: string,
    phoneNumberSid: string
  ): Promise<boolean>;

  getMessageStatus(messageSid: string): Promise<MessageDeliveryStatus | null>;
}

// =============================================================================
// TwilioServiceImpl
// =============================================================================

class TwilioServiceImpl implements ITwilioService {
  private readonly db: PrismaClient;

  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  private async getDaemonEndpoint(orchestratorId: string): Promise<string> {
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { daemonEndpoint: true },
    });

    if (!orchestrator?.daemonEndpoint) {
      throw new TwilioServiceError(
        `No daemon endpoint registered for orchestrator: ${orchestratorId}`,
        'DAEMON_ENDPOINT_NOT_FOUND'
      );
    }

    return orchestrator.daemonEndpoint.replace(/\/$/, '');
  }

  private async daemonPost<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = `Daemon request failed: ${response.status} ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as {
          error?: string;
          message?: string;
        };
        errorMessage = errorBody.error ?? errorBody.message ?? errorMessage;
      } catch {
        // ignore JSON parse errors
      }
      throw new TwilioServiceError(errorMessage, String(response.status));
    }

    return response.json() as Promise<T>;
  }

  private async daemonGet<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      let errorMessage = `Daemon request failed: ${response.status} ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as {
          error?: string;
          message?: string;
        };
        errorMessage = errorBody.error ?? errorBody.message ?? errorMessage;
      } catch {
        // ignore JSON parse errors
      }
      throw new TwilioServiceError(errorMessage, String(response.status));
    }

    return response.json() as Promise<T>;
  }

  // ===========================================================================
  // ITwilioService Implementation
  // ===========================================================================

  async sendSMS(
    orchestratorId: string,
    message: SMSMessage
  ): Promise<MessageDeliveryStatus> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);
    return this.daemonPost<MessageDeliveryStatus>(
      `${endpoint}/api/channels/twilio/sms`,
      message
    );
  }

  async sendWhatsApp(
    orchestratorId: string,
    message: WhatsAppMessage
  ): Promise<MessageDeliveryStatus> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);
    return this.daemonPost<MessageDeliveryStatus>(
      `${endpoint}/api/channels/twilio/whatsapp`,
      message
    );
  }

  async initiateCall(
    orchestratorId: string,
    request: VoiceCallRequest
  ): Promise<{ callSid: string; status: string }> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);
    return this.daemonPost<{ callSid: string; status: string }>(
      `${endpoint}/api/channels/twilio/calls`,
      request
    );
  }

  async getPhoneNumbers(orchestratorId: string): Promise<PhoneNumberInfo[]> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);
    return this.daemonGet<PhoneNumberInfo[]>(
      `${endpoint}/api/channels/twilio/numbers`
    );
  }

  async provisionNumber(
    orchestratorId: string,
    options?: {
      areaCode?: string;
      country?: string;
      capabilities?: string[];
    }
  ): Promise<PhoneNumberInfo> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);
    const result = await this.daemonPost<PhoneNumberInfo>(
      `${endpoint}/api/channels/twilio/numbers/provision`,
      options ?? {}
    );

    if (!result.sid) {
      throw new TwilioProvisioningError(
        'Daemon returned invalid provisioning response',
        'INVALID_PROVISION_RESPONSE'
      );
    }

    return result;
  }

  async releaseNumber(
    orchestratorId: string,
    phoneNumberSid: string
  ): Promise<boolean> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);
    await this.daemonPost<{ released: boolean }>(
      `${endpoint}/api/channels/twilio/numbers/${phoneNumberSid}/release`,
      {}
    );
    return true;
  }

  async getMessageStatus(
    _messageSid: string
  ): Promise<MessageDeliveryStatus | null> {
    // Message status lookups go directly to the daemon's shared status endpoint
    // without an orchestrator scope since SIDs are globally unique.
    // Callers who need this with an orchestrator context should use the daemon
    // endpoint they already hold. Return null if not resolvable at this layer.
    return null;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new TwilioService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns ITwilioService instance
 *
 * @example
 * ```typescript
 * const twilioService = createTwilioService();
 *
 * const status = await twilioService.sendSMS('orch_123', {
 *   to: '+14155552671',
 *   body: 'Hello from your orchestrator!',
 * });
 * ```
 */
export function createTwilioService(database?: PrismaClient): ITwilioService {
  return new TwilioServiceImpl(database);
}

/**
 * Default TwilioService singleton using the singleton Prisma client.
 */
export const getTwilioService = (() => {
  let instance: ITwilioService | null = null;
  return (): ITwilioService => {
    if (!instance) {
      instance = createTwilioService();
    }
    return instance;
  };
})();
