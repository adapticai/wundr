/**
 * @wundr/slack-agent - Usergroups Management Capability
 *
 * Provides comprehensive Slack usergroup (user groups / @mentions) management
 * capabilities for the Orchestrator agent. The Orchestrator agent operates as a full user in
 * Slack workspaces, enabling it to create, update, enable/disable usergroups
 * and manage group membership with appropriate permissions.
 *
 * Usergroups are the @mention groups in Slack (e.g., @engineering, @design)
 * that allow messaging multiple users at once.
 *
 * @packageDocumentation
 */

import type { WebClient } from '@slack/web-api';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Slack usergroup representation
 */
export interface Usergroup {
  /** Unique usergroup identifier (e.g., S1234567890) */
  readonly id: string;
  /** Team/workspace ID this usergroup belongs to */
  readonly teamId: string;
  /** Display name of the usergroup */
  readonly name: string;
  /** Handle used for @mentions (without @) */
  readonly handle: string;
  /** Description of the usergroup */
  readonly description?: string;
  /** Whether this is a usergroup (always true for usergroups) */
  readonly isUsergroup: boolean;
  /** Array of user IDs in this group */
  readonly users?: string[];
  /** Number of users in this group */
  readonly userCount: number;
  /** Whether the usergroup is enabled (active) */
  readonly isEnabled?: boolean;
  /** ISO timestamp of when the group was created */
  readonly dateCreated?: string;
  /** ISO timestamp of when the group was last updated */
  readonly dateUpdated?: string;
  /** User ID of the creator */
  readonly createdBy?: string;
  /** User ID of the last updater */
  readonly updatedBy?: string;
  /** Auto type (admins, owners, or null for custom groups) */
  readonly autoType?: string | null;
  /** Channel IDs where this group is used by default */
  readonly channels?: string[];
}

/**
 * Options for creating a usergroup
 */
export interface CreateUsergroupOptions {
  /** Handle for @mentions (without @, lowercase, no spaces) */
  handle?: string;
  /** Description of the usergroup */
  description?: string;
  /** Initial channel IDs for default use */
  channels?: string[];
  /** Include member count in response */
  includeCount?: boolean;
}

/**
 * Updates for a usergroup
 */
export interface UsergroupUpdate {
  /** New display name */
  name?: string;
  /** New handle for @mentions */
  handle?: string;
  /** New description */
  description?: string;
  /** New channel IDs for default use */
  channels?: string[];
}

/**
 * Options for listing usergroups
 */
export interface ListUsergroupsOptions {
  /** Include disabled/inactive usergroups */
  includeDisabled?: boolean;
  /** Include number of users in each group */
  includeCount?: boolean;
  /** Include user IDs in each group */
  includeUsers?: boolean;
}

/**
 * Usergroup management error codes
 */
export enum UsergroupErrorCode {
  /** Usergroup not found */
  NOT_FOUND = 'subteam_not_found',
  /** Handle already taken */
  HANDLE_TAKEN = 'handle_taken',
  /** Name already taken */
  NAME_TAKEN = 'name_taken',
  /** Invalid handle format */
  INVALID_HANDLE = 'invalid_handle',
  /** Insufficient permissions (requires admin or usergroup admin) */
  PERMISSION_DENIED = 'not_allowed',
  /** Missing required OAuth scope */
  MISSING_SCOPE = 'missing_scope',
  /** Usergroup is already disabled */
  ALREADY_DISABLED = 'already_disabled',
  /** Usergroup is not disabled */
  NOT_DISABLED = 'subteam_not_disabled',
  /** Rate limited */
  RATE_LIMITED = 'ratelimited',
  /** Cannot modify auto-provisioned groups */
  CANNOT_MODIFY_AUTO = 'cannot_modify_auto_provisioned',
  /** User not found */
  USER_NOT_FOUND = 'user_not_found',
  /** General error */
  UNKNOWN = 'unknown_error',
  /** No users provided for member update */
  NO_USERS = 'no_users',
}

/**
 * Usergroup management error
 */
export class UsergroupManagementError extends Error {
  /** Error code from Slack API or internal */
  readonly code: UsergroupErrorCode | string;
  /** Original Slack API error (if available) */
  readonly slackError?: string;
  /** Usergroup ID related to the error (if available) */
  readonly usergroupId?: string;

  constructor(
    message: string,
    code: UsergroupErrorCode | string,
    options?: { slackError?: string; usergroupId?: string },
  ) {
    super(message);
    this.name = 'UsergroupManagementError';
    this.code = code;
    this.slackError = options?.slackError;
    this.usergroupId = options?.usergroupId;
  }
}

/**
 * Configuration for UsergroupManager
 */
export interface UsergroupManagerConfig {
  /** Default team ID for Enterprise Grid (optional) */
  defaultTeamId?: string;
  /** Maximum retries on rate limit */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

/**
 * Internal type for Slack API usergroup response
 */
interface SlackUsergroupResponse {
  id?: string;
  team_id?: string;
  name?: string;
  handle?: string;
  description?: string;
  is_usergroup?: boolean;
  users?: string[];
  user_count?: number;
  is_external?: boolean;
  date_create?: number;
  date_update?: number;
  date_delete?: number;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
  auto_type?: string | null;
  prefs?: {
    channels?: string[];
    groups?: string[];
  };
}

// =============================================================================
// Usergroup Manager Implementation
// =============================================================================

/**
 * UsergroupManager - Manages Slack usergroup operations for the Orchestrator agent
 *
 * Provides methods to create, update, enable/disable, and query usergroups.
 * Handles permission errors gracefully and provides clear error messages.
 *
 * Note: Most usergroup operations require the `usergroups:write` OAuth scope
 * and appropriate workspace permissions (admin or usergroup admin).
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { UsergroupManager } from '@wundr/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const usergroupManager = new UsergroupManager(client);
 *
 * // Create a new usergroup
 * const group = await usergroupManager.createUsergroup('Engineering Team', {
 *   handle: 'engineering',
 *   description: 'All engineering team members',
 * });
 *
 * // Add members to the group
 * await usergroupManager.updateMembers(group.id, ['U12345', 'U67890']);
 *
 * // List all usergroups
 * const groups = await usergroupManager.listUsergroups();
 * ```
 */
export class UsergroupManager {
  private readonly client: WebClient;
  private readonly config: Required<UsergroupManagerConfig>;

  /**
   * Creates a new UsergroupManager instance
   *
   * @param client - Authenticated Slack WebClient instance
   * @param config - Optional configuration
   */
  constructor(client: WebClient, config: UsergroupManagerConfig = {}) {
    this.client = client;
    this.config = {
      defaultTeamId: config.defaultTeamId ?? '',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };
  }

  // ===========================================================================
  // Usergroup Creation
  // ===========================================================================

  /**
   * Create a new usergroup
   *
   * Requires `usergroups:write` OAuth scope and admin or usergroup admin permissions.
   *
   * @param name - Display name for the usergroup
   * @param options - Additional creation options
   * @returns Created usergroup
   * @throws UsergroupManagementError if creation fails
   *
   * @example
   * ```typescript
   * const group = await usergroupManager.createUsergroup('Design Team', {
   *   handle: 'design',
   *   description: 'Product design team members',
   *   channels: ['C12345'], // Default channels
   * });
   * console.log(`Created @${group.handle} with ID ${group.id}`);
   * ```
   */
  async createUsergroup(
    name: string,
    options: CreateUsergroupOptions = {},
  ): Promise<Usergroup> {
    if (!name || name.trim().length === 0) {
      throw new UsergroupManagementError(
        'Usergroup name cannot be empty',
        UsergroupErrorCode.UNKNOWN,
      );
    }

    const handle = options.handle || this.generateHandle(name);
    this.validateHandle(handle);

    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.create({
          name: name.trim(),
          handle,
          description: options.description,
          channels: options.channels?.join(','),
          include_count: options.includeCount,
        }),
      );

      if (!response.ok || !response.usergroup) {
        throw new UsergroupManagementError(
          `Failed to create usergroup: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }

      return this.mapSlackUsergroup(response.usergroup as SlackUsergroupResponse);
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'create usergroup');
    }
  }

  // ===========================================================================
  // Usergroup Updates
  // ===========================================================================

  /**
   * Update an existing usergroup
   *
   * Requires `usergroups:write` OAuth scope and admin or usergroup admin permissions.
   *
   * @param usergroupId - Usergroup ID to update (e.g., S1234567890)
   * @param updates - Fields to update
   * @returns Updated usergroup
   * @throws UsergroupManagementError if update fails
   *
   * @example
   * ```typescript
   * const updated = await usergroupManager.updateUsergroup('S12345', {
   *   name: 'Engineering & DevOps',
   *   description: 'Engineering and DevOps team members',
   * });
   * ```
   */
  async updateUsergroup(
    usergroupId: string,
    updates: UsergroupUpdate,
  ): Promise<Usergroup> {
    if (updates.handle) {
      this.validateHandle(updates.handle);
    }

    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.update({
          usergroup: usergroupId,
          name: updates.name,
          handle: updates.handle,
          description: updates.description,
          channels: updates.channels?.join(','),
        }),
      );

      if (!response.ok || !response.usergroup) {
        throw new UsergroupManagementError(
          `Failed to update usergroup: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error, usergroupId },
        );
      }

      return this.mapSlackUsergroup(response.usergroup as SlackUsergroupResponse);
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'update usergroup', usergroupId);
    }
  }

  // ===========================================================================
  // Enable/Disable Operations
  // ===========================================================================

  /**
   * Disable (deactivate) a usergroup
   *
   * Disabled usergroups cannot be @mentioned and don't appear in search.
   * The usergroup can be re-enabled later with enableUsergroup().
   *
   * Requires `usergroups:write` OAuth scope and admin permissions.
   *
   * @param usergroupId - Usergroup ID to disable
   * @throws UsergroupManagementError if disable fails
   *
   * @example
   * ```typescript
   * await usergroupManager.disableUsergroup('S12345');
   * console.log('Usergroup disabled');
   * ```
   */
  async disableUsergroup(usergroupId: string): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.disable({
          usergroup: usergroupId,
        }),
      );

      if (!response.ok) {
        throw new UsergroupManagementError(
          `Failed to disable usergroup: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error, usergroupId },
        );
      }
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'disable usergroup', usergroupId);
    }
  }

  /**
   * Enable (reactivate) a disabled usergroup
   *
   * Re-enables a previously disabled usergroup, making it available for
   * @mentions and search again.
   *
   * Requires `usergroups:write` OAuth scope and admin permissions.
   *
   * @param usergroupId - Usergroup ID to enable
   * @throws UsergroupManagementError if enable fails
   *
   * @example
   * ```typescript
   * await usergroupManager.enableUsergroup('S12345');
   * console.log('Usergroup re-enabled');
   * ```
   */
  async enableUsergroup(usergroupId: string): Promise<void> {
    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.enable({
          usergroup: usergroupId,
        }),
      );

      if (!response.ok) {
        throw new UsergroupManagementError(
          `Failed to enable usergroup: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error, usergroupId },
        );
      }
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'enable usergroup', usergroupId);
    }
  }

  // ===========================================================================
  // Usergroup Queries
  // ===========================================================================

  /**
   * List all usergroups in the workspace
   *
   * Requires `usergroups:read` OAuth scope.
   *
   * @param includeDisabled - Whether to include disabled usergroups (default: false)
   * @returns Array of usergroups
   *
   * @example
   * ```typescript
   * // List active usergroups
   * const groups = await usergroupManager.listUsergroups();
   *
   * // Include disabled usergroups
   * const allGroups = await usergroupManager.listUsergroups(true);
   * ```
   */
  async listUsergroups(includeDisabled: boolean = false): Promise<Usergroup[]> {
    return this.listUsergroupsWithOptions({ includeDisabled });
  }

  /**
   * List all usergroups with full options
   *
   * @param options - List options
   * @returns Array of usergroups
   *
   * @example
   * ```typescript
   * const groups = await usergroupManager.listUsergroupsWithOptions({
   *   includeDisabled: true,
   *   includeCount: true,
   *   includeUsers: true,
   * });
   * ```
   */
  async listUsergroupsWithOptions(
    options: ListUsergroupsOptions = {},
  ): Promise<Usergroup[]> {
    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.list({
          include_disabled: options.includeDisabled,
          include_count: options.includeCount,
          include_users: options.includeUsers,
        }),
      );

      if (!response.ok) {
        throw new UsergroupManagementError(
          `Failed to list usergroups: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error },
        );
      }

      const usergroups = response.usergroups || [];
      return usergroups.map((ug) =>
        this.mapSlackUsergroup(ug as SlackUsergroupResponse),
      );
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'list usergroups');
    }
  }

  /**
   * Get information about a specific usergroup
   *
   * Requires `usergroups:read` OAuth scope.
   *
   * @param usergroupId - Usergroup ID to retrieve
   * @returns Usergroup details
   * @throws UsergroupManagementError if usergroup not found
   *
   * @example
   * ```typescript
   * const group = await usergroupManager.getUsergroup('S12345');
   * console.log(`@${group.handle}: ${group.description}`);
   * ```
   */
  async getUsergroup(usergroupId: string): Promise<Usergroup> {
    // The Slack API doesn't have a direct "get single usergroup" endpoint,
    // so we list all and filter
    try {
      const groups = await this.listUsergroupsWithOptions({
        includeDisabled: true,
        includeCount: true,
        includeUsers: true,
      });

      const group = groups.find((g) => g.id === usergroupId);
      if (!group) {
        throw new UsergroupManagementError(
          `Usergroup not found: ${usergroupId}`,
          UsergroupErrorCode.NOT_FOUND,
          { usergroupId },
        );
      }

      return group;
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'get usergroup', usergroupId);
    }
  }

  // ===========================================================================
  // Member Management
  // ===========================================================================

  /**
   * Update the members of a usergroup (replace all members)
   *
   * This replaces all existing members with the provided list.
   * Use addMembers() or removeMembers() for incremental updates.
   *
   * Requires `usergroups:write` OAuth scope and admin or usergroup admin permissions.
   *
   * @param usergroupId - Usergroup ID
   * @param userIds - Array of user IDs to set as members
   * @returns Updated usergroup
   * @throws UsergroupManagementError if update fails
   *
   * @example
   * ```typescript
   * const updated = await usergroupManager.updateMembers('S12345', [
   *   'U111111',
   *   'U222222',
   *   'U333333',
   * ]);
   * console.log(`Group now has ${updated.userCount} members`);
   * ```
   */
  async updateMembers(
    usergroupId: string,
    userIds: string[],
  ): Promise<Usergroup> {
    if (!userIds || userIds.length === 0) {
      throw new UsergroupManagementError(
        'At least one user ID is required',
        UsergroupErrorCode.NO_USERS,
        { usergroupId },
      );
    }

    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.users.update({
          usergroup: usergroupId,
          users: userIds.join(','),
        }),
      );

      if (!response.ok || !response.usergroup) {
        throw new UsergroupManagementError(
          `Failed to update members: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error, usergroupId },
        );
      }

      return this.mapSlackUsergroup(response.usergroup as SlackUsergroupResponse);
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'update members', usergroupId);
    }
  }

  /**
   * Add members to a usergroup (incremental add)
   *
   * Adds the specified users to the group without removing existing members.
   *
   * Requires `usergroups:write` OAuth scope and admin or usergroup admin permissions.
   *
   * @param usergroupId - Usergroup ID
   * @param userIds - Array of user IDs to add
   * @returns Updated usergroup
   * @throws UsergroupManagementError if update fails
   *
   * @example
   * ```typescript
   * const updated = await usergroupManager.addMembers('S12345', ['U444444', 'U555555']);
   * console.log(`Added members, group now has ${updated.userCount} members`);
   * ```
   */
  async addMembers(usergroupId: string, userIds: string[]): Promise<Usergroup> {
    if (!userIds || userIds.length === 0) {
      // No users to add, just return current state
      return this.getUsergroup(usergroupId);
    }

    // Get current members
    const currentMembers = await this.getMembers(usergroupId);

    // Combine with new members (deduplicated)
    const memberSet = new Set([...currentMembers, ...userIds]);
    const allMembers = Array.from(memberSet);

    // Update with combined list
    return this.updateMembers(usergroupId, allMembers);
  }

  /**
   * Remove members from a usergroup (incremental remove)
   *
   * Removes the specified users from the group.
   *
   * Requires `usergroups:write` OAuth scope and admin or usergroup admin permissions.
   *
   * @param usergroupId - Usergroup ID
   * @param userIds - Array of user IDs to remove
   * @returns Updated usergroup
   * @throws UsergroupManagementError if update fails or no members would remain
   *
   * @example
   * ```typescript
   * const updated = await usergroupManager.removeMembers('S12345', ['U111111']);
   * console.log(`Removed member, group now has ${updated.userCount} members`);
   * ```
   */
  async removeMembers(
    usergroupId: string,
    userIds: string[],
  ): Promise<Usergroup> {
    if (!userIds || userIds.length === 0) {
      // No users to remove, just return current state
      return this.getUsergroup(usergroupId);
    }

    // Get current members
    const currentMembers = await this.getMembers(usergroupId);

    // Remove specified users
    const userIdsToRemove = new Set(userIds);
    const remainingMembers = currentMembers.filter(
      (id) => !userIdsToRemove.has(id),
    );

    if (remainingMembers.length === 0) {
      throw new UsergroupManagementError(
        'Cannot remove all members from a usergroup',
        UsergroupErrorCode.NO_USERS,
        { usergroupId },
      );
    }

    // Update with remaining members
    return this.updateMembers(usergroupId, remainingMembers);
  }

  /**
   * Get all member IDs of a usergroup
   *
   * Requires `usergroups:read` OAuth scope.
   *
   * @param usergroupId - Usergroup ID
   * @returns Array of user IDs
   * @throws UsergroupManagementError if retrieval fails
   *
   * @example
   * ```typescript
   * const memberIds = await usergroupManager.getMembers('S12345');
   * console.log(`Group has ${memberIds.length} members:`, memberIds);
   * ```
   */
  async getMembers(usergroupId: string): Promise<string[]> {
    try {
      const response = await this.withRetry(() =>
        this.client.usergroups.users.list({
          usergroup: usergroupId,
        }),
      );

      if (!response.ok) {
        throw new UsergroupManagementError(
          `Failed to get members: ${response.error || 'Unknown error'}`,
          response.error || UsergroupErrorCode.UNKNOWN,
          { slackError: response.error, usergroupId },
        );
      }

      return response.users || [];
    } catch (error) {
      if (error instanceof UsergroupManagementError) {
        throw error;
      }
      throw this.handleSlackError(error, 'get members', usergroupId);
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Generate a handle from a display name
   */
  private generateHandle(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 80);
  }

  /**
   * Validate handle format
   */
  private validateHandle(handle: string): void {
    if (!handle || handle.length === 0) {
      throw new UsergroupManagementError(
        'Handle cannot be empty',
        UsergroupErrorCode.INVALID_HANDLE,
      );
    }

    if (handle.length > 80) {
      throw new UsergroupManagementError(
        'Handle cannot exceed 80 characters',
        UsergroupErrorCode.INVALID_HANDLE,
      );
    }

    if (!/^[a-z0-9][a-z0-9-_]*$/.test(handle)) {
      throw new UsergroupManagementError(
        'Handle must start with a letter or number and contain only lowercase letters, numbers, hyphens, and underscores',
        UsergroupErrorCode.INVALID_HANDLE,
      );
    }
  }

  /**
   * Map Slack API usergroup response to Usergroup type
   */
  private mapSlackUsergroup(slackUsergroup: SlackUsergroupResponse): Usergroup {
    return {
      id: slackUsergroup.id || '',
      teamId: slackUsergroup.team_id || '',
      name: slackUsergroup.name || '',
      handle: slackUsergroup.handle || '',
      description: slackUsergroup.description,
      isUsergroup: slackUsergroup.is_usergroup ?? true,
      users: slackUsergroup.users,
      userCount: slackUsergroup.user_count ?? slackUsergroup.users?.length ?? 0,
      isEnabled: slackUsergroup.date_delete === undefined || slackUsergroup.date_delete === 0,
      dateCreated: slackUsergroup.date_create
        ? new Date(slackUsergroup.date_create * 1000).toISOString()
        : undefined,
      dateUpdated: slackUsergroup.date_update
        ? new Date(slackUsergroup.date_update * 1000).toISOString()
        : undefined,
      createdBy: slackUsergroup.created_by,
      updatedBy: slackUsergroup.updated_by,
      autoType: slackUsergroup.auto_type,
      channels: slackUsergroup.prefs?.channels,
    };
  }

  /**
   * Handle Slack API errors
   */
  private handleSlackError(
    error: unknown,
    operation: string,
    usergroupId?: string,
  ): UsergroupManagementError {
    const slackError =
      error instanceof Error
        ? (error as { data?: { error?: string } }).data?.error || error.message
        : 'Unknown error';

    // Map common Slack errors to our error codes
    let code: UsergroupErrorCode | string = UsergroupErrorCode.UNKNOWN;

    if (typeof slackError === 'string') {
      switch (slackError) {
        case 'subteam_not_found':
        case 'no_such_subteam':
          code = UsergroupErrorCode.NOT_FOUND;
          break;
        case 'handle_already_exists':
        case 'handle_taken':
          code = UsergroupErrorCode.HANDLE_TAKEN;
          break;
        case 'name_already_exists':
        case 'name_taken':
          code = UsergroupErrorCode.NAME_TAKEN;
          break;
        case 'invalid_handle':
        case 'bad_handle':
          code = UsergroupErrorCode.INVALID_HANDLE;
          break;
        case 'not_allowed':
        case 'not_authorized':
        case 'restricted_action':
        case 'user_is_restricted':
        case 'user_is_ultra_restricted':
        case 'not_authed':
        case 'invalid_auth':
        case 'account_inactive':
          code = UsergroupErrorCode.PERMISSION_DENIED;
          break;
        case 'missing_scope':
          code = UsergroupErrorCode.MISSING_SCOPE;
          break;
        case 'already_disabled':
          code = UsergroupErrorCode.ALREADY_DISABLED;
          break;
        case 'subteam_not_disabled':
          code = UsergroupErrorCode.NOT_DISABLED;
          break;
        case 'ratelimited':
          code = UsergroupErrorCode.RATE_LIMITED;
          break;
        case 'cannot_modify_auto_provisioned':
          code = UsergroupErrorCode.CANNOT_MODIFY_AUTO;
          break;
        case 'user_not_found':
        case 'users_not_found':
          code = UsergroupErrorCode.USER_NOT_FOUND;
          break;
        case 'no_users':
        case 'no_users_provided':
          code = UsergroupErrorCode.NO_USERS;
          break;
        default:
          code = slackError;
      }
    }

    return new UsergroupManagementError(
      `Failed to ${operation}: ${slackError}`,
      code,
      { slackError: typeof slackError === 'string' ? slackError : undefined, usergroupId },
    );
  }

  /**
   * Retry wrapper with exponential backoff for rate limits
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if rate limited
        const slackError =
          error instanceof Error
            ? (error as { data?: { error?: string } }).data?.error
            : undefined;

        if (slackError === 'ratelimited') {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        // Re-throw non-rate-limit errors immediately
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a UsergroupManager instance
 *
 * @param client - Authenticated Slack WebClient
 * @param config - Optional configuration
 * @returns UsergroupManager instance
 *
 * @example
 * ```typescript
 * import { WebClient } from '@slack/web-api';
 * import { createUsergroupManager } from '@wundr/slack-agent';
 *
 * const client = new WebClient(process.env.SLACK_BOT_TOKEN);
 * const usergroupManager = createUsergroupManager(client);
 * ```
 */
export function createUsergroupManager(
  client: WebClient,
  config?: UsergroupManagerConfig,
): UsergroupManager {
  return new UsergroupManager(client, config);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is a UsergroupManagementError
 */
export function isUsergroupManagementError(
  error: unknown,
): error is UsergroupManagementError {
  return error instanceof UsergroupManagementError;
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  return (
    isUsergroupManagementError(error) &&
    (error.code === UsergroupErrorCode.PERMISSION_DENIED ||
      error.code === UsergroupErrorCode.MISSING_SCOPE)
  );
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return (
    isUsergroupManagementError(error) &&
    error.code === UsergroupErrorCode.RATE_LIMITED
  );
}

/**
 * Check if error is a usergroup not found error
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    isUsergroupManagementError(error) &&
    error.code === UsergroupErrorCode.NOT_FOUND
  );
}

/**
 * Check if error is a handle/name taken error
 */
export function isNameConflictError(error: unknown): boolean {
  return (
    isUsergroupManagementError(error) &&
    (error.code === UsergroupErrorCode.HANDLE_TAKEN ||
      error.code === UsergroupErrorCode.NAME_TAKEN)
  );
}
