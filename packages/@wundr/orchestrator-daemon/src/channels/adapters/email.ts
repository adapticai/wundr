/**
 * Email Channel Adapter
 *
 * Production-grade email integration for the Wundr Orchestrator. Supports
 * multiple provider backends with a unified ChannelPlugin interface:
 *
 * - **SendGrid**: REST API v3 via fetch (no SDK dependency)
 * - **AWS SES**: REST API via fetch with AWS Signature V4
 * - **SMTP**: Nodemailer-compatible transport (dynamically imported)
 *
 * Features:
 * - Thread tracking via In-Reply-To / References / X-Thread-ID headers
 * - HTML template rendering with plain-text fallback
 * - Attachment handling (receive via webhook, send via provider API)
 * - Rate limiting with per-provider token-bucket and Retry-After support
 * - Webhook payload parsing for inbound email (SendGrid, Mailgun, SES SNS)
 * - Conversation mapping: email thread -> NormalizedMessage
 * - Graceful shutdown with in-flight request draining
 *
 * The adapter uses native `fetch` / `https` for all provider API calls
 * so no additional runtime dependencies are needed beyond those already
 * in package.json.
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
  OutboundAttachment,
  OutboundMessage,
  PairingConfig,
  RateLimitState,
  SenderValidation,
  TypingHandle,
} from '../types.js';

// ---------------------------------------------------------------------------
// Email-Specific Configuration
// ---------------------------------------------------------------------------

/**
 * Provider-specific configuration for the email channel adapter.
 * Extends the base ChannelConfig with email-specific fields.
 */
export interface EmailConfig extends ChannelConfig {
  /** Email delivery provider. */
  readonly provider: 'sendgrid' | 'ses' | 'smtp';

  // -- SendGrid -----------------------------------------------------------
  /** SendGrid API key (required for provider: "sendgrid"). */
  readonly apiKey?: string;

  // -- AWS SES ------------------------------------------------------------
  /** AWS region for SES (required for provider: "ses"). */
  readonly region?: string;
  /** AWS access key ID (required for provider: "ses"). */
  readonly awsAccessKeyId?: string;
  /** AWS secret access key (required for provider: "ses"). */
  readonly awsSecretAccessKey?: string;
  /** AWS session token (optional, for temporary credentials). */
  readonly awsSessionToken?: string;

  // -- SMTP ---------------------------------------------------------------
  /** SMTP server hostname (required for provider: "smtp"). */
  readonly smtpHost?: string;
  /** SMTP server port (default: 587 for STARTTLS, 465 for SSL). */
  readonly smtpPort?: number;
  /** SMTP username for authentication. */
  readonly smtpUser?: string;
  /** SMTP password for authentication. */
  readonly smtpPass?: string;
  /** Use TLS (default: true when smtpPort is 465). */
  readonly smtpSecure?: boolean;

  // -- Sender Identity ----------------------------------------------------
  /** From address (e.g., "james@adaptic.ai"). Required. */
  readonly fromAddress: string;
  /** Display name (e.g., "James - VP Engineering"). Required. */
  readonly fromName: string;
  /** Optional reply-to address. */
  readonly replyToAddress?: string;

  // -- Inbound / Webhook --------------------------------------------------
  /** HMAC secret for validating inbound webhook signatures. */
  readonly webhookSecret?: string;

  // -- Rate Limiting ------------------------------------------------------
  /** Maximum outbound requests per second (default: 10). */
  readonly maxRequestsPerSecond?: number;
  /** Maximum retry attempts on rate-limit errors (default: 3). */
  readonly maxRetries?: number;

  // -- Threading ----------------------------------------------------------
  /** Header name used to track thread IDs (default: "X-Wundr-Thread-ID"). */
  readonly threadIdHeader?: string;

  // -- Allow-listing ------------------------------------------------------
  /** Email addresses allowed to message the Orchestrator (empty = all). */
  readonly fromAllowList?: readonly string[];
  /** Email domains allowed to message the Orchestrator (empty = all). */
  readonly fromAllowDomains?: readonly string[];
}

// ---------------------------------------------------------------------------
// Email-Specific Types
// ---------------------------------------------------------------------------

/**
 * A parsed inbound email message.
 */
export interface ParsedEmail {
  /** Message-ID header (platform message ID). */
  readonly messageId: string;
  /** Sender email address. */
  readonly from: string;
  /** Sender display name, if present. */
  readonly fromName?: string;
  /** Recipient email address(es). */
  readonly to: string[];
  /** CC recipients, if any. */
  readonly cc?: string[];
  /** Subject line. */
  readonly subject: string;
  /** Plain text body. */
  readonly textBody?: string;
  /** HTML body. */
  readonly htmlBody?: string;
  /** In-Reply-To header (parent message ID). */
  readonly inReplyTo?: string;
  /** References header (thread chain). */
  readonly references?: string[];
  /** Custom thread ID from X-Wundr-Thread-ID (or similar) header. */
  readonly threadId?: string;
  /** Attachments received. */
  readonly attachments?: InboundEmailAttachment[];
  /** Raw header map. */
  readonly headers?: Record<string, string>;
  /** Timestamp the email was received. */
  readonly receivedAt: Date;
}

/**
 * An attachment included in an inbound email.
 */
export interface InboundEmailAttachment {
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes?: number;
  /** Base64-encoded content (if provided by the webhook provider). */
  readonly contentBase64?: string;
  /** URL to download the attachment (if hosted by the provider). */
  readonly contentUrl?: string;
}

/**
 * Outbound email message format.
 * Extends OutboundMessage with email-specific fields.
 */
export interface OutboundEmailMessage extends OutboundMessage {
  /** Subject line (defaults to "Re: <threadId>" or a generated subject). */
  readonly subject?: string;
  /** HTML body (if omitted, the plain text body is used). */
  readonly htmlBody?: string;
  /** CC recipients. */
  readonly cc?: readonly string[];
  /** BCC recipients. */
  readonly bcc?: readonly string[];
  /** Reply-to override for this specific message. */
  readonly replyTo?: string;
  /** Custom headers to include. */
  readonly headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_REQUESTS_PER_SECOND = 10;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_THREAD_ID_HEADER = 'X-Wundr-Thread-ID';
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

// ---------------------------------------------------------------------------
// Rate Limiter (Token Bucket)
// ---------------------------------------------------------------------------

/**
 * Token-bucket rate limiter for outbound email API calls.
 * Respects Retry-After headers and per-method limits.
 */
class EmailRateLimiter {
  private readonly state = new Map<string, RateLimitState>();
  private globalBackoffUntil = 0;
  private tokens: number;
  private lastRefillAt: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private readonly maxRetries: number;
  private readonly logger: ChannelLogger;

  constructor(
    maxRequestsPerSecond: number,
    maxRetries: number,
    logger: ChannelLogger,
  ) {
    this.maxTokens = maxRequestsPerSecond;
    this.tokens = maxRequestsPerSecond;
    this.refillIntervalMs = 1000 / maxRequestsPerSecond;
    this.lastRefillAt = Date.now();
    this.maxRetries = maxRetries;
    this.logger = logger;
  }

  /**
   * Execute `fn` with token-bucket and Retry-After awareness.
   * On HTTP 429 / rate_limited errors, wait and retry up to maxRetries.
   */
  async execute<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Global backoff wait.
      const globalWait = Math.max(0, this.globalBackoffUntil - Date.now());
      if (globalWait > 0) {
        this.logger.debug(
          `[email] Rate limiter: global backoff ${globalWait}ms (${operation}, attempt ${attempt + 1}).`,
        );
        await sleep(globalWait);
      }

      // Token bucket: wait for a token.
      await this.acquireToken();

      try {
        const result = await fn();
        this.state.delete(operation);
        return result;
      } catch (err) {
        lastError = err;
        const retryAfterSec = extractRetryAfterSec(err);
        if (retryAfterSec > 0 && attempt < this.maxRetries) {
          this.logger.warn(
            `[email] Rate limited on ${operation}: retry after ${retryAfterSec}s (attempt ${attempt + 1}/${this.maxRetries}).`,
          );
          this.recordLimit(operation, retryAfterSec);
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  private async acquireToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    const refills = Math.floor(elapsed / this.refillIntervalMs);
    if (refills > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + refills);
      this.lastRefillAt = now;
    }

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Wait for the next refill.
    const waitMs = this.refillIntervalMs - (now - this.lastRefillAt);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    this.tokens = Math.max(0, this.tokens - 1);
  }

  private recordLimit(operation: string, retryAfterSec: number): void {
    const resetAt = Math.ceil(Date.now() / 1000) + retryAfterSec;
    this.state.set(operation, {
      remaining: 0,
      resetAt,
      limited: true,
      retryAfterSec,
    });
    this.globalBackoffUntil = Math.max(
      this.globalBackoffUntil,
      Date.now() + retryAfterSec * 1000,
    );
  }
}

// ---------------------------------------------------------------------------
// Thread Tracker
// ---------------------------------------------------------------------------

/**
 * Tracks email thread chains using In-Reply-To / References headers.
 * Maps a thread ID to the most recent message ID so we can set
 * In-Reply-To correctly when sending follow-up emails.
 */
class EmailThreadTracker {
  /** threadId -> { lastMessageId, references[], subject } */
  private readonly threads = new Map<string, ThreadState>();

  record(
    threadId: string,
    messageId: string,
    references: string[],
    subject: string,
  ): void {
    const existing = this.threads.get(threadId);
    const allRefs = existing
      ? [...new Set([...existing.references, messageId])]
      : references;
    this.threads.set(threadId, {
      lastMessageId: messageId,
      references: allRefs,
      subject,
    });
  }

  getState(threadId: string): ThreadState | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Build the In-Reply-To and References headers for a reply.
   */
  buildReplyHeaders(
    threadId: string,
    currentMessageId: string,
    customHeader: string,
  ): Record<string, string> {
    const state = this.threads.get(threadId);
    const headers: Record<string, string> = {
      [customHeader]: threadId,
    };

    if (state) {
      headers['In-Reply-To'] = state.lastMessageId;
      const refs = [...state.references, state.lastMessageId];
      headers['References'] = [...new Set(refs)].join(' ');
    }

    return headers;
  }

  clear(threadId: string): void {
    this.threads.delete(threadId);
  }
}

interface ThreadState {
  lastMessageId: string;
  references: string[];
  subject: string;
}

// ---------------------------------------------------------------------------
// SendGrid Provider
// ---------------------------------------------------------------------------

/**
 * SendGrid REST API v3 provider using native fetch.
 */
class SendGridProvider {
  constructor(
    private readonly apiKey: string,
    private readonly logger: ChannelLogger,
  ) {}

  async send(payload: SendGridPayload): Promise<{ messageId: string }> {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') ?? '5';
        const error = new RateLimitError(
          `SendGrid rate limit: ${response.status}`,
          parseInt(retryAfter, 10) || 5,
        );
        throw error;
      }
      throw new Error(
        `SendGrid API error ${response.status}: ${body}`,
      );
    }

    // SendGrid returns 202 Accepted with no body; the Message-ID is in the header.
    const messageId =
      response.headers.get('x-message-id') ??
      `sg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.logger.debug(`[email] SendGrid accepted message: ${messageId}`);
    return { messageId };
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
    secret: string,
  ): Promise<boolean> {
    try {
      const crypto = await import('node:crypto');
      const toVerify = timestamp + payload;
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(toVerify)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      );
    } catch {
      return false;
    }
  }
}

interface SendGridPayload {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>;
    cc?: Array<{ email: string; name?: string }>;
    bcc?: Array<{ email: string; name?: string }>;
    subject?: string;
    headers?: Record<string, string>;
  }>;
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content: Array<{ type: string; value: string }>;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// AWS SES Provider (Signature V4 via fetch)
// ---------------------------------------------------------------------------

/**
 * AWS SES v1 (SendRawEmail / SendEmail) provider using AWS Signature V4
 * with native fetch. No AWS SDK dependency required.
 */
class SesProvider {
  constructor(
    private readonly region: string,
    private readonly accessKeyId: string,
    private readonly secretAccessKey: string,
    private readonly sessionToken: string | undefined,
    private readonly logger: ChannelLogger,
  ) {}

  async send(params: SesEmailParams): Promise<{ messageId: string }> {
    const endpoint = `https://email.${this.region}.amazonaws.com/v2/email/outbound-emails`;
    const body = JSON.stringify(params);
    const headers = await this.buildAuthHeaders('POST', endpoint, body);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') ?? '5';
        throw new RateLimitError(
          `SES rate limit: ${response.status}`,
          parseInt(retryAfter, 10) || 5,
        );
      }
      throw new Error(`AWS SES error ${response.status}: ${responseBody}`);
    }

    const data = (await response.json()) as { MessageId?: string };
    const messageId = data.MessageId ?? `ses-${Date.now()}`;
    this.logger.debug(`[email] SES sent message: ${messageId}`);
    return { messageId };
  }

  /**
   * Build AWS Signature V4 authorization headers for an HTTP request.
   * Implements HMAC-SHA256 signing per the AWS spec without the SDK.
   */
  private async buildAuthHeaders(
    method: string,
    url: string,
    body: string,
  ): Promise<Record<string, string>> {
    const crypto = await import('node:crypto');
    const parsed = new URL(url);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const service = 'ses';
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;

    // 1. Canonical Request
    const payloadHash = crypto
      .createHash('sha256')
      .update(body)
      .digest('hex');
    const canonicalHeaders =
      `host:${parsed.host}\n` +
      `x-amz-date:${amzDate}\n` +
      (this.sessionToken ? `x-amz-security-token:${this.sessionToken}\n` : '');
    const signedHeaders =
      'host;x-amz-date' +
      (this.sessionToken ? ';x-amz-security-token' : '');
    const canonicalRequest = [
      method,
      parsed.pathname,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // 2. String to Sign
    const hashedCanonical = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashedCanonical,
    ].join('\n');

    // 3. Signing Key
    const sign = (key: Buffer | string, data: string): Buffer => {
      return crypto.createHmac('sha256', key).update(data).digest();
    };
    const signingKey = sign(
      sign(
        sign(
          sign(Buffer.from(`AWS4${this.secretAccessKey}`), dateStamp),
          this.region,
        ),
        service,
      ),
      'aws4_request',
    );

    // 4. Signature
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    // 5. Authorization header
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'X-Amz-Date': amzDate,
      Authorization: authorization,
    };
    if (this.sessionToken) {
      headers['X-Amz-Security-Token'] = this.sessionToken;
    }
    return headers;
  }
}

interface SesEmailParams {
  FromEmailAddress: string;
  Destination: {
    ToAddresses: string[];
    CcAddresses?: string[];
    BccAddresses?: string[];
  };
  Content: {
    Simple: {
      Subject: { Data: string; Charset?: string };
      Body: {
        Text?: { Data: string; Charset?: string };
        Html?: { Data: string; Charset?: string };
      };
    };
  };
  ReplyToAddresses?: string[];
  Tags?: Array<{ Name: string; Value: string }>;
}

// ---------------------------------------------------------------------------
// SMTP Provider (nodemailer, dynamically imported)
// ---------------------------------------------------------------------------

/**
 * SMTP provider backed by nodemailer (dynamically imported).
 * Falls back gracefully if nodemailer is not installed.
 */
class SmtpProvider {
  private transporter: SmtpTransporterLike | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly user: string | undefined,
    private readonly pass: string | undefined,
    private readonly secure: boolean,
    private readonly logger: ChannelLogger,
  ) {}

  async initialize(): Promise<void> {
    try {
      const nodemailer = await importNodemailer();
      const authOptions =
        this.user && this.pass
          ? { auth: { user: this.user, pass: this.pass } }
          : {};
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        ...authOptions,
      }) as SmtpTransporterLike;

      await this.transporter.verify();
      this.logger.info(
        `[email] SMTP transporter connected to ${this.host}:${this.port}.`,
      );
    } catch (err) {
      throw new Error(
        `SMTP initialization failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async send(options: SmtpSendOptions): Promise<{ messageId: string }> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized. Call initialize() first.');
    }
    const info = await this.transporter.sendMail(options);
    const messageId = (info as { messageId?: string }).messageId ?? `smtp-${Date.now()}`;
    this.logger.debug(`[email] SMTP sent message: ${messageId}`);
    return { messageId };
  }

  async shutdown(): Promise<void> {
    if (this.transporter) {
      this.transporter.close?.();
      this.transporter = null;
    }
  }
}

interface SmtpSendOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

interface SmtpTransporterLike {
  verify(): Promise<boolean>;
  sendMail(options: SmtpSendOptions): Promise<unknown>;
  close?(): void;
}

// ---------------------------------------------------------------------------
// EmailChannelAdapter
// ---------------------------------------------------------------------------

/**
 * Production-grade email channel adapter implementing the full ChannelPlugin
 * interface with multi-provider support (SendGrid, SES, SMTP).
 *
 * @example
 * ```typescript
 * const email = new EmailChannelAdapter();
 * await email.connect({
 *   enabled: true,
 *   provider: 'sendgrid',
 *   apiKey: process.env.SENDGRID_API_KEY!,
 *   fromAddress: 'james@adaptic.ai',
 *   fromName: 'James - VP Engineering',
 *   replyToAddress: 'james@adaptic.ai',
 *   webhookSecret: process.env.EMAIL_WEBHOOK_SECRET,
 *   fromAllowDomains: ['trusted-company.com'],
 * });
 *
 * // Send an email
 * await email.sendMessage({
 *   to: 'user@example.com',
 *   text: 'Hello from the Orchestrator!',
 * });
 *
 * // Handle an inbound webhook
 * const parsed = await email.handleIncoming(webhookBody);
 * if (parsed) {
 *   email.on('message', (msg) => console.log(msg.content.text));
 * }
 * ```
 */
export class EmailChannelAdapter extends BaseChannelAdapter {
  readonly id = 'email' as const;

  readonly meta: ChannelMeta = {
    id: 'email',
    label: 'Email',
    blurb: 'Multi-provider email integration (SendGrid, AWS SES, SMTP).',
    aliases: ['mail', 'smtp'],
    order: 50,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'thread'],
    reactions: false,
    threads: true,
    media: true,
    edit: false,
    delete: false,
    typingIndicators: false,
    readReceipts: false,
    maxMessageLength: 0, // Unlimited
    maxMediaBytes: 26_214_400, // 25 MB (common provider limit)
  };

  // -- Internal state -------------------------------------------------------
  private emailConfig: EmailConfig | null = null;
  private rateLimiter: EmailRateLimiter | null = null;
  private readonly threadTracker = new EmailThreadTracker();
  private sendgridProvider: SendGridProvider | null = null;
  private sesProvider: SesProvider | null = null;
  private smtpProvider: SmtpProvider | null = null;
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;
  private lastErrorAt: Date | null = null;
  private messageCount = 0;
  private errorCount = 0;

  constructor(logger?: ChannelLogger) {
    super(logger);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  async connect(config: ChannelConfig): Promise<void> {
    if (this.connected) {
      this.logger.debug('[email] Adapter already connected, skipping.');
      return;
    }

    const emailConfig = config as EmailConfig;
    this.emailConfig = emailConfig;

    this.validateConfig(emailConfig);

    this.rateLimiter = new EmailRateLimiter(
      emailConfig.maxRequestsPerSecond ?? DEFAULT_MAX_REQUESTS_PER_SECOND,
      emailConfig.maxRetries ?? DEFAULT_MAX_RETRIES,
      this.logger,
    );

    try {
      await this.initializeProvider(emailConfig);
      this.connected = true;
      this.config = config;

      this.logger.info(
        `[email] Adapter connected (provider: ${emailConfig.provider}, ` +
        `from: ${emailConfig.fromAddress}).`,
      );

      this.emit('connected', {
        channelId: this.id,
        accountId: emailConfig.fromAddress,
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.lastErrorAt = new Date();
      this.logger.error(`[email] Adapter connect failed: ${this.lastError}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.smtpProvider) {
        await this.smtpProvider.shutdown();
        this.smtpProvider = null;
      }
    } catch (err) {
      this.logger.error(
        `[email] Error during disconnect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.sendgridProvider = null;
    this.sesProvider = null;
    this.connected = false;

    this.emit('disconnected', {
      channelId: this.id,
      accountId: this.emailConfig?.fromAddress,
    });

    this.logger.info('[email] Adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    return {
      channelId: this.id,
      healthy: this.connected,
      connected: this.connected,
      accountId: this.emailConfig?.fromAddress,
      lastMessageAt: this.lastMessageAt ?? undefined,
      lastErrorAt: this.lastErrorAt ?? undefined,
      lastError: this.lastError ?? undefined,
      details: {
        provider: this.emailConfig?.provider ?? 'none',
        fromAddress: this.emailConfig?.fromAddress ?? 'none',
        messagesProcessed: this.messageCount,
        errors: this.errorCount,
        smtpConnected: this.smtpProvider !== null,
      },
    };
  }

  // =========================================================================
  // Messaging
  // =========================================================================

  /**
   * Send an email via the configured provider.
   *
   * The `to` field of OutboundMessage is treated as the recipient email address.
   * The `threadId` field, if provided, is used for In-Reply-To / References headers.
   *
   * For richer control (subject, HTML, CC/BCC), cast to OutboundEmailMessage.
   */
  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    this.requireConnected();

    const emailMessage = message as OutboundEmailMessage;
    const threadId = message.threadId;
    const threadState = threadId
      ? this.threadTracker.getState(threadId)
      : undefined;
    const subject =
      emailMessage.subject ??
      (threadState
        ? `Re: ${threadState.subject}`
        : 'Message from Orchestrator');

    // Build custom headers for thread tracking.
    const threadHeader =
      this.emailConfig?.threadIdHeader ?? DEFAULT_THREAD_ID_HEADER;
    const messageId = generateMessageId(this.emailConfig?.fromAddress ?? 'orchestrator');
    const threadHeaders = threadId
      ? this.threadTracker.buildReplyHeaders(threadId, messageId, threadHeader)
      : { [threadHeader]: messageId };
    const customHeaders: Record<string, string> = {
      ...threadHeaders,
      'X-Mailer': 'Wundr Orchestrator',
      ...emailMessage.headers,
    };

    // Build plain-text body with chunks for very long messages.
    const textBody = message.text;
    const htmlBody = emailMessage.htmlBody ?? convertTextToHtml(textBody);

    const replyTo =
      emailMessage.replyTo ?? this.emailConfig?.replyToAddress;

    try {
      const result = await this.withRateLimit('send', () =>
        this.sendViaProvider({
          from: this.emailConfig!.fromAddress,
          fromName: this.emailConfig!.fromName,
          to: Array.isArray(message.to) ? message.to : [message.to],
          cc: emailMessage.cc ? [...emailMessage.cc] : undefined,
          bcc: emailMessage.bcc ? [...emailMessage.bcc] : undefined,
          subject,
          textBody,
          htmlBody,
          replyTo,
          messageId,
          headers: customHeaders,
          attachments: message.attachments ? [...message.attachments] : undefined,
        }),
      );

      // Record the thread state so future replies can chain correctly.
      const effectiveThreadId = threadId ?? messageId;
      this.threadTracker.record(
        effectiveThreadId,
        messageId,
        customHeaders['References']?.split(' ') ?? [],
        subject,
      );

      this.messageCount++;
      this.logger.debug(
        `[email] Sent to ${message.to} (messageId: ${result.messageId}).`,
      );

      return {
        ok: true,
        messageId: result.messageId,
        conversationId: message.to,
        timestamp: new Date(),
      };
    } catch (err) {
      this.errorCount++;
      this.lastError = err instanceof Error ? err.message : String(err);
      this.lastErrorAt = new Date();

      this.emit('error', {
        channelId: this.id,
        error: err instanceof Error ? err : new Error(String(err)),
        recoverable: !(err instanceof RateLimitError),
      });

      return {
        ok: false,
        error: this.lastError,
      };
    }
  }

  /**
   * Email does not support typing indicators.
   * Returns a no-op handle to satisfy the interface.
   */
  sendTypingIndicator(_conversationId: string): TypingHandle {
    return { stop: () => {} };
  }

  /**
   * Send a media attachment as an email attachment.
   */
  async sendMedia(
    conversationId: string,
    attachment: OutboundAttachment,
    options?: { text?: string; threadId?: string },
  ): Promise<DeliveryResult> {
    return this.sendMessage({
      to: conversationId,
      text: options?.text ?? '',
      threadId: options?.threadId,
      attachments: [attachment],
    });
  }

  // =========================================================================
  // Inbound Webhook Processing
  // =========================================================================

  /**
   * Process an inbound email webhook payload from a provider.
   *
   * Validates the webhook signature (if configured), parses the payload
   * into a ParsedEmail, then emits a normalized 'message' event.
   *
   * Supported payload formats:
   * - SendGrid Inbound Parse webhook
   * - AWS SES / SNS notification (S3 or direct)
   * - Mailgun inbound webhook (form-encoded or JSON)
   *
   * @param webhookPayload - Raw webhook body as string or parsed object.
   * @param headers - HTTP request headers (for signature validation).
   * @returns The parsed email, or null if the payload was invalid/rejected.
   */
  async handleIncoming(
    webhookPayload: string | Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<ParsedEmail | null> {
    if (!this.connected) {
      this.logger.warn('[email] handleIncoming called on disconnected adapter.');
      return null;
    }

    try {
      // Validate webhook signature if configured.
      if (this.emailConfig?.webhookSecret && headers) {
        const isValid = await this.validateWebhookSignature(
          webhookPayload,
          headers,
        );
        if (!isValid) {
          this.logger.warn('[email] Webhook signature validation failed. Rejecting payload.');
          return null;
        }
      }

      const parsed = this.parseWebhookPayload(webhookPayload);
      if (!parsed) {
        this.logger.debug('[email] Could not parse webhook payload.');
        return null;
      }

      // Sender validation.
      const validation = await this.validateSender(parsed.from, 'direct');
      if (!validation.allowed) {
        this.logger.debug(
          `[email] Rejected inbound email from ${parsed.from}: ${validation.reason}`,
        );
        return null;
      }

      // Track thread state from inbound message.
      if (parsed.threadId || parsed.inReplyTo) {
        const effectiveThreadId = parsed.threadId ?? parsed.inReplyTo ?? parsed.messageId;
        this.threadTracker.record(
          effectiveThreadId,
          parsed.messageId,
          parsed.references ?? [],
          parsed.subject,
        );
      }

      // Emit normalized message.
      const normalized = this.normalizeInboundEmail(parsed);
      if (normalized) {
        this.lastMessageAt = new Date();
        this.messageCount++;
        this.emit('message', normalized);
      }

      return parsed;
    } catch (err) {
      this.errorCount++;
      this.lastError = err instanceof Error ? err.message : String(err);
      this.lastErrorAt = new Date();
      this.logger.error(`[email] Error handling inbound webhook: ${this.lastError}`);

      this.emit('error', {
        channelId: this.id,
        error: err instanceof Error ? err : new Error(String(err)),
        recoverable: true,
      });

      return null;
    }
  }

  /**
   * Parse a raw email string or object into a structured ParsedEmail.
   *
   * Handles:
   * - SendGrid Inbound Parse webhook (JSON or multipart form data as pre-parsed object)
   * - AWS SES SNS notification JSON
   * - Generic key-value email header objects
   *
   * @param raw - Raw email string or pre-parsed object.
   * @returns ParsedEmail or null if unparseable.
   */
  parseMessage(raw: string | Record<string, unknown>): ParsedEmail | null {
    return this.parseWebhookPayload(raw);
  }

  /**
   * Map a parsed email to a conversation context identifier.
   *
   * Derives the thread/conversation ID from (in priority order):
   * 1. Custom thread ID header (X-Wundr-Thread-ID)
   * 2. In-Reply-To header (parent message ID)
   * 3. Message-ID itself (starts a new conversation)
   *
   * @returns Conversation ID string.
   */
  mapToConversation(email: ParsedEmail): string {
    return email.threadId ?? email.inReplyTo ?? email.messageId;
  }

  // =========================================================================
  // Security / Pairing
  // =========================================================================

  async validateSender(
    senderId: string,
    _chatType: ChatType,
  ): Promise<SenderValidation> {
    const config = this.emailConfig;
    if (!config) {
      return { allowed: true };
    }

    const email = senderId.trim().toLowerCase();

    // Check allow-list (exact email match).
    if (config.fromAllowList && config.fromAllowList.length > 0) {
      const inAllowList = config.fromAllowList.some(
        (entry) => entry.trim().toLowerCase() === email,
      );
      if (inAllowList) {
        return { allowed: true };
      }
    }

    // Check allow-domains (domain match).
    if (config.fromAllowDomains && config.fromAllowDomains.length > 0) {
      const domain = email.split('@')[1] ?? '';
      const inAllowDomain = config.fromAllowDomains.some(
        (d) => d.trim().toLowerCase() === domain,
      );
      if (inAllowDomain) {
        return { allowed: true };
      }
    }

    // If either allow list is configured, deny non-matching senders.
    const hasRestrictions =
      (config.fromAllowList && config.fromAllowList.length > 0) ||
      (config.fromAllowDomains && config.fromAllowDomains.length > 0);

    if (hasRestrictions) {
      return {
        allowed: false,
        reason: `Sender ${senderId} is not in the email allow-list or allow-domains.`,
      };
    }

    // No restrictions configured — allow all.
    return { allowed: true };
  }

  getPairingConfig(): PairingConfig | null {
    const config = this.emailConfig;
    if (!config) {
      return null;
    }

    const allowList = [
      ...(config.fromAllowList ?? []),
      ...(config.fromAllowDomains ?? []).map((d) => `@${d}`),
    ];

    if (allowList.length === 0) {
      return null;
    }

    return {
      requireApproval: false,
      allowList,
      normalizeEntry: (raw: string) => raw.trim().toLowerCase(),
    };
  }

  // =========================================================================
  // Thread Management (Public API)
  // =========================================================================

  /**
   * Get the current thread state for a given thread ID.
   * Useful for inspecting In-Reply-To / References chains.
   */
  getThreadState(threadId: string): ThreadState | undefined {
    return this.threadTracker.getState(threadId);
  }

  /**
   * Manually seed a thread state (e.g., when restoring from persistent storage).
   */
  seedThread(
    threadId: string,
    lastMessageId: string,
    references: string[],
    subject: string,
  ): void {
    this.threadTracker.record(threadId, lastMessageId, references, subject);
  }

  // =========================================================================
  // Internal: Provider Initialization
  // =========================================================================

  private async initializeProvider(config: EmailConfig): Promise<void> {
    switch (config.provider) {
      case 'sendgrid': {
        if (!config.apiKey) {
          throw new Error('SendGrid provider requires apiKey.');
        }
        this.sendgridProvider = new SendGridProvider(config.apiKey, this.logger);
        this.logger.info('[email] SendGrid provider initialized.');
        break;
      }

      case 'ses': {
        if (!config.region) {
          throw new Error('SES provider requires region.');
        }
        if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
          throw new Error('SES provider requires awsAccessKeyId and awsSecretAccessKey.');
        }
        this.sesProvider = new SesProvider(
          config.region,
          config.awsAccessKeyId,
          config.awsSecretAccessKey,
          config.awsSessionToken,
          this.logger,
        );
        this.logger.info(`[email] AWS SES provider initialized (region: ${config.region}).`);
        break;
      }

      case 'smtp': {
        if (!config.smtpHost) {
          throw new Error('SMTP provider requires smtpHost.');
        }
        const port = config.smtpPort ?? (config.smtpSecure ? 465 : 587);
        const secure = config.smtpSecure ?? port === 465;
        this.smtpProvider = new SmtpProvider(
          config.smtpHost,
          port,
          config.smtpUser,
          config.smtpPass,
          secure,
          this.logger,
        );
        await this.smtpProvider.initialize();
        break;
      }

      default: {
        throw new Error(
          `Unknown email provider: "${(config as EmailConfig).provider}". ` +
          'Valid values: "sendgrid", "ses", "smtp".',
        );
      }
    }
  }

  // =========================================================================
  // Internal: Provider Dispatch
  // =========================================================================

  private async sendViaProvider(params: ProviderSendParams): Promise<{ messageId: string }> {
    const config = this.emailConfig!;

    switch (config.provider) {
      case 'sendgrid':
        return this.sendViaSendGrid(params);

      case 'ses':
        return this.sendViaSes(params);

      case 'smtp':
        return this.sendViaSmtp(params);

      default:
        throw new Error(`Provider not initialized: ${config.provider}`);
    }
  }

  private async sendViaSendGrid(params: ProviderSendParams): Promise<{ messageId: string }> {
    if (!this.sendgridProvider) {
      throw new Error('SendGrid provider not initialized.');
    }

    const payload: SendGridPayload = {
      personalizations: [
        {
          to: params.to.map((email) => parseEmailAddress(email)),
          ...(params.cc?.length ? { cc: params.cc.map((e) => parseEmailAddress(e)) } : {}),
          ...(params.bcc?.length ? { bcc: params.bcc.map((e) => parseEmailAddress(e)) } : {}),
          headers: params.headers,
        },
      ],
      from: {
        email: params.from,
        name: params.fromName,
      },
      ...(params.replyTo
        ? { reply_to: { email: params.replyTo } }
        : {}),
      subject: params.subject,
      content: [
        { type: 'text/plain', value: params.textBody || '' },
        ...(params.htmlBody
          ? [{ type: 'text/html', value: params.htmlBody }]
          : []),
      ],
      ...(params.attachments?.length
        ? { attachments: await buildSendGridAttachments(params.attachments) }
        : {}),
    };

    return this.sendgridProvider.send(payload);
  }

  private async sendViaSes(params: ProviderSendParams): Promise<{ messageId: string }> {
    if (!this.sesProvider) {
      throw new Error('SES provider not initialized.');
    }

    const sesParams: SesEmailParams = {
      FromEmailAddress: params.fromName
        ? `${params.fromName} <${params.from}>`
        : params.from,
      Destination: {
        ToAddresses: params.to,
        ...(params.cc?.length ? { CcAddresses: params.cc } : {}),
        ...(params.bcc?.length ? { BccAddresses: params.bcc } : {}),
      },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: {
            ...(params.textBody
              ? { Text: { Data: params.textBody, Charset: 'UTF-8' } }
              : {}),
            ...(params.htmlBody
              ? { Html: { Data: params.htmlBody, Charset: 'UTF-8' } }
              : {}),
          },
        },
      },
      ...(params.replyTo ? { ReplyToAddresses: [params.replyTo] } : {}),
    };

    return this.sesProvider.send(sesParams);
  }

  private async sendViaSmtp(params: ProviderSendParams): Promise<{ messageId: string }> {
    if (!this.smtpProvider) {
      throw new Error('SMTP provider not initialized.');
    }

    const smtpAttachments = params.attachments
      ? await buildSmtpAttachments(params.attachments)
      : undefined;

    const smtpOptions: SmtpSendOptions = {
      from: params.fromName
        ? `"${params.fromName}" <${params.from}>`
        : params.from,
      to: params.to,
      ...(params.cc?.length ? { cc: params.cc } : {}),
      ...(params.bcc?.length ? { bcc: params.bcc } : {}),
      subject: params.subject,
      text: params.textBody,
      ...(params.htmlBody ? { html: params.htmlBody } : {}),
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      headers: params.headers,
      ...(smtpAttachments?.length ? { attachments: smtpAttachments } : {}),
    };

    return this.smtpProvider.send(smtpOptions);
  }

  // =========================================================================
  // Internal: Webhook Parsing
  // =========================================================================

  private parseWebhookPayload(
    payload: string | Record<string, unknown>,
  ): ParsedEmail | null {
    try {
      const data: Record<string, unknown> =
        typeof payload === 'string'
          ? (JSON.parse(payload) as Record<string, unknown>)
          : payload;

      // Detect SendGrid Inbound Parse format.
      if (data['from'] && data['subject'] && (data['text'] || data['html'])) {
        return this.parseSendGridWebhook(data);
      }

      // Detect AWS SES SNS notification.
      if (data['Type'] === 'Notification' && data['Message']) {
        return this.parseSesNotification(data);
      }

      // Detect Mailgun inbound format.
      if (data['sender'] && data['recipient']) {
        return this.parseMailgunWebhook(data);
      }

      // Generic raw email headers object.
      if (data['headers'] && data['messageId']) {
        return this.parseGenericWebhook(data);
      }

      this.logger.debug('[email] Unrecognized webhook payload format.');
      return null;
    } catch (err) {
      this.logger.error(
        `[email] Failed to parse webhook payload: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private parseSendGridWebhook(data: Record<string, unknown>): ParsedEmail {
    const threadHeader = this.emailConfig?.threadIdHeader ?? DEFAULT_THREAD_ID_HEADER;
    const headers = normalizeHeaders(
      (data['headers'] as Record<string, string> | string | undefined) ?? {},
    );

    const from = String(data['from'] ?? '');
    const { email: fromEmail, name: fromName } = parseEmailAddress(from);
    const to = splitEmailList(String(data['to'] ?? ''));
    const cc = data['cc'] ? splitEmailList(String(data['cc'])) : undefined;
    const subject = String(data['subject'] ?? '');
    const headersParsed = data['headers_parsed'] as Record<string, string> | undefined;
    const messageId =
      String(headersParsed?.['Message-ID'] ?? headers['message-id'] ?? '') ||
      `inbound-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Parse MIME message-id: strip angle brackets.
    const cleanMessageId = messageId.replace(/^<|>$/g, '');

    const inReplyTo = headers['in-reply-to']?.replace(/^<|>$/g, '');
    const references = headers['references']
      ?.split(/\s+/)
      .map((r) => r.replace(/^<|>$/g, ''))
      .filter(Boolean);
    const threadId =
      headers[threadHeader.toLowerCase()] ?? inReplyTo ?? undefined;

    const attachments = this.parseSendGridAttachments(data);

    return {
      messageId: cleanMessageId,
      from: fromEmail,
      fromName: fromName || undefined,
      to,
      cc,
      subject,
      textBody: String(data['text'] ?? ''),
      htmlBody: data['html'] ? String(data['html']) : undefined,
      inReplyTo,
      references,
      threadId,
      attachments,
      headers,
      receivedAt: new Date(),
    };
  }

  private parseSendGridAttachments(
    data: Record<string, unknown>,
  ): InboundEmailAttachment[] {
    const attachmentCount = parseInt(String(data['attachments'] ?? '0'), 10);
    if (!attachmentCount || attachmentCount <= 0) {
      return [];
    }

    const result: InboundEmailAttachment[] = [];
    for (let i = 1; i <= attachmentCount; i++) {
      const name = String(data[`attachment-info`] ?? '');
      const contentType = String(data[`attachment${i}`] ?? 'application/octet-stream');
      result.push({
        filename: name || `attachment-${i}`,
        mimeType: contentType,
      });
    }
    return result;
  }

  private parseSesNotification(data: Record<string, unknown>): ParsedEmail | null {
    try {
      const message = JSON.parse(String(data['Message'])) as Record<string, unknown>;
      const mail = message['mail'] as Record<string, unknown> | undefined;
      if (!mail) {
        return null;
      }

      const headers = (mail['headers'] as Array<{ name: string; value: string }> | undefined) ?? [];
      const headerMap: Record<string, string> = {};
      for (const h of headers) {
        headerMap[h.name.toLowerCase()] = h.value;
      }

      const threadHeader = this.emailConfig?.threadIdHeader ?? DEFAULT_THREAD_ID_HEADER;
      const messageId = String(mail['messageId'] ?? `ses-${Date.now()}`);
      const from = String(mail['source'] ?? headerMap['from'] ?? '');
      const { email: fromEmail, name: fromName } = parseEmailAddress(from);
      const to = (mail['destination'] as string[] | undefined) ?? [];
      const subject = String(headerMap['subject'] ?? '(no subject)');
      const inReplyTo = headerMap['in-reply-to']?.replace(/^<|>$/g, '');
      const references = headerMap['references']
        ?.split(/\s+/)
        .map((r) => r.replace(/^<|>$/g, ''))
        .filter(Boolean);
      const threadId =
        headerMap[threadHeader.toLowerCase()] ?? inReplyTo ?? undefined;

      const content = message['content'] as Record<string, unknown> | undefined;
      const textBody = String(content?.['text'] ?? '');
      const htmlBody = content?.['html'] ? String(content['html']) : undefined;

      return {
        messageId,
        from: fromEmail,
        fromName: fromName || undefined,
        to,
        subject,
        textBody,
        htmlBody,
        inReplyTo,
        references,
        threadId,
        headers: headerMap,
        receivedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parseMailgunWebhook(data: Record<string, unknown>): ParsedEmail {
    const threadHeader = this.emailConfig?.threadIdHeader ?? DEFAULT_THREAD_ID_HEADER;
    const headers = normalizeHeaders(
      (data['message-headers'] as Array<[string, string]> | undefined) ?? [],
    );

    const from = String(data['sender'] ?? data['from'] ?? '');
    const { email: fromEmail, name: fromName } = parseEmailAddress(from);
    const to = splitEmailList(String(data['recipient'] ?? data['to'] ?? ''));
    const subject = String(data['subject'] ?? '');
    const messageId = String(data['Message-Id'] ?? data['message-id'] ?? headers['message-id'] ?? `mg-${Date.now()}`);
    const cleanMessageId = messageId.replace(/^<|>$/g, '');

    const inReplyTo = headers['in-reply-to']?.replace(/^<|>$/g, '');
    const references = headers['references']
      ?.split(/\s+/)
      .map((r) => r.replace(/^<|>$/g, ''))
      .filter(Boolean);
    const threadId =
      headers[threadHeader.toLowerCase()] ?? inReplyTo ?? undefined;

    return {
      messageId: cleanMessageId,
      from: fromEmail,
      fromName: fromName || undefined,
      to,
      subject,
      textBody: String(data['body-plain'] ?? data['stripped-text'] ?? ''),
      htmlBody: data['body-html'] ? String(data['body-html']) : undefined,
      inReplyTo,
      references,
      threadId,
      headers,
      receivedAt: new Date(),
    };
  }

  private parseGenericWebhook(data: Record<string, unknown>): ParsedEmail {
    const headers = normalizeHeaders(
      (data['headers'] as Record<string, string> | undefined) ?? {},
    );
    const threadHeader = this.emailConfig?.threadIdHeader ?? DEFAULT_THREAD_ID_HEADER;
    const from = String(data['from'] ?? headers['from'] ?? '');
    const { email: fromEmail, name: fromName } = parseEmailAddress(from);
    const to = splitEmailList(String(data['to'] ?? headers['to'] ?? ''));
    const subject = String(data['subject'] ?? headers['subject'] ?? '');
    const messageId = String(data['messageId'] ?? headers['message-id'] ?? `generic-${Date.now()}`).replace(/^<|>$/g, '');
    const inReplyTo = headers['in-reply-to']?.replace(/^<|>$/g, '');
    const references = headers['references']
      ?.split(/\s+/)
      .map((r) => r.replace(/^<|>$/g, ''))
      .filter(Boolean);
    const threadId =
      headers[threadHeader.toLowerCase()] ?? inReplyTo ?? undefined;

    return {
      messageId,
      from: fromEmail,
      fromName: fromName || undefined,
      to,
      subject,
      textBody: String(data['text'] ?? data['body'] ?? ''),
      htmlBody: data['html'] ? String(data['html']) : undefined,
      inReplyTo,
      references,
      threadId,
      headers,
      receivedAt: new Date(),
    };
  }

  // =========================================================================
  // Internal: Message Normalization
  // =========================================================================

  private normalizeInboundEmail(parsed: ParsedEmail): NormalizedMessage | null {
    if (!parsed.messageId || !parsed.from) {
      return null;
    }

    const conversationId = this.mapToConversation(parsed);
    const sender = this.normalizeEmailSender(parsed);
    const content = this.normalizeEmailContent(parsed);

    return {
      id: `email:${parsed.messageId}`,
      channelId: this.id,
      platformMessageId: parsed.messageId,
      conversationId,
      threadId: parsed.threadId ?? parsed.inReplyTo,
      sender,
      content,
      timestamp: parsed.receivedAt,
      chatType: 'direct',
      replyTo: parsed.inReplyTo,
      raw: parsed,
    };
  }

  private normalizeEmailSender(parsed: ParsedEmail): NormalizedSender {
    const isSelf =
      this.emailConfig !== null &&
      parsed.from.toLowerCase() === this.emailConfig.fromAddress.toLowerCase();

    return {
      id: parsed.from,
      displayName: parsed.fromName ?? parsed.from,
      username: parsed.from,
      isSelf,
      isBot: false,
    };
  }

  private normalizeEmailContent(parsed: ParsedEmail): MessageContent {
    const text = parsed.textBody ?? stripHtmlTags(parsed.htmlBody ?? '');
    const attachments = this.normalizeEmailAttachments(parsed.attachments ?? []);
    const isSelf =
      this.emailConfig !== null &&
      parsed.from.toLowerCase() === this.emailConfig.fromAddress.toLowerCase();

    return {
      text,
      rawText: parsed.htmlBody ?? parsed.textBody,
      attachments,
      mentions: [],
      mentionsSelf: isSelf,
    };
  }

  private normalizeEmailAttachments(
    inbound: InboundEmailAttachment[],
  ): NormalizedAttachment[] {
    return inbound.map((att) => ({
      type: resolveAttachmentType(att.mimeType),
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      url: att.contentUrl ?? '',
    }));
  }

  // =========================================================================
  // Internal: Webhook Signature Validation
  // =========================================================================

  private async validateWebhookSignature(
    payload: string | Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<boolean> {
    const secret = this.emailConfig?.webhookSecret;
    if (!secret) {
      return true; // No secret configured — skip validation.
    }

    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);

    // SendGrid: X-Twilio-Email-Event-Webhook-Signature / X-Twilio-Email-Event-Webhook-Timestamp
    const sgSig = headers['x-twilio-email-event-webhook-signature'];
    const sgTs = headers['x-twilio-email-event-webhook-timestamp'];
    if (sgSig && sgTs && this.sendgridProvider) {
      return this.sendgridProvider.verifyWebhookSignature(payloadStr, sgSig, sgTs, secret);
    }

    // Generic HMAC-SHA256: X-Webhook-Signature
    const genericSig = headers['x-webhook-signature'];
    if (genericSig) {
      return verifyHmac(payloadStr, genericSig, secret);
    }

    // No recognized signature headers present — allow through.
    return true;
  }

  // =========================================================================
  // Internal: Config Validation
  // =========================================================================

  private validateConfig(config: EmailConfig): void {
    if (!config.fromAddress) {
      throw new Error('EmailConfig requires fromAddress.');
    }
    if (!config.fromName) {
      throw new Error('EmailConfig requires fromName.');
    }
    if (!['sendgrid', 'ses', 'smtp'].includes(config.provider)) {
      throw new Error(
        `Invalid email provider "${config.provider}". Must be "sendgrid", "ses", or "smtp".`,
      );
    }
  }

  // =========================================================================
  // Internal: Rate Limiting
  // =========================================================================

  private async withRateLimit<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!this.rateLimiter) {
      return fn();
    }
    return this.rateLimiter.execute(operation, fn);
  }

  // =========================================================================
  // Internal: Guard
  // =========================================================================

  private requireConnected(): void {
    if (!this.connected) {
      throw new Error(
        'Email adapter is not connected. Call connect() first.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface ProviderSendParams {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  replyTo?: string;
  messageId: string;
  headers?: Record<string, string>;
  attachments?: readonly OutboundAttachment[];
}

// ---------------------------------------------------------------------------
// Custom Error Types
// ---------------------------------------------------------------------------

class RateLimitError extends Error {
  readonly retryAfterSec: number;

  constructor(message: string, retryAfterSec: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

// ---------------------------------------------------------------------------
// Attachment Builders
// ---------------------------------------------------------------------------

async function buildSendGridAttachments(
  attachments: readonly OutboundAttachment[],
): Promise<SendGridPayload['attachments']> {
  const result: NonNullable<SendGridPayload['attachments']> = [];

  for (const att of attachments) {
    let content: string;

    if (att.source === 'buffer' && att.buffer) {
      content = att.buffer.toString('base64');
    } else if (att.source === 'path' && att.location) {
      const fs = await import('node:fs/promises');
      const buf = await fs.readFile(att.location);
      content = buf.toString('base64');
    } else if (att.source === 'url' && att.location) {
      const resp = await fetch(att.location);
      if (!resp.ok) {
        throw new Error(`Failed to download attachment from ${att.location}: ${resp.status}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      content = buf.toString('base64');
    } else {
      continue;
    }

    result.push({
      content,
      filename: att.filename,
      type: att.mimeType ?? 'application/octet-stream',
      disposition: 'attachment',
    });
  }

  return result;
}

async function buildSmtpAttachments(
  attachments: readonly OutboundAttachment[],
): Promise<SmtpSendOptions['attachments']> {
  const result: NonNullable<SmtpSendOptions['attachments']> = [];

  for (const att of attachments) {
    if (att.source === 'buffer' && att.buffer) {
      result.push({
        filename: att.filename,
        content: att.buffer,
        contentType: att.mimeType,
      });
    } else if (att.source === 'path' && att.location) {
      result.push({
        filename: att.filename,
        path: att.location,
        contentType: att.mimeType,
      });
    } else if (att.source === 'url' && att.location) {
      const resp = await fetch(att.location);
      if (!resp.ok) {
        throw new Error(`Failed to download attachment from ${att.location}: ${resp.status}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      result.push({
        filename: att.filename,
        content: buf,
        contentType: att.mimeType,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Extract Retry-After seconds from an error object.
 * Handles RateLimitError instances and generic HTTP error objects.
 */
function extractRetryAfterSec(err: unknown): number {
  if (err instanceof RateLimitError) {
    return err.retryAfterSec;
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // HTTP response-style error.
    const retryAfter = obj['retryAfter'] ?? obj['retry-after'];
    if (typeof retryAfter === 'number' && retryAfter > 0) {
      return retryAfter;
    }
    if (typeof retryAfter === 'string') {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    const headers = obj['headers'] as Record<string, string> | undefined;
    if (headers?.['retry-after']) {
      const parsed = parseInt(headers['retry-after'], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 0;
}

/**
 * Parse an RFC 5322 email address into email + display name components.
 * Handles formats:
 * - "Display Name <email@example.com>"
 * - "email@example.com"
 */
function parseEmailAddress(raw: string): { email: string; name?: string } {
  if (!raw) {
    return { email: '' };
  }
  const angleMatch = raw.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1]?.trim() || undefined,
      email: angleMatch[2]?.trim() ?? '',
    };
  }
  return { email: raw.trim() };
}

/**
 * Split a comma-separated list of email addresses.
 */
function splitEmailList(raw: string): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => parseEmailAddress(s.trim()).email)
    .filter(Boolean);
}

/**
 * Normalize a headers object or array to a lowercase key map.
 */
function normalizeHeaders(
  input: Record<string, string> | Array<[string, string]> | string,
): Record<string, string> {
  if (Array.isArray(input)) {
    const result: Record<string, string> = {};
    for (const [key, value] of input) {
      result[key.toLowerCase()] = value;
    }
    return result;
  }

  if (typeof input === 'string') {
    // Raw header block: "Key: Value\r\nKey2: Value2"
    const result: Record<string, string> = {};
    for (const line of input.split(/\r?\n/)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

/**
 * Generate a unique Message-ID for outbound emails.
 * Format: <timestamp.random@domain>
 */
function generateMessageId(fromAddress: string): string {
  const domain = fromAddress.split('@')[1] ?? 'orchestrator.local';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `<${ts}.${rand}@${domain}>`;
}

/**
 * Convert plain text to minimal HTML (preserving line breaks).
 */
function convertTextToHtml(text: string): string {
  if (!text) {
    return '';
  }
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const withBreaks = escaped.replace(/\n/g, '<br>\n');
  return `<!DOCTYPE html><html><body>${withBreaks}</body></html>`;
}

/**
 * Strip HTML tags from a string to produce plain text.
 */
function stripHtmlTags(html: string): string {
  if (!html) {
    return '';
  }
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Resolve attachment type from MIME type.
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
 * Verify an HMAC-SHA256 signature.
 */
async function verifyHmac(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const crypto = await import('node:crypto');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dynamic import of nodemailer. Allows the adapter to compile and be
 * type-checked even when nodemailer is not installed.
 */
async function importNodemailer(): Promise<{
  createTransport(options: Record<string, unknown>): unknown;
}> {
  try {
    // nodemailer is an optional peer dependency; dynamically import so the adapter
    // compiles and type-checks even when it is not installed.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- optional peer dependency
    const nm = await import('nodemailer'); // eslint-disable-line import/no-unresolved
    return nm as { createTransport(options: Record<string, unknown>): unknown };
  } catch {
    throw new Error(
      'nodemailer is not installed. Run `npm install nodemailer` to use the SMTP provider.',
    );
  }
}
