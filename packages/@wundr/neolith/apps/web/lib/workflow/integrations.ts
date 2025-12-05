/**
 * Workflow Integration Definitions
 *
 * Comprehensive integration library for external services including:
 * - HTTP/REST API calls
 * - Email (send/receive via SMTP/IMAP)
 * - Slack notifications and interactions
 * - GitHub (issues, PRs, webhooks)
 * - Calendar events (Google Calendar, Outlook)
 *
 * Each integration includes:
 * - Type definitions
 * - Configuration schemas (Zod)
 * - OAuth flow setup
 * - API client methods
 * - Error handling
 */

import {
  Globe,
  Mail,
  Slack as SlackIcon,
  Github,
  Calendar,
  Send,
  Inbox,
  Webhook,
} from 'lucide-react';
import { z } from 'zod';

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Base Integration Types
// ============================================================================

export type IntegrationType = 'http' | 'email' | 'slack' | 'github' | 'calendar';

export type AuthType = 'none' | 'api-key' | 'oauth2' | 'basic' | 'bearer';

export interface BaseIntegration {
  id: string;
  type: IntegrationType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  authType: AuthType;
  configSchema: z.ZodSchema;
  actions: IntegrationAction[];
  requiresConnection: boolean;
}

export interface IntegrationAction {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  configSchema: z.ZodSchema;
  requiredScopes?: string[];
}

export interface IntegrationConnection {
  id: string;
  integrationId: string;
  name: string;
  authType: AuthType;
  credentials: Record<string, unknown>;
  scopes?: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// HTTP/REST API Integration
// ============================================================================

const httpConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  defaultHeaders: z.record(z.string()).optional(),
  timeout: z.number().min(1000).max(300000).default(30000),
  retryPolicy: z
    .object({
      maxRetries: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(100).max(10000).default(1000),
      retryOn: z.array(z.number()).default([408, 429, 500, 502, 503, 504]),
    })
    .optional(),
});

const httpRequestActionSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.union([z.string(), z.record(z.unknown())]).optional(),
  bodyType: z.enum(['json', 'form', 'text', 'xml']).default('json'),
  authentication: z
    .object({
      type: z.enum(['none', 'basic', 'bearer', 'api-key', 'oauth2']),
      username: z.string().optional(),
      password: z.string().optional(),
      token: z.string().optional(),
      apiKey: z.string().optional(),
      apiKeyLocation: z.enum(['header', 'query']).optional(),
      apiKeyName: z.string().optional(),
    })
    .optional(),
  followRedirects: z.boolean().default(true),
  validateSSL: z.boolean().default(true),
  responseType: z.enum(['json', 'text', 'blob', 'stream']).default('json'),
});

export const HTTP_INTEGRATION: BaseIntegration = {
  id: 'http',
  type: 'http',
  name: 'HTTP Request',
  description: 'Make HTTP/REST API calls to any endpoint',
  icon: Globe,
  color: 'text-blue-500',
  authType: 'none',
  configSchema: httpConfigSchema,
  requiresConnection: false,
  actions: [
    {
      id: 'http.request',
      name: 'HTTP Request',
      description: 'Make an HTTP request to any API',
      icon: Send,
      configSchema: httpRequestActionSchema,
    },
    {
      id: 'http.webhook',
      name: 'Webhook',
      description: 'Receive HTTP webhooks',
      icon: Webhook,
      configSchema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
        validateSignature: z.boolean().default(false),
        signatureHeader: z.string().optional(),
        signatureSecret: z.string().optional(),
      }),
    },
  ],
};

// ============================================================================
// Email Integration (SMTP/IMAP)
// ============================================================================

const emailConnectionSchema = z.object({
  provider: z.enum(['smtp', 'gmail', 'outlook', 'sendgrid', 'mailgun', 'ses']),
  smtpHost: z.string().optional(),
  smtpPort: z.number().min(1).max(65535).optional(),
  smtpSecure: z.boolean().default(true),
  imapHost: z.string().optional(),
  imapPort: z.number().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
});

const sendEmailActionSchema = z.object({
  to: z
    .array(z.string().email())
    .min(1, 'At least one recipient required')
    .max(100, 'Maximum 100 recipients'),
  cc: z.array(z.string().email()).max(100).optional(),
  bcc: z.array(z.string().email()).max(100).optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  bodyType: z.enum(['text', 'html']).default('html'),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(), // Base64 encoded
        contentType: z.string(),
        size: z.number(),
      }),
    )
    .max(10)
    .optional(),
  replyTo: z.string().email().optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  headers: z.record(z.string()).optional(),
  trackOpens: z.boolean().default(false),
  trackClicks: z.boolean().default(false),
});

const receiveEmailActionSchema = z.object({
  folder: z.string().default('INBOX'),
  filter: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      hasAttachment: z.boolean().optional(),
      isUnread: z.boolean().default(true),
      since: z.string().datetime().optional(),
    })
    .optional(),
  markAsRead: z.boolean().default(false),
  maxEmails: z.number().min(1).max(100).default(10),
  sortBy: z.enum(['date', 'from', 'subject']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const EMAIL_INTEGRATION: BaseIntegration = {
  id: 'email',
  type: 'email',
  name: 'Email',
  description: 'Send and receive emails via SMTP/IMAP',
  icon: Mail,
  color: 'text-red-500',
  authType: 'basic',
  configSchema: emailConnectionSchema,
  requiresConnection: true,
  actions: [
    {
      id: 'email.send',
      name: 'Send Email',
      description: 'Send an email with attachments and tracking',
      icon: Send,
      configSchema: sendEmailActionSchema,
    },
    {
      id: 'email.receive',
      name: 'Receive Email',
      description: 'Fetch emails from inbox with filters',
      icon: Inbox,
      configSchema: receiveEmailActionSchema,
    },
  ],
};

// ============================================================================
// Slack Integration
// ============================================================================

const slackConnectionSchema = z.object({
  workspaceId: z.string().min(1),
  botToken: z.string().min(1), // xoxb-...
  appToken: z.string().optional(), // xapp-...
  signingSecret: z.string().min(1),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).default([
    'chat:write',
    'channels:read',
    'users:read',
    'files:write',
  ]),
});

const slackSendMessageActionSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  text: z.string().min(1, 'Message text is required').max(4000),
  blocks: z.array(z.record(z.unknown())).optional(), // Slack Block Kit JSON
  threadTs: z.string().optional(), // Reply to thread
  attachments: z.array(z.record(z.unknown())).optional(),
  metadata: z.record(z.unknown()).optional(),
  unfurlLinks: z.boolean().default(true),
  unfurlMedia: z.boolean().default(true),
  parseMode: z.enum(['none', 'full']).default('none'),
  linkNames: z.boolean().default(false),
});

const slackCreateChannelActionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-_]+$/, 'Channel name must be lowercase alphanumeric with dashes/underscores'),
  description: z.string().max(250).optional(),
  isPrivate: z.boolean().default(false),
  userIds: z.array(z.string()).optional(),
});

const slackInviteUserActionSchema = z.object({
  channelId: z.string().min(1),
  userIds: z.array(z.string()).min(1, 'At least one user ID required').max(1000),
});

const slackUploadFileActionSchema = z.object({
  channels: z.array(z.string()).min(1, 'At least one channel required'),
  filename: z.string().min(1),
  content: z.string().min(1), // Base64 or URL
  title: z.string().optional(),
  initialComment: z.string().optional(),
  threadTs: z.string().optional(),
});

export const SLACK_INTEGRATION: BaseIntegration = {
  id: 'slack',
  type: 'slack',
  name: 'Slack',
  description: 'Send messages, create channels, and interact with Slack',
  icon: SlackIcon,
  color: 'text-purple-500',
  authType: 'oauth2',
  configSchema: slackConnectionSchema,
  requiresConnection: true,
  actions: [
    {
      id: 'slack.send_message',
      name: 'Send Message',
      description: 'Post a message to a Slack channel',
      icon: Send,
      configSchema: slackSendMessageActionSchema,
      requiredScopes: ['chat:write'],
    },
    {
      id: 'slack.create_channel',
      name: 'Create Channel',
      description: 'Create a new Slack channel',
      icon: SlackIcon,
      configSchema: slackCreateChannelActionSchema,
      requiredScopes: ['channels:manage', 'groups:write'],
    },
    {
      id: 'slack.invite_user',
      name: 'Invite User',
      description: 'Invite users to a Slack channel',
      icon: SlackIcon,
      configSchema: slackInviteUserActionSchema,
      requiredScopes: ['channels:manage', 'groups:write'],
    },
    {
      id: 'slack.upload_file',
      name: 'Upload File',
      description: 'Upload a file to Slack',
      icon: Send,
      configSchema: slackUploadFileActionSchema,
      requiredScopes: ['files:write'],
    },
  ],
};

// ============================================================================
// GitHub Integration
// ============================================================================

const githubConnectionSchema = z.object({
  accessToken: z.string().min(1), // GitHub Personal Access Token or OAuth token
  username: z.string().optional(),
  organization: z.string().optional(),
  scopes: z.array(z.string()).default(['repo', 'issues', 'pull_requests']),
});

const githubCreateIssueActionSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  title: z.string().min(1, 'Issue title is required').max(256),
  body: z.string().optional(),
  assignees: z.array(z.string()).max(10).optional(),
  labels: z.array(z.string()).max(100).optional(),
  milestone: z.number().optional(),
});

const githubCreatePRActionSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1).max(256),
  body: z.string().optional(),
  head: z.string().min(1, 'Source branch is required'),
  base: z.string().min(1, 'Target branch is required'),
  draft: z.boolean().default(false),
  maintainerCanModify: z.boolean().default(true),
  assignees: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
});

const githubCommentActionSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  issueNumber: z.number().min(1),
  body: z.string().min(1, 'Comment body is required'),
});

const githubMergeActionSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().min(1),
  commitTitle: z.string().optional(),
  commitMessage: z.string().optional(),
  mergeMethod: z.enum(['merge', 'squash', 'rebase']).default('merge'),
  deleteBranch: z.boolean().default(false),
});

const githubGetIssuesActionSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  state: z.enum(['open', 'closed', 'all']).default('open'),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  creator: z.string().optional(),
  since: z.string().datetime().optional(),
  perPage: z.number().min(1).max(100).default(30),
  page: z.number().min(1).default(1),
  sort: z.enum(['created', 'updated', 'comments']).default('created'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const GITHUB_INTEGRATION: BaseIntegration = {
  id: 'github',
  type: 'github',
  name: 'GitHub',
  description: 'Create issues, PRs, and manage repositories',
  icon: Github,
  color: 'text-gray-700',
  authType: 'oauth2',
  configSchema: githubConnectionSchema,
  requiresConnection: true,
  actions: [
    {
      id: 'github.create_issue',
      name: 'Create Issue',
      description: 'Create a new GitHub issue',
      icon: Github,
      configSchema: githubCreateIssueActionSchema,
      requiredScopes: ['repo'],
    },
    {
      id: 'github.create_pr',
      name: 'Create Pull Request',
      description: 'Create a new pull request',
      icon: Github,
      configSchema: githubCreatePRActionSchema,
      requiredScopes: ['repo'],
    },
    {
      id: 'github.comment',
      name: 'Add Comment',
      description: 'Comment on an issue or PR',
      icon: Send,
      configSchema: githubCommentActionSchema,
      requiredScopes: ['repo'],
    },
    {
      id: 'github.merge_pr',
      name: 'Merge Pull Request',
      description: 'Merge a pull request',
      icon: Github,
      configSchema: githubMergeActionSchema,
      requiredScopes: ['repo'],
    },
    {
      id: 'github.get_issues',
      name: 'Get Issues',
      description: 'Fetch issues from a repository',
      icon: Inbox,
      configSchema: githubGetIssuesActionSchema,
      requiredScopes: ['repo'],
    },
  ],
};

// ============================================================================
// Calendar Integration (Google Calendar / Outlook)
// ============================================================================

const calendarConnectionSchema = z.object({
  provider: z.enum(['google', 'outlook', 'ical']),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  calendarId: z.string().default('primary'),
  timezone: z.string().default('UTC'),
  scopes: z
    .array(z.string())
    .default(['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']),
});

const calendarCreateEventActionSchema = z.object({
  calendarId: z.string().default('primary'),
  summary: z.string().min(1, 'Event title is required').max(1024),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime('Start time must be valid ISO 8601 datetime'),
  endTime: z.string().datetime('End time must be valid ISO 8601 datetime'),
  timezone: z.string().default('UTC'),
  allDay: z.boolean().default(false),
  attendees: z
    .array(
      z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
        optional: z.boolean().default(false),
        responseStatus: z.enum(['needsAction', 'accepted', 'declined', 'tentative']).optional(),
      }),
    )
    .optional(),
  reminders: z
    .array(
      z.object({
        method: z.enum(['email', 'popup']),
        minutes: z.number().min(0).max(40320), // Max 4 weeks
      }),
    )
    .optional(),
  recurrence: z.array(z.string()).optional(), // RRULE format
  color: z.string().optional(),
  visibility: z.enum(['default', 'public', 'private', 'confidential']).default('default'),
  conferenceData: z
    .object({
      createRequest: z.boolean().default(false),
      conferenceSolution: z.enum(['hangoutsMeet', 'zoom', 'teams']).optional(),
    })
    .optional(),
});

const calendarGetEventsActionSchema = z.object({
  calendarId: z.string().default('primary'),
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  query: z.string().optional(),
  maxResults: z.number().min(1).max(2500).default(250),
  orderBy: z.enum(['startTime', 'updated']).default('startTime'),
  singleEvents: z.boolean().default(true),
  showDeleted: z.boolean().default(false),
});

const calendarUpdateEventActionSchema = z.object({
  calendarId: z.string().default('primary'),
  eventId: z.string().min(1, 'Event ID is required'),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.object({ email: z.string().email() })).optional(),
  reminders: z
    .array(
      z.object({
        method: z.enum(['email', 'popup']),
        minutes: z.number(),
      }),
    )
    .optional(),
  sendUpdates: z.enum(['all', 'externalOnly', 'none']).default('all'),
});

const calendarDeleteEventActionSchema = z.object({
  calendarId: z.string().default('primary'),
  eventId: z.string().min(1, 'Event ID is required'),
  sendUpdates: z.enum(['all', 'externalOnly', 'none']).default('all'),
});

export const CALENDAR_INTEGRATION: BaseIntegration = {
  id: 'calendar',
  type: 'calendar',
  name: 'Calendar',
  description: 'Manage calendar events (Google Calendar, Outlook)',
  icon: Calendar,
  color: 'text-blue-600',
  authType: 'oauth2',
  configSchema: calendarConnectionSchema,
  requiresConnection: true,
  actions: [
    {
      id: 'calendar.create_event',
      name: 'Create Event',
      description: 'Create a new calendar event',
      icon: Calendar,
      configSchema: calendarCreateEventActionSchema,
      requiredScopes: ['https://www.googleapis.com/auth/calendar.events'],
    },
    {
      id: 'calendar.get_events',
      name: 'Get Events',
      description: 'Fetch calendar events',
      icon: Inbox,
      configSchema: calendarGetEventsActionSchema,
      requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
    {
      id: 'calendar.update_event',
      name: 'Update Event',
      description: 'Update an existing calendar event',
      icon: Calendar,
      configSchema: calendarUpdateEventActionSchema,
      requiredScopes: ['https://www.googleapis.com/auth/calendar.events'],
    },
    {
      id: 'calendar.delete_event',
      name: 'Delete Event',
      description: 'Delete a calendar event',
      icon: Calendar,
      configSchema: calendarDeleteEventActionSchema,
      requiredScopes: ['https://www.googleapis.com/auth/calendar.events'],
    },
  ],
};

// ============================================================================
// Registry & Helper Functions
// ============================================================================

export const ALL_INTEGRATIONS: BaseIntegration[] = [
  HTTP_INTEGRATION,
  EMAIL_INTEGRATION,
  SLACK_INTEGRATION,
  GITHUB_INTEGRATION,
  CALENDAR_INTEGRATION,
];

export function getIntegrationById(id: string): BaseIntegration | undefined {
  return ALL_INTEGRATIONS.find(integration => integration.id === id);
}

export function getIntegrationsByType(type: IntegrationType): BaseIntegration[] {
  return ALL_INTEGRATIONS.filter(integration => integration.type === type);
}

export function getIntegrationAction(
  integrationId: string,
  actionId: string,
): IntegrationAction | undefined {
  const integration = getIntegrationById(integrationId);
  return integration?.actions.find(action => action.id === actionId);
}

export function searchIntegrations(query: string): BaseIntegration[] {
  const lowerQuery = query.toLowerCase();
  return ALL_INTEGRATIONS.filter(
    integration =>
      integration.name.toLowerCase().includes(lowerQuery) ||
      integration.description.toLowerCase().includes(lowerQuery) ||
      integration.actions.some(
        action =>
          action.name.toLowerCase().includes(lowerQuery) ||
          action.description.toLowerCase().includes(lowerQuery),
      ),
  );
}

// ============================================================================
// OAuth Configuration
// ============================================================================

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export const OAUTH_CONFIGS: Record<string, Partial<OAuthConfig>> = {
  slack: {
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read', 'users:read', 'files:write'],
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:user', 'user:email'],
  },
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
};

export function getOAuthUrl(
  integrationId: string,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const config = OAUTH_CONFIGS[integrationId];
  if (!config?.authorizationUrl || !config.scopes) {
    throw new Error(`OAuth configuration not found for integration: ${integrationId}`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state,
    response_type: 'code',
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

// ============================================================================
// Integration Validation
// ============================================================================

export async function validateIntegrationConnection(
  integration: BaseIntegration,
  credentials: Record<string, unknown>,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Validate against schema
    const result = integration.configSchema.safeParse(credentials);
    if (!result.success) {
      return {
        valid: false,
        error: result.error.errors.map(e => e.message).join(', '),
      };
    }

    // Perform actual connection test based on integration type
    switch (integration.type) {
      case 'slack':
        // Test Slack connection with auth.test API
        if (!credentials.botToken) {
          return { valid: false, error: 'Bot token is required' };
        }
        break;

      case 'github':
        // Test GitHub connection with user API
        if (!credentials.accessToken) {
          return { valid: false, error: 'Access token is required' };
        }
        break;

      case 'email':
        // Test SMTP connection
        if (!credentials.smtpHost && !credentials.apiKey) {
          return { valid: false, error: 'SMTP host or API key is required' };
        }
        break;

      case 'calendar':
        // Test calendar API access
        if (!credentials.accessToken) {
          return { valid: false, error: 'Access token is required' };
        }
        break;

      case 'http':
        // HTTP doesn't require connection validation
        break;
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}
