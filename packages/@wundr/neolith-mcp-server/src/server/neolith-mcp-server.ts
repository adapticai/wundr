/**
 * Neolith MCP Server Implementation
 *
 * High-level server class for Neolith MCP tools that extends the base MCP server
 * with Neolith-specific API integration and authentication.
 *
 * This server provides MCP tools for interacting with the Neolith workspace API,
 * enabling Claude Code to manage workspaces, channels, messages, and files.
 */

import {
  MCPServer,
  type MCPServerOptions,
  type McpToolType as Tool,
  type ToolHandler,
  type ToolRegistration,
  type Logger,
} from '@wundr.io/mcp-server';

/**
 * Neolith MCP Server Options
 *
 * Extends base MCPServerOptions with Neolith-specific configuration
 */
export interface NeolithMCPServerOptions extends MCPServerOptions {
  /** Neolith API base URL */
  neolithApiUrl: string;
  /** Authentication token for Neolith API */
  authToken: string;
  /** Optional workspace slug to scope operations */
  workspaceSlug?: string;
  /** API request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable request/response logging for debugging */
  debugApi?: boolean;
}

/**
 * Neolith MCP Server Configuration
 *
 * Internal configuration object used by the server
 */
export interface NeolithMCPServerConfig {
  readonly neolithApiUrl: string;
  readonly authToken: string;
  readonly workspaceSlug?: string;
  readonly timeout: number;
  readonly debugApi: boolean;
}

/**
 * Neolith API Client Interface
 *
 * Used for making authenticated requests to the Neolith API
 */
export interface NeolithAPIClient {
  get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T>;
  post<T = unknown>(path: string, data?: Record<string, unknown>): Promise<T>;
  put<T = unknown>(path: string, data?: Record<string, unknown>): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
  patch<T = unknown>(path: string, data?: Record<string, unknown>): Promise<T>;
}

/**
 * Neolith MCP Server Status
 */
export type NeolithMCPServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * Neolith MCP Server Class
 *
 * Main entry point for creating and managing a Neolith MCP server.
 * Provides tools for interacting with Neolith workspaces, channels, and messages.
 *
 * @example
 * ```typescript
 * const server = new NeolithMCPServer({
 *   name: 'neolith-mcp-server',
 *   version: '1.0.0',
 *   neolithApiUrl: 'https://api.neolith.dev',
 *   authToken: process.env.NEOLITH_AUTH_TOKEN,
 *   workspaceSlug: 'my-workspace'
 * });
 *
 * await server.start();
 * ```
 */
export class NeolithMCPServer {
  private readonly mcpServer: MCPServer;
  private readonly config: NeolithMCPServerConfig;
  private readonly logger: Logger;
  private readonly apiClient: NeolithAPIClient;

  private status: NeolithMCPServerStatus = 'stopped';

  constructor(options: NeolithMCPServerOptions) {
    // Validate required Neolith options
    if (!options.neolithApiUrl) {
      throw new Error('neolithApiUrl is required');
    }
    if (!options.authToken) {
      throw new Error('authToken is required');
    }

    // Build Neolith configuration
    this.config = {
      neolithApiUrl: options.neolithApiUrl,
      authToken: options.authToken,
      workspaceSlug: options.workspaceSlug,
      timeout: options.timeout ?? 30000,
      debugApi: options.debugApi ?? false,
    };

    // Create the base MCP server
    this.mcpServer = new MCPServer({
      name: options.name,
      version: options.version,
      description: options.description ?? 'Neolith MCP Server for workspace management',
      capabilities: options.capabilities,
      logging: options.logging,
      tools: options.tools ?? [],
      resources: options.resources,
      prompts: options.prompts,
      debug: options.debug,
      logger: options.logger,
    });

    this.logger = this.mcpServer.getLogger() as unknown as Logger;

    // Create Neolith API client
    this.apiClient = this.createAPIClient();

    this.logger.debug('Neolith MCP Server created', {
      name: options.name,
      version: options.version,
      apiUrl: this.config.neolithApiUrl,
      workspace: this.config.workspaceSlug,
    });
  }

  /**
   * Get the current server status
   */
  public getStatus(): NeolithMCPServerStatus {
    return this.status;
  }

  /**
   * Start the Neolith MCP server
   */
  public async start(): Promise<void> {
    if (this.status === 'running') {
      this.logger.warn('Neolith MCP Server is already running');
      return;
    }

    this.status = 'starting';
    this.logger.info('Starting Neolith MCP Server...');

    try {
      // Start the underlying MCP server
      await this.mcpServer.start();
      this.status = 'running';
      this.logger.info('Neolith MCP Server started successfully');
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to start Neolith MCP Server', error);
      throw error;
    }
  }

  /**
   * Stop the Neolith MCP server
   */
  public async stop(): Promise<void> {
    if (this.status === 'stopped') {
      this.logger.warn('Neolith MCP Server is already stopped');
      return;
    }

    this.status = 'stopping';
    this.logger.info('Stopping Neolith MCP Server...');

    try {
      await this.mcpServer.stop();
      this.status = 'stopped';
      this.logger.info('Neolith MCP Server stopped successfully');
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to stop Neolith MCP Server', error);
      throw error;
    }
  }

  /**
   * Register a Neolith-specific tool with the server
   *
   * @param registration Tool registration including tool definition and handler
   * @returns This server instance for chaining
   */
  public registerTool(registration: ToolRegistration): this {
    this.mcpServer.registerTool(registration);
    return this;
  }

  /**
   * Register a tool using separate parameters
   *
   * @param tool Tool definition
   * @param handler Tool handler function
   * @returns This server instance for chaining
   */
  public addTool(tool: Tool, handler: ToolHandler): this {
    this.mcpServer.addTool(tool, handler);
    return this;
  }

  /**
   * Unregister a tool by name
   *
   * @param name Tool name to unregister
   * @returns True if the tool was unregistered
   */
  public unregisterTool(name: string): boolean {
    return this.mcpServer.unregisterTool(name);
  }

  /**
   * Get the Neolith API client for making authenticated requests
   */
  public getAPIClient(): NeolithAPIClient {
    return this.apiClient;
  }

  /**
   * Get the Neolith server configuration
   */
  public getConfig(): Readonly<NeolithMCPServerConfig> {
    return this.config;
  }

  /**
   * Get the logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get the underlying MCP server instance
   */
  public getMCPServer(): MCPServer {
    return this.mcpServer;
  }

  /**
   * Create the Neolith API client with authentication
   *
   * @private
   */
  private createAPIClient(): NeolithAPIClient {
    const baseURL = this.config.neolithApiUrl;
    const headers = {
      'Authorization': `Bearer ${this.config.authToken}`,
      'Content-Type': 'application/json',
    };

    const makeRequest = async <T = unknown>(
      method: string,
      path: string,
      data?: Record<string, unknown> | null,
      params?: Record<string, unknown>
    ): Promise<T> => {
      const url = new URL(path.startsWith('/') ? path.slice(1) : path, baseURL);

      // Add query parameters
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const requestOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(this.config.timeout),
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        requestOptions.body = JSON.stringify(data);
      }

      if (this.config.debugApi) {
        this.logger.debug(`API Request: ${method} ${url.toString()}`, { data });
      }

      try {
        const response = await fetch(url.toString(), requestOptions);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Neolith API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const responseData = await response.json();

        if (this.config.debugApi) {
          this.logger.debug(`API Response: ${method} ${url.toString()}`, { responseData });
        }

        return responseData as T;
      } catch (error) {
        this.logger.error(`API request failed: ${method} ${url.toString()}`, error);
        throw error;
      }
    };

    return {
      get: <T = unknown>(path: string, params?: Record<string, unknown>) =>
        makeRequest<T>('GET', path, null, params),
      post: <T = unknown>(path: string, data?: Record<string, unknown>) =>
        makeRequest<T>('POST', path, data),
      put: <T = unknown>(path: string, data?: Record<string, unknown>) =>
        makeRequest<T>('PUT', path, data),
      delete: <T = unknown>(path: string) =>
        makeRequest<T>('DELETE', path),
      patch: <T = unknown>(path: string, data?: Record<string, unknown>) =>
        makeRequest<T>('PATCH', path, data),
    };
  }
}

/**
 * Factory function to create a Neolith MCP server
 *
 * @param options Neolith server options
 * @returns New Neolith MCP server instance
 *
 * @example
 * ```typescript
 * const server = createNeolithMCPServer({
 *   name: 'neolith-mcp-server',
 *   version: '1.0.0',
 *   neolithApiUrl: 'https://api.neolith.dev',
 *   authToken: process.env.NEOLITH_AUTH_TOKEN,
 * });
 *
 * await server.start();
 * ```
 */
export function createNeolithMCPServer(options: NeolithMCPServerOptions): NeolithMCPServer {
  return new NeolithMCPServer(options);
}

/**
 * Builder pattern for creating Neolith MCP servers
 */
export class NeolithMCPServerBuilder {
  private options: Partial<NeolithMCPServerOptions>;

  constructor(name: string, version: string) {
    this.options = {
      name,
      version,
      tools: [],
      resources: [],
      prompts: [],
    };
  }

  /**
   * Set server description
   */
  public description(desc: string): this {
    this.options.description = desc;
    return this;
  }

  /**
   * Set Neolith API URL
   */
  public apiUrl(url: string): this {
    this.options.neolithApiUrl = url;
    return this;
  }

  /**
   * Set authentication token
   */
  public authToken(token: string): this {
    this.options.authToken = token;
    return this;
  }

  /**
   * Set workspace slug
   */
  public workspace(slug: string): this {
    this.options.workspaceSlug = slug;
    return this;
  }

  /**
   * Set API timeout
   */
  public timeout(ms: number): this {
    this.options.timeout = ms;
    return this;
  }

  /**
   * Enable API debugging
   */
  public debugApi(enabled = true): this {
    this.options.debugApi = enabled;
    return this;
  }

  /**
   * Enable general debug mode
   */
  public debug(enabled = true): this {
    this.options.debug = enabled;
    return this;
  }

  /**
   * Add a tool
   */
  public withTool(tool: Tool, handler: ToolHandler): this {
    this.options.tools = [...(this.options.tools ?? []), { tool, handler }];
    return this;
  }

  /**
   * Set log level
   */
  public logLevel(level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'): this {
    this.options.logging = { ...this.options.logging, level };
    return this;
  }

  /**
   * Set custom logger
   */
  public logger(logger: Logger): this {
    this.options.logger = logger as any;
    return this;
  }

  /**
   * Build and return the server
   */
  public build(): NeolithMCPServer {
    if (!this.options.neolithApiUrl) {
      throw new Error('neolithApiUrl is required - use .apiUrl() to set it');
    }
    if (!this.options.authToken) {
      throw new Error('authToken is required - use .authToken() to set it');
    }

    return new NeolithMCPServer(this.options as NeolithMCPServerOptions);
  }

  /**
   * Build and start the server
   */
  public async start(): Promise<NeolithMCPServer> {
    const server = this.build();
    await server.start();
    return server;
  }
}

/**
 * Start building a Neolith MCP server
 *
 * @param name Server name
 * @param version Server version
 * @returns Server builder instance
 *
 * @example
 * ```typescript
 * const server = await buildNeolithMCPServer('neolith-mcp-server', '1.0.0')
 *   .description('Neolith workspace management server')
 *   .apiUrl('https://api.neolith.dev')
 *   .authToken(process.env.NEOLITH_AUTH_TOKEN)
 *   .workspace('my-workspace')
 *   .logLevel('debug')
 *   .start();
 * ```
 */
export function buildNeolithMCPServer(name: string, version: string): NeolithMCPServerBuilder {
  return new NeolithMCPServerBuilder(name, version);
}
