export interface ProfileConfig {
    fullName: string;
    role: string;
    jobTitle?: string;
    company?: string;
    githubUsername: string;
    githubEmail: string;
    location?: string;
    age?: number;
    openaiApiKey?: string;
    slackUserToken?: string;
}
export interface ProfilePhoto {
    originalPath: string;
    slackPath: string;
    gmailPath: string;
    avatarPath: string;
}
export declare class ProfilePersonalizer {
    private config;
    private spinner;
    private profilePhotosDir;
    private wallpaperDir;
    constructor(config: ProfileConfig);
    /**
     * Main orchestration method to personalize the entire profile
     */
    personalize(): Promise<void>;
    /**
     * Generate random profile data for missing fields
     */
    private generateRandomProfileData;
    /**
     * Create necessary directories for profile assets
     */
    private createDirectories;
    /**
     * Generate profile photo using OpenAI DALL-E
     */
    private generateProfilePhoto;
    /**
     * Update Slack profile with photo and details
     */
    private updateSlackProfile;
    /**
     * Update Gmail profile and signature
     */
    private updateGmailProfile;
    /**
     * Personalize Mac settings if on macOS
     */
    private personalizeMac;
    /**
     * Create welcome script for the user
     */
    private createWelcomeScript;
    /**
     * Get profile configuration summary
     */
    getProfileSummary(): object;
}
//# sourceMappingURL=profile-personalizer.d.ts.map