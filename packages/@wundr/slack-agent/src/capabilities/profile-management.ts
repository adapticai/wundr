/**
 * @wundr/slack-agent - Profile Management Capability
 *
 * Provides comprehensive profile management for VP (Virtual Principal) agents
 * operating as full users in Slack workspaces. Handles profile CRUD operations,
 * custom fields, photos, and workspace-specific configurations.
 *
 * @packageDocumentation
 */

import { promises as fs } from 'fs';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Slack user profile structure returned by the API
 */
export interface UserProfile {
  /** User's display name */
  display_name: string;
  /** User's display name (normalized) */
  display_name_normalized: string;
  /** User's real name (first + last) */
  real_name: string;
  /** User's real name (normalized) */
  real_name_normalized: string;
  /** User's first name */
  first_name: string;
  /** User's last name */
  last_name: string;
  /** User's title/role */
  title: string;
  /** User's phone number */
  phone: string;
  /** User's email address */
  email: string;
  /** User's pronouns */
  pronouns?: string;
  /** User's timezone identifier */
  tz?: string;
  /** User's timezone label */
  tz_label?: string;
  /** User's timezone offset in seconds */
  tz_offset?: number;
  /** User's status text */
  status_text: string;
  /** User's status emoji */
  status_emoji: string;
  /** Status expiration timestamp (Unix) */
  status_expiration?: number;
  /** User's Skype handle */
  skype?: string;
  /** Avatar image URLs at various sizes */
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  image_1024?: string;
  image_original?: string;
  /** Custom profile fields (workspace-specific) */
  fields?: Record<string, ProfileFieldValue>;
  /** Team ID */
  team?: string;
}

/**
 * Value structure for custom profile fields
 */
export interface ProfileFieldValue {
  /** The field value */
  value: string;
  /** Alternative text for the field */
  alt: string;
}

/**
 * Profile update payload structure
 */
export interface ProfileUpdate {
  /** User's display name */
  display_name?: string;
  /** User's real name */
  real_name?: string;
  /** User's first name */
  first_name?: string;
  /** User's last name */
  last_name?: string;
  /** User's title/role */
  title?: string;
  /** User's phone number */
  phone?: string;
  /** User's email address */
  email?: string;
  /** User's pronouns */
  pronouns?: string;
  /** User's status text */
  status_text?: string;
  /** User's status emoji */
  status_emoji?: string;
  /** Status expiration timestamp (Unix) */
  status_expiration?: number;
  /** Custom profile fields */
  fields?: Record<string, ProfileFieldValue>;
}

/**
 * Custom field definition from workspace
 */
export interface CustomField {
  /** Field ID (e.g., Xf123ABC456) */
  id: string;
  /** Human-readable label */
  label: string;
  /** Field ordering hint */
  ordering: number;
  /** Field type (e.g., 'text', 'date', 'link') */
  type: string;
  /** Possible options for select fields */
  possible_values?: string[];
  /** Field hint/placeholder text */
  hint?: string;
  /** Whether the field is hidden */
  is_hidden?: boolean;
}

/**
 * Response structure for profile get operations
 */
interface ProfileGetResponse {
  ok: boolean;
  error?: string;
  profile?: UserProfile;
}

/**
 * Response structure for profile set operations
 */
interface ProfileSetResponse {
  ok: boolean;
  error?: string;
  profile?: UserProfile;
}

/**
 * Response structure for photo operations
 */
interface PhotoResponse {
  ok: boolean;
  error?: string;
}

/**
 * Response structure for custom fields list
 */
interface CustomFieldsResponse {
  ok: boolean;
  error?: string;
  profile_fields?: Record<string, CustomField>;
}

/**
 * Response structure for user info
 */
interface UserInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    tz?: string;
    tz_label?: string;
    tz_offset?: number;
    profile?: UserProfile;
  };
}

/**
 * Slack WebClient interface for profile operations
 */
interface SlackWebClient {
  users: {
    profile: {
      get: (params?: { user?: string }) => Promise<ProfileGetResponse>;
      set: (params: { profile: string; user?: string }) => Promise<ProfileSetResponse>;
    };
    setPhoto: (params: { image: Buffer | string }) => Promise<PhotoResponse>;
    deletePhoto: () => Promise<PhotoResponse>;
    info: (params: { user: string }) => Promise<UserInfoResponse>;
  };
  team: {
    profile: {
      get: () => Promise<CustomFieldsResponse>;
    };
  };
}

/**
 * Configuration options for ProfileManager
 */
export interface ProfileManagerConfig {
  /** Slack user token (xoxp-...) */
  token: string;
  /** Optional: Pre-configured WebClient instance */
  client?: SlackWebClient;
  /** Optional: Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when profile operations fail
 */
export class ProfileError extends Error {
  /** Slack API error code */
  public readonly code: string;
  /** Original error details */
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ProfileError.prototype);
  }
}

// =============================================================================
// Mock Implementation (for when @slack/web-api is not available)
// =============================================================================

/**
 * Mock WebClient for testing or when Slack SDK is unavailable
 */
class MockWebClient implements SlackWebClient {
  private readonly _token: string;

  constructor(token: string) {
    this._token = token;
  }

  get token(): string {
    return this._token;
  }

  users = {
    profile: {
      get: async (_params?: { user?: string }): Promise<ProfileGetResponse> => ({
        ok: false,
        error: 'slack_api_unavailable',
      }),
      set: async (_params: {
        profile: string;
        user?: string;
      }): Promise<ProfileSetResponse> => ({
        ok: false,
        error: 'slack_api_unavailable',
      }),
    },
    setPhoto: async (_params: { image: Buffer | string }): Promise<PhotoResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    deletePhoto: async (): Promise<PhotoResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
    info: async (_params: { user: string }): Promise<UserInfoResponse> => ({
      ok: false,
      error: 'slack_api_unavailable',
    }),
  };

  team = {
    profile: {
      get: async (): Promise<CustomFieldsResponse> => ({
        ok: false,
        error: 'slack_api_unavailable',
      }),
    },
  };
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Slack WebClient instance
 *
 * @param token - Slack user token (xoxp-...)
 * @returns Configured WebClient instance
 */
async function createSlackClient(token: string): Promise<SlackWebClient> {
  try {
    const slack = await import('@slack/web-api');
    return new slack.WebClient(token) as unknown as SlackWebClient;
  } catch {
    // Slack SDK not available, use mock
    return new MockWebClient(token);
  }
}

// =============================================================================
// ProfileManager Class
// =============================================================================

/**
 * Manages Slack user profile operations for VP agents.
 *
 * This class provides comprehensive profile management capabilities including:
 * - Profile retrieval (own or other users)
 * - Profile updates (display name, title, phone, etc.)
 * - Profile photo management (upload, delete)
 * - Custom field management (workspace-specific fields)
 * - Timezone and pronouns management
 *
 * @example
 * ```typescript
 * import { ProfileManager } from '@wundr/slack-agent/capabilities/profile-management';
 *
 * const manager = new ProfileManager({
 *   token: process.env.SLACK_USER_TOKEN!, // xoxp-...
 * });
 *
 * // Update VP agent's profile
 * await manager.setRealName('Ada', 'Lovelace');
 * await manager.setTitle('Virtual Principal - Engineering');
 * await manager.setProfilePhoto('./avatar.png');
 * ```
 */
export class ProfileManager {
  private client: SlackWebClient | null = null;
  private readonly config: ProfileManagerConfig;
  private initPromise: Promise<void>;

  /**
   * Creates a new ProfileManager instance
   *
   * @param config - Configuration options
   */
  constructor(config: ProfileManagerConfig) {
    this.config = config;
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the Slack client
   */
  private async initialize(): Promise<void> {
    if (this.config.client) {
      this.client = this.config.client;
    } else {
      this.client = await createSlackClient(this.config.token);
    }
  }

  /**
   * Get the initialized client
   */
  private async getClient(): Promise<SlackWebClient> {
    await this.initPromise;
    if (!this.client) {
      throw new ProfileError('Slack client not initialized', 'client_not_initialized');
    }
    return this.client;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`[ProfileManager] ${message}`, ...args);
    }
  }

  /**
   * Handle API response errors
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof ProfileError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      (error as { code?: string })?.code ||
      (error as { data?: { error?: string } })?.data?.error ||
      'unknown_error';

    throw new ProfileError(`Failed to ${operation}: ${errorMessage}`, errorCode, error);
  }

  // ===========================================================================
  // Profile Retrieval Methods
  // ===========================================================================

  /**
   * Get a user's profile
   *
   * @param userId - Optional user ID. If not provided, returns own profile.
   * @returns The user's profile
   *
   * @example
   * ```typescript
   * // Get own profile
   * const myProfile = await manager.getProfile();
   *
   * // Get another user's profile
   * const userProfile = await manager.getProfile('U123ABC456');
   * ```
   */
  async getProfile(userId?: string): Promise<UserProfile> {
    try {
      this.debug('Getting profile', userId ? `for user ${userId}` : 'for self');
      const client = await this.getClient();

      const response = await client.users.profile.get(userId ? { user: userId } : undefined);

      if (!response.ok) {
        throw new ProfileError(
          `Failed to get profile: ${response.error}`,
          response.error || 'get_profile_failed',
        );
      }

      if (!response.profile) {
        throw new ProfileError('No profile data returned', 'no_profile_data');
      }

      return response.profile;
    } catch (error) {
      this.handleError(error, 'get profile');
    }
  }

  // ===========================================================================
  // Profile Update Methods
  // ===========================================================================

  /**
   * Update profile with multiple fields at once
   *
   * @param profile - Profile fields to update
   *
   * @example
   * ```typescript
   * await manager.updateProfile({
   *   display_name: 'Ada VP',
   *   title: 'Virtual Principal - Engineering',
   *   pronouns: 'she/her',
   * });
   * ```
   */
  async updateProfile(profile: ProfileUpdate): Promise<void> {
    try {
      this.debug('Updating profile', profile);
      const client = await this.getClient();

      // Convert to API format
      const profilePayload: Record<string, unknown> = {};

      if (profile.display_name !== undefined) {
        profilePayload.display_name = profile.display_name;
      }
      if (profile.real_name !== undefined) {
        profilePayload.real_name = profile.real_name;
      }
      if (profile.first_name !== undefined) {
        profilePayload.first_name = profile.first_name;
      }
      if (profile.last_name !== undefined) {
        profilePayload.last_name = profile.last_name;
      }
      if (profile.title !== undefined) {
        profilePayload.title = profile.title;
      }
      if (profile.phone !== undefined) {
        profilePayload.phone = profile.phone;
      }
      if (profile.email !== undefined) {
        profilePayload.email = profile.email;
      }
      if (profile.pronouns !== undefined) {
        profilePayload.pronouns = profile.pronouns;
      }
      if (profile.status_text !== undefined) {
        profilePayload.status_text = profile.status_text;
      }
      if (profile.status_emoji !== undefined) {
        profilePayload.status_emoji = profile.status_emoji;
      }
      if (profile.status_expiration !== undefined) {
        profilePayload.status_expiration = profile.status_expiration;
      }
      if (profile.fields !== undefined) {
        profilePayload.fields = profile.fields;
      }

      const response = await client.users.profile.set({
        profile: JSON.stringify(profilePayload),
      });

      if (!response.ok) {
        throw new ProfileError(
          `Failed to update profile: ${response.error}`,
          response.error || 'update_profile_failed',
        );
      }

      this.debug('Profile updated successfully');
    } catch (error) {
      this.handleError(error, 'update profile');
    }
  }

  /**
   * Set the display name (how the name appears in Slack)
   *
   * @param name - Display name
   *
   * @example
   * ```typescript
   * await manager.setDisplayName('Ada VP');
   * ```
   */
  async setDisplayName(name: string): Promise<void> {
    await this.updateProfile({ display_name: name });
  }

  /**
   * Set the real name (first and last name)
   *
   * @param firstName - First name
   * @param lastName - Last name
   *
   * @example
   * ```typescript
   * await manager.setRealName('Ada', 'Lovelace');
   * ```
   */
  async setRealName(firstName: string, lastName: string): Promise<void> {
    await this.updateProfile({
      first_name: firstName,
      last_name: lastName,
      real_name: `${firstName} ${lastName}`,
    });
  }

  /**
   * Set the user's title/role
   *
   * @param title - Job title or role
   *
   * @example
   * ```typescript
   * await manager.setTitle('Virtual Principal - Engineering');
   * ```
   */
  async setTitle(title: string): Promise<void> {
    await this.updateProfile({ title });
  }

  /**
   * Set the user's phone number
   *
   * @param phone - Phone number
   *
   * @example
   * ```typescript
   * await manager.setPhone('+1-555-123-4567');
   * ```
   */
  async setPhone(phone: string): Promise<void> {
    await this.updateProfile({ phone });
  }

  // ===========================================================================
  // Profile Photo Methods
  // ===========================================================================

  /**
   * Set profile photo from a file path
   *
   * @param imagePath - Path to the image file (PNG, JPG, GIF)
   *
   * @example
   * ```typescript
   * await manager.setProfilePhoto('./avatars/ada-vp.png');
   * ```
   */
  async setProfilePhoto(imagePath: string): Promise<void> {
    try {
      this.debug('Setting profile photo from path', imagePath);
      const imageBuffer = await fs.readFile(imagePath);
      await this.setProfilePhotoFromBuffer(imageBuffer);
    } catch (error) {
      this.handleError(error, 'set profile photo from path');
    }
  }

  /**
   * Set profile photo from a buffer
   *
   * @param buffer - Image data as a Buffer
   *
   * @example
   * ```typescript
   * const imageBuffer = await fetchAvatarImage();
   * await manager.setProfilePhotoFromBuffer(imageBuffer);
   * ```
   */
  async setProfilePhotoFromBuffer(buffer: Buffer): Promise<void> {
    try {
      this.debug('Setting profile photo from buffer', `${buffer.length} bytes`);
      const client = await this.getClient();

      const response = await client.users.setPhoto({ image: buffer });

      if (!response.ok) {
        throw new ProfileError(
          `Failed to set profile photo: ${response.error}`,
          response.error || 'set_photo_failed',
        );
      }

      this.debug('Profile photo set successfully');
    } catch (error) {
      this.handleError(error, 'set profile photo');
    }
  }

  /**
   * Delete/remove the current profile photo
   *
   * @example
   * ```typescript
   * await manager.deleteProfilePhoto();
   * ```
   */
  async deleteProfilePhoto(): Promise<void> {
    try {
      this.debug('Deleting profile photo');
      const client = await this.getClient();

      const response = await client.users.deletePhoto();

      if (!response.ok) {
        throw new ProfileError(
          `Failed to delete profile photo: ${response.error}`,
          response.error || 'delete_photo_failed',
        );
      }

      this.debug('Profile photo deleted successfully');
    } catch (error) {
      this.handleError(error, 'delete profile photo');
    }
  }

  // ===========================================================================
  // Pronouns and Timezone Methods
  // ===========================================================================

  /**
   * Set the user's pronouns
   *
   * @param pronouns - Pronouns (e.g., 'she/her', 'he/him', 'they/them')
   *
   * @example
   * ```typescript
   * await manager.setPronouns('they/them');
   * ```
   */
  async setPronouns(pronouns: string): Promise<void> {
    await this.updateProfile({ pronouns });
  }

  /**
   * Set the user's timezone
   *
   * Note: This updates the timezone through the profile, but the actual
   * timezone setting may require additional API calls depending on
   * workspace configuration.
   *
   * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
   *
   * @example
   * ```typescript
   * await manager.setTimezone('America/Los_Angeles');
   * ```
   */
  async setTimezone(timezone: string): Promise<void> {
    try {
      this.debug('Setting timezone', timezone);
      const client = await this.getClient();

      // Note: Slack's API for timezone is limited. The users.profile.set
      // endpoint doesn't directly support timezone updates. The actual
      // timezone is typically set through the user's Slack client settings.
      //
      // However, we can store it as a custom field if the workspace has one,
      // or document that this is a best-effort operation.

      // Try to update via profile (may not be supported)
      const profilePayload = {
        // Some workspaces allow timezone in profile fields
        fields: {
          // Common field ID patterns for timezone (workspace-specific)
          Xf_timezone: { value: timezone, alt: '' },
        },
      };

      const response = await client.users.profile.set({
        profile: JSON.stringify(profilePayload),
      });

      if (!response.ok) {
        // If profile update fails, log warning but don't throw
        // as timezone may need to be set through different means
        this.debug(
          'Warning: Could not set timezone via profile API. ' +
            'Timezone may need to be set through Slack client settings.',
        );
      } else {
        this.debug('Timezone field updated');
      }
    } catch (error) {
      // Don't throw for timezone as it's often not directly settable
      this.debug('Warning: Timezone update failed', error);
    }
  }

  // ===========================================================================
  // Custom Fields Methods
  // ===========================================================================

  /**
   * Set a custom profile field value
   *
   * Custom field IDs are workspace-specific and typically start with 'Xf'.
   * Use `getCustomFields()` to discover available fields.
   *
   * @param fieldId - The custom field ID (e.g., 'Xf123ABC456')
   * @param value - The value to set
   *
   * @example
   * ```typescript
   * // Get available fields first
   * const fields = await manager.getCustomFields();
   * const teamField = fields.find(f => f.label === 'Team');
   *
   * if (teamField) {
   *   await manager.setCustomField(teamField.id, 'Platform Engineering');
   * }
   * ```
   */
  async setCustomField(fieldId: string, value: string): Promise<void> {
    try {
      this.debug('Setting custom field', fieldId, value);
      const client = await this.getClient();

      const profilePayload = {
        fields: {
          [fieldId]: {
            value,
            alt: '',
          },
        },
      };

      const response = await client.users.profile.set({
        profile: JSON.stringify(profilePayload),
      });

      if (!response.ok) {
        throw new ProfileError(
          `Failed to set custom field: ${response.error}`,
          response.error || 'set_custom_field_failed',
        );
      }

      this.debug('Custom field set successfully');
    } catch (error) {
      this.handleError(error, 'set custom field');
    }
  }

  /**
   * Get available custom fields for the workspace
   *
   * Custom fields are workspace-specific and configured by workspace admins.
   * This method returns all available fields that can be set on user profiles.
   *
   * @returns Array of custom field definitions
   *
   * @example
   * ```typescript
   * const fields = await manager.getCustomFields();
   *
   * for (const field of fields) {
   *   console.log(`${field.label} (${field.id}): ${field.type}`);
   * }
   * ```
   */
  async getCustomFields(): Promise<CustomField[]> {
    try {
      this.debug('Getting custom fields');
      const client = await this.getClient();

      const response = await client.team.profile.get();

      if (!response.ok) {
        throw new ProfileError(
          `Failed to get custom fields: ${response.error}`,
          response.error || 'get_custom_fields_failed',
        );
      }

      if (!response.profile_fields) {
        return [];
      }

      // Convert from object format to array format
      const fields: CustomField[] = Object.entries(response.profile_fields).map(([id, field]) => ({
        id,
        label: field.label,
        ordering: field.ordering,
        type: field.type,
        possible_values: field.possible_values,
        hint: field.hint,
        is_hidden: field.is_hidden,
      }));

      // Sort by ordering
      fields.sort((a, b) => a.ordering - b.ordering);

      this.debug('Found custom fields', fields.length);
      return fields;
    } catch (error) {
      this.handleError(error, 'get custom fields');
    }
  }

  /**
   * Set multiple custom fields at once
   *
   * @param fields - Map of field IDs to values
   *
   * @example
   * ```typescript
   * await manager.setCustomFields({
   *   'Xf123ABC456': 'Platform Engineering',
   *   'Xf789DEF012': 'San Francisco',
   * });
   * ```
   */
  async setCustomFields(fields: Record<string, string>): Promise<void> {
    try {
      this.debug('Setting multiple custom fields', Object.keys(fields).length);
      const client = await this.getClient();

      const profilePayload = {
        fields: Object.fromEntries(
          Object.entries(fields).map(([id, value]) => [id, { value, alt: '' }]),
        ),
      };

      const response = await client.users.profile.set({
        profile: JSON.stringify(profilePayload),
      });

      if (!response.ok) {
        throw new ProfileError(
          `Failed to set custom fields: ${response.error}`,
          response.error || 'set_custom_fields_failed',
        );
      }

      this.debug('Custom fields set successfully');
    } catch (error) {
      this.handleError(error, 'set custom fields');
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a ProfileManager instance
 *
 * @param config - Configuration options or just a token string
 * @returns Configured ProfileManager instance
 *
 * @example
 * ```typescript
 * // With token only
 * const manager = createProfileManager(process.env.SLACK_USER_TOKEN!);
 *
 * // With full config
 * const manager = createProfileManager({
 *   token: process.env.SLACK_USER_TOKEN!,
 *   debug: true,
 * });
 * ```
 */
export function createProfileManager(config: ProfileManagerConfig | string): ProfileManager {
  if (typeof config === 'string') {
    return new ProfileManager({ token: config });
  }
  return new ProfileManager(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default ProfileManager;
