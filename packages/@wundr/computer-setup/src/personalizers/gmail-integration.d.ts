/**
 * Gmail Integration - Full implementation with OAuth2 and Gmail API
 */
import { DeveloperProfile } from '../types';
export interface GmailCredentials {
    client_id: string;
    client_secret: string;
    redirect_uri?: string;
    access_token?: string;
    refresh_token?: string;
    scope?: string[];
    token_type?: string;
    expiry_date?: number;
}
export interface GmailProfileData {
    name?: string;
    displayName?: string;
    role?: string;
    jobTitle?: string;
    email?: string;
    replyToAddress?: string;
    signature?: string;
    isDefault?: boolean;
    treatAsAlias?: boolean;
}
export interface GmailIntegration {
    isConfigured(): Promise<boolean>;
    configure(profile: DeveloperProfile): Promise<void>;
    getSignature(): Promise<string>;
    updateSignature(signature: string): Promise<void>;
    updateProfile(profileData: GmailProfileData): Promise<void>;
}
export declare class GmailIntegrationService implements GmailIntegration {
    private readonly credentialsPath;
    private readonly tokenPath;
    private auth;
    private isAvailable;
    constructor();
    /**
     * Check if Gmail API credentials exist and are valid
     */
    isConfigured(): Promise<boolean>;
    /**
     * Set up Gmail API credentials with OAuth2 flow
     */
    configure(profile: DeveloperProfile): Promise<void>;
    /**
     * Retrieve current Gmail signature
     */
    getSignature(): Promise<string>;
    /**
     * Update Gmail signature with HTML template
     */
    updateSignature(signature: string): Promise<void>;
    /**
     * Update Gmail profile information
     */
    updateProfile(profileData: GmailProfileData): Promise<void>;
    /**
     * Get authenticated client, handling token refresh
     */
    private getAuthClient;
    /**
     * Utility method to complete OAuth flow with authorization code
     */
    completeOAuthFlow(authorizationCode: string): Promise<void>;
    /**
     * Test the Gmail connection
     */
    testConnection(): Promise<{
        success: boolean;
        email?: string;
        error?: string;
    }>;
}
//# sourceMappingURL=gmail-integration.d.ts.map