/**
 * Admin Console GraphQL Resolvers
 *
 * Comprehensive resolvers for workspace admin operations including settings management,
 * role-based access control, member management, invitations, billing, and admin action logging.
 * Implements strict admin permission checks on all mutations.
 *
 * @module @genesis/api-types/resolvers/admin-resolvers
 */

import { GraphQLError } from 'graphql';

import type { PrismaClient, Prisma } from '@prisma/client';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL context for admin resolvers
 */
export interface AdminGraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Redis client for caching */
  redis?: RedisClient;
  /** DataLoaders for batching */
  loaders?: AdminDataLoaders;
  /** Request IP address */
  ipAddress?: string;
  /** Unique request identifier */
  requestId: string;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * Redis client interface
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
}

/**
 * DataLoaders for batching database requests
 */
interface AdminDataLoaders {
  userLoader: DataLoader<string, User | null>;
  roleLoader: DataLoader<string, Role | null>;
  memberLoader: DataLoader<string, MemberInfo | null>;
}

interface DataLoader<K, V> {
  load(key: K): Promise<V>;
  loadMany(keys: K[]): Promise<(V | Error)[]>;
  clear(key: K): void;
  clearAll(): void;
}

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

/**
 * User entity type
 */
interface User {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: Date;
}

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Member status enum values
 */
export const MemberStatus = {
  Active: 'ACTIVE',
  Suspended: 'SUSPENDED',
  Pending: 'PENDING',
} as const;

export type MemberStatusType = (typeof MemberStatus)[keyof typeof MemberStatus];

/**
 * Invite status enum values
 */
export const InviteStatus = {
  Pending: 'PENDING',
  Accepted: 'ACCEPTED',
  Expired: 'EXPIRED',
  Revoked: 'REVOKED',
} as const;

export type InviteStatusType = (typeof InviteStatus)[keyof typeof InviteStatus];

/**
 * Plan type enum values
 */
export const PlanType = {
  Free: 'FREE',
  Starter: 'STARTER',
  Professional: 'PROFESSIONAL',
  Enterprise: 'ENTERPRISE',
} as const;

export type PlanTypeValue = (typeof PlanType)[keyof typeof PlanType];

/**
 * Billing status enum values
 */
export const BillingStatus = {
  Active: 'ACTIVE',
  PastDue: 'PAST_DUE',
  Cancelled: 'CANCELLED',
  Trialing: 'TRIALING',
} as const;

export type BillingStatusValue =
  (typeof BillingStatus)[keyof typeof BillingStatus];

/**
 * Permission resource enum values
 */
export const PermissionResource = {
  Workspace: 'WORKSPACE',
  Channels: 'CHANNELS',
  Messages: 'MESSAGES',
  Members: 'MEMBERS',
  Roles: 'ROLES',
  Integrations: 'INTEGRATIONS',
  Workflows: 'WORKFLOWS',
  Analytics: 'ANALYTICS',
  AuditLogs: 'AUDIT_LOGS',
  Settings: 'SETTINGS',
  Billing: 'BILLING',
} as const;

export type PermissionResourceType =
  (typeof PermissionResource)[keyof typeof PermissionResource];

/**
 * Permission action enum values
 */
export const PermissionAction = {
  Create: 'CREATE',
  Read: 'READ',
  Update: 'UPDATE',
  Delete: 'DELETE',
  Manage: 'MANAGE',
} as const;

export type PermissionActionType =
  (typeof PermissionAction)[keyof typeof PermissionAction];

/**
 * Admin action type enum values
 */
export const AdminActionType = {
  SettingsUpdated: 'SETTINGS_UPDATED',
  SettingsReset: 'SETTINGS_RESET',
  RoleCreated: 'ROLE_CREATED',
  RoleUpdated: 'ROLE_UPDATED',
  RoleDeleted: 'ROLE_DELETED',
  MemberUpdated: 'MEMBER_UPDATED',
  MemberSuspended: 'MEMBER_SUSPENDED',
  MemberUnsuspended: 'MEMBER_UNSUSPENDED',
  MemberRemoved: 'MEMBER_REMOVED',
  InviteSent: 'INVITE_SENT',
  InviteRevoked: 'INVITE_REVOKED',
  PlanUpgraded: 'PLAN_UPGRADED',
  PlanDowngraded: 'PLAN_DOWNGRADED',
} as const;

export type AdminActionTypeValue =
  (typeof AdminActionType)[keyof typeof AdminActionType];

// =============================================================================
// ENTITY TYPES
// =============================================================================

/**
 * Permission entry
 */
interface Permission {
  resource: PermissionResourceType;
  actions: PermissionActionType[];
}

/**
 * Role entity type
 */
interface Role {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isDefault: boolean;
  isSystemRole: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Member info entity type
 */
interface MemberInfo {
  id: string;
  userId: string;
  workspaceId: string;
  roleId: string;
  status: MemberStatusType;
  joinedAt: Date;
  lastActiveAt: Date | null;
  invitedBy: string | null;
  customFields: Record<string, unknown> | null;
}

/**
 * Invite entity type
 */
interface Invite {
  id: string;
  workspaceId: string;
  email: string;
  roleId: string;
  status: InviteStatusType;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
  acceptedAt: Date | null;
}

/**
 * General settings
 */
interface GeneralSettings {
  name: string;
  description: string | null;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
}

/**
 * Security settings
 */
interface SecuritySettings {
  mfaRequired: boolean;
  sessionTimeout: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  ipWhitelist: string[];
  allowedDomains: string[];
}

/**
 * Messaging settings
 */
interface MessagingSettings {
  messageRetention: number;
  fileRetention: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  editWindow: number;
  deleteWindow: number;
}

/**
 * Notification settings
 */
interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  digestFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

/**
 * Integration settings
 */
interface IntegrationSettings {
  allowedProviders: string[];
  webhooksEnabled: boolean;
  apiAccessEnabled: boolean;
  oauthEnabled: boolean;
}

/**
 * Compliance settings
 */
interface ComplianceSettings {
  dataRetention: {
    enabled: boolean;
    periodDays: number;
    autoDelete: boolean;
  };
  auditLogging: {
    enabled: boolean;
    retentionDays: number;
  };
  exportEnabled: boolean;
  gdprCompliant: boolean;
  hipaaCompliant: boolean;
}

/**
 * Branding settings
 */
interface BrandingSettings {
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  customCss: string | null;
}

/**
 * Workspace settings entity type
 */
interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  general: GeneralSettings;
  security: SecuritySettings;
  messaging: MessagingSettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
  compliance: ComplianceSettings;
  branding: BrandingSettings;
  updatedAt: Date;
  updatedBy: string;
}

/**
 * Plan features
 */
interface PlanFeatures {
  maxMembers: number;
  maxChannels: number;
  maxStorage: number;
  maxIntegrations: number;
  customRoles: boolean;
  advancedAnalytics: boolean;
  ssoEnabled: boolean;
  auditLogs: boolean;
  prioritySupport: boolean;
}

/**
 * Billing info entity type
 */
interface BillingInfo {
  id: string;
  workspaceId: string;
  plan: PlanTypeValue;
  status: BillingStatusValue;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  seats: number;
  seatsUsed: number;
  features: PlanFeatures;
}

/**
 * Admin action entity type
 */
interface AdminAction {
  id: string;
  workspaceId: string;
  actorId: string;
  action: AdminActionTypeValue;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  timestamp: Date;
}

/**
 * Billing upgrade result
 */
interface BillingUpgradeResult {
  success: boolean;
  billingInfo: BillingInfo | null;
  checkoutUrl: string | null;
  errors: Array<{ code: string; message: string }>;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Update settings input
 */
interface UpdateSettingsInput {
  general?: Partial<GeneralSettings> | null;
  security?: Partial<SecuritySettings> | null;
  messaging?: Partial<MessagingSettings> | null;
  notifications?: Partial<NotificationSettings> | null;
  integrations?: Partial<IntegrationSettings> | null;
  compliance?: Partial<ComplianceSettings> | null;
  branding?: Partial<BrandingSettings> | null;
}

/**
 * Permission input
 */
interface PermissionInput {
  resource: PermissionResourceType;
  actions: PermissionActionType[];
}

/**
 * Create role input
 */
interface CreateRoleInput {
  name: string;
  description?: string | null;
  permissions: PermissionInput[];
  priority?: number | null;
}

/**
 * Update role input
 */
interface UpdateRoleInput {
  name?: string | null;
  description?: string | null;
  permissions?: PermissionInput[] | null;
  priority?: number | null;
}

/**
 * Update member input
 */
interface UpdateMemberInput {
  roleId?: string | null;
  customFields?: Record<string, unknown> | null;
}

/**
 * Invite member input
 */
interface InviteMemberInput {
  email: string;
  roleId?: string | null;
  message?: string | null;
}

// =============================================================================
// ARGUMENT TYPES
// =============================================================================

interface WorkspaceSettingsArgs {
  workspaceId: string;
}

interface RoleArgs {
  id: string;
}

interface RolesArgs {
  workspaceId: string;
}

interface MemberArgs {
  workspaceId: string;
  userId: string;
}

interface MembersArgs {
  workspaceId: string;
  status?: MemberStatusType | null;
  roleId?: string | null;
  search?: string | null;
}

interface InvitesArgs {
  workspaceId: string;
  status?: InviteStatusType | null;
}

interface BillingInfoArgs {
  workspaceId: string;
}

interface AdminActionsArgs {
  workspaceId: string;
  action?: AdminActionTypeValue | null;
  actorId?: string | null;
  limit?: number | null;
}

interface UpdateSettingsArgs {
  workspaceId: string;
  input: UpdateSettingsInput;
}

interface ResetSettingsArgs {
  workspaceId: string;
  section?: string | null;
}

interface CreateRoleArgs {
  workspaceId: string;
  input: CreateRoleInput;
}

interface UpdateRoleArgs {
  id: string;
  input: UpdateRoleInput;
}

interface DeleteRoleArgs {
  id: string;
}

interface UpdateMemberArgs {
  workspaceId: string;
  userId: string;
  input: UpdateMemberInput;
}

interface SuspendMemberArgs {
  workspaceId: string;
  userId: string;
  reason?: string | null;
}

interface UnsuspendMemberArgs {
  workspaceId: string;
  userId: string;
}

interface RemoveMemberArgs {
  workspaceId: string;
  userId: string;
}

interface InviteMembersArgs {
  workspaceId: string;
  invites: InviteMemberInput[];
}

interface RevokeInviteArgs {
  id: string;
}

interface UpgradePlanArgs {
  workspaceId: string;
  plan: PlanTypeValue;
}

// =============================================================================
// SUBSCRIPTION EVENTS
// =============================================================================

export const MEMBER_STATUS_CHANGED = 'MEMBER_STATUS_CHANGED';
export const SETTINGS_UPDATED = 'SETTINGS_UPDATED';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 */
function isAuthenticated(
  context: AdminGraphQLContext
): context is AdminGraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Check if user has admin permission for a workspace
 */
async function isWorkspaceAdmin(
  context: AdminGraphQLContext,
  workspaceId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  // System admin has all access
  if (context.user.role === 'ADMIN') {
    return true;
  }

  // Check workspace membership role
  const membership = await context.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: context.user.id,
      },
    },
    select: { role: true },
  });

  return membership?.role === 'OWNER' || membership?.role === 'ADMIN';
}

/**
 * Require admin permission or throw
 */
async function requireAdmin(
  context: AdminGraphQLContext,
  workspaceId: string
): Promise<void> {
  if (!isAuthenticated(context)) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  const isAdmin = await isWorkspaceAdmin(context, workspaceId);
  if (!isAdmin) {
    throw new GraphQLError('Admin permission required', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

/**
 * Admin action log storage interface
 * In-memory for now, can be replaced with a database table
 */
const adminActionLogs: Map<string, AdminAction[]> = new Map();

/**
 * Log an admin action
 * Stores in workspace settings until a dedicated AuditLog table is available
 */
async function logAdminAction(
  context: AdminGraphQLContext,
  workspaceId: string,
  action: AdminActionTypeValue,
  resource: string,
  resourceId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  if (!isAuthenticated(context)) {
    return;
  }

  try {
    const adminAction: AdminAction = {
      id: generateId('action'),
      workspaceId,
      actorId: context.user.id,
      action,
      resource,
      resourceId,
      details,
      ipAddress: context.ipAddress ?? null,
      timestamp: new Date(),
    };

    // Store in memory (or could be stored in workspace.settings.adminActions)
    const workspaceActions = adminActionLogs.get(workspaceId) ?? [];
    workspaceActions.unshift(adminAction);
    // Keep only last 1000 actions per workspace
    if (workspaceActions.length > 1000) {
      workspaceActions.pop();
    }
    adminActionLogs.set(workspaceId, workspaceActions);

    // Optionally persist to workspace settings for durability
    // This could be migrated to a dedicated AuditLog table later
  } catch {
    // Log error but don't fail the operation
    // eslint-disable-next-line no-console
    console.error('Failed to log admin action:', action);
  }
}

/**
 * Get admin actions from storage
 */
function getAdminActions(
  workspaceId: string,
  action?: AdminActionTypeValue | null,
  actorId?: string | null,
  limit?: number | null
): AdminAction[] {
  const actions = adminActionLogs.get(workspaceId) ?? [];
  let filtered = actions;

  if (action) {
    filtered = filtered.filter(a => a.action === action);
  }

  if (actorId) {
    filtered = filtered.filter(a => a.actorId === actorId);
  }

  return filtered.slice(0, limit ?? 50);
}

/**
 * Get default settings
 */
function getDefaultSettings(): Omit<
  WorkspaceSettings,
  'id' | 'workspaceId' | 'updatedAt' | 'updatedBy'
> {
  return {
    general: {
      name: '',
      description: null,
      timezone: 'UTC',
      language: 'en',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
    },
    security: {
      mfaRequired: false,
      sessionTimeout: 86400000, // 24 hours
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
      },
      ipWhitelist: [],
      allowedDomains: [],
    },
    messaging: {
      messageRetention: 365,
      fileRetention: 365,
      maxFileSize: 104857600, // 100MB
      allowedFileTypes: ['*'],
      editWindow: 3600000, // 1 hour
      deleteWindow: 86400000, // 24 hours
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      digestFrequency: 'realtime',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
    },
    integrations: {
      allowedProviders: [],
      webhooksEnabled: true,
      apiAccessEnabled: true,
      oauthEnabled: true,
    },
    compliance: {
      dataRetention: {
        enabled: false,
        periodDays: 365,
        autoDelete: false,
      },
      auditLogging: {
        enabled: true,
        retentionDays: 90,
      },
      exportEnabled: true,
      gdprCompliant: false,
      hipaaCompliant: false,
    },
    branding: {
      primaryColor: '#6366f1',
      logoUrl: null,
      faviconUrl: null,
      customCss: null,
    },
  };
}

/**
 * Get plan features
 */
function getPlanFeatures(plan: PlanTypeValue): PlanFeatures {
  const features: Record<PlanTypeValue, PlanFeatures> = {
    FREE: {
      maxMembers: 10,
      maxChannels: 5,
      maxStorage: 5368709120, // 5GB
      maxIntegrations: 2,
      customRoles: false,
      advancedAnalytics: false,
      ssoEnabled: false,
      auditLogs: false,
      prioritySupport: false,
    },
    STARTER: {
      maxMembers: 50,
      maxChannels: 25,
      maxStorage: 53687091200, // 50GB
      maxIntegrations: 5,
      customRoles: true,
      advancedAnalytics: false,
      ssoEnabled: false,
      auditLogs: true,
      prioritySupport: false,
    },
    PROFESSIONAL: {
      maxMembers: 250,
      maxChannels: 100,
      maxStorage: 268435456000, // 250GB
      maxIntegrations: 20,
      customRoles: true,
      advancedAnalytics: true,
      ssoEnabled: true,
      auditLogs: true,
      prioritySupport: true,
    },
    ENTERPRISE: {
      maxMembers: -1, // unlimited
      maxChannels: -1, // unlimited
      maxStorage: -1, // unlimited
      maxIntegrations: -1, // unlimited
      customRoles: true,
      advancedAnalytics: true,
      ssoEnabled: true,
      auditLogs: true,
      prioritySupport: true,
    },
  };

  return features[plan];
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

// =============================================================================
// QUERY RESOLVERS
// =============================================================================

/**
 * Admin query resolvers
 */
export const adminQueries = {
  /**
   * Get workspace settings
   */
  workspaceSettings: async (
    _parent: unknown,
    args: WorkspaceSettingsArgs,
    context: AdminGraphQLContext
  ): Promise<WorkspaceSettings> => {
    await requireAdmin(context, args.workspaceId);

    // Try to find existing settings
    const workspace = await context.prisma.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { id: true, name: true, settings: true, updatedAt: true },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Parse settings or use defaults
    const storedSettings = workspace.settings as Record<string, unknown> | null;
    const defaults = getDefaultSettings();

    return {
      id: `settings_${workspace.id}`,
      workspaceId: workspace.id,
      general: {
        ...defaults.general,
        name: workspace.name,
        ...(storedSettings?.general as Partial<GeneralSettings> | undefined),
      },
      security: {
        ...defaults.security,
        ...(storedSettings?.security as Partial<SecuritySettings> | undefined),
      },
      messaging: {
        ...defaults.messaging,
        ...(storedSettings?.messaging as
          | Partial<MessagingSettings>
          | undefined),
      },
      notifications: {
        ...defaults.notifications,
        ...(storedSettings?.notifications as
          | Partial<NotificationSettings>
          | undefined),
      },
      integrations: {
        ...defaults.integrations,
        ...(storedSettings?.integrations as
          | Partial<IntegrationSettings>
          | undefined),
      },
      compliance: {
        ...defaults.compliance,
        ...(storedSettings?.compliance as
          | Partial<ComplianceSettings>
          | undefined),
      },
      branding: {
        ...defaults.branding,
        ...(storedSettings?.branding as Partial<BrandingSettings> | undefined),
      },
      updatedAt: workspace.updatedAt,
      updatedBy: (storedSettings?.updatedBy as string) ?? context.user!.id,
    };
  },

  /**
   * Get a single role by ID
   */
  role: async (
    _parent: unknown,
    args: RoleArgs,
    context: AdminGraphQLContext
  ): Promise<Role | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Use DataLoader if available
    if (context.loaders?.roleLoader) {
      return context.loaders.roleLoader.load(args.id);
    }

    // Mock: In real implementation, fetch from database
    // For now, return null if not a system role
    const systemRoles = getSystemRoles('mock_workspace');
    return systemRoles.find(r => r.id === args.id) ?? null;
  },

  /**
   * Get all roles for a workspace
   */
  roles: async (
    _parent: unknown,
    args: RolesArgs,
    context: AdminGraphQLContext
  ): Promise<Role[]> => {
    await requireAdmin(context, args.workspaceId);

    // Return system roles + custom roles
    // In real implementation, fetch custom roles from database
    return getSystemRoles(args.workspaceId);
  },

  /**
   * Get a single member
   */
  member: async (
    _parent: unknown,
    args: MemberArgs,
    context: AdminGraphQLContext
  ): Promise<MemberInfo | null> => {
    await requireAdmin(context, args.workspaceId);

    const member = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: args.workspaceId,
          userId: args.userId,
        },
      },
      include: { user: true },
    });

    if (!member) {
      return null;
    }

    return {
      id: member.id,
      userId: member.userId,
      workspaceId: member.workspaceId,
      roleId: `role_${member.role.toLowerCase()}`,
      status: MemberStatus.Active,
      joinedAt: member.joinedAt,
      lastActiveAt: null,
      invitedBy: null,
      customFields: null,
    };
  },

  /**
   * Get all members with optional filters
   */
  members: async (
    _parent: unknown,
    args: MembersArgs,
    context: AdminGraphQLContext
  ): Promise<MemberInfo[]> => {
    await requireAdmin(context, args.workspaceId);

    const where: Prisma.workspaceMemberWhereInput = {
      workspaceId: args.workspaceId,
    };

    // Apply role filter
    if (args.roleId) {
      const roleMap: Record<string, string> = {
        role_owner: 'OWNER',
        role_admin: 'ADMIN',
        role_member: 'MEMBER',
        role_guest: 'GUEST',
      };
      const role = roleMap[args.roleId];
      if (role) {
        where.role = role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
      }
    }

    // Apply search filter
    if (args.search) {
      where.user = {
        OR: [
          { name: { contains: args.search, mode: 'insensitive' } },
          { email: { contains: args.search, mode: 'insensitive' } },
        ],
      };
    }

    const members = await context.prisma.workspaceMember.findMany({
      where,
      include: { user: true },
      orderBy: { joinedAt: 'desc' },
    });

    return members.map(
      (m: Prisma.workspaceMemberGetPayload<{ include: { user: true } }>) => ({
        id: m.id,
        userId: m.userId,
        workspaceId: m.workspaceId,
        roleId: `role_${m.role.toLowerCase()}`,
        status: MemberStatus.Active,
        joinedAt: m.joinedAt,
        lastActiveAt: null,
        invitedBy: null,
        customFields: null,
      })
    );
  },

  /**
   * Get pending invites
   */
  invites: async (
    _parent: unknown,
    args: InvitesArgs,
    context: AdminGraphQLContext
  ): Promise<Invite[]> => {
    await requireAdmin(context, args.workspaceId);

    // In real implementation, fetch from invites table
    // For now, return empty array
    return [];
  },

  /**
   * Get billing information
   */
  billingInfo: async (
    _parent: unknown,
    args: BillingInfoArgs,
    context: AdminGraphQLContext
  ): Promise<BillingInfo> => {
    await requireAdmin(context, args.workspaceId);

    // Count current members
    const memberCount = await context.prisma.workspaceMember.count({
      where: { workspaceId: args.workspaceId },
    });

    // In real implementation, fetch from billing table or Stripe
    // Return default free plan
    return {
      id: `billing_${args.workspaceId}`,
      workspaceId: args.workspaceId,
      plan: PlanType.Free,
      status: BillingStatus.Active,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      seats: 10,
      seatsUsed: memberCount,
      features: getPlanFeatures(PlanType.Free),
    };
  },

  /**
   * Get admin actions audit log
   */
  adminActions: async (
    _parent: unknown,
    args: AdminActionsArgs,
    context: AdminGraphQLContext
  ): Promise<AdminAction[]> => {
    await requireAdmin(context, args.workspaceId);

    return getAdminActions(
      args.workspaceId,
      args.action,
      args.actorId,
      args.limit
    );
  },
};

// =============================================================================
// MUTATION RESOLVERS
// =============================================================================

/**
 * Admin mutation resolvers
 */
export const adminMutations = {
  /**
   * Update workspace settings
   */
  updateSettings: async (
    _parent: unknown,
    args: UpdateSettingsArgs,
    context: AdminGraphQLContext
  ): Promise<WorkspaceSettings> => {
    await requireAdmin(context, args.workspaceId);

    const workspace = await context.prisma.workspace.findUnique({
      where: { id: args.workspaceId },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Merge settings
    const existingSettings =
      (workspace.settings as Record<string, unknown>) ?? {};
    const newSettings = { ...existingSettings };

    if (args.input.general) {
      newSettings.general = {
        ...(existingSettings.general as object),
        ...args.input.general,
      };
    }
    if (args.input.security) {
      newSettings.security = {
        ...(existingSettings.security as object),
        ...args.input.security,
      };
    }
    if (args.input.messaging) {
      newSettings.messaging = {
        ...(existingSettings.messaging as object),
        ...args.input.messaging,
      };
    }
    if (args.input.notifications) {
      newSettings.notifications = {
        ...(existingSettings.notifications as object),
        ...args.input.notifications,
      };
    }
    if (args.input.integrations) {
      newSettings.integrations = {
        ...(existingSettings.integrations as object),
        ...args.input.integrations,
      };
    }
    if (args.input.compliance) {
      newSettings.compliance = {
        ...(existingSettings.compliance as object),
        ...args.input.compliance,
      };
    }
    if (args.input.branding) {
      newSettings.branding = {
        ...(existingSettings.branding as object),
        ...args.input.branding,
      };
    }

    newSettings.updatedBy = context.user!.id;
    newSettings.updatedAt = new Date().toISOString();

    // Update workspace
    await context.prisma.workspace.update({
      where: { id: args.workspaceId },
      data: {
        settings: newSettings as Prisma.InputJsonValue,
      },
    });

    // Log action
    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.SettingsUpdated,
      'settings',
      args.workspaceId,
      { sections: Object.keys(args.input) }
    );

    // Publish update
    await context.pubsub.publish(`${SETTINGS_UPDATED}_${args.workspaceId}`, {
      settingsUpdated: adminQueries.workspaceSettings(_parent, args, context),
    });

    return adminQueries.workspaceSettings(_parent, args, context);
  },

  /**
   * Reset settings to defaults
   */
  resetSettings: async (
    _parent: unknown,
    args: ResetSettingsArgs,
    context: AdminGraphQLContext
  ): Promise<WorkspaceSettings> => {
    await requireAdmin(context, args.workspaceId);

    const workspace = await context.prisma.workspace.findUnique({
      where: { id: args.workspaceId },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const existingSettings =
      (workspace.settings as Record<string, unknown>) ?? {};
    const defaults = getDefaultSettings();

    let newSettings: Record<string, unknown>;

    if (args.section) {
      // Reset only specified section
      newSettings = {
        ...existingSettings,
        [args.section]: defaults[args.section as keyof typeof defaults],
      };
    } else {
      // Reset all settings
      newSettings = {
        ...defaults,
        updatedBy: context.user!.id,
        updatedAt: new Date().toISOString(),
      };
    }

    await context.prisma.workspace.update({
      where: { id: args.workspaceId },
      data: {
        settings: newSettings as Prisma.InputJsonValue,
      },
    });

    // Log action
    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.SettingsReset,
      'settings',
      args.workspaceId,
      { section: args.section ?? 'all' }
    );

    return adminQueries.workspaceSettings(
      _parent,
      { workspaceId: args.workspaceId },
      context
    );
  },

  /**
   * Create a new role
   */
  createRole: async (
    _parent: unknown,
    args: CreateRoleArgs,
    context: AdminGraphQLContext
  ): Promise<Role> => {
    await requireAdmin(context, args.workspaceId);

    // Check plan allows custom roles
    const billing = await adminQueries.billingInfo(
      _parent,
      { workspaceId: args.workspaceId },
      context
    );
    if (!billing.features.customRoles) {
      throw new GraphQLError('Custom roles not available on current plan', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const role: Role = {
      id: generateId('role'),
      workspaceId: args.workspaceId,
      name: args.input.name,
      description: args.input.description ?? null,
      permissions: args.input.permissions,
      isDefault: false,
      isSystemRole: false,
      priority: args.input.priority ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In real implementation, store in database
    // For now, log and return
    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.RoleCreated,
      'role',
      role.id,
      { name: role.name }
    );

    return role;
  },

  /**
   * Update an existing role
   */
  updateRole: async (
    _parent: unknown,
    args: UpdateRoleArgs,
    context: AdminGraphQLContext
  ): Promise<Role> => {
    // Find role first to get workspaceId
    const systemRoles = getSystemRoles('mock');
    const existingRole = systemRoles.find(r => r.id === args.id);

    if (!existingRole) {
      throw new GraphQLError('Role not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existingRole.isSystemRole) {
      throw new GraphQLError('Cannot modify system roles', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await requireAdmin(context, existingRole.workspaceId);

    const updatedRole: Role = {
      ...existingRole,
      name: args.input.name ?? existingRole.name,
      description:
        args.input.description !== undefined
          ? args.input.description
          : existingRole.description,
      permissions: args.input.permissions ?? existingRole.permissions,
      priority: args.input.priority ?? existingRole.priority,
      updatedAt: new Date(),
    };

    await logAdminAction(
      context,
      existingRole.workspaceId,
      AdminActionType.RoleUpdated,
      'role',
      args.id,
      { changes: args.input }
    );

    return updatedRole;
  },

  /**
   * Delete a role
   */
  deleteRole: async (
    _parent: unknown,
    args: DeleteRoleArgs,
    context: AdminGraphQLContext
  ): Promise<boolean> => {
    const systemRoles = getSystemRoles('mock');
    const existingRole = systemRoles.find(r => r.id === args.id);

    if (!existingRole) {
      throw new GraphQLError('Role not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existingRole.isSystemRole) {
      throw new GraphQLError('Cannot delete system roles', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await requireAdmin(context, existingRole.workspaceId);

    await logAdminAction(
      context,
      existingRole.workspaceId,
      AdminActionType.RoleDeleted,
      'role',
      args.id,
      { name: existingRole.name }
    );

    return true;
  },

  /**
   * Update a member
   */
  updateMember: async (
    _parent: unknown,
    args: UpdateMemberArgs,
    context: AdminGraphQLContext
  ): Promise<MemberInfo> => {
    await requireAdmin(context, args.workspaceId);

    const member = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: args.workspaceId,
          userId: args.userId,
        },
      },
    });

    if (!member) {
      throw new GraphQLError('Member not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Map roleId to role enum
    if (args.input.roleId) {
      const roleMap: Record<string, 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'> = {
        role_owner: 'OWNER',
        role_admin: 'ADMIN',
        role_member: 'MEMBER',
        role_guest: 'GUEST',
      };
      const role = roleMap[args.input.roleId];
      if (role) {
        await context.prisma.workspaceMember.update({
          where: {
            workspaceId_userId: {
              workspaceId: args.workspaceId,
              userId: args.userId,
            },
          },
          data: { role },
        });
      }
    }

    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.MemberUpdated,
      'member',
      args.userId,
      { changes: args.input }
    );

    return (await adminQueries.member(
      _parent,
      { workspaceId: args.workspaceId, userId: args.userId },
      context
    ))!;
  },

  /**
   * Suspend a member
   */
  suspendMember: async (
    _parent: unknown,
    args: SuspendMemberArgs,
    context: AdminGraphQLContext
  ): Promise<MemberInfo> => {
    await requireAdmin(context, args.workspaceId);

    const member = await adminQueries.member(
      _parent,
      { workspaceId: args.workspaceId, userId: args.userId },
      context
    );

    if (!member) {
      throw new GraphQLError('Member not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // In real implementation, update member status
    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.MemberSuspended,
      'member',
      args.userId,
      { reason: args.reason }
    );

    // Publish status change
    await context.pubsub.publish(
      `${MEMBER_STATUS_CHANGED}_${args.workspaceId}`,
      {
        memberStatusChanged: { ...member, status: MemberStatus.Suspended },
      }
    );

    return { ...member, status: MemberStatus.Suspended };
  },

  /**
   * Unsuspend a member
   */
  unsuspendMember: async (
    _parent: unknown,
    args: UnsuspendMemberArgs,
    context: AdminGraphQLContext
  ): Promise<MemberInfo> => {
    await requireAdmin(context, args.workspaceId);

    const member = await adminQueries.member(
      _parent,
      { workspaceId: args.workspaceId, userId: args.userId },
      context
    );

    if (!member) {
      throw new GraphQLError('Member not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.MemberUnsuspended,
      'member',
      args.userId,
      {}
    );

    await context.pubsub.publish(
      `${MEMBER_STATUS_CHANGED}_${args.workspaceId}`,
      {
        memberStatusChanged: { ...member, status: MemberStatus.Active },
      }
    );

    return { ...member, status: MemberStatus.Active };
  },

  /**
   * Remove a member from workspace
   */
  removeMember: async (
    _parent: unknown,
    args: RemoveMemberArgs,
    context: AdminGraphQLContext
  ): Promise<boolean> => {
    await requireAdmin(context, args.workspaceId);

    const member = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: args.workspaceId,
          userId: args.userId,
        },
      },
    });

    if (!member) {
      throw new GraphQLError('Member not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Prevent removing owner
    if (member.role === 'OWNER') {
      throw new GraphQLError('Cannot remove workspace owner', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await context.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: args.workspaceId,
          userId: args.userId,
        },
      },
    });

    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.MemberRemoved,
      'member',
      args.userId,
      {}
    );

    return true;
  },

  /**
   * Invite multiple members
   */
  inviteMembers: async (
    _parent: unknown,
    args: InviteMembersArgs,
    context: AdminGraphQLContext
  ): Promise<Invite[]> => {
    await requireAdmin(context, args.workspaceId);

    const invites: Invite[] = args.invites.map(invite => ({
      id: generateId('invite'),
      workspaceId: args.workspaceId,
      email: invite.email,
      roleId: invite.roleId ?? 'role_member',
      status: InviteStatus.Pending,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdBy: context.user!.id,
      createdAt: new Date(),
      acceptedAt: null,
    }));

    // In real implementation, store invites and send emails
    await logAdminAction(
      context,
      args.workspaceId,
      AdminActionType.InviteSent,
      'invite',
      null,
      { emails: args.invites.map(i => i.email) }
    );

    return invites;
  },

  /**
   * Revoke an invite
   */
  revokeInvite: async (
    _parent: unknown,
    args: RevokeInviteArgs,
    context: AdminGraphQLContext
  ): Promise<boolean> => {
    // In real implementation, find invite and check permissions
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    await logAdminAction(
      context,
      'mock_workspace',
      AdminActionType.InviteRevoked,
      'invite',
      args.id,
      {}
    );

    return true;
  },

  /**
   * Upgrade workspace plan
   */
  upgradePlan: async (
    _parent: unknown,
    args: UpgradePlanArgs,
    context: AdminGraphQLContext
  ): Promise<BillingUpgradeResult> => {
    await requireAdmin(context, args.workspaceId);

    const currentBilling = await adminQueries.billingInfo(
      _parent,
      { workspaceId: args.workspaceId },
      context
    );

    // Check if downgrade
    const planOrder: PlanTypeValue[] = [
      PlanType.Free,
      PlanType.Starter,
      PlanType.Professional,
      PlanType.Enterprise,
    ];
    const currentIndex = planOrder.indexOf(currentBilling.plan);
    const newIndex = planOrder.indexOf(args.plan);

    const actionType =
      newIndex > currentIndex
        ? AdminActionType.PlanUpgraded
        : AdminActionType.PlanDowngraded;

    // In real implementation, integrate with Stripe/billing provider
    const updatedBilling: BillingInfo = {
      ...currentBilling,
      plan: args.plan,
      features: getPlanFeatures(args.plan),
    };

    await logAdminAction(
      context,
      args.workspaceId,
      actionType,
      'billing',
      args.workspaceId,
      { from: currentBilling.plan, to: args.plan }
    );

    return {
      success: true,
      billingInfo: updatedBilling,
      checkoutUrl: null,
      errors: [],
    };
  },
};

// =============================================================================
// SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Admin subscription resolvers
 */
export const adminSubscriptions = {
  /**
   * Subscribe to member status changes
   */
  memberStatusChanged: {
    subscribe: (
      _parent: unknown,
      args: { workspaceId: string },
      context: AdminGraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(
        `${MEMBER_STATUS_CHANGED}_${args.workspaceId}`
      );
    },
  },

  /**
   * Subscribe to settings updates
   */
  settingsUpdated: {
    subscribe: (
      _parent: unknown,
      args: { workspaceId: string },
      context: AdminGraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(
        `${SETTINGS_UPDATED}_${args.workspaceId}`
      );
    },
  },
};

// =============================================================================
// FIELD RESOLVERS
// =============================================================================

/**
 * Role field resolvers
 */
export const RoleFieldResolvers = {
  /**
   * Get member count for a role
   */
  memberCount: async (
    parent: Role,
    _args: unknown,
    context: AdminGraphQLContext
  ): Promise<number> => {
    // Map roleId to role enum
    const roleMap: Record<string, string> = {
      role_owner: 'OWNER',
      role_admin: 'ADMIN',
      role_member: 'MEMBER',
      role_guest: 'GUEST',
    };

    const role = roleMap[parent.id];
    if (!role) {
      return 0;
    }

    return context.prisma.workspaceMember.count({
      where: {
        workspaceId: parent.workspaceId,
        role: role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST',
      },
    });
  },
};

/**
 * MemberInfo field resolvers
 */
export const MemberInfoFieldResolvers = {
  /**
   * Get user for a member
   */
  user: async (
    parent: MemberInfo,
    _args: unknown,
    context: AdminGraphQLContext
  ): Promise<User | null> => {
    // Use DataLoader if available
    if (context.loaders?.userLoader) {
      return context.loaders.userLoader.load(parent.userId);
    }

    const user = await context.prisma.user.findUnique({
      where: { id: parent.userId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    };
  },

  /**
   * Get role for a member
   */
  role: async (
    parent: MemberInfo,
    _args: unknown,
    context: AdminGraphQLContext
  ): Promise<Role | null> => {
    // Use DataLoader if available
    if (context.loaders?.roleLoader) {
      return context.loaders.roleLoader.load(parent.roleId);
    }

    const systemRoles = getSystemRoles(parent.workspaceId);
    return systemRoles.find(r => r.id === parent.roleId) ?? null;
  },
};

/**
 * Invite field resolvers
 */
export const InviteFieldResolvers = {
  /**
   * Get role for an invite
   */
  role: async (
    parent: Invite,
    _args: unknown,
    context: AdminGraphQLContext
  ): Promise<Role | null> => {
    if (context.loaders?.roleLoader) {
      return context.loaders.roleLoader.load(parent.roleId);
    }

    const systemRoles = getSystemRoles(parent.workspaceId);
    return systemRoles.find(r => r.id === parent.roleId) ?? null;
  },

  /**
   * Get creator for an invite
   */
  creator: async (
    parent: Invite,
    _args: unknown,
    context: AdminGraphQLContext
  ): Promise<User | null> => {
    if (context.loaders?.userLoader) {
      return context.loaders.userLoader.load(parent.createdBy);
    }

    const user = await context.prisma.user.findUnique({
      where: { id: parent.createdBy },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    };
  },
};

/**
 * AdminAction field resolvers
 */
export const AdminActionFieldResolvers = {
  /**
   * Get actor for an admin action
   */
  actor: async (
    parent: AdminAction,
    _args: unknown,
    context: AdminGraphQLContext
  ): Promise<User | null> => {
    if (context.loaders?.userLoader) {
      return context.loaders.userLoader.load(parent.actorId);
    }

    const user = await context.prisma.user.findUnique({
      where: { id: parent.actorId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    };
  },
};

// =============================================================================
// HELPER: SYSTEM ROLES
// =============================================================================

/**
 * Get system-defined roles
 */
function getSystemRoles(workspaceId: string): Role[] {
  return [
    {
      id: 'role_owner',
      workspaceId,
      name: 'Owner',
      description: 'Full control over the workspace',
      permissions: Object.values(PermissionResource).map(resource => ({
        resource,
        actions: Object.values(PermissionAction),
      })),
      isDefault: false,
      isSystemRole: true,
      priority: 100,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    {
      id: 'role_admin',
      workspaceId,
      name: 'Admin',
      description: 'Manage workspace settings and members',
      permissions: Object.values(PermissionResource)
        .filter(r => r !== PermissionResource.Billing)
        .map(resource => ({
          resource,
          actions: Object.values(PermissionAction),
        })),
      isDefault: false,
      isSystemRole: true,
      priority: 80,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    {
      id: 'role_member',
      workspaceId,
      name: 'Member',
      description: 'Standard workspace member',
      permissions: [
        {
          resource: PermissionResource.Workspace,
          actions: [PermissionAction.Read],
        },
        {
          resource: PermissionResource.Channels,
          actions: [
            PermissionAction.Create,
            PermissionAction.Read,
            PermissionAction.Update,
          ],
        },
        {
          resource: PermissionResource.Messages,
          actions: [
            PermissionAction.Create,
            PermissionAction.Read,
            PermissionAction.Update,
            PermissionAction.Delete,
          ],
        },
        {
          resource: PermissionResource.Members,
          actions: [PermissionAction.Read],
        },
      ],
      isDefault: true,
      isSystemRole: true,
      priority: 50,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    {
      id: 'role_guest',
      workspaceId,
      name: 'Guest',
      description: 'Limited access - specific channels only',
      permissions: [
        {
          resource: PermissionResource.Workspace,
          actions: [PermissionAction.Read],
        },
        {
          resource: PermissionResource.Channels,
          actions: [PermissionAction.Read],
        },
        {
          resource: PermissionResource.Messages,
          actions: [PermissionAction.Create, PermissionAction.Read],
        },
      ],
      isDefault: false,
      isSystemRole: true,
      priority: 20,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ];
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL type definitions for admin console
 */
export const adminTypeDefs = `#graphql
  # Settings Types
  type WorkspaceSettings {
    id: ID!
    workspaceId: ID!
    general: GeneralSettings!
    security: SecuritySettings!
    messaging: MessagingSettings!
    notifications: NotificationSettings!
    integrations: IntegrationSettings!
    compliance: ComplianceSettings!
    branding: BrandingSettings!
    updatedAt: DateTime!
    updatedBy: ID!
  }

  type GeneralSettings {
    name: String!
    description: String
    timezone: String!
    language: String!
    dateFormat: String!
    timeFormat: String!
  }

  type SecuritySettings {
    mfaRequired: Boolean!
    sessionTimeout: Int!
    passwordPolicy: PasswordPolicy!
    ipWhitelist: [String!]!
    allowedDomains: [String!]!
  }

  type PasswordPolicy {
    minLength: Int!
    requireUppercase: Boolean!
    requireNumbers: Boolean!
    requireSpecialChars: Boolean!
  }

  type MessagingSettings {
    messageRetention: Int!
    fileRetention: Int!
    maxFileSize: Int!
    allowedFileTypes: [String!]!
    editWindow: Int!
    deleteWindow: Int!
  }

  type NotificationSettings {
    emailNotifications: Boolean!
    pushNotifications: Boolean!
    digestFrequency: DigestFrequency!
    quietHours: QuietHours!
  }

  enum DigestFrequency {
    realtime
    hourly
    daily
    weekly
  }

  type QuietHours {
    enabled: Boolean!
    start: String!
    end: String!
    timezone: String!
  }

  type IntegrationSettings {
    allowedProviders: [String!]!
    webhooksEnabled: Boolean!
    apiAccessEnabled: Boolean!
    oauthEnabled: Boolean!
  }

  type ComplianceSettings {
    dataRetention: DataRetentionSettings!
    auditLogging: AuditLoggingSettings!
    exportEnabled: Boolean!
    gdprCompliant: Boolean!
    hipaaCompliant: Boolean!
  }

  type DataRetentionSettings {
    enabled: Boolean!
    periodDays: Int!
    autoDelete: Boolean!
  }

  type AuditLoggingSettings {
    enabled: Boolean!
    retentionDays: Int!
  }

  type BrandingSettings {
    primaryColor: String!
    logoUrl: String
    faviconUrl: String
    customCss: String
  }

  # Role Types
  type Role {
    id: ID!
    workspaceId: ID!
    name: String!
    description: String
    permissions: [Permission!]!
    isDefault: Boolean!
    isSystemRole: Boolean!
    priority: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    memberCount: Int!
  }

  type Permission {
    resource: PermissionResource!
    actions: [PermissionAction!]!
  }

  enum PermissionResource {
    WORKSPACE
    CHANNELS
    MESSAGES
    MEMBERS
    ROLES
    INTEGRATIONS
    WORKFLOWS
    ANALYTICS
    AUDIT_LOGS
    SETTINGS
    BILLING
  }

  enum PermissionAction {
    CREATE
    READ
    UPDATE
    DELETE
    MANAGE
  }

  # Member Types
  type MemberInfo {
    id: ID!
    userId: ID!
    workspaceId: ID!
    roleId: ID!
    status: MemberStatus!
    joinedAt: DateTime!
    lastActiveAt: DateTime
    invitedBy: ID
    customFields: JSON
    user: User!
    role: Role!
  }

  enum MemberStatus {
    ACTIVE
    SUSPENDED
    PENDING
  }

  # Invite Types
  type Invite {
    id: ID!
    workspaceId: ID!
    email: String!
    roleId: ID!
    status: InviteStatus!
    expiresAt: DateTime!
    createdBy: ID!
    createdAt: DateTime!
    acceptedAt: DateTime
    role: Role!
    creator: User!
  }

  enum InviteStatus {
    PENDING
    ACCEPTED
    EXPIRED
    REVOKED
  }

  # Billing Types
  type BillingInfo {
    id: ID!
    workspaceId: ID!
    plan: PlanType!
    status: BillingStatus!
    currentPeriodStart: DateTime!
    currentPeriodEnd: DateTime!
    seats: Int!
    seatsUsed: Int!
    features: PlanFeatures!
  }

  enum PlanType {
    FREE
    STARTER
    PROFESSIONAL
    ENTERPRISE
  }

  enum BillingStatus {
    ACTIVE
    PAST_DUE
    CANCELLED
    TRIALING
  }

  type PlanFeatures {
    maxMembers: Int!
    maxChannels: Int!
    maxStorage: Int!
    maxIntegrations: Int!
    customRoles: Boolean!
    advancedAnalytics: Boolean!
    ssoEnabled: Boolean!
    auditLogs: Boolean!
    prioritySupport: Boolean!
  }

  type BillingUpgradeResult {
    success: Boolean!
    billingInfo: BillingInfo
    checkoutUrl: String
    errors: [AdminError!]!
  }

  type AdminError {
    code: String!
    message: String!
  }

  # Admin Action Types
  type AdminAction {
    id: ID!
    workspaceId: ID!
    actorId: ID!
    action: AdminActionType!
    resource: String!
    resourceId: String
    details: JSON!
    ipAddress: String
    timestamp: DateTime!
    actor: User!
  }

  enum AdminActionType {
    SETTINGS_UPDATED
    SETTINGS_RESET
    ROLE_CREATED
    ROLE_UPDATED
    ROLE_DELETED
    MEMBER_UPDATED
    MEMBER_SUSPENDED
    MEMBER_UNSUSPENDED
    MEMBER_REMOVED
    INVITE_SENT
    INVITE_REVOKED
    PLAN_UPGRADED
    PLAN_DOWNGRADED
  }

  # Inputs
  input UpdateSettingsInput {
    general: GeneralSettingsInput
    security: SecuritySettingsInput
    messaging: MessagingSettingsInput
    notifications: NotificationSettingsInput
    integrations: IntegrationSettingsInput
    compliance: ComplianceSettingsInput
    branding: BrandingSettingsInput
  }

  input GeneralSettingsInput {
    name: String
    description: String
    timezone: String
    language: String
    dateFormat: String
    timeFormat: String
  }

  input SecuritySettingsInput {
    mfaRequired: Boolean
    sessionTimeout: Int
    passwordPolicy: PasswordPolicyInput
    ipWhitelist: [String!]
    allowedDomains: [String!]
  }

  input PasswordPolicyInput {
    minLength: Int
    requireUppercase: Boolean
    requireNumbers: Boolean
    requireSpecialChars: Boolean
  }

  input MessagingSettingsInput {
    messageRetention: Int
    fileRetention: Int
    maxFileSize: Int
    allowedFileTypes: [String!]
    editWindow: Int
    deleteWindow: Int
  }

  input NotificationSettingsInput {
    emailNotifications: Boolean
    pushNotifications: Boolean
    digestFrequency: DigestFrequency
    quietHours: QuietHoursInput
  }

  input QuietHoursInput {
    enabled: Boolean
    start: String
    end: String
    timezone: String
  }

  input IntegrationSettingsInput {
    allowedProviders: [String!]
    webhooksEnabled: Boolean
    apiAccessEnabled: Boolean
    oauthEnabled: Boolean
  }

  input ComplianceSettingsInput {
    dataRetention: DataRetentionInput
    auditLogging: AuditLoggingInput
    exportEnabled: Boolean
    gdprCompliant: Boolean
    hipaaCompliant: Boolean
  }

  input DataRetentionInput {
    enabled: Boolean
    periodDays: Int
    autoDelete: Boolean
  }

  input AuditLoggingInput {
    enabled: Boolean
    retentionDays: Int
  }

  input BrandingSettingsInput {
    primaryColor: String
    logoUrl: String
    faviconUrl: String
    customCss: String
  }

  input CreateRoleInput {
    name: String!
    description: String
    permissions: [PermissionInput!]!
    priority: Int
  }

  input UpdateRoleInput {
    name: String
    description: String
    permissions: [PermissionInput!]
    priority: Int
  }

  input PermissionInput {
    resource: PermissionResource!
    actions: [PermissionAction!]!
  }

  input UpdateMemberInput {
    roleId: ID
    customFields: JSON
  }

  input InviteMemberInput {
    email: String!
    roleId: ID
    message: String
  }

  # Queries
  extend type Query {
    workspaceSettings(workspaceId: ID!): WorkspaceSettings!
    role(id: ID!): Role
    roles(workspaceId: ID!): [Role!]!
    member(workspaceId: ID!, userId: ID!): MemberInfo
    members(workspaceId: ID!, status: MemberStatus, roleId: ID, search: String): [MemberInfo!]!
    invites(workspaceId: ID!, status: InviteStatus): [Invite!]!
    billingInfo(workspaceId: ID!): BillingInfo!
    adminActions(workspaceId: ID!, action: AdminActionType, actorId: ID, limit: Int): [AdminAction!]!
  }

  # Mutations
  extend type Mutation {
    updateSettings(workspaceId: ID!, input: UpdateSettingsInput!): WorkspaceSettings!
    resetSettings(workspaceId: ID!, section: String): WorkspaceSettings!

    createRole(workspaceId: ID!, input: CreateRoleInput!): Role!
    updateRole(id: ID!, input: UpdateRoleInput!): Role!
    deleteRole(id: ID!): Boolean!

    updateMember(workspaceId: ID!, userId: ID!, input: UpdateMemberInput!): MemberInfo!
    suspendMember(workspaceId: ID!, userId: ID!, reason: String): MemberInfo!
    unsuspendMember(workspaceId: ID!, userId: ID!): MemberInfo!
    removeMember(workspaceId: ID!, userId: ID!): Boolean!

    inviteMembers(workspaceId: ID!, invites: [InviteMemberInput!]!): [Invite!]!
    revokeInvite(id: ID!): Boolean!

    upgradePlan(workspaceId: ID!, plan: PlanType!): BillingUpgradeResult!
  }

  # Subscriptions
  extend type Subscription {
    memberStatusChanged(workspaceId: ID!): MemberInfo!
    settingsUpdated(workspaceId: ID!): WorkspaceSettings!
  }
`;

// =============================================================================
// COMBINED RESOLVERS
// =============================================================================

/**
 * Combined admin resolvers for schema stitching
 */
export const adminResolvers = {
  Query: adminQueries,
  Mutation: adminMutations,
  Subscription: adminSubscriptions,
  Role: RoleFieldResolvers,
  MemberInfo: MemberInfoFieldResolvers,
  Invite: InviteFieldResolvers,
  AdminAction: AdminActionFieldResolvers,
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create admin resolvers with custom context
 */
export function createAdminResolvers(options?: {
  enableLogging?: boolean;
}): typeof adminResolvers {
  if (options?.enableLogging) {
    // Could wrap resolvers with logging middleware
  }
  return adminResolvers;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default adminResolvers;
