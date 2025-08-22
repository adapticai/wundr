"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackIntegration = void 0;
const fs_1 = require("fs");
// Handle optional Slack dependency
let WebClient;
try {
    const slack = require('@slack/web-api');
    WebClient = slack.WebClient;
}
catch (e) {
    // Mock WebClient for when Slack SDK is not available
    WebClient = class MockWebClient {
        constructor(token) { }
        users = {
            profile: {
                set: async () => ({ ok: false, error: 'slack_api_unavailable' }),
                get: async () => ({ ok: false, error: 'slack_api_unavailable' })
            },
            setPhoto: async () => ({ ok: false, error: 'slack_api_unavailable' })
        };
        auth = {
            test: async () => ({ ok: false, error: 'slack_api_unavailable' })
        };
        team = {
            info: async () => ({ ok: false, error: 'slack_api_unavailable' })
        };
        dnd = {
            setSnooze: async () => ({ ok: false, error: 'slack_api_unavailable' }),
            endSnooze: async () => ({ ok: false, error: 'slack_api_unavailable' })
        };
    };
}
class SlackIntegration {
    client;
    constructor(token) {
        this.client = new WebClient(token);
    }
    /**
     * Update Slack profile with provided information
     */
    async updateProfile(profileData) {
        try {
            // Prepare profile object
            const profile = {
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
            await this.client.users.profile.set({ profile });
            // Upload profile photo if provided
            if (profileData.photoPath) {
                await this.uploadProfilePhoto(profileData.photoPath);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to update Slack profile: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Upload profile photo to Slack
     */
    async uploadProfilePhoto(photoPath) {
        try {
            const photoData = await fs_1.promises.readFile(photoPath);
            await this.client.users.setPhoto({
                image: photoData,
            });
        }
        catch (error) {
            throw new Error(`Failed to upload Slack profile photo: ${error}`);
        }
    }
    /**
     * Get current user profile information
     */
    async getCurrentProfile() {
        try {
            const response = await this.client.users.profile.get();
            return response.profile;
        }
        catch (error) {
            throw new Error(`Failed to get Slack profile: ${error}`);
        }
    }
    /**
     * Set Slack status with custom message and emoji
     */
    async setStatus(statusText, statusEmoji = ':computer:', expiration) {
        try {
            const profile = {
                status_text: statusText,
                status_emoji: statusEmoji,
            };
            if (expiration) {
                profile.status_expiration = expiration;
            }
            await this.client.users.profile.set({ profile });
        }
        catch (error) {
            throw new Error(`Failed to set Slack status: ${error}`);
        }
    }
    /**
     * Update only the profile fields without affecting other settings
     */
    async updateProfileFields(fields) {
        try {
            const profile = {
                fields,
            };
            await this.client.users.profile.set({ profile });
        }
        catch (error) {
            throw new Error(`Failed to update Slack profile fields: ${error}`);
        }
    }
    /**
     * Set Do Not Disturb status
     */
    async setDoNotDisturb(minutes) {
        try {
            await this.client.dnd.setSnooze({
                num_minutes: minutes,
            });
        }
        catch (error) {
            throw new Error(`Failed to set Do Not Disturb: ${error}`);
        }
    }
    /**
     * Clear Do Not Disturb status
     */
    async clearDoNotDisturb() {
        try {
            await this.client.dnd.endSnooze();
        }
        catch (error) {
            throw new Error(`Failed to clear Do Not Disturb: ${error}`);
        }
    }
    /**
     * Get workspace information
     */
    async getWorkspaceInfo() {
        try {
            const response = await this.client.team.info();
            return response.team;
        }
        catch (error) {
            throw new Error(`Failed to get workspace info: ${error}`);
        }
    }
    /**
     * Validate token and check permissions
     */
    async validateToken() {
        try {
            const authResponse = await this.client.auth.test();
            if (authResponse.ok) {
                return {
                    valid: true,
                    user: authResponse.user,
                    team: authResponse.team,
                };
            }
            else {
                return { valid: false };
            }
        }
        catch (error) {
            return { valid: false };
        }
    }
    /**
     * Set custom profile fields based on company schema
     */
    async setCustomFields(customFields) {
        try {
            // First get the current profile to understand available fields
            const currentProfile = await this.getCurrentProfile();
            const fields = currentProfile.fields || {};
            // Update with new custom fields
            Object.entries(customFields).forEach(([key, value]) => {
                if (fields[key]) {
                    fields[key].value = value;
                }
                else {
                    // Create new field - note: field IDs are workspace-specific
                    fields[key] = {
                        value,
                        alt: '',
                    };
                }
            });
            await this.updateProfileFields(fields);
        }
        catch (error) {
            throw new Error(`Failed to set custom fields: ${error}`);
        }
    }
    /**
     * Bulk update profile with all information at once
     */
    async bulkUpdateProfile(profileData) {
        try {
            const profile = {
                real_name: profileData.realName,
                title: profileData.title,
                status_text: profileData.statusText || '',
                status_emoji: profileData.statusEmoji || ':computer:',
            };
            // Add optional fields
            if (profileData.pronouns)
                profile.pronouns = profileData.pronouns;
            if (profileData.phone)
                profile.phone = profileData.phone;
            // Handle custom fields
            if (profileData.customFields) {
                const currentProfile = await this.getCurrentProfile();
                const existingFields = currentProfile.fields || {};
                Object.entries(profileData.customFields).forEach(([key, value]) => {
                    existingFields[key] = { value, alt: '' };
                });
                profile.fields = existingFields;
            }
            // Company field (standard field ID may vary by workspace)
            if (profileData.company) {
                if (!profile.fields)
                    profile.fields = {};
                profile.fields.Xf0COMPANY = {
                    value: profileData.company,
                    alt: '',
                };
            }
            // Update all profile information
            await this.client.users.profile.set({ profile });
            // Upload photo separately if provided
            if (profileData.photoPath) {
                await this.uploadProfilePhoto(profileData.photoPath);
            }
        }
        catch (error) {
            throw new Error(`Failed to bulk update profile: ${error}`);
        }
    }
}
exports.SlackIntegration = SlackIntegration;
//# sourceMappingURL=slack-integration.js.map