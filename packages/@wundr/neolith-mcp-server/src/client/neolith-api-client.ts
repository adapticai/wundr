/**
 * Neolith API Client
 *
 * HTTP client for making requests to Neolith API endpoints.
 * Handles authentication, request/response formatting, and error handling.
 *
 * @module neolith-mcp-server/client/neolith-api-client
 */

// Using native fetch (Node.js 18+)

/**
 * Configuration for Neolith API Client
 */
export interface NeolithApiClientConfig {
  /** Base URL for Neolith API (e.g., https://app.neolith.dev or http://localhost:3000) */
  baseUrl: string;
  /** API authentication token */
  apiToken?: string;
  /** Session cookie for authenticated requests */
  sessionCookie?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/**
 * API request options
 */
export interface ApiRequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Query parameters */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request timeout override */
  timeout?: number;
  /** Whether to include credentials */
  credentials?: RequestCredentials;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  /** Response data */
  data?: T;
  /** Success message */
  message?: string;
  /** Error message */
  error?: string;
  /** Error details */
  errorDetails?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Neolith API Client
 *
 * Provides typed HTTP methods for interacting with Neolith API endpoints.
 */
export class NeolithApiClient {
  private config: Required<NeolithApiClientConfig>;

  constructor(config: NeolithApiClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiToken: config.apiToken || '',
      sessionCookie: config.sessionCookie || '',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Make an HTTP request to the Neolith API
   *
   * @param path - API endpoint path (without base URL)
   * @param options - Request options
   * @returns API response
   */
  async request<T = unknown>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      query,
      timeout = this.config.timeout,
      credentials = 'include',
    } = options;

    // Build URL with query parameters
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.config.baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add authentication
    if (this.config.apiToken) {
      requestHeaders['Authorization'] = `Bearer ${this.config.apiToken}`;
    }
    if (this.config.sessionCookie) {
      requestHeaders['Cookie'] = this.config.sessionCookie;
    }

    // Build request init
    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
      credentials,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      requestInit.body = JSON.stringify(body);
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url.toString(), {
        ...requestInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const responseData = await response.json() as ApiResponse<T>;

      // Check if response is successful
      if (!response.ok) {
        return {
          error: responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          errorDetails: responseData.errorDetails || {
            code: `HTTP_${response.status}`,
            message: response.statusText,
          },
        };
      }

      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        error: `Request failed: ${errorMessage}`,
        errorDetails: {
          code: 'NETWORK_ERROR',
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    path: string,
    queryOrOptions?: Record<string, string | number | boolean | undefined> | Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    // If queryOrOptions has a 'query' property, treat it as ApiRequestOptions
    // Otherwise, treat it as query parameters directly
    const options = queryOrOptions && 'query' in queryOrOptions
      ? queryOrOptions as Omit<ApiRequestOptions, 'method' | 'body'>
      : { query: queryOrOptions as Record<string, string | number | boolean | undefined> };

    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Upload a file using multipart/form-data
   *
   * @param path - API endpoint path
   * @param formData - FormData object with file and metadata
   * @param options - Request options
   * @returns API response
   */
  async uploadFile<T = unknown>(
    path: string,
    formData: FormData,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
  ): Promise<ApiResponse<T>> {
    const {
      headers = {},
      query,
      timeout = this.config.timeout,
      credentials = 'include',
    } = options;

    // Build URL with query parameters
    const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.config.baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Build headers (don't set Content-Type for FormData, browser will set it with boundary)
    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    // Add authentication
    if (this.config.apiToken) {
      requestHeaders['Authorization'] = `Bearer ${this.config.apiToken}`;
    }
    if (this.config.sessionCookie) {
      requestHeaders['Cookie'] = this.config.sessionCookie;
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
        credentials,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const responseData = await response.json() as ApiResponse<T>;

      // Check if response is successful
      if (!response.ok) {
        return {
          error: responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          errorDetails: responseData.errorDetails || {
            code: `HTTP_${response.status}`,
            message: response.statusText,
          },
        };
      }

      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        error: `Upload failed: ${errorMessage}`,
        errorDetails: {
          code: 'UPLOAD_ERROR',
          message: errorMessage,
        },
      };
    }
  }
}

/**
 * Create a new Neolith API client instance
 *
 * @param config - Client configuration
 * @returns Neolith API client
 */
export function createNeolithClient(config: NeolithApiClientConfig): NeolithApiClient {
  return new NeolithApiClient(config);
}
