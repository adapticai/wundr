export interface SlackProfileData {
    realName: string;
    title: string;
    statusText?: string;
    statusEmoji?: string;
    company?: string;
    photoPath?: string;
}
export declare class SlackIntegration {
    private client;
    constructor(token: string);
    /**
     * Update Slack profile with provided information
     */
    updateProfile(profileData: SlackProfileData): Promise<void>;
    /**
     * Upload profile photo to Slack
     */
    private uploadProfilePhoto;
    /**
     * Get current user profile information
     */
    getCurrentProfile(): Promise<any>;
    /**
     * Set Slack status with custom message and emoji
     */
    setStatus(statusText: string, statusEmoji?: string, expiration?: number): Promise<void>;
    /**
     * Update only the profile fields without affecting other settings
     */
    updateProfileFields(fields: Record<string, {
        value: string;
        alt: string;
    }>): Promise<void>;
    /**
     * Set Do Not Disturb status
     */
    setDoNotDisturb(minutes: number): Promise<void>;
    /**
     * Clear Do Not Disturb status
     */
    clearDoNotDisturb(): Promise<void>;
    /**
     * Get workspace information
     */
    getWorkspaceInfo(): Promise<any>;
    /**
     * Validate token and check permissions
     */
    validateToken(): Promise<{
        valid: boolean;
        user?: string;
        team?: string;
    }>;
    /**
     * Set custom profile fields based on company schema
     */
    setCustomFields(customFields: Record<string, string>): Promise<void>;
    /**
     * Bulk update profile with all information at once
     */
    bulkUpdateProfile(profileData: SlackProfileData & {
        customFields?: Record<string, string>;
        pronouns?: string;
        phone?: string;
        timezone?: string;
    }): Promise<void>;
}
//# sourceMappingURL=slack-integration.d.ts.map