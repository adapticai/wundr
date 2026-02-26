/**
 * Twilio Communication Adapter
 *
 * Implements the ChannelPlugin interface for Twilio, providing:
 *
 * - SMS messaging (outbound, inbound webhook handling)
 * - Voice calls (outbound initiation, inbound TwiML responses)
 * - WhatsApp messaging via Twilio's WhatsApp sandbox/business API
 * - Phone number provisioning and release via Twilio REST API
 * - Webhook signature validation (Twilio Request Validator)
 * - Multi-number routing based on capabilities and assignedTo
 *
 * Uses the Twilio REST API directly via fetch — no twilio npm package required.
 * API base: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/
 *
 * Design follows the same BaseChannelAdapter pattern as the Slack and Telegram
 * adapters: normalized I/O, capabilities-gated methods, event emission, and
 * idempotent lifecycle management.
 *
 * @packageDocumentation
 */

import { BaseChannelAdapter } from '../types.js';

import type {
  ChannelCapabilities,
  ChannelConfig,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelMeta,
  ChatType,
  DeliveryResult,
  MessageContent,
  NormalizedAttachment,
  NormalizedMessage,
  NormalizedSender,
  OutboundMessage,
  PairingConfig,
  SenderValidation,
} from '../types.js';

// ---------------------------------------------------------------------------
// Twilio-Specific Configuration
// ---------------------------------------------------------------------------

/**
 * A single Twilio phone number with its capabilities and optional assignment.
 */
export interface TwilioPhoneNumber {
  /** Phone number in E.164 format (e.g. +14155552671). */
  readonly number: string;
  /** Twilio Phone Number SID (e.g. PNxxxx). */
  readonly sid: string;
  /** Communication capabilities this number supports. */
  readonly capabilities: ('voice' | 'sms' | 'whatsapp')[];
  /** Orchestrator ID this number is dedicated to, if any. */
  readonly assignedTo?: string;
}

/**
 * Configuration for the Twilio channel adapter.
 * Extends the base ChannelConfig with Twilio-specific fields.
 */
export interface TwilioConfig extends ChannelConfig {
  /** Twilio Account SID (starts with AC). */
  readonly accountSid: string;
  /** Twilio Auth Token. */
  readonly authToken: string;
  /** Phone numbers owned / managed by this account. */
  readonly phoneNumbers: TwilioPhoneNumber[];
  /** Default number to send from when no from is specified. */
  readonly defaultFromNumber?: string;
  /** Base URL used to construct webhook URLs (e.g. https://myapp.example.com). */
  readonly webhookBaseUrl: string;
  /** Twilio TwiML App SID (optional, used for programmatic voice). */
  readonly twimlAppSid?: string;
  /** DM allow-list: phone numbers (+E.164) allowed to message without approval. */
  readonly dmAllowList?: readonly string[];
  /** Maximum retries on Twilio API rate-limit (429). Defaults to 3. */
  readonly maxRetries?: number;
}

// ---------------------------------------------------------------------------
// TwiML Generation Options
// ---------------------------------------------------------------------------

/**
 * Options for generating a TwiML response document.
 */
export interface TwiMLOptions {
  /** Text to say via TTS. */
  say?: string;
  /** Language/voice for TTS (e.g. "en-US", "alice"). */
  voice?: string;
  /** Language for TTS (default "en"). */
  language?: string;
  /** Gather speech or DTMF input. */
  gather?: {
    /** Webhook URL to POST gathered digits/speech. */
    action: string;
    /** Input type: "speech", "dtmf", or "speech dtmf". */
    input?: string;
    /** Timeout in seconds waiting for input. */
    timeout?: number;
    /** Prompt to say while gathering. */
    say?: string;
  };
  /** Dial a number or conference. */
  dial?: {
    /** Number to dial. */
    number: string;
    /** Caller ID to present. */
    callerId?: string;
  };
  /** Redirect to a different TwiML URL. */
  redirect?: string;
  /** Hang up the call. */
  hangup?: boolean;
  /** Play an audio URL. */
  play?: string;
  /** Pause in seconds. */
  pause?: number;
}

// ---------------------------------------------------------------------------
// Twilio API Response Shapes
// ---------------------------------------------------------------------------

interface TwilioMessageResponse {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string;
  date_created: string;
  error_code?: number | null;
  error_message?: string | null;
}

interface TwilioCallResponse {
  sid: string;
  to: string;
  from: string;
  status: string;
  date_created: string;
}

interface TwilioAvailableNumber {
  phone_number: string;
  friendly_name: string;
  region: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
  phone_number_sid?: string;
}

interface TwilioIncomingNumberResponse {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

// ---------------------------------------------------------------------------
// Webhook Payload Shapes
// ---------------------------------------------------------------------------

/**
 * Normalized webhook data from Twilio for SMS/WhatsApp events.
 */
export interface TwilioSmsWebhookData {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  [key: string]: string | undefined;
}

/**
 * Normalized webhook data from Twilio for voice call events.
 */
export interface TwilioVoiceWebhookData {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Twilio REST API base URL template. */
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

/** SMS max character length (Twilio auto-splits, but we log). */
const SMS_MAX_LENGTH = 1600;

/** WhatsApp max message length. */
const WHATSAPP_MAX_LENGTH = 4096;

/** Twilio webhook signature header name. */
const TWILIO_SIGNATURE_HEADER = 'X-Twilio-Signature';

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

/**
 * Simple retry-on-429 rate limiter for Twilio API calls.
 */
class TwilioRateLimiter {
  private readonly maxRetries: number;
  private readonly logger: ChannelLogger;

  constructor(maxRetries: number, logger: ChannelLogger) {
    this.maxRetries = maxRetries;
    this.logger = logger;
  }

  async execute<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const retryAfterSec = extractRetryAfterSec(err);
        if (retryAfterSec > 0 && attempt < this.maxRetries) {
          this.logger.warn(
            `Twilio rate limited on ${label}: retrying after ${retryAfterSec}s (attempt ${attempt + 1}/${this.maxRetries}).`,
          );
          await sleep(retryAfterSec * 1000);
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }
}

// ---------------------------------------------------------------------------
// TwilioChannelAdapter
// ---------------------------------------------------------------------------

/**
 * Twilio channel adapter for SMS, Voice, and WhatsApp messaging.
 *
 * @example
 * ```typescript
 * const twilio = new TwilioChannelAdapter();
 * await twilio.connect({
 *   enabled: true,
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   webhookBaseUrl: 'https://my-app.example.com',
 *   phoneNumbers: [
 *     {
 *       number: '+14155552671',
 *       sid: 'PN...',
 *       capabilities: ['sms', 'voice'],
 *     },
 *   ],
 * });
 *
 * // Send an SMS
 * await twilio.sendSMS('+19995551234', 'Hello from the Orchestrator!');
 *
 * // Listen for inbound messages
 * twilio.on('message', (msg) => console.log(msg.content.text));
 * ```
 */
export class TwilioChannelAdapter extends BaseChannelAdapter {
  readonly id = 'twilio' as const;

  readonly meta: ChannelMeta = {
    id: 'twilio',
    label: 'Twilio',
    blurb: 'Twilio SMS, Voice, and WhatsApp communication adapter.',
    aliases: ['sms', 'whatsapp-twilio', 'phone'],
    order: 40,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct'],
    reactions: false,
    threads: false,
    media: true,
    edit: false,
    delete: false,
    typingIndicators: false,
    readReceipts: false,
    maxMessageLength: SMS_MAX_LENGTH,
    maxMediaBytes: 5_242_880, // Twilio MMS: 5 MB
  };

  private twilioConfig: TwilioConfig | null = null;
  private rateLimiter: TwilioRateLimiter | null = null;
  private lastMessageAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastError: string | null = null;

  constructor(logger?: ChannelLogger) {
    super(logger);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async connect(config: ChannelConfig): Promise<void> {
    if (this.connected) {
      this.logger.debug('Twilio adapter already connected, skipping.');
      return;
    }

    const twilioConfig = config as TwilioConfig;

    if (!twilioConfig.accountSid || !twilioConfig.authToken) {
      throw new Error('Twilio adapter requires accountSid and authToken.');
    }
    if (!twilioConfig.webhookBaseUrl) {
      throw new Error('Twilio adapter requires webhookBaseUrl.');
    }
    if (!twilioConfig.phoneNumbers || twilioConfig.phoneNumbers.length === 0) {
      throw new Error(
        'Twilio adapter requires at least one phoneNumbers entry.',
      );
    }

    this.twilioConfig = twilioConfig;
    this.rateLimiter = new TwilioRateLimiter(
      twilioConfig.maxRetries ?? 3,
      this.logger,
    );

    // Validate credentials with a lightweight account fetch.
    try {
      await this.fetchAccountInfo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.lastErrorAt = new Date();
      throw new Error(`Twilio adapter credential check failed: ${msg}`);
    }

    this.connected = true;
    this.config = config;

    this.logger.info(
      `Twilio adapter connected (accountSid: ${twilioConfig.accountSid}, numbers: ${twilioConfig.phoneNumbers.map((n) => n.number).join(', ')}).`,
    );

    this.emit('connected', {
      channelId: this.id,
      accountId: twilioConfig.accountSid,
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.twilioConfig = null;
    this.rateLimiter = null;

    this.emit('disconnected', { channelId: this.id });
    this.logger.info('Twilio adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    if (!this.connected || !this.twilioConfig) {
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: this.lastError ?? 'Not connected',
        lastErrorAt: this.lastErrorAt ?? undefined,
      };
    }

    try {
      const start = Date.now();
      await this.fetchAccountInfo();
      const latencyMs = Date.now() - start;
      return {
        channelId: this.id,
        healthy: true,
        connected: true,
        latencyMs,
        accountId: this.twilioConfig.accountSid,
        lastMessageAt: this.lastMessageAt ?? undefined,
        lastErrorAt: this.lastErrorAt ?? undefined,
        details: {
          phoneNumbers: this.twilioConfig.phoneNumbers.map((n) => n.number),
          webhookBaseUrl: this.twilioConfig.webhookBaseUrl,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.lastErrorAt = new Date();
      return {
        channelId: this.id,
        healthy: false,
        connected: false,
        lastError: msg,
        lastErrorAt: this.lastErrorAt,
      };
    }
  }

  // ==========================================================================
  // ChannelPlugin: sendMessage (unified outbound entry point)
  // ==========================================================================

  /**
   * Send a message through the appropriate Twilio channel (SMS or WhatsApp)
   * based on the `to` address format.
   *
   * - If `to` starts with "whatsapp:", treated as WhatsApp.
   * - Otherwise, treated as SMS.
   *
   * The `accountId` field on the OutboundMessage can specify which phone number
   * (from the configured phoneNumbers list) to use as the sender.
   */
  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    const isWhatsApp = message.to.startsWith('whatsapp:');
    if (isWhatsApp) {
      return this.sendWhatsApp(message.to, message.text, message.accountId);
    }
    return this.sendSMS(message.to, message.text, message.accountId);
  }

  // ==========================================================================
  // SMS Methods
  // ==========================================================================

  /**
   * Send an SMS message via Twilio.
   *
   * @param to - Recipient phone number in E.164 format.
   * @param body - Message text.
   * @param from - Sender number in E.164. Defaults to the configured defaultFromNumber
   *               or the first number with SMS capability.
   */
  async sendSMS(to: string, body: string, from?: string): Promise<DeliveryResult> {
    this.requireConnected();

    const fromNumber = this.resolveFromNumber(from, 'sms');
    if (!fromNumber) {
      return {
        ok: false,
        error: 'No SMS-capable phone number configured.',
      };
    }

    try {
      const response = await this.withRateLimit('messages', () =>
        this.twilioPost<TwilioMessageResponse>('Messages.json', {
          To: to,
          From: fromNumber,
          Body: body,
        }),
      );

      if (response.error_code) {
        this.logger.error(
          `Twilio SMS error ${response.error_code}: ${response.error_message}`,
        );
        return {
          ok: false,
          error: `Twilio error ${response.error_code}: ${response.error_message}`,
        };
      }

      this.logger.info(
        `Twilio SMS sent: SID=${response.sid} to=${to} from=${fromNumber}`,
      );

      return {
        ok: true,
        messageId: response.sid,
        conversationId: to,
        timestamp: new Date(response.date_created),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.lastErrorAt = new Date();
      return { ok: false, error: msg };
    }
  }

  /**
   * Process an incoming SMS from a Twilio webhook POST body.
   * Emits a normalized "message" event on the adapter.
   *
   * @param webhookData - The parsed form-encoded body from Twilio's webhook.
   * @returns The normalized message, or null if the payload is invalid.
   */
  handleIncomingSMS(webhookData: TwilioSmsWebhookData): NormalizedMessage | null {
    if (!webhookData.MessageSid || !webhookData.From || !webhookData.To) {
      this.logger.warn('Twilio handleIncomingSMS: missing required fields.');
      return null;
    }

    const message = this.normalizeInboundSMS(webhookData, 'sms');
    if (message) {
      this.lastMessageAt = new Date();
      this.emit('message', message);
    }
    return message;
  }

  // ==========================================================================
  // Voice Methods
  // ==========================================================================

  /**
   * Initiate an outbound voice call via Twilio.
   *
   * @param to - Destination phone number in E.164 format.
   * @param twimlUrl - URL that Twilio will fetch to get TwiML instructions for the call.
   * @param from - Caller ID in E.164. Defaults to configured defaultFromNumber.
   */
  async makeCall(to: string, twimlUrl: string, from?: string): Promise<DeliveryResult> {
    this.requireConnected();

    const fromNumber = this.resolveFromNumber(from, 'voice');
    if (!fromNumber) {
      return {
        ok: false,
        error: 'No voice-capable phone number configured.',
      };
    }

    try {
      const response = await this.withRateLimit('calls', () =>
        this.twilioPost<TwilioCallResponse>('Calls.json', {
          To: to,
          From: fromNumber,
          Url: twimlUrl,
        }),
      );

      this.logger.info(
        `Twilio call initiated: SID=${response.sid} to=${to} from=${fromNumber}`,
      );

      return {
        ok: true,
        messageId: response.sid,
        conversationId: to,
        timestamp: new Date(response.date_created),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.lastErrorAt = new Date();
      return { ok: false, error: msg };
    }
  }

  /**
   * Generate a TwiML XML response for an incoming call webhook.
   * Returns a TwiML string and emits a "message" event for routing.
   *
   * @param webhookData - The parsed form-encoded body from Twilio's voice webhook.
   * @param twimlOptions - TwiML instructions to embed (defaults to a simple greeting).
   * @returns TwiML XML string to return to Twilio.
   */
  handleIncomingCall(
    webhookData: TwilioVoiceWebhookData,
    twimlOptions?: TwiMLOptions,
  ): string {
    if (!webhookData.CallSid || !webhookData.From) {
      this.logger.warn('Twilio handleIncomingCall: missing required fields.');
      return this.generateTwiML({ say: 'Sorry, an error occurred.', hangup: true });
    }

    // Emit a "message" event so the orchestrator can respond.
    const message = this.normalizeInboundCall(webhookData);
    if (message) {
      this.lastMessageAt = new Date();
      this.emit('message', message);
    }

    // Return TwiML. The caller can intercept via event handlers if needed.
    const options = twimlOptions ?? {
      say: 'Hello! You have reached the Orchestrator. Please leave a message.',
      hangup: true,
    };
    return this.generateTwiML(options);
  }

  /**
   * Generate a TwiML XML document from structured options.
   *
   * @param options - TwiML verb options.
   * @returns TwiML XML string ready to return as the HTTP response body.
   */
  generateTwiML(options: TwiMLOptions): string {
    const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<Response>'];

    if (options.pause) {
      parts.push(`  <Pause length="${options.pause}"/>`);
    }

    if (options.play) {
      parts.push(`  <Play>${escapeTwiMLText(options.play)}</Play>`);
    }

    if (options.gather) {
      const g = options.gather;
      const attrs: string[] = [`action="${escapeTwiMLAttr(g.action)}"`];
      if (g.input) {
        attrs.push(`input="${escapeTwiMLAttr(g.input)}"`);
      }
      if (g.timeout !== undefined) {
        attrs.push(`timeout="${g.timeout}"`);
      }

      if (g.say) {
        const voice = options.voice ? ` voice="${escapeTwiMLAttr(options.voice)}"` : '';
        const lang = options.language ? ` language="${escapeTwiMLAttr(options.language)}"` : '';
        parts.push(`  <Gather ${attrs.join(' ')}>`);
        parts.push(`    <Say${voice}${lang}>${escapeTwiMLText(g.say)}</Say>`);
        parts.push('  </Gather>');
      } else {
        parts.push(`  <Gather ${attrs.join(' ')}/>`);
      }
    } else if (options.say) {
      const voice = options.voice ? ` voice="${escapeTwiMLAttr(options.voice)}"` : '';
      const lang = options.language ? ` language="${escapeTwiMLAttr(options.language)}"` : '';
      parts.push(`  <Say${voice}${lang}>${escapeTwiMLText(options.say)}</Say>`);
    }

    if (options.dial) {
      const callerId = options.dial.callerId
        ? ` callerId="${escapeTwiMLAttr(options.dial.callerId)}"`
        : '';
      parts.push(
        `  <Dial${callerId}><Number>${escapeTwiMLText(options.dial.number)}</Number></Dial>`,
      );
    }

    if (options.redirect) {
      parts.push(`  <Redirect>${escapeTwiMLText(options.redirect)}</Redirect>`);
    }

    if (options.hangup) {
      parts.push('  <Hangup/>');
    }

    parts.push('</Response>');
    return parts.join('\n');
  }

  // ==========================================================================
  // WhatsApp Methods
  // ==========================================================================

  /**
   * Send a WhatsApp message via Twilio.
   * The `to` address must include the "whatsapp:" prefix.
   *
   * @param to - Recipient in WhatsApp format: "whatsapp:+14155552671".
   * @param body - Message text.
   * @param from - Sender WhatsApp number. Defaults to the first WhatsApp-capable number.
   */
  async sendWhatsApp(to: string, body: string, from?: string): Promise<DeliveryResult> {
    this.requireConnected();

    const fromNumber = this.resolveFromNumber(from, 'whatsapp');
    if (!fromNumber) {
      return {
        ok: false,
        error: 'No WhatsApp-capable phone number configured.',
      };
    }

    // Ensure whatsapp: prefix on both sides.
    const normalizedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const normalizedFrom = fromNumber.startsWith('whatsapp:')
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    try {
      const response = await this.withRateLimit('whatsapp', () =>
        this.twilioPost<TwilioMessageResponse>('Messages.json', {
          To: normalizedTo,
          From: normalizedFrom,
          Body: body,
        }),
      );

      if (response.error_code) {
        return {
          ok: false,
          error: `Twilio error ${response.error_code}: ${response.error_message}`,
        };
      }

      this.logger.info(
        `Twilio WhatsApp sent: SID=${response.sid} to=${normalizedTo}`,
      );

      return {
        ok: true,
        messageId: response.sid,
        conversationId: normalizedTo,
        timestamp: new Date(response.date_created),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.lastErrorAt = new Date();
      return { ok: false, error: msg };
    }
  }

  /**
   * Process an incoming WhatsApp message from a Twilio webhook POST body.
   * Emits a normalized "message" event on the adapter.
   *
   * @param webhookData - The parsed form-encoded body from Twilio's WhatsApp webhook.
   * @returns The normalized message, or null if the payload is invalid.
   */
  handleIncomingWhatsApp(webhookData: TwilioSmsWebhookData): NormalizedMessage | null {
    if (!webhookData.MessageSid || !webhookData.From || !webhookData.To) {
      this.logger.warn('Twilio handleIncomingWhatsApp: missing required fields.');
      return null;
    }

    const message = this.normalizeInboundSMS(webhookData, 'whatsapp');
    if (message) {
      this.lastMessageAt = new Date();
      this.emit('message', message);
    }
    return message;
  }

  // ==========================================================================
  // Phone Number Provisioning
  // ==========================================================================

  /**
   * Search for available phone numbers to purchase.
   *
   * @param countryCode - ISO 3166-1 alpha-2 country code (e.g. "US", "GB").
   * @param areaCode - Optional area code filter (US/CA only).
   * @returns List of available numbers with their capabilities.
   */
  async listAvailableNumbers(
    countryCode: string,
    areaCode?: string,
  ): Promise<TwilioAvailableNumber[]> {
    this.requireConnected();

    const params = new URLSearchParams({ SmsEnabled: 'true' });
    if (areaCode) {
      params.set('AreaCode', areaCode);
    }

    try {
      const url = this.buildApiUrl(
        `AvailablePhoneNumbers/${countryCode.toUpperCase()}/Local.json?${params.toString()}`,
      );
      const response = await this.withRateLimit('available-numbers', () =>
        this.twilioGet<{ available_phone_numbers: TwilioAvailableNumber[] }>(url),
      );
      return response.available_phone_numbers ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio listAvailableNumbers failed: ${msg}`);
      throw err;
    }
  }

  /**
   * Purchase a phone number via the Twilio API and add it to the local config.
   *
   * @param countryCode - ISO 3166-1 alpha-2 country code.
   * @param areaCode - Optional area code (US/CA only).
   * @param capabilities - Capabilities to request. Defaults to ['sms', 'voice'].
   * @returns The provisioned phone number record.
   */
  async provisionNumber(
    countryCode: string,
    areaCode?: string,
    capabilities: ('voice' | 'sms' | 'whatsapp')[] = ['sms', 'voice'],
  ): Promise<TwilioPhoneNumber> {
    this.requireConnected();
    const config = this.requireConfig();

    // Find an available number first.
    const available = await this.listAvailableNumbers(countryCode, areaCode);
    if (available.length === 0) {
      throw new Error(
        `No available numbers found for country=${countryCode}${areaCode ? `, areaCode=${areaCode}` : ''}.`,
      );
    }

    const target = available[0];

    // Purchase the number.
    const webhookBase = config.webhookBaseUrl.replace(/\/$/, '');
    const purchased = await this.withRateLimit('provision', () =>
      this.twilioPost<TwilioIncomingNumberResponse>('IncomingPhoneNumbers.json', {
        PhoneNumber: target.phone_number,
        SmsUrl: `${webhookBase}/webhooks/twilio/sms`,
        SmsMethod: 'POST',
        VoiceUrl: `${webhookBase}/webhooks/twilio/voice`,
        VoiceMethod: 'POST',
        StatusCallback: `${webhookBase}/webhooks/twilio/status`,
      }),
    );

    const provisioned: TwilioPhoneNumber = {
      number: purchased.phone_number,
      sid: purchased.sid,
      capabilities,
    };

    this.logger.info(
      `Twilio provisioned number: ${purchased.phone_number} (SID: ${purchased.sid})`,
    );

    return provisioned;
  }

  /**
   * Release (delete) a phone number from the Twilio account.
   *
   * @param phoneSid - The SID of the IncomingPhoneNumber resource to release.
   */
  async releaseNumber(phoneSid: string): Promise<void> {
    this.requireConnected();

    try {
      await this.withRateLimit('release', () =>
        this.twilioDelete(`IncomingPhoneNumbers/${phoneSid}.json`),
      );
      this.logger.info(`Twilio released number SID: ${phoneSid}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio releaseNumber failed for ${phoneSid}: ${msg}`);
      throw err;
    }
  }

  // ==========================================================================
  // Webhook Handling
  // ==========================================================================

  /**
   * Validate a Twilio webhook request using HMAC-SHA1 signature verification.
   *
   * Twilio computes the signature as:
   *   HMAC-SHA1(authToken, url + sorted(POST_params))
   *
   * @param signature - The X-Twilio-Signature header value.
   * @param url - The full URL that received the request.
   * @param params - The POST body parameters as a key-value object.
   * @returns True if the signature is valid.
   */
  async validateWebhook(
    signature: string,
    url: string,
    params: Record<string, string>,
  ): Promise<boolean> {
    if (!this.twilioConfig?.authToken) {
      return false;
    }

    try {
      const crypto = await importNodeCrypto();
      const authToken = this.twilioConfig.authToken;

      // Build the data string: URL + sorted param key-value pairs concatenated.
      const sortedKeys = Object.keys(params).sort();
      const paramString = sortedKeys
        .map((key) => `${key}${params[key]}`)
        .join('');
      const dataString = url + paramString;

      const hmac = crypto
        .createHmac('sha1', authToken)
        .update(dataString, 'utf8')
        .digest('base64');

      return hmac === signature;
    } catch (err) {
      this.logger.error(
        `Twilio validateWebhook crypto error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Route an incoming Twilio webhook to the appropriate handler based on type.
   *
   * @param type - The webhook type: "sms", "whatsapp", or "voice".
   * @param data - The parsed POST body from the webhook.
   * @returns For voice webhooks, returns TwiML XML. For others, returns the
   *          normalized message (or null).
   */
  routeWebhook(
    type: 'sms' | 'whatsapp' | 'voice',
    data: TwilioSmsWebhookData | TwilioVoiceWebhookData,
  ): NormalizedMessage | string | null {
    switch (type) {
      case 'sms':
        return this.handleIncomingSMS(data as TwilioSmsWebhookData);
      case 'whatsapp':
        return this.handleIncomingWhatsApp(data as TwilioSmsWebhookData);
      case 'voice':
        return this.handleIncomingCall(data as TwilioVoiceWebhookData);
      default:
        this.logger.warn(`Twilio routeWebhook: unknown type "${type}"`);
        return null;
    }
  }

  // ==========================================================================
  // Security / Pairing
  // ==========================================================================

  async validateSender(
    senderId: string,
    _chatType: ChatType,
  ): Promise<SenderValidation> {
    const config = this.twilioConfig;
    if (!config?.pairing?.requireApproval) {
      return { allowed: true };
    }

    const allowList = config.dmAllowList ?? config.pairing.allowList ?? [];
    const normalized = normalizeE164(senderId);
    const isAllowed = allowList.some(
      (entry) => normalizeE164(entry) === normalized,
    );

    return isAllowed
      ? { allowed: true }
      : {
          allowed: false,
          reason: 'Sender not in Twilio allow-list.',
          pendingApproval: true,
        };
  }

  getPairingConfig(): PairingConfig | null {
    const config = this.twilioConfig;
    if (!config?.pairing) {
      return null;
    }
    return {
      requireApproval: config.pairing.requireApproval,
      allowList: config.dmAllowList ?? config.pairing.allowList ?? [],
      normalizeEntry: normalizeE164,
    };
  }

  // ==========================================================================
  // Internal: Message Normalization
  // ==========================================================================

  private normalizeInboundSMS(
    data: TwilioSmsWebhookData,
    mode: 'sms' | 'whatsapp',
  ): NormalizedMessage | null {
    const from = data.From;
    const to = data.To;
    const body = data.Body ?? '';

    if (!from || !to) {
      return null;
    }

    const attachments = this.extractTwilioMediaAttachments(data);

    const sender: NormalizedSender = {
      id: from,
      displayName: from,
      isSelf: false,
      isBot: false,
    };

    const content: MessageContent = {
      text: body,
      rawText: body,
      attachments,
      mentions: [],
      mentionsSelf: false,
    };

    return {
      id: `twilio:${data.MessageSid}`,
      channelId: this.id,
      platformMessageId: data.MessageSid,
      conversationId: from,
      sender,
      content,
      timestamp: new Date(),
      chatType: 'direct',
      raw: data,
    };
  }

  private normalizeInboundCall(
    data: TwilioVoiceWebhookData,
  ): NormalizedMessage | null {
    const from = data.From;
    if (!from) {
      return null;
    }

    const sender: NormalizedSender = {
      id: from,
      displayName: from,
      isSelf: false,
      isBot: false,
    };

    const content: MessageContent = {
      text: `[incoming call] from ${from} status=${data.CallStatus ?? 'unknown'}`,
      rawText: `CallSid=${data.CallSid}`,
      attachments: [],
      mentions: [],
      mentionsSelf: false,
    };

    return {
      id: `twilio:call:${data.CallSid}`,
      channelId: this.id,
      platformMessageId: data.CallSid,
      conversationId: from,
      sender,
      content,
      timestamp: new Date(),
      chatType: 'direct',
      raw: data,
    };
  }

  private extractTwilioMediaAttachments(
    data: TwilioSmsWebhookData,
  ): NormalizedAttachment[] {
    const numMedia = parseInt(data.NumMedia ?? '0', 10);
    if (!numMedia || numMedia <= 0) {
      return [];
    }

    const attachments: NormalizedAttachment[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = data[`MediaUrl${i}`];
      const mimeType = data[`MediaContentType${i}`];
      if (!url) {
        continue;
      }
      attachments.push({
        type: resolveAttachmentType(mimeType),
        filename: `media-${i}${mimeTypeToExtension(mimeType)}`,
        mimeType,
        url,
      });
    }
    return attachments;
  }

  // ==========================================================================
  // Internal: Number Selection
  // ==========================================================================

  /**
   * Resolve the from phone number to use for a given capability.
   * Priority: explicit `from` arg > defaultFromNumber > first capable number.
   */
  private resolveFromNumber(
    from: string | undefined,
    capability: 'sms' | 'voice' | 'whatsapp',
  ): string | null {
    const config = this.twilioConfig;
    if (!config) {
      return null;
    }

    // Strip whatsapp: prefix for lookup, re-apply if needed.
    const stripPrefix = (n: string) =>
      n.startsWith('whatsapp:') ? n.slice('whatsapp:'.length) : n;

    if (from) {
      const rawFrom = stripPrefix(from);
      const found = config.phoneNumbers.find(
        (n) => n.number === rawFrom || n.number === from,
      );
      if (found && found.capabilities.includes(capability)) {
        return found.number;
      }
      // Caller provided an explicit number; trust it even if not in config.
      return stripPrefix(from);
    }

    if (config.defaultFromNumber) {
      return stripPrefix(config.defaultFromNumber);
    }

    // Auto-select the first number with the required capability.
    const capable = config.phoneNumbers.find((n) =>
      n.capabilities.includes(capability),
    );
    return capable?.number ?? null;
  }

  // ==========================================================================
  // Internal: Twilio REST API Helpers
  // ==========================================================================

  private buildApiUrl(path: string): string {
    const config = this.requireConfig();
    return `${TWILIO_API_BASE}/${config.accountSid}/${path}`;
  }

  private buildAuthHeader(): string {
    const config = this.requireConfig();
    const credentials = `${config.accountSid}:${config.authToken}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  private async twilioPost<T>(path: string, body: Record<string, string>): Promise<T> {
    const url = this.buildApiUrl(path);
    const formBody = new URLSearchParams(body).toString();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.buildAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody,
    });

    if (!response.ok) {
      const errorBody = await safeParseJson<{
        code?: number;
        message?: string;
        status?: number;
      }>(response);
      const twilioCode = errorBody?.code ?? response.status;
      const twilioMessage = errorBody?.message ?? response.statusText;
      const err = new TwilioApiError(
        `Twilio API error ${twilioCode}: ${twilioMessage}`,
        response.status,
        twilioCode,
      );
      throw err;
    }

    return response.json() as Promise<T>;
  }

  private async twilioGet<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: this.buildAuthHeader(),
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await safeParseJson<{
        code?: number;
        message?: string;
      }>(response);
      throw new TwilioApiError(
        `Twilio API error ${response.status}: ${errorBody?.message ?? response.statusText}`,
        response.status,
        errorBody?.code,
      );
    }

    return response.json() as Promise<T>;
  }

  private async twilioDelete(path: string): Promise<void> {
    const url = this.buildApiUrl(path);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: this.buildAuthHeader(),
      },
    });

    if (!response.ok && response.status !== 204) {
      const errorBody = await safeParseJson<{
        code?: number;
        message?: string;
      }>(response);
      throw new TwilioApiError(
        `Twilio DELETE error ${response.status}: ${errorBody?.message ?? response.statusText}`,
        response.status,
        errorBody?.code,
      );
    }
  }

  private async fetchAccountInfo(): Promise<void> {
    const config = this.requireConfig();
    const url = `${TWILIO_API_BASE}/${config.accountSid}.json`;
    await this.twilioGet<{ sid: string }>(url);
  }

  private async withRateLimit<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!this.rateLimiter) {
      return fn();
    }
    return this.rateLimiter.execute(label, fn);
  }

  // ==========================================================================
  // Internal: Guards
  // ==========================================================================

  private requireConnected(): void {
    if (!this.connected || !this.twilioConfig) {
      throw new Error(
        'Twilio adapter is not connected. Call connect() first.',
      );
    }
  }

  private requireConfig(): TwilioConfig {
    if (!this.twilioConfig) {
      throw new Error(
        'Twilio adapter is not connected. Call connect() first.',
      );
    }
    return this.twilioConfig;
  }
}

// ---------------------------------------------------------------------------
// TwilioApiError
// ---------------------------------------------------------------------------

/**
 * Custom error class that carries the Twilio HTTP status and error code.
 * Used by the rate limiter to detect 429 responses.
 */
class TwilioApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly twilioCode?: number,
  ) {
    super(message);
    this.name = 'TwilioApiError';
  }
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the Retry-After value in seconds from a Twilio 429 error.
 */
function extractRetryAfterSec(err: unknown): number {
  if (err instanceof TwilioApiError && err.httpStatus === 429) {
    // Default 1-second backoff on rate limit.
    return 1;
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const headers = obj.headers as Record<string, string> | undefined;
    if (headers?.['retry-after']) {
      const parsed = parseInt(headers['retry-after'], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a phone number to a canonical form for allow-list comparison.
 * Strips whitespace and whatsapp: prefix; keeps E.164 format.
 */
function normalizeE164(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^whatsapp:/i, '');
}

/**
 * Resolve a MIME type to a normalized attachment type.
 */
function resolveAttachmentType(
  mimeType?: string,
): 'image' | 'video' | 'audio' | 'file' {
  if (!mimeType) {
    return 'file';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}

/**
 * Map a MIME type to a file extension for attachment filename generation.
 */
function mimeTypeToExtension(mimeType?: string): string {
  if (!mimeType) {
    return '';
  }
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/amr': '.amr',
    'application/pdf': '.pdf',
  };
  return map[mimeType] ?? '';
}

/**
 * Escape text content for embedding inside TwiML XML elements.
 */
function escapeTwiMLText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape attribute values in TwiML XML.
 */
function escapeTwiMLAttr(value: string): string {
  return escapeTwiMLText(value);
}

/**
 * Attempt to parse a Response body as JSON. Returns null on failure.
 */
async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Dynamic import of Node.js crypto for webhook signature validation.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
async function importNodeCrypto(): Promise<typeof import('crypto')> {
  return await import('crypto');
}

// ---------------------------------------------------------------------------
// Re-export header constant for use in Express/Fastify route handlers
// ---------------------------------------------------------------------------
export { TWILIO_SIGNATURE_HEADER, WHATSAPP_MAX_LENGTH, SMS_MAX_LENGTH };
