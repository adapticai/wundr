/**
 * Neolith API Client
 *
 * Provides HTTP client for interacting with Neolith API endpoints.
 * Supports authentication, retry logic, error handling, and file uploads.
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface NeolithApiClientOptions {
  /**
   * Base URL for the Neolith API (e.g., "http://localhost:3000")
   */
  baseUrl: string;

  /**
   * Authentication token (Bearer token or Daemon JWT)
   */
  authToken?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Enable request/response logging
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Initial delay in milliseconds before first retry
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Maximum delay in milliseconds between retries
     * @default 10000
     */
    maxDelay?: number;

    /**
     * Exponential backoff multiplier
     * @default 2
     */
    backoffMultiplier?: number;

    /**
     * HTTP status codes that should trigger a retry
     * @default [408, 429, 500, 502, 503, 504]
     */
    retryableStatusCodes?: number[];
  };
}

export interface NeolithApiRequestOptions {
  /**
   * HTTP method
   */
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

  /**
   * Request path (relative to baseUrl)
   */
  path: string;

  /**
   * Query parameters
   */
  query?: Record<string, string | number | boolean | undefined>;

  /**
   * Request body (JSON serializable)
   */
  body?: unknown;

  /**
   * Request headers
   */
  headers?: Record<string, string>;

  /**
   * Override default timeout for this request
   */
  timeout?: number;

  /**
   * Disable retry logic for this request
   */
  noRetry?: boolean;
}

export interface NeolithApiResponse<T = unknown> {
  /**
   * HTTP status code
   */
  status: number;

  /**
   * Response headers
   */
  headers: Record<string, string>;

  /**
   * Parsed response body
   */
  data: T;

  /**
   * Raw response text
   */
  rawBody?: string;
}

export interface NeolithApiErrorDetails {
  /**
   * HTTP status code
   */
  status: number;

  /**
   * Error code from API
   */
  code?: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Additional error details
   */
  details?: unknown;

  /**
   * Response body (if available)
   */
  responseBody?: unknown;
}

// ============================================================================
// Error Classes
// ============================================================================

export class NeolithApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly responseBody?: unknown;

  constructor(errorDetails: NeolithApiErrorDetails) {
    super(errorDetails.message);
    this.name = 'NeolithApiError';
    this.status = errorDetails.status;
    this.code = errorDetails.code;
    this.details = errorDetails.details;
    this.responseBody = errorDetails.responseBody;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NeolithApiError);
    }
  }

  /**
   * Check if error is a specific HTTP status code
   */
  isStatus(status: number): boolean {
    return this.status === status;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  /**
   * Convert to JSON-serializable format
   */
  toJSON(): NeolithApiErrorDetails {
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      details: this.details,
      responseBody: this.responseBody,
    };
  }
}

export class NeolithApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'NeolithApiTimeoutError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NeolithApiTimeoutError);
    }
  }
}

export class NeolithApiNetworkError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'NeolithApiNetworkError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NeolithApiNetworkError);
    }
  }
}

// ============================================================================
// Client Events
// ============================================================================

export interface NeolithApiClientEvents {
  'request:start': (options: NeolithApiRequestOptions) => void;
  'request:success': (response: NeolithApiResponse) => void;
  'request:error': (error: Error) => void;
  'request:retry': (attempt: number, error: Error) => void;
}

// ============================================================================
// Client Implementation
// ============================================================================

export class NeolithApiClient extends EventEmitter<NeolithApiClientEvents> {
  private readonly baseUrl: string;
  private authToken?: string;
  private readonly timeout: number;
  private readonly enableLogging: boolean;
  private readonly retryConfig: Required<Required<NeolithApiClientOptions>['retry']>;

  constructor(options: NeolithApiClientOptions) {
    super();

    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authToken = options.authToken;
    this.timeout = options.timeout ?? 30000;
    this.enableLogging = options.enableLogging ?? false;

    // Set up retry configuration with defaults
    const retryDefaults = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    };

    this.retryConfig = {
      ...retryDefaults,
      ...options.retry,
    };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Perform a GET request
   */
  async get<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    options?: Partial<NeolithApiRequestOptions>
  ): Promise<NeolithApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      path,
      query,
      ...options,
    });
  }

  /**
   * Perform a POST request
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Partial<NeolithApiRequestOptions>
  ): Promise<NeolithApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      path,
      body,
      ...options,
    });
  }

  /**
   * Perform a PATCH request
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Partial<NeolithApiRequestOptions>
  ): Promise<NeolithApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      path,
      body,
      ...options,
    });
  }

  /**
   * Perform a PUT request
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: Partial<NeolithApiRequestOptions>
  ): Promise<NeolithApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      path,
      body,
      ...options,
    });
  }

  /**
   * Perform a DELETE request
   */
  async delete<T = unknown>(
    path: string,
    options?: Partial<NeolithApiRequestOptions>
  ): Promise<NeolithApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      path,
      ...options,
    });
  }

  /**
   * Upload a file using multipart/form-data
   */
  async upload<T = unknown>(
    path: string,
    file: {
      data: Blob | string;
      filename: string;
      contentType?: string;
    },
    additionalFields?: Record<string, string>,
    options?: Partial<NeolithApiRequestOptions>
  ): Promise<NeolithApiResponse<T>> {
    const formData = new FormData();

    // Add file
    const blob = file.data instanceof Blob
      ? file.data
      : new Blob([file.data], { type: file.contentType || 'application/octet-stream' });

    formData.append('file', blob, file.filename);

    // Add additional fields
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    return this.request<T>({
      method: 'POST',
      path,
      body: formData,
      headers: {
        // Let fetch set Content-Type with boundary for multipart/form-data
        ...(options?.headers || {}),
      },
      ...options,
    });
  }

  /**
   * Perform a generic HTTP request with retry logic
   */
  async request<T = unknown>(
    options: NeolithApiRequestOptions
  ): Promise<NeolithApiResponse<T>> {
    this.emit('request:start', options);

    if (this.enableLogging) {
      console.log(`[NeolithApiClient] ${options.method} ${options.path}`);
    }

    // Retry logic
    if (options.noRetry) {
      return this.executeRequest<T>(options);
    }

    let lastError: Error | undefined;
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.executeRequest<T>(options);
        this.emit('request:success', response);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except specific codes
        if (error instanceof NeolithApiError) {
          if (
            error.isClientError() &&
            !this.retryConfig.retryableStatusCodes.includes(error.status)
          ) {
            this.emit('request:error', error);
            throw error;
          }
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          this.emit('request:error', lastError);
          throw lastError;
        }

        // Emit retry event
        this.emit('request:retry', attempt, lastError);

        if (this.enableLogging) {
          console.log(
            `[NeolithApiClient] Retry attempt ${attempt}/${this.retryConfig.maxAttempts} ` +
            `after ${delay}ms for ${options.method} ${options.path}`
          );
        }

        // Wait before retry with exponential backoff
        await this.sleep(delay);
        delay = Math.min(
          delay * this.retryConfig.backoffMultiplier,
          this.retryConfig.maxDelay
        );
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Request failed with unknown error');
  }

  /**
   * Update authentication token
   */
  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  /**
   * Get current authentication token
   */
  getAuthToken(): string | undefined {
    return this.authToken;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Execute a single HTTP request (no retry logic)
   */
  private async executeRequest<T = unknown>(
    options: NeolithApiRequestOptions
  ): Promise<NeolithApiResponse<T>> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options);
    const timeout = options.timeout ?? this.timeout;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method: options.method,
        headers,
        signal: controller.signal,
      };

      // Add body for non-GET requests
      if (options.body && options.method !== 'GET') {
        if (options.body instanceof FormData) {
          fetchOptions.body = options.body;
        } else {
          fetchOptions.body = JSON.stringify(options.body);
        }
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      // Parse response
      const rawBody = await response.text();
      let data: T;

      try {
        data = rawBody ? JSON.parse(rawBody) : ({} as T);
      } catch {
        // If response is not JSON, return raw text
        data = rawBody as T;
      }

      // Extract headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Handle non-2xx responses
      if (!response.ok) {
        throw new NeolithApiError({
          status: response.status,
          code: (data as any)?.error?.code,
          message: (data as any)?.error?.message || response.statusText || 'Request failed',
          details: (data as any)?.error?.details,
          responseBody: data,
        });
      }

      return {
        status: response.status,
        headers: responseHeaders,
        data,
        rawBody,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if ((error as any).name === 'AbortError') {
        throw new NeolithApiTimeoutError(timeout);
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw new NeolithApiNetworkError(
          `Network error: ${error.message}`,
          error
        );
      }

      // Re-throw API errors
      if (error instanceof NeolithApiError) {
        throw error;
      }

      // Wrap unknown errors
      throw new NeolithApiNetworkError(
        `Unknown error: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(options: NeolithApiRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers || {}),
    };

    // Add Content-Type for JSON body (but not for FormData)
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add authentication header
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Neolith API client instance
 */
export function createNeolithApiClient(
  options: NeolithApiClientOptions
): NeolithApiClient {
  return new NeolithApiClient(options);
}

// ============================================================================
// Exports
// ============================================================================

export default NeolithApiClient;
