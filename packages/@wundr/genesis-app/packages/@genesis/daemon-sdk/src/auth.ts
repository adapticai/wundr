/**
 * Genesis Daemon SDK Authentication
 * Handles API key authentication and token management
 */

import type {
  AuthResponse,
  DaemonConfig,
  TokenRefreshResponse,
} from './types.js';

/**
 * Token storage interface
 */
interface TokenStorage {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  scopes: string[];
}

/**
 * Authentication manager for the Daemon SDK
 */
export class AuthManager {
  private config: DaemonConfig;
  private tokens: TokenStorage = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    scopes: [],
  };
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private onTokenRefresh?: (tokens: TokenRefreshResponse) => void;

  constructor(config: DaemonConfig) {
    this.config = config;
  }

  /**
   * Authenticate with the daemon using API key
   */
  async authenticate(): Promise<AuthResponse> {
    const response = await fetch(`${this.config.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        clientId: this.config.clientId,
        grantType: 'api_key',
      }),
      signal: AbortSignal.timeout(this.config.timeout ?? 30000),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      throw new AuthenticationError(
        (errorData.message as string) ??
          `Authentication failed: ${response.status}`,
        response.status
      );
    }

    const authResponse = (await response.json()) as AuthResponse;
    this.storeTokens(authResponse);
    this.scheduleTokenRefresh();

    return authResponse;
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<TokenRefreshResponse> {
    if (!this.tokens.refreshToken) {
      throw new AuthenticationError('No refresh token available', 401);
    }

    const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tokens.refreshToken}`,
      },
      body: JSON.stringify({
        refreshToken: this.tokens.refreshToken,
      }),
      signal: AbortSignal.timeout(this.config.timeout ?? 30000),
    });

    if (!response.ok) {
      // Clear tokens on refresh failure
      this.clearTokens();
      const errorData = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      throw new AuthenticationError(
        (errorData.message as string) ??
          `Token refresh failed: ${response.status}`,
        response.status
      );
    }

    const refreshResponse = (await response.json()) as TokenRefreshResponse;

    // Update stored access token
    this.tokens.accessToken = refreshResponse.accessToken;
    this.tokens.expiresAt = Date.now() + refreshResponse.expiresIn * 1000;

    // Notify listener
    this.onTokenRefresh?.(refreshResponse);

    // Schedule next refresh
    this.scheduleTokenRefresh();

    return refreshResponse;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    if (this.isTokenExpired()) {
      return null;
    }
    return this.tokens.accessToken;
  }

  /**
   * Get the current refresh token
   */
  getRefreshToken(): string | null {
    return this.tokens.refreshToken;
  }

  /**
   * Check if the access token is expired
   */
  isTokenExpired(): boolean {
    if (!this.tokens.expiresAt) {
      return true;
    }
    // Consider token expired 30 seconds before actual expiry
    return Date.now() >= this.tokens.expiresAt - 30000;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !this.isTokenExpired() && this.tokens.accessToken !== null;
  }

  /**
   * Get granted scopes
   */
  getScopes(): string[] {
    return [...this.tokens.scopes];
  }

  /**
   * Check if a specific scope is granted
   */
  hasScope(scope: string): boolean {
    return this.tokens.scopes.includes(scope);
  }

  /**
   * Set callback for token refresh events
   */
  onRefresh(callback: (tokens: TokenRefreshResponse) => void): void {
    this.onTokenRefresh = callback;
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    this.tokens = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      scopes: [],
    };
    this.cancelRefreshTimer();
  }

  /**
   * Dispose of the auth manager
   */
  dispose(): void {
    this.clearTokens();
    this.onTokenRefresh = undefined;
  }

  /**
   * Store tokens from auth response
   */
  private storeTokens(response: AuthResponse): void {
    this.tokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      scopes: response.scopes,
    };
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    this.cancelRefreshTimer();

    if (!this.tokens.expiresAt) {
      return;
    }

    // Refresh 60 seconds before expiry
    const refreshIn = this.tokens.expiresAt - Date.now() - 60000;

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          // Token refresh failed - will need to re-authenticate
          console.error('Automatic token refresh failed:', error);
        }
      }, refreshIn);
    }
  }

  /**
   * Cancel pending refresh timer
   */
  private cancelRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

/**
 * Create authorization header value
 */
export function createAuthHeader(
  token: string,
  type: string = 'Bearer'
): string {
  return `${type} ${token}`;
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): boolean {
  // API key should be at least 32 characters
  if (!apiKey || apiKey.length < 32) {
    return false;
  }
  // Should only contain alphanumeric characters, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(apiKey);
}
