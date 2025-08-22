/**
 * Gmail Integration - Full implementation with OAuth2 and Gmail API
 */

import { DeveloperProfile } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Handle optional Google APIs dependencies
let google: any;
let OAuth2Client: any;
let gmail: any;

try {
  const googleapis = require('googleapis');
  const { google_auth_library } = require('google-auth-library');
  
  google = googleapis.google;
  OAuth2Client = google_auth_library.OAuth2Client;
  gmail = google.gmail('v1');
} catch (e) {
  // Mock implementations when googleapis is not available
  google = null;
  OAuth2Client = class MockOAuth2Client {
    constructor() {}
    generateAuthUrl() { return 'mock://auth-url'; }
    getToken() { return Promise.resolve({ tokens: {} }); }
    setCredentials() {}
    on() {}
  };
  gmail = {
    users: {
      settings: {
        sendAs: {
          list: () => Promise.resolve({ data: { sendAs: [] } }),
          patch: () => Promise.resolve({ data: {} })
        }
      },
      getProfile: () => Promise.resolve({ data: { emailAddress: 'mock@example.com' } })
    }
  };
}

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

export class GmailIntegrationService implements GmailIntegration {
  private readonly credentialsPath: string;
  private readonly tokenPath: string;
  private auth: any;
  private isAvailable: boolean;

  constructor() {
    const configDir = path.join(os.homedir(), '.config', 'wundr-setup');
    this.credentialsPath = path.join(configDir, 'gmail-credentials.json');
    this.tokenPath = path.join(configDir, 'gmail-tokens.json');
    this.isAvailable = !!google;
  }

  /**
   * Check if Gmail API credentials exist and are valid
   */
  async isConfigured(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      // Check if credentials file exists
      await fs.access(this.credentialsPath);
      
      // Check if token file exists
      await fs.access(this.tokenPath);
      
      // Try to initialize auth client
      const auth = await this.getAuthClient();
      if (!auth) {
        return false;
      }

      // Test the authentication by making a simple API call
      const profile = await gmail.users.getProfile({
        auth,
        userId: 'me'
      });
      
      return !!profile.data.emailAddress;
    } catch (error) {
      console.warn('Gmail configuration check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Set up Gmail API credentials with OAuth2 flow
   */
  async configure(profile: DeveloperProfile): Promise<void> {
    if (!this.isAvailable) {
      throw new Error('Google APIs package (googleapis) is not available. Install it with: npm install googleapis google-auth-library');
    }

    if (!profile.email) {
      throw new Error('Developer profile must include an email address for Gmail integration');
    }

    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.credentialsPath);
      await fs.mkdir(configDir, { recursive: true });

      // Check if credentials already exist
      let credentials: GmailCredentials;
      try {
        const credentialsContent = await fs.readFile(this.credentialsPath, 'utf8');
        credentials = JSON.parse(credentialsContent);
      } catch {
        // If no existing credentials, prompt user to set them up
        console.log('\n=== Gmail API Setup Required ===');
        console.log('To configure Gmail integration, you need to:');
        console.log('1. Go to https://console.cloud.google.com/');
        console.log('2. Create a new project or select existing one');
        console.log('3. Enable Gmail API');
        console.log('4. Create OAuth2 credentials');
        console.log('5. Download the credentials JSON file');
        console.log('6. Save it as:', this.credentialsPath);
        console.log('');
        console.log('The credentials file should contain:');
        console.log('- client_id');
        console.log('- client_secret');
        console.log('- redirect_uri (use: http://localhost:3000/oauth/callback)');
        console.log('');
        
        throw new Error('Gmail credentials not found. Please set up OAuth2 credentials first.');
      }

      // Initialize OAuth2 client
      const auth = new OAuth2Client(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uri || 'http://localhost:3000/oauth/callback'
      );

      // Check if we have valid tokens
      let tokens;
      try {
        const tokenContent = await fs.readFile(this.tokenPath, 'utf8');
        tokens = JSON.parse(tokenContent);
        auth.setCredentials(tokens);
        
        // Test the tokens
        await gmail.users.getProfile({ auth, userId: 'me' });
        console.log('✅ Gmail integration already configured and working');
        return;
      } catch (tokenError) {
        // Need to get new tokens
        console.log('🔄 Gmail tokens expired or invalid, initiating OAuth flow...');
      }

      // Generate authorization URL
      const authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.settings.basic',
          'https://www.googleapis.com/auth/gmail.settings.sharing',
          'https://www.googleapis.com/auth/gmail.readonly'
        ],
        prompt: 'consent'
      });

      console.log('\n=== Gmail OAuth Authorization Required ===');
      console.log('1. Open this URL in your browser:');
      console.log(authUrl);
      console.log('');
      console.log('2. Complete the authorization flow');
      console.log('3. Copy the authorization code from the callback URL');
      console.log('4. Run this setup again with the authorization code');
      console.log('');
      
      // For automated setup, we'd need to implement a local server
      // or use a different flow. For now, we guide the user through manual setup.
      throw new Error('Manual OAuth authorization required. Please complete the steps above.');
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to configure Gmail integration: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Retrieve current Gmail signature
   */
  async getSignature(): Promise<string> {
    if (!this.isAvailable) {
      console.warn('Gmail API not available, returning empty signature');
      return '';
    }

    try {
      const auth = await this.getAuthClient();
      if (!auth) {
        throw new Error('Gmail not configured. Run configure() first.');
      }

      // Get the user's send-as settings (which includes signatures)
      const response = await gmail.users.settings.sendAs.list({
        auth,
        userId: 'me'
      });

      const sendAsSettings = response.data.sendAs;
      if (!sendAsSettings || sendAsSettings.length === 0) {
        return '';
      }

      // Find the primary email address
      const primarySetting = sendAsSettings.find((setting: any) => setting.isPrimary) || sendAsSettings[0];
      
      return primarySetting.signature || '';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get Gmail signature: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update Gmail signature with HTML template
   */
  async updateSignature(signature: string): Promise<void> {
    if (!this.isAvailable) {
      console.warn('Gmail API not available, skipping signature update');
      return;
    }

    try {
      const auth = await this.getAuthClient();
      if (!auth) {
        throw new Error('Gmail not configured. Run configure() first.');
      }

      // Get current send-as settings
      const listResponse = await gmail.users.settings.sendAs.list({
        auth,
        userId: 'me'
      });

      const sendAsSettings = listResponse.data.sendAs;
      if (!sendAsSettings || sendAsSettings.length === 0) {
        throw new Error('No send-as settings found');
      }

      // Find the primary email address
      const primarySetting = sendAsSettings.find((setting: any) => setting.isPrimary) || sendAsSettings[0];
      
      if (!primarySetting.sendAsEmail) {
        throw new Error('Primary email address not found');
      }

      // Update the signature
      await gmail.users.settings.sendAs.patch({
        auth,
        userId: 'me',
        sendAsEmail: primarySetting.sendAsEmail,
        requestBody: {
          signature: signature
        }
      });

      console.log('✅ Gmail signature updated successfully');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update Gmail signature: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update Gmail profile information
   */
  async updateProfile(profileData: GmailProfileData): Promise<void> {
    if (!this.isAvailable) {
      console.warn('Gmail API not available, skipping profile update');
      return;
    }

    try {
      const auth = await this.getAuthClient();
      if (!auth) {
        throw new Error('Gmail not configured. Run configure() first.');
      }

      // Get current send-as settings
      const listResponse = await gmail.users.settings.sendAs.list({
        auth,
        userId: 'me'
      });

      const sendAsSettings = listResponse.data.sendAs;
      if (!sendAsSettings || sendAsSettings.length === 0) {
        throw new Error('No send-as settings found');
      }

      // Find the primary email address
      const primarySetting = sendAsSettings.find((setting: any) => setting.isPrimary) || sendAsSettings[0];
      
      if (!primarySetting.sendAsEmail) {
        throw new Error('Primary email address not found');
      }

      // Prepare update data
      const updateData: any = {};
      
      // Handle display name (prefer name over displayName for backward compatibility)
      const displayName = profileData.name || profileData.displayName;
      if (displayName !== undefined) {
        updateData.displayName = displayName;
      }
      
      if (profileData.replyToAddress !== undefined) {
        updateData.replyToAddress = profileData.replyToAddress;
      }
      
      if (profileData.signature !== undefined) {
        updateData.signature = profileData.signature;
      }
      
      if (profileData.treatAsAlias !== undefined) {
        updateData.treatAsAlias = profileData.treatAsAlias;
      }

      // Note: role, jobTitle, and email are typically handled through signature updates
      // or other profile mechanisms, as Gmail's send-as settings are more limited

      // Update the profile
      await gmail.users.settings.sendAs.patch({
        auth,
        userId: 'me',
        sendAsEmail: primarySetting.sendAsEmail,
        requestBody: updateData
      });

      console.log('✅ Gmail profile updated successfully');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update Gmail profile: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get authenticated client, handling token refresh
   */
  private async getAuthClient(): Promise<any> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      // Read credentials
      const credentialsContent = await fs.readFile(this.credentialsPath, 'utf8');
      const credentials: GmailCredentials = JSON.parse(credentialsContent);

      // Read tokens
      const tokenContent = await fs.readFile(this.tokenPath, 'utf8');
      const tokens = JSON.parse(tokenContent);

      // Create OAuth2 client
      const auth = new OAuth2Client(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uri || 'http://localhost:3000/oauth/callback'
      );

      auth.setCredentials(tokens);

      // Set up automatic token refresh
      auth.on('tokens', async (newTokens: any) => {
        if (newTokens.refresh_token) {
          tokens.refresh_token = newTokens.refresh_token;
        }
        if (newTokens.access_token) {
          tokens.access_token = newTokens.access_token;
        }
        if (newTokens.expiry_date) {
          tokens.expiry_date = newTokens.expiry_date;
        }

        // Save updated tokens
        await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
      });

      return auth;
    } catch (error) {
      console.warn('Failed to get auth client:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Utility method to complete OAuth flow with authorization code
   */
  async completeOAuthFlow(authorizationCode: string): Promise<void> {
    if (!this.isAvailable) {
      throw new Error('Google APIs package not available');
    }

    try {
      // Read credentials
      const credentialsContent = await fs.readFile(this.credentialsPath, 'utf8');
      const credentials: GmailCredentials = JSON.parse(credentialsContent);

      // Create OAuth2 client
      const auth = new OAuth2Client(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uri || 'http://localhost:3000/oauth/callback'
      );

      // Exchange authorization code for tokens
      const { tokens } = await auth.getToken(authorizationCode);
      
      // Save tokens
      await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
      
      console.log('✅ OAuth flow completed successfully');
      console.log('✅ Gmail integration is now configured');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to complete OAuth flow: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Test the Gmail connection
   */
  async testConnection(): Promise<{ success: boolean; email?: string; error?: string }> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'Google APIs package not available'
      };
    }

    try {
      const auth = await this.getAuthClient();
      if (!auth) {
        return {
          success: false,
          error: 'Authentication not configured'
        };
      }

      const profile = await gmail.users.getProfile({
        auth,
        userId: 'me'
      });

      return {
        success: true,
        email: profile.data.emailAddress
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}