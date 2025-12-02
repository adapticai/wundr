/**
 * Organization Validation Schemas
 *
 * Zod schemas for organization-related API endpoints.
 *
 * @module lib/validations/organization
 */

import { z } from 'zod';

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Organization-related error codes
 */
export const ORG_ERROR_CODES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_SLUG: 'INVALID_SLUG',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',
  ORG_SLUG_EXISTS: 'ORG_SLUG_EXISTS',
  WORKSPACE_SLUG_EXISTS: 'WORKSPACE_SLUG_EXISTS',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  CANNOT_REMOVE_OWNER: 'CANNOT_REMOVE_OWNER',
  CANNOT_MODIFY_OWNER: 'CANNOT_MODIFY_OWNER',
  CANNOT_REMOVE_SELF: 'CANNOT_REMOVE_SELF',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  CHANNEL_ARCHIVED: 'CHANNEL_ARCHIVED',
  FORBIDDEN: 'FORBIDDEN',
  CANNOT_JOIN_PRIVATE: 'CANNOT_JOIN_PRIVATE',
  CANNOT_LEAVE_LAST_ADMIN: 'CANNOT_LEAVE_LAST_ADMIN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DM_SELF_NOT_ALLOWED: 'DM_SELF_NOT_ALLOWED',
  DISCIPLINE_NOT_FOUND: 'DISCIPLINE_NOT_FOUND',
  DISCIPLINE_NAME_EXISTS: 'DISCIPLINE_NAME_EXISTS',
} as const;

export type OrgErrorCode =
  (typeof ORG_ERROR_CODES)[keyof typeof ORG_ERROR_CODES];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a standardized error response object for JSON responses
 */
export function createErrorResponse(
  message: string,
  code: string,
  extraData?: Record<string, unknown>
): { error: string; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

/**
 * Create a standardized org error response object
 */
export function createOrgErrorResponse(
  message: string,
  code: OrgErrorCode,
  extraData?: Record<string, unknown>
): { error: OrgErrorCode; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

// =============================================================================
// WORKSPACE SCHEMAS
// =============================================================================

/**
 * Workspace slug validation
 */
export const workspaceSlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be less than 50 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase letters, numbers, and hyphens only'
  );

/**
 * Create workspace input schema
 */
export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  slug: workspaceSlugSchema,
  organizationId: z.string().uuid('Invalid organization ID'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  settings: z.record(z.unknown()).optional(),
  iconUrl: z.string().optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/**
 * Update workspace input schema
 */
export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  iconUrl: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// =============================================================================
// MEMBER SCHEMAS
// =============================================================================

/**
 * Member role enum - must match Prisma WorkspaceRole enum
 */
export const memberRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);

export type MemberRole = z.infer<typeof memberRoleEnum>;

/**
 * Invite member input schema
 */
export const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: memberRoleEnum.default('MEMBER'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Update member role input schema
 */
export const updateMemberRoleSchema = z.object({
  role: memberRoleEnum,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// =============================================================================
// ORGANIZATION SCHEMAS
// =============================================================================

/**
 * Organization type enum
 */
export const orgTypeEnum = z.enum([
  'startup',
  'enterprise',
  'agency',
  'nonprofit',
  'government',
  'education',
  'other',
]);

export type OrgType = z.infer<typeof orgTypeEnum>;

/**
 * Organization slug validation
 */
export const organizationSlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be less than 50 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase letters, numbers, and hyphens only'
  );

/**
 * Create organization input schema
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  slug: organizationSlugSchema,
  type: orgTypeEnum.default('other'),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  logoUrl: z.string().url('Invalid URL').optional(),
  website: z.string().url('Invalid URL').optional(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/**
 * Update organization input schema
 */
export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  type: orgTypeEnum.optional(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  logoUrl: z.string().url('Invalid URL').optional(),
  website: z.string().url('Invalid URL').optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// =============================================================================
// WORKSPACE FILTERS SCHEMA
// =============================================================================

/**
 * Workspace filters input schema for listing workspaces
 */
export const workspaceFiltersSchema = z.object({
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type WorkspaceFiltersInput = z.infer<typeof workspaceFiltersSchema>;

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

/**
 * Organization ID parameter schema
 */
export const organizationIdParamSchema = z.object({
  id: z.string().uuid('Invalid organization ID'),
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;

/**
 * Workspace ID parameter schema
 */
export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
});

export type WorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>;

/**
 * User ID parameter schema
 */
export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;

/**
 * Channel ID parameter schema
 */
export const channelIdParamSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
});

export type ChannelIdParam = z.infer<typeof channelIdParamSchema>;

/**
 * Discipline ID parameter schema
 */
export const disciplineIdParamSchema = z.object({
  disciplineId: z.string().uuid('Invalid discipline ID'),
});

export type DisciplineIdParam = z.infer<typeof disciplineIdParamSchema>;

// =============================================================================
// ORGANIZATION MEMBER SCHEMAS
// =============================================================================

/**
 * Organization role enum - must match Prisma OrganizationRole enum
 */
export const organizationRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']);

export type OrganizationRole = z.infer<typeof organizationRoleEnum>;

/**
 * Add organization member input schema
 */
export const addOrganizationMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: organizationRoleEnum.default('MEMBER'),
});

export type AddOrganizationMemberInput = z.infer<
  typeof addOrganizationMemberSchema
>;

/**
 * Update organization member role input schema
 */
export const updateOrganizationMemberRoleSchema = z.object({
  role: organizationRoleEnum,
});

export type UpdateOrganizationMemberRoleInput = z.infer<
  typeof updateOrganizationMemberRoleSchema
>;

// =============================================================================
// WORKSPACE MEMBER SCHEMAS
// =============================================================================

/**
 * Add workspace member input schema
 */
export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: memberRoleEnum.default('MEMBER'),
});

export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;

/**
 * Update workspace member role input schema
 */
export const updateWorkspaceMemberRoleSchema = z.object({
  role: memberRoleEnum,
});

export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>;

// =============================================================================
// ORGANIZATION FILTERS SCHEMA
// =============================================================================

/**
 * Organization filters input schema for listing organizations
 */
export const organizationFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  type: orgTypeEnum.optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type OrganizationFiltersInput = z.infer<
  typeof organizationFiltersSchema
>;

// =============================================================================
// CHANNEL SCHEMAS
// =============================================================================

/**
 * Channel type enum - must match Prisma ChannelType enum
 */
export const channelTypeEnum = z.enum(['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE']);

export type ChannelType = z.infer<typeof channelTypeEnum>;

/**
 * Channel role enum - must match Prisma ChannelRole enum
 */
export const channelRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']);

export type ChannelRole = z.infer<typeof channelRoleEnum>;

/**
 * Create channel input schema
 */
export const createChannelSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  type: channelTypeEnum.default('PUBLIC'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  topic: z
    .string()
    .max(200, 'Topic must be less than 200 characters')
    .optional(),
  isPrivate: z.boolean().default(false),
  workspaceId: z.string().uuid('Invalid workspace ID').optional(),
  disciplineId: z.string().uuid('Invalid discipline ID').optional(),
  memberIds: z.array(z.string().uuid('Invalid member ID')).default([]),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

/**
 * Update channel input schema
 */
export const updateChannelSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  type: channelTypeEnum.optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  topic: z
    .string()
    .max(200, 'Topic must be less than 200 characters')
    .optional(),
  isPrivate: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

/**
 * Update channel member role input schema
 */
export const updateChannelMemberRoleSchema = z.object({
  role: channelRoleEnum,
});

export type UpdateChannelMemberRoleInput = z.infer<
  typeof updateChannelMemberRoleSchema
>;

/**
 * Channel filters input schema for listing channels
 */
export const channelFiltersSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  disciplineId: z.string().uuid().optional(),
  type: channelTypeEnum.optional(),
  isPrivate: z.coerce.boolean().optional(),
  includeArchived: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ChannelFiltersInput = z.infer<typeof channelFiltersSchema>;

// =============================================================================
// DIRECT MESSAGE SCHEMAS
// =============================================================================

/**
 * Create direct message input schema
 */
export const createDMSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  workspaceId: z.string().uuid('Invalid workspace ID'),
  recipientId: z.string().uuid('Invalid recipient ID').optional(),
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message must be less than 5000 characters')
    .optional(),
});

export type CreateDMInput = z.infer<typeof createDMSchema>;

// =============================================================================
// DISCIPLINE SCHEMAS
// =============================================================================

/**
 * Create discipline input schema
 */
export const createDisciplineSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  workspaceId: z.string().uuid('Invalid workspace ID'),
  organizationId: z.string().uuid('Invalid organization ID'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color hex code')
    .optional(),
  icon: z.string().max(50).optional(),
});

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;

/**
 * Update discipline input schema
 */
export const updateDisciplineSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color hex code')
    .optional(),
  icon: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;

/**
 * Discipline filters input schema for listing disciplines
 */
export const disciplineFiltersSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type DisciplineFiltersInput = z.infer<typeof disciplineFiltersSchema>;
