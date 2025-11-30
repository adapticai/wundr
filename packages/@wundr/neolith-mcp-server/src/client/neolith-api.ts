/**
 * Neolith API Client
 * HTTP client for making requests to Neolith API endpoints
 *
 * @module @wundr.io/neolith-mcp-server/client/neolith-api
 */

/**
 * Configuration for Neolith API client
 */
export interface NeolithApiConfig {
  /** Base URL for Neolith API (e.g., 'http://localhost:3000' or 'https://app.neolith.io') */
  baseUrl: string;
  /** API token for authentication */
  apiToken?: string;
  /** Session cookie for authentication */
  sessionCookie?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP request options
 */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Neolith API Client
 * Handles HTTP requests to Neolith API endpoints
 */
export class NeolithApiClient {
  private config: Required<NeolithApiConfig>;

  constructor(config: NeolithApiConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiToken: config.apiToken || '',
      sessionCookie: config.sessionCookie || '',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Make an HTTP request to the Neolith API
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication
    if (this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`;
    } else if (this.config.sessionCookie) {
      headers['Cookie'] = this.config.sessionCookie;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeout || this.config.timeout,
    );

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      let data: unknown;
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          success: false,
          error: typeof data === 'object' && data !== null && 'error' in data
            ? (data as { error: string }).error
            : `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return {
        success: true,
        data: data as T,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            status: 408,
          };
        }
        return {
          success: false,
          error: error.message,
          status: 0,
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred',
        status: 0,
      };
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string, queryParams?: Record<string, string>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url = `${endpoint}?${params.toString()}`;
    }

    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

/**
 * Create a Neolith API client instance
 */
export function createNeolithApiClient(config: NeolithApiConfig): NeolithApiClient {
  return new NeolithApiClient(config);
}

/**
 * Get API client instance from environment variables
 */
export function getDefaultApiClient(): NeolithApiClient {
  const baseUrl = process.env.NEOLITH_API_BASE_URL || 'http://localhost:3000';
  const apiToken = process.env.NEOLITH_API_TOKEN;
  const sessionCookie = process.env.NEOLITH_SESSION_COOKIE;

  if (!apiToken && !sessionCookie) {
    throw new Error(
      'Neolith API authentication not configured. Set NEOLITH_API_TOKEN or NEOLITH_SESSION_COOKIE environment variable.',
    );
  }

  return createNeolithApiClient({ baseUrl, apiToken, sessionCookie });
}
