/**
 * Admin-related TypeScript types
 * @module types/admin
 */

// =============================================================================
// Dashboard Statistics
// =============================================================================

/**
 * Growth metrics for a specific time period
 */
export interface GrowthMetric {
  /** Current value */
  current: number;
  /** Previous period value for comparison */
  previous: number;
  /** Percentage change */
  percentageChange: number;
  /** Whether the change is positive */
  isPositive: boolean;
}

/**
 * Dashboard statistics overview
 */
export interface DashboardStats {
  /** Total number of active users */
  activeUsers: GrowthMetric;
  /** Total number of workspace members */
  totalMembers: GrowthMetric;
  /** Total number of channels */
  totalChannels: GrowthMetric;
  /** Total number of messages sent */
  totalMessages: GrowthMetric;
  /** Storage usage in bytes */
  storageUsed: {
    current: number;
    limit: number;
    percentage: number;
  };
  /** API usage statistics */
  apiUsage: {
    current: number;
    limit: number;
    percentage: number;
  };
  /** Recent activity trends */
  activityTrends: {
    date: Date;
    users: number;
    messages: number;
    channels: number;
  }[];
  /** Top contributors */
  topContributors: {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string;
    messageCount: number;
    channelCount: number;
  }[];
}

// =============================================================================
// User Management
// =============================================================================

/**
 * Admin user status
 */
export type AdminUserStatus = 'active' | 'suspended' | 'pending' | 'deleted';

/**
 * User search filters
 */
export interface UserFilters {
  /** Filter by status */
  status?: AdminUserStatus;
  /** Filter by role ID */
  roleId?: string;
  /** Search by name or email */
  search?: string;
  /** Sort field */
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastActiveAt';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Detailed user information for admin
 */
export interface AdminUser {
  /** User ID */
  id: string;
  /** User's name */
  name: string | null;
  /** User's email */
  email: string;
  /** User's display name */
  displayName?: string | null;
  /** Profile avatar URL */
  avatarUrl?: string | null;
  /** Current status */
  status: AdminUserStatus;
  /** Assigned role ID */
  roleId: string | null;
  /** Role details */
  role?: {
    id: string;
    name: string;
    color?: string | null;
  };
  /** Account creation date */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt?: Date | null;
  /** Last login timestamp */
  lastLoginAt?: Date | null;
  /** Email verification status */
  emailVerified: boolean;
  /** Two-factor authentication status */
  twoFactorEnabled: boolean;
  /** Number of workspaces user is member of */
  workspaceCount?: number;
  /** Total messages sent */
  messageCount?: number;
  /** Custom user metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Paginated users response
 */
export interface PaginatedUsers {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// =============================================================================
// Audit Logs
// =============================================================================

/**
 * Audit log action types
 */
export type AuditActionType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.suspended'
  | 'user.unsuspended'
  | 'user.login'
  | 'user.logout'
  | 'user.password_changed'
  | 'member.invited'
  | 'member.accepted'
  | 'member.removed'
  | 'member.role_changed'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'settings.updated'
  | 'billing.updated'
  | 'billing.upgraded'
  | 'billing.downgraded'
  | 'channel.created'
  | 'channel.deleted'
  | 'workspace.created'
  | 'workspace.deleted';

/**
 * Audit log entry
 */
export interface AuditLog {
  /** Unique audit log ID */
  id: string;
  /** Action type performed */
  action: AuditActionType;
  /** ID of the user who performed the action */
  actorId: string;
  /** Actor's details */
  actor?: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl?: string | null;
  };
  /** Type of target resource */
  targetType: string | null;
  /** ID of the target resource */
  targetId: string | null;
  /** Name of the target resource */
  targetName?: string | null;
  /** Additional metadata about the action */
  metadata?: Record<string, unknown>;
  /** IP address of the actor */
  ipAddress?: string | null;
  /** User agent string */
  userAgent?: string | null;
  /** Timestamp of the action */
  createdAt: Date;
}

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  /** Filter by action type */
  action?: AuditActionType;
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by target type */
  targetType?: string;
  /** Filter by target ID */
  targetId?: string;
  /** Start date for date range */
  startDate?: Date;
  /** End date for date range */
  endDate?: Date;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Paginated audit logs response
 */
export interface PaginatedAuditLogs {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// =============================================================================
// Permissions
// =============================================================================

/**
 * Permission resource types
 */
export type PermissionResource =
  | 'workspace'
  | 'channel'
  | 'message'
  | 'user'
  | 'role'
  | 'settings'
  | 'billing'
  | 'integration'
  | '*';

/**
 * Permission action types
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | '*';

/**
 * Permission definition
 */
export interface Permission {
  /** Resource the permission applies to */
  resource: PermissionResource;
  /** Actions allowed on the resource */
  actions: PermissionAction[];
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  /** Whether the permission is granted */
  granted: boolean;
  /** Reason for denial if not granted */
  reason?: string;
}

/**
 * Bulk permission check result
 */
export interface BulkPermissionCheckResult {
  [key: string]: PermissionCheckResult;
}

// =============================================================================
// Workspace Settings
// =============================================================================

/**
 * General workspace settings
 */
export interface GeneralSettings {
  /** Workspace name */
  name: string;
  /** URL slug */
  slug: string;
  /** Description */
  description?: string;
  /** Timezone */
  timezone: string;
  /** Language code */
  language: string;
  /** Custom logo URL */
  logoUrl?: string;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Enable email notifications */
  emailNotifications: boolean;
  /** Enable Slack notifications */
  slackNotifications: boolean;
  /** Send daily digest emails */
  dailyDigest: boolean;
  /** Send mention alerts */
  mentionAlerts: boolean;
  /** Send weekly summaries */
  weeklySummary: boolean;
}

/**
 * Security settings
 */
export interface SecuritySettings {
  /** Require multi-factor authentication */
  requireMfa: boolean;
  /** Session timeout in minutes */
  sessionTimeoutMinutes: number;
  /** Allowed email domains for signup */
  allowedDomains: string[];
  /** IP whitelist */
  ipWhitelist: string[];
  /** Password minimum length */
  passwordMinLength: number;
  /** Require password complexity */
  requirePasswordComplexity: boolean;
}

/**
 * Integration settings
 */
export interface IntegrationSettings {
  /** Enable Slack integration */
  slackEnabled: boolean;
  /** Enable GitHub integration */
  githubEnabled: boolean;
  /** Enable webhooks */
  webhooksEnabled: boolean;
  /** Enable API access */
  apiEnabled: boolean;
  /** API rate limit per hour */
  apiRateLimit: number;
}

/**
 * Complete workspace admin settings
 */
export interface WorkspaceAdminSettings {
  general: GeneralSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  integrations: IntegrationSettings;
  customFields?: Record<string, unknown>;
}

// =============================================================================
// Billing
// =============================================================================

/**
 * Subscription plan types
 */
export type PlanType = 'free' | 'starter' | 'professional' | 'business' | 'enterprise';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';

/**
 * Usage metrics
 */
export interface UsageMetrics {
  /** Current number of members */
  members: number;
  /** Maximum members allowed */
  membersLimit: number;
  /** Storage used in bytes */
  storage: number;
  /** Storage limit in bytes */
  storageLimit: number;
  /** Number of channels */
  channels: number;
  /** Maximum channels allowed */
  channelsLimit: number;
  /** API calls this period */
  apiCalls?: number;
  /** API calls limit */
  apiCallsLimit?: number;
}

/**
 * Billing information for admin
 */
export interface AdminBillingInfo {
  /** Current plan */
  plan: PlanType;
  /** Plan display name */
  planName: string;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Current billing period start */
  currentPeriodStart: Date;
  /** Current billing period end */
  currentPeriodEnd: Date;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** Trial end date if trialing */
  trialEnd?: Date | null;
  /** Usage metrics */
  usage: UsageMetrics;
  /** Enabled features */
  features: string[];
  /** Monthly/annual cost in cents */
  amount?: number;
  /** Currency code */
  currency?: string;
  /** Payment method last 4 digits */
  paymentMethodLast4?: string;
  /** Next invoice date */
  nextInvoiceDate?: Date;
  /** Next invoice amount in cents */
  nextInvoiceAmount?: number;
}

/**
 * Available plan for upgrade/downgrade
 */
export interface AvailablePlan {
  /** Plan type */
  type: PlanType;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Monthly price in cents */
  monthlyPrice: number;
  /** Annual price in cents */
  annualPrice: number;
  /** Features included */
  features: string[];
  /** Limits */
  limits: {
    members: number;
    storage: number;
    channels: number;
    apiCalls?: number;
  };
  /** Whether this is the current plan */
  isCurrent: boolean;
  /** Whether upgrade is available */
  canUpgrade: boolean;
}

// =============================================================================
// System Health
// =============================================================================

/**
 * System health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down';

/**
 * Individual service health
 */
export interface ServiceHealth {
  /** Service name */
  name: string;
  /** Current status */
  status: HealthStatus;
  /** Response time in ms */
  responseTime?: number;
  /** Last check timestamp */
  lastCheck: Date;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  /** Overall status */
  status: HealthStatus;
  /** Individual services */
  services: ServiceHealth[];
  /** System uptime in seconds */
  uptime: number;
  /** Database status */
  database: ServiceHealth;
  /** Redis/cache status */
  cache?: ServiceHealth;
  /** Storage status */
  storage?: ServiceHealth;
}
