import { promises as fs } from 'fs';

// Type definitions for Slack API responses and client
interface SlackProfileResponse {
  ok: boolean;
  error?: string;
  profile?: SlackProfile;
}

interface SlackProfile {
  real_name?: string;
  title?: string;
  status_text?: string;
  status_emoji?: string;
  fields?: Record<string, { value: string; alt: string }>;
  pronouns?: string;
  phone?: string;
}

interface SlackAuthResponse {
  ok: boolean;
  error?: string;
  user?: string;
  team?: string;
}

interface SlackTeamResponse {
  ok: boolean;
  error?: string;
  team?: {
    id: string;
    name: string;
    domain: string;
  };
}

interface SlackDndResponse {
  ok: boolean;
  error?: string;
}

interface SlackPhotoResponse {
  ok: boolean;
  error?: string;
}

interface SlackClientInterface {
  users: {
    profile: {
      set: (params: { profile: SlackProfilePayload }) => Promise<SlackProfileResponse>;
      get: () => Promise<SlackProfileResponse>;
    };
    setPhoto: (params: { image: Buffer }) => Promise<SlackPhotoResponse>;
  };
  auth: {
    test: () => Promise<SlackAuthResponse>;
  };
  team: {
    info: () => Promise<SlackTeamResponse>;
  };
  dnd: {
    setSnooze: (params: { num_minutes: number }) => Promise<SlackDndResponse>;
    endSnooze: () => Promise<SlackDndResponse>;
  };
}

interface SlackProfilePayload {
  real_name?: string;
  title?: string;
  status_text?: string;
  status_emoji?: string;
  status_expiration?: number;
  fields?: Record<string, { value: string; alt: string }>;
  pronouns?: string;
  phone?: string;
}

// Mock WebClient for when Slack SDK is not available
class MockWebClient implements SlackClientInterface {
  constructor(_token: string) {}

  users = {
    profile: {
      set: async (_params: { profile: SlackProfilePayload }) => ({ ok: false, error: 'slack_api_unavailable' }),
      get: async () => ({ ok: false, error: 'slack_api_unavailable' }),
    },
    setPhoto: async (_params: { image: Buffer }) => ({ ok: false, error: 'slack_api_unavailable' }),
  };

  auth = {
    test: async () => ({ ok: false, error: 'slack_api_unavailable' }),
  };

  team = {
    info: async () => ({ ok: false, error: 'slack_api_unavailable' }),
  };

  dnd = {
    setSnooze: async (_params: { num_minutes: number }) => ({ ok: false, error: 'slack_api_unavailable' }),
    endSnooze: async () => ({ ok: false, error: 'slack_api_unavailable' }),
  };
}

// Factory function to create Slack client
async function createSlackClient(token: string): Promise<SlackClientInterface> {
  try {
    const slack = await import('@slack/web-api');
    return new slack.WebClient(token) as unknown as SlackClientInterface;
  } catch (_e) {
    // Slack SDK not available, use mock
    return new MockWebClient(token);
  }
}

export interface SlackProfileData {
  realName: string;
  title: string;
  statusText?: string;
  statusEmoji?: string;
  company?: string;
  photoPath?: string;
}

export class SlackIntegration {
  private client: SlackClientInterface | null = null;
  private initPromise: Promise<void>;

  constructor(token: string) {
    this.initPromise = this.initialize(token);
  }

  private async initialize(token: string): Promise<void> {
    this.client = await createSlackClient(token);
  }

  private async getClient(): Promise<SlackClientInterface> {
    await this.initPromise;
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }
    return this.client;
  }

  /**
   * Update Slack profile with provided information
   */
  async updateProfile(profileData: SlackProfileData): Promise<void> {
    try {
      const client = await this.getClient();

      // Prepare profile object
      const profile: SlackProfilePayload = {
        real_name: profileData.realName,
        title: profileData.title,
        status_text: profileData.statusText || '',
        status_emoji: profileData.statusEmoji || ':computer:',
      };

      // Add company field if provided
      if (profileData.company) {
        profile.fields = {
          Xf0COMPANY: {
            value: profileData.company,
            alt: '',
          },
        };
      }

      // Update profile fields
      await client.users.profile.set({ profile });

      // Upload profile photo if provided
      if (profileData.photoPath) {
        await this.uploadProfilePhoto(profileData.photoPath);
      }

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update Slack profile: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Upload profile photo to Slack
   */
  private async uploadProfilePhoto(photoPath: string): Promise<void> {
    try {
      const client = await this.getClient();
      const photoData = await fs.readFile(photoPath);

      await client.users.setPhoto({
        image: photoData,
      });

    } catch (_error) {
      throw new Error(`Failed to upload Slack profile photo: ${_error}`);
    }
  }

  /**
   * Get current user profile information
   */
  async getCurrentProfile(): Promise<SlackProfile | undefined> {
    try {
      const client = await this.getClient();
      const response = await client.users.profile.get();
      return response.profile;
    } catch (_error) {
      throw new Error(`Failed to get Slack profile: ${_error}`);
    }
  }

  /**
   * Set Slack status with custom message and emoji
   */
  async setStatus(statusText: string, statusEmoji: string = ':computer:', expiration?: number): Promise<void> {
    try {
      const client = await this.getClient();
      const profile: SlackProfilePayload = {
        status_text: statusText,
        status_emoji: statusEmoji,
      };

      if (expiration) {
        profile.status_expiration = expiration;
      }

      await client.users.profile.set({ profile });

    } catch (_error) {
      throw new Error(`Failed to set Slack status: ${_error}`);
    }
  }

  /**
   * Update only the profile fields without affecting other settings
   */
  async updateProfileFields(fields: Record<string, { value: string; alt: string }>): Promise<void> {
    try {
      const client = await this.getClient();
      const profile: SlackProfilePayload = {
        fields,
      };

      await client.users.profile.set({ profile });

    } catch (_error) {
      throw new Error(`Failed to update Slack profile fields: ${_error}`);
    }
  }

  /**
   * Set Do Not Disturb status
   */
  async setDoNotDisturb(minutes: number): Promise<void> {
    try {
      const client = await this.getClient();
      await client.dnd.setSnooze({
        num_minutes: minutes,
      });

    } catch (_error) {
      throw new Error(`Failed to set Do Not Disturb: ${_error}`);
    }
  }

  /**
   * Clear Do Not Disturb status
   */
  async clearDoNotDisturb(): Promise<void> {
    try {
      const client = await this.getClient();
      await client.dnd.endSnooze();
    } catch (_error) {
      throw new Error(`Failed to clear Do Not Disturb: ${_error}`);
    }
  }

  /**
   * Get workspace information
   */
  async getWorkspaceInfo(): Promise<SlackTeamResponse['team']> {
    try {
      const client = await this.getClient();
      const response = await client.team.info();
      return response.team;
    } catch (_error) {
      throw new Error(`Failed to get workspace info: ${_error}`);
    }
  }

  /**
   * Validate token and check permissions
   */
  async validateToken(): Promise<{ valid: boolean; user?: string; team?: string }> {
    try {
      const client = await this.getClient();
      const authResponse = await client.auth.test();

      if (authResponse.ok) {
        return {
          valid: true,
          user: authResponse.user,
          team: authResponse.team,
        };
      } else {
        return { valid: false };
      }

    } catch (_error) {
      return { valid: false };
    }
  }

  /**
   * Set custom profile fields based on company schema
   */
  async setCustomFields(customFields: Record<string, string>): Promise<void> {
    try {
      // First get the current profile to understand available fields
      const currentProfile = await this.getCurrentProfile();
      const fields: Record<string, { value: string; alt: string }> = currentProfile?.fields || {};

      // Update with new custom fields
      Object.entries(customFields).forEach(([key, value]) => {
        if (fields[key]) {
          fields[key].value = value;
        } else {
          // Create new field - note: field IDs are workspace-specific
          fields[key] = {
            value,
            alt: '',
          };
        }
      });

      await this.updateProfileFields(fields);

    } catch (_error) {
      throw new Error(`Failed to set custom fields: ${_error}`);
    }
  }

  /**
   * Bulk update profile with all information at once
   */
  async bulkUpdateProfile(profileData: SlackProfileData & {
    customFields?: Record<string, string>;
    pronouns?: string;
    phone?: string;
    timezone?: string;
  }): Promise<void> {
    try {
      const client = await this.getClient();
      const profile: SlackProfilePayload = {
        real_name: profileData.realName,
        title: profileData.title,
        status_text: profileData.statusText || '',
        status_emoji: profileData.statusEmoji || ':computer:',
      };

      // Add optional fields
      if (profileData.pronouns) {
        profile.pronouns = profileData.pronouns;
      }
      if (profileData.phone) {
        profile.phone = profileData.phone;
      }

      // Handle custom fields
      if (profileData.customFields) {
        const currentProfile = await this.getCurrentProfile();
        const existingFields: Record<string, { value: string; alt: string }> = currentProfile?.fields || {};

        Object.entries(profileData.customFields).forEach(([key, value]) => {
          existingFields[key] = { value, alt: '' };
        });

        profile.fields = existingFields;
      }

      // Company field (standard field ID may vary by workspace)
      if (profileData.company) {
        if (!profile.fields) {
          profile.fields = {};
        }
        profile.fields.Xf0COMPANY = {
          value: profileData.company,
          alt: '',
        };
      }

      // Update all profile information
      await client.users.profile.set({ profile });

      // Upload photo separately if provided
      if (profileData.photoPath) {
        await this.uploadProfilePhoto(profileData.photoPath);
      }

    } catch (_error) {
      throw new Error(`Failed to bulk update profile: ${_error}`);
    }
  }
}