/**
 * Admin Validation Schemas
 * @module lib/validations/admin
 */

import { z } from 'zod';

export const ADMIN_ERROR_CODES = {
  UNAUTHORIZED: 'ADMIN_UNAUTHORIZED',
  FORBIDDEN: 'ADMIN_FORBIDDEN',
  INVALID_ROLE: 'ADMIN_INVALID_ROLE',
  PERMISSION_DENIED: 'ADMIN_PERMISSION_DENIED',
  INVALID_ACTION: 'ADMIN_INVALID_ACTION',
  USER_NOT_FOUND: 'ADMIN_USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'ADMIN_WORKSPACE_NOT_FOUND',
  MEMBER_NOT_FOUND: 'ADMIN_MEMBER_NOT_FOUND',
  MEMBER_NOT_SUSPENDED: 'ADMIN_MEMBER_NOT_SUSPENDED',
  MEMBER_ALREADY_SUSPENDED: 'ADMIN_MEMBER_ALREADY_SUSPENDED',
  NOT_FOUND: 'ADMIN_NOT_FOUND',
  INVALID_SETTINGS: 'ADMIN_INVALID_SETTINGS',
  VALIDATION_ERROR: 'ADMIN_VALIDATION_ERROR',
  INVITE_NOT_FOUND: 'ADMIN_INVITE_NOT_FOUND',
  INVITE_ALREADY_ACCEPTED: 'ADMIN_INVITE_ALREADY_ACCEPTED',
  INVITE_REVOKED: 'ADMIN_INVITE_REVOKED',
  INVITE_EXPIRED: 'ADMIN_INVITE_EXPIRED',
  INVALID_INVITE_TOKEN: 'ADMIN_INVALID_INVITE_TOKEN',
  EMAIL_ALREADY_MEMBER: 'ADMIN_EMAIL_ALREADY_MEMBER',
  ROLE_NOT_FOUND: 'ADMIN_ROLE_NOT_FOUND',
  ROLE_NAME_EXISTS: 'ADMIN_ROLE_NAME_EXISTS',
  CANNOT_MODIFY_SYSTEM_ROLE: 'ADMIN_CANNOT_MODIFY_SYSTEM_ROLE',
  CANNOT_DELETE_SYSTEM_ROLE: 'ADMIN_CANNOT_DELETE_SYSTEM_ROLE',
  CANNOT_MODIFY_OWNER: 'ADMIN_CANNOT_MODIFY_OWNER',
  CANNOT_SUSPEND_SELF: 'ADMIN_CANNOT_SUSPEND_SELF',
  CANNOT_REMOVE_SELF: 'ADMIN_CANNOT_REMOVE_SELF',
  PLAN_DOWNGRADE_NOT_ALLOWED: 'ADMIN_PLAN_DOWNGRADE_NOT_ALLOWED',
  INTERNAL_ERROR: 'ADMIN_INTERNAL_ERROR',
} as const;

export type AdminErrorCode =
  (typeof ADMIN_ERROR_CODES)[keyof typeof ADMIN_ERROR_CODES];

/**
 * Create a standardized admin error response
 */
export function createAdminErrorResponse(
  message: string,
  code: AdminErrorCode,
  extraData?: Record<string, unknown>
): { error: AdminErrorCode; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

export const adminRoleSchema = z.enum(['super_admin', 'admin', 'moderator']);

export const adminActionSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'suspend', 'restore']),
  targetId: z.string(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const adminSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  allowRegistration: z.boolean().optional(),
  maxUsers: z.number().positive().optional(),
  features: z.record(z.boolean()).optional(),
});

export const adminUserManagementSchema = z.object({
  userId: z.string(),
  role: adminRoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
});

/**
 * Create role schema
 */
export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z
    .array(
      z.object({
        resource: z.string(),
        actions: z.array(z.string()),
      })
    )
    .min(1, 'At least one permission is required'),
  color: z.string().optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

/**
 * Update role schema
 */
export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z
    .array(
      z.object({
        resource: z.string(),
        actions: z.array(z.string()),
      })
    )
    .optional(),
  color: z.string().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/**
 * Accept invite schema
 */
export const acceptInviteSchema = z.object({
  inviteId: z.string(),
  token: z.string(),
  password: z.string().min(8).optional(),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/**
 * Activity log filters schema
 */
export const activityLogFiltersSchema = z.object({
  action: z.string().optional(),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().positive().max(100).default(50),
  offset: z.coerce.number().nonnegative().default(0),
});

export type ActivityLogFilters = z.infer<typeof activityLogFiltersSchema>;

/**
 * Batch create invites schema
 */
export const batchCreateInvitesSchema = z.object({
  invites: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.string().optional(),
        roleId: z.string().optional(),
        expiresInDays: z.number().positive().max(90).optional(),
        message: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(50),
});

export type BatchCreateInvitesInput = z.infer<typeof batchCreateInvitesSchema>;

/**
 * Invite status enum
 * Moved here to be declared before inviteFiltersSchema uses it
 */
export const inviteStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED',
]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

/**
 * Member status enum
 * Moved here to be declared before memberFiltersSchema uses it
 */
export const memberStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

/**
 * Plan type enum
 * Moved here to be declared before upgradePlanSchema uses it
 */
export const planTypeSchema = z.enum([
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'BUSINESS',
  'ENTERPRISE',
]);

export type PlanType = z.infer<typeof planTypeSchema>;

/**
 * Invite filters schema
 */
export const inviteFiltersSchema = z.object({
  status: inviteStatusSchema.optional(),
});

export type InviteFilters = z.infer<typeof inviteFiltersSchema>;

/**
 * Member filters schema
 */
export const memberFiltersSchema = z.object({
  status: memberStatusSchema.optional(),
  roleId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().positive().max(100).default(20),
  offset: z.coerce.number().nonnegative().default(0),
});

export type MemberFilters = z.infer<typeof memberFiltersSchema>;

/**
 * Reset settings schema
 */
export const resetSettingsSchema = z.object({
  section: z
    .enum([
      'general',
      'notifications',
      'security',
      'integrations',
      'customFields',
    ])
    .optional(),
});

export type ResetSettingsInput = z.infer<typeof resetSettingsSchema>;

/**
 * Suspend member schema
 */
export const suspendMemberSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type SuspendMemberInput = z.infer<typeof suspendMemberSchema>;

/**
 * Update member schema
 */
export const updateMemberSchema = z.object({
  roleId: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/**
 * Upgrade plan schema
 */
export const upgradePlanSchema = z.object({
  plan: planTypeSchema,
});

export type UpgradePlanInput = z.infer<typeof upgradePlanSchema>;

/**
 * Invite object schema
 */
export const inviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  roleId: z.string().nullable(),
  status: inviteStatusSchema,
  message: z.string().nullable(),
  token: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
  invitedBy: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
  }),
});

export type Invite = z.infer<typeof inviteSchema>;

/**
 * Admin action type enum
 */
export const adminActionTypeSchema = z.enum([
  'create',
  'update',
  'delete',
  'suspend',
  'restore',
  'invite',
  'revoke',
  'promote',
  'demote',
  'ban',
  'unban',
  'member.suspended',
  'member.unsuspended',
  'member.role_changed',
  'member.removed',
  'role.created',
  'role.updated',
  'role.deleted',
  'invite.created',
  'invite.revoked',
  'settings.updated',
  'billing.upgraded',
]);

export type AdminActionType = z.infer<typeof adminActionTypeSchema>;

/**
 * Admin action object schema
 */
export const adminActionObjectSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string(),
  actor: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    })
    .optional(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  targetName: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.date(),
});

export type AdminAction = z.infer<typeof adminActionObjectSchema>;

/**
 * Role object schema
 */
export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(
    z.object({
      resource: z.string(),
      actions: z.array(z.string()),
    })
  ),
  isSystem: z.boolean(),
  color: z.string().nullable(),
  memberCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Role = z.infer<typeof roleSchema>;

/**
 * Workspace settings object schema
 */
export const workspaceSettingsSchema = z.object({
  general: z
    .object({
      timezone: z.string(),
      language: z.string(),
    })
    .optional(),
  notifications: z
    .object({
      emailNotifications: z.boolean(),
      slackNotifications: z.boolean(),
      dailyDigest: z.boolean(),
      mentionAlerts: z.boolean(),
    })
    .optional(),
  security: z
    .object({
      requireMfa: z.boolean(),
      sessionTimeoutMinutes: z.number(),
      allowedDomains: z.array(z.string()),
      ipWhitelist: z.array(z.string()),
    })
    .optional(),
  integrations: z
    .object({
      slackEnabled: z.boolean(),
      githubEnabled: z.boolean(),
      webhooksEnabled: z.boolean(),
    })
    .optional(),
  customFields: z.record(z.unknown()).optional(),
});

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

/**
 * Billing information schema
 */
export const billingInfoSchema = z.object({
  plan: planTypeSchema,
  planName: z.string(),
  status: z.string(),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean(),
  usage: z.object({
    members: z.number(),
    membersLimit: z.number(),
    storage: z.number(),
    storageLimit: z.number(),
    channels: z.number(),
    channelsLimit: z.number(),
  }),
  features: z.array(z.string()),
});

export type BillingInfo = z.infer<typeof billingInfoSchema>;
