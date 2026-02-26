/**
 * @neolith/core - EmailService
 *
 * Service layer for sending emails through orchestrator daemons.
 * Bridges the Neolith web app with the daemon's email adapter (SendGrid, AWS SES, SMTP).
 * Communicates with the daemon via HTTP REST calls to its email channel endpoint.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Error Classes
// =============================================================================

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

export class EmailDeliveryError extends EmailServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

export class EmailTemplateError extends EmailServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailTemplateError';
  }
}

// =============================================================================
// Types
// =============================================================================

export interface EmailMessage {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  variables: string[];
}

// =============================================================================
// Built-in Templates
// =============================================================================

export const EMAIL_BUILT_IN_TEMPLATES: Record<string, EmailTemplate> = {
  'task-notification': {
    id: 'task-notification',
    name: 'Task Notification',
    subject: 'New task assigned: {taskTitle}',
    htmlTemplate:
      '<p>You have been assigned a new task: <strong>{taskTitle}</strong></p>',
    variables: ['taskTitle'],
  },
  'status-report': {
    id: 'status-report',
    name: 'Status Report',
    subject: 'Daily Status Report for {orgName}',
    htmlTemplate: '<p>Daily Status Report for <strong>{orgName}</strong></p>',
    variables: ['orgName'],
  },
  'agent-welcome': {
    id: 'agent-welcome',
    name: 'Agent Welcome',
    subject: 'Welcome to {orgName}, {agentName}',
    htmlTemplate:
      '<p>Welcome to <strong>{orgName}</strong>, {agentName}! We are glad to have you.</p>',
    variables: ['orgName', 'agentName'],
  },
};

// =============================================================================
// IEmailService Interface
// =============================================================================

export interface IEmailService {
  /**
   * Send a single email through the orchestrator's daemon.
   *
   * @param orchestratorId - The orchestrator whose daemon handles delivery
   * @param message - The email message to send
   * @returns Delivery status with a message ID
   * @throws {EmailDeliveryError} If the daemon rejects or fails to send the email
   */
  sendEmail(
    orchestratorId: string,
    message: EmailMessage
  ): Promise<EmailDeliveryStatus>;

  /**
   * Send a bulk email to multiple recipients using a template.
   *
   * @param orchestratorId - The orchestrator whose daemon handles delivery
   * @param recipients - List of recipient email addresses
   * @param template - The email template to render
   * @param data - Template variable substitutions
   * @returns Array of delivery statuses, one per recipient
   * @throws {EmailTemplateError} If template variables are missing
   */
  sendBulk(
    orchestratorId: string,
    recipients: string[],
    template: EmailTemplate,
    data: Record<string, string>
  ): Promise<EmailDeliveryStatus[]>;

  /**
   * Get the delivery status for a previously sent message.
   *
   * @param messageId - The message ID returned from sendEmail
   * @returns Delivery status, or null if not found
   */
  getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus | null>;

  /**
   * List sent emails for an orchestrator with optional filters.
   *
   * @param orchestratorId - The orchestrator ID
   * @param filters - Optional pagination and status filters
   * @returns List of delivery statuses
   */
  listSentEmails(
    orchestratorId: string,
    filters?: { limit?: number; offset?: number; status?: string }
  ): Promise<EmailDeliveryStatus[]>;
}

// =============================================================================
// EmailService Implementation
// =============================================================================

/**
 * EmailServiceImpl communicates with the orchestrator daemon over HTTP REST
 * to send emails through its configured email adapter.
 */
export class EmailServiceImpl implements IEmailService {
  private readonly db: PrismaClient;

  /**
   * Creates a new EmailServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Looks up the daemon HTTP endpoint for the given orchestrator.
   *
   * @throws {EmailServiceError} If the orchestrator is not found or has no daemon endpoint
   */
  private async getDaemonEndpoint(orchestratorId: string): Promise<string> {
    const orchestrator = await this.db.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { daemonEndpoint: true },
    });

    if (!orchestrator) {
      throw new EmailServiceError(`Orchestrator not found: ${orchestratorId}`);
    }

    if (!orchestrator.daemonEndpoint) {
      throw new EmailServiceError(
        `Orchestrator ${orchestratorId} has no daemon endpoint configured`
      );
    }

    return orchestrator.daemonEndpoint;
  }

  /**
   * Render a template by substituting {variable} placeholders with data values.
   *
   * @throws {EmailTemplateError} If required variables are missing from data
   */
  private renderTemplate(
    template: EmailTemplate,
    data: Record<string, string>
  ): {
    subject: string;
    html: string;
  } {
    for (const variable of template.variables) {
      if (!(variable in data)) {
        throw new EmailTemplateError(
          `Template "${template.id}" requires variable "${variable}" but it was not provided`
        );
      }
    }

    const replace = (str: string): string =>
      str.replace(/\{(\w+)\}/g, (_, key: string) => data[key] ?? `{${key}}`);

    return {
      subject: replace(template.subject),
      html: replace(template.htmlTemplate),
    };
  }

  // ===========================================================================
  // IEmailService Methods
  // ===========================================================================

  async sendEmail(
    orchestratorId: string,
    message: EmailMessage
  ): Promise<EmailDeliveryStatus> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);

    let response: Response;
    try {
      response = await fetch(`${endpoint}/api/channels/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (err) {
      throw new EmailDeliveryError(
        `Failed to reach daemon at ${endpoint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new EmailDeliveryError(
        `Daemon returned ${response.status} for email send: ${body}`
      );
    }

    return response.json() as Promise<EmailDeliveryStatus>;
  }

  async sendBulk(
    orchestratorId: string,
    recipients: string[],
    template: EmailTemplate,
    data: Record<string, string>
  ): Promise<EmailDeliveryStatus[]> {
    const { subject, html } = this.renderTemplate(template, data);

    const results = await Promise.allSettled(
      recipients.map(to =>
        this.sendEmail(orchestratorId, { to, subject, body: html, html })
      )
    );

    return results.map((result, index): EmailDeliveryStatus => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        messageId: `failed-${Date.now()}-${index}`,
        status: 'failed',
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    });
  }

  async getDeliveryStatus(
    _messageId: string
  ): Promise<EmailDeliveryStatus | null> {
    // In-memory delivery status is tracked by the daemon; query it via a generic
    // endpoint. Without a known orchestrator ID we fall back to null — callers
    // that need status should use listSentEmails instead.
    return null;
  }

  async listSentEmails(
    orchestratorId: string,
    filters?: { limit?: number; offset?: number; status?: string }
  ): Promise<EmailDeliveryStatus[]> {
    const endpoint = await this.getDaemonEndpoint(orchestratorId);

    const params = new URLSearchParams();
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));
    if (filters?.status) params.set('status', filters.status);

    const url = `${endpoint}/api/channels/email/sent${params.size > 0 ? `?${params}` : ''}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new EmailServiceError(
        `Failed to reach daemon at ${endpoint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new EmailServiceError(
        `Daemon returned ${response.status} for list sent emails: ${body}`
      );
    }

    return response.json() as Promise<EmailDeliveryStatus[]>;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new EmailService instance.
 *
 * @param database - Optional Prisma client instance
 * @returns EmailService instance
 *
 * @example
 * ```typescript
 * const emailService = createEmailService();
 *
 * // Send a task notification
 * const status = await emailService.sendEmail('orch_123', {
 *   to: 'user@example.com',
 *   subject: 'New task assigned',
 *   body: 'You have been assigned: Build the email service',
 * });
 *
 * // Send bulk using a built-in template
 * const statuses = await emailService.sendBulk(
 *   'orch_123',
 *   ['a@example.com', 'b@example.com'],
 *   EMAIL_BUILT_IN_TEMPLATES['task-notification'],
 *   { taskTitle: 'Review PR #42' }
 * );
 * ```
 */
export function createEmailService(database?: PrismaClient): EmailServiceImpl {
  return new EmailServiceImpl(database);
}

/**
 * Default EmailService instance using the singleton Prisma client.
 */
export const emailService = createEmailService();
