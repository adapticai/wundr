/**
 * @genesis/core - Organization Type Definitions
 *
 * Type definitions for organization, workspace, channel, and discipline
 * management services.
 *
 * @packageDocumentation
 */

import type {
  Channel,
  ChannelMember,
  ChannelRole,
  ChannelType,
  Organization,
  OrganizationMember,
  OrganizationRole,
  User,
  VP,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceVisibility,
} from '@neolith/database';

// =============================================================================
// Organization Types
// =============================================================================

/**
 * Organization with members included.
 */
export interface OrganizationWithMembers extends Organization {
  /** Organization members with user data */
  organizationMembers: OrganizationMemberWithUser[];
}

/**
 * Organization with full relations.
 */
export interface OrganizationWithRelations extends Organization {
  /** Organization members with user data */
  organizationMembers: OrganizationMemberWithUser[];
  /** Workspaces in the organization */
  workspaces: Workspace[];
  /** VPs in the organization */
  orchestrators: VP[];
}

/**
 * Organization member with user data.
 */
export interface OrganizationMemberWithUser extends OrganizationMember {
  /** The member's user data */
  user: User;
}

/**
 * Input for creating a new organization.
 */
export interface CreateOrgInput {
  /** Organization name */
  name: string;
  /** URL-friendly slug (auto-generated if not provided) */
  slug?: string;
  /** Organization description */
  description?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Organization settings */
  settings?: Record<string, unknown>;
  /** ID of the user creating the organization (becomes owner) */
  createdById: string;
}

/**
 * Input for updating an organization.
 */
export interface UpdateOrgInput {
  /** Organization name */
  name?: string;
  /** Organization description */
  description?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Organization settings */
  settings?: Record<string, unknown>;
}

/**
 * Options for listing organizations.
 */
export interface ListOrgsOptions {
  /** Filter by user membership */
  userId?: string;
  /** Include archived organizations */
  includeArchived?: boolean;
  /** Number of records to skip */
  skip?: number;
  /** Number of records to take */
  take?: number;
  /** Field to order by */
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated organization result.
 */
export interface PaginatedOrgResult {
  /** Organization data */
  data: OrganizationWithMembers[];
  /** Total count */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// Workspace Types
// =============================================================================

/**
 * Workspace with members included.
 */
export interface WorkspaceWithMembers extends Workspace {
  /** Workspace members with user data */
  workspaceMembers: WorkspaceMemberWithUser[];
}

/**
 * Workspace with full relations.
 */
export interface WorkspaceWithRelations extends Workspace {
  /** Workspace members with user data */
  workspaceMembers: WorkspaceMemberWithUser[];
  /** Channels in the workspace */
  channels: Channel[];
  /** Parent organization */
  organization: Organization;
}

/**
 * Workspace member with user data.
 */
export interface WorkspaceMemberWithUser extends WorkspaceMember {
  /** The member's user data */
  user: User;
}

/**
 * Input for creating a new workspace.
 */
export interface CreateWorkspaceInput {
  /** Workspace name */
  name: string;
  /** URL-friendly slug (auto-generated if not provided) */
  slug?: string;
  /** Workspace description */
  description?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Visibility level */
  visibility?: WorkspaceVisibility;
  /** Workspace settings */
  settings?: Record<string, unknown>;
  /** Parent organization ID */
  organizationId: string;
  /** ID of the user creating the workspace (becomes owner) */
  createdById: string;
}

/**
 * Input for updating a workspace.
 */
export interface UpdateWorkspaceInput {
  /** Workspace name */
  name?: string;
  /** Workspace description */
  description?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Visibility level */
  visibility?: WorkspaceVisibility;
  /** Workspace settings */
  settings?: Record<string, unknown>;
}

/**
 * Options for listing workspaces.
 */
export interface ListWorkspacesOptions {
  /** Filter by visibility */
  visibility?: WorkspaceVisibility;
  /** Filter by user membership */
  userId?: string;
  /** Include archived workspaces */
  includeArchived?: boolean;
  /** Number of records to skip */
  skip?: number;
  /** Number of records to take */
  take?: number;
  /** Field to order by */
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated workspace result.
 */
export interface PaginatedWorkspaceResult {
  /** Workspace data */
  data: WorkspaceWithMembers[];
  /** Total count */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// Channel Types
// =============================================================================

/**
 * Channel with members included.
 */
export interface ChannelWithMembers extends Channel {
  /** Channel members with user data */
  members: ChannelMemberWithUser[];
}

/**
 * Channel with full relations.
 */
export interface ChannelWithRelations extends Channel {
  /** Channel members with user data */
  members: ChannelMemberWithUser[];
  /** Parent workspace */
  workspace: Workspace;
  /** Channel creator */
  creator?: User | null;
}

/**
 * Channel member with user data.
 */
export interface ChannelMemberWithUser extends ChannelMember {
  /** The member's user data */
  user: User;
}

/**
 * Input for creating a new channel.
 */
export interface CreateChannelInput {
  /** Channel name */
  name: string;
  /** URL-friendly slug (auto-generated if not provided) */
  slug?: string;
  /** Channel description */
  description?: string;
  /** Channel type */
  type?: ChannelType;
  /** Channel settings */
  settings?: Record<string, unknown>;
  /** Parent workspace ID */
  workspaceId: string;
  /** ID of the user creating the channel (becomes owner) */
  createdById: string;
}

/**
 * Input for updating a channel.
 */
export interface UpdateChannelInput {
  /** Channel name */
  name?: string;
  /** Channel description */
  description?: string;
  /** Channel type */
  type?: ChannelType;
  /** Channel settings */
  settings?: Record<string, unknown>;
}

/**
 * Options for listing channels.
 */
export interface ChannelListOptions {
  /** Filter by channel type */
  type?: ChannelType;
  /** Filter by user membership */
  userId?: string;
  /** Include archived channels */
  includeArchived?: boolean;
  /** Number of records to skip */
  skip?: number;
  /** Number of records to take */
  take?: number;
  /** Field to order by */
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated channel result.
 */
export interface PaginatedChannelResult {
  /** Channel data */
  data: ChannelWithMembers[];
  /** Total count */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// Discipline Types
// =============================================================================

/**
 * Discipline represents a functional area or department.
 * Note: Discipline is not a database model, it's derived from VP.discipline field.
 */
export interface Discipline {
  /** Unique discipline identifier (derived from normalized name) */
  id: string;
  /** Discipline name */
  name: string;
  /** Discipline description */
  description?: string;
  /** Organization ID */
  organizationId: string;
  /** Number of VPs in this discipline */
  vpCount: number;
  /** When this discipline was first created (first Orchestrator with this discipline) */
  createdAt: Date;
}

/**
 * Discipline with associated VPs.
 */
export interface DisciplineWithVPs extends Discipline {
  /** VPs in this discipline */
  orchestrators: VPBasic[];
}

/**
 * Basic Orchestrator info for discipline listing.
 */
export interface VPBasic {
  /** OrchestratorID */
  id: string;
  /** Orchestrator role */
  role: string;
  /** Orchestrator status */
  status: string;
  /** User info */
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

/**
 * Input for creating a discipline.
 * Since discipline is not a model, this creates metadata stored elsewhere.
 */
export interface CreateDisciplineInput {
  /** Discipline name */
  name: string;
  /** Discipline description */
  description?: string;
  /** Organization ID */
  organizationId: string;
}

/**
 * Input for updating a discipline.
 */
export interface UpdateDisciplineInput {
  /** Discipline name */
  name?: string;
  /** Discipline description */
  description?: string;
}

/**
 * Options for listing disciplines.
 */
export interface ListDisciplinesOptions {
  /** Include empty disciplines */
  includeEmpty?: boolean;
  /** Number of records to skip */
  skip?: number;
  /** Number of records to take */
  take?: number;
  /** Field to order by */
  orderBy?: 'name' | 'vpCount' | 'createdAt';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated discipline result.
 */
export interface PaginatedDisciplineResult {
  /** Discipline data */
  data: Discipline[];
  /** Total count */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// Member Role Types (re-export for convenience)
// =============================================================================

export type { OrganizationRole, WorkspaceRole, ChannelRole };

/**
 * Channel member role type alias.
 */
export type ChannelMemberRole = ChannelRole;

/**
 * Workspace member role type alias.
 */
export type WorkspaceMemberRole = WorkspaceRole;

/**
 * Organization member role type alias.
 */
export type OrganizationMemberRole = OrganizationRole;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an object is an Organization.
 */
export function isOrganization(obj: unknown): obj is Organization {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'slug' in obj
  );
}

/**
 * Type guard to check if an object is a Workspace.
 */
export function isWorkspace(obj: unknown): obj is Workspace {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'slug' in obj &&
    'organizationId' in obj
  );
}

/**
 * Type guard to check if an object is a Channel.
 */
export function isChannel(obj: unknown): obj is Channel {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'slug' in obj &&
    'workspaceId' in obj
  );
}

/**
 * Type guard for CreateChannelInput validation.
 */
export function isValidCreateChannelInput(input: unknown): input is CreateChannelInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const data = input as Record<string, unknown>;

  return (
    typeof data.name === 'string' &&
    data.name.length > 0 &&
    typeof data.workspaceId === 'string' &&
    data.workspaceId.length > 0 &&
    typeof data.createdById === 'string' &&
    data.createdById.length > 0
  );
}

/**
 * Type guard for CreateWorkspaceInput validation.
 */
export function isValidCreateWorkspaceInput(input: unknown): input is CreateWorkspaceInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const data = input as Record<string, unknown>;

  return (
    typeof data.name === 'string' &&
    data.name.length > 0 &&
    typeof data.organizationId === 'string' &&
    data.organizationId.length > 0 &&
    typeof data.createdById === 'string' &&
    data.createdById.length > 0
  );
}

/**
 * Type guard for CreateOrgInput validation.
 */
export function isValidCreateOrgInput(input: unknown): input is CreateOrgInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const data = input as Record<string, unknown>;

  return (
    typeof data.name === 'string' &&
    data.name.length > 0 &&
    typeof data.createdById === 'string' &&
    data.createdById.length > 0
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default list options for organizations.
 */
export const DEFAULT_ORG_LIST_OPTIONS: Required<
  Pick<ListOrgsOptions, 'skip' | 'take' | 'orderBy' | 'orderDirection' | 'includeArchived'>
> = {
  skip: 0,
  take: 20,
  orderBy: 'createdAt',
  orderDirection: 'desc',
  includeArchived: false,
};

/**
 * Default list options for workspaces.
 */
export const DEFAULT_WORKSPACE_LIST_OPTIONS: Required<
  Pick<ListWorkspacesOptions, 'skip' | 'take' | 'orderBy' | 'orderDirection' | 'includeArchived'>
> = {
  skip: 0,
  take: 20,
  orderBy: 'createdAt',
  orderDirection: 'desc',
  includeArchived: false,
};

/**
 * Default list options for channels.
 */
export const DEFAULT_CHANNEL_LIST_OPTIONS: Required<
  Pick<ChannelListOptions, 'skip' | 'take' | 'orderBy' | 'orderDirection' | 'includeArchived'>
> = {
  skip: 0,
  take: 50,
  orderBy: 'name',
  orderDirection: 'asc',
  includeArchived: false,
};

/**
 * Maximum name length for organizations, workspaces, and channels.
 */
export const MAX_NAME_LENGTH = 100;

/**
 * Maximum description length.
 */
export const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * Maximum slug length.
 */
export const MAX_SLUG_LENGTH = 50;

/**
 * Valid channel types.
 */
export const CHANNEL_TYPES = ['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE'] as const;

/**
 * Valid workspace visibility levels.
 */
export const WORKSPACE_VISIBILITY_LEVELS = ['PUBLIC', 'PRIVATE', 'INTERNAL'] as const;

/**
 * Valid organization roles.
 */
export const ORGANIZATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

/**
 * Valid workspace roles.
 */
export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'] as const;

/**
 * Valid channel roles.
 */
export const CHANNEL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
