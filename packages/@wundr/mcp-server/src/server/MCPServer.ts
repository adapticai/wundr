/**
 * MCP Server Implementation
 *
 * High-level server class that orchestrates the MCP protocol handler,
 * transport layer, and tool/resource/prompt registrations.
 */

import { MCPProtocolHandler } from '../protocol/handler';
import { createStdioTransport } from '../protocol/transport';
import { ConsoleLogger } from '../utils/logger';

import type { StdioTransport} from '../protocol/transport';
import type {
  MCPServerConfig,
  ServerCapabilities,
  Tool,
  ToolRegistration,
  ToolHandler,
  Resource,
  ResourceRegistration,
  ResourceHandler,
  Prompt,
  PromptRegistration,
  PromptHandler,
  Logger,
  LogLevel,
} from '../types';


/**
 * MCP Server Options
 */
export interface MCPServerOptions {
  /** Server name (required) */
  name: string;
  /** Server version (required) */
  version: string;
  /** Server description */
  description?: string;
  /** Server capabilities override */
  capabilities?: Partial<ServerCapabilities>;
  /** Logging configuration */
  logging?: {
    level?: LogLevel;
    format?: 'json' | 'text';
  };
  /** Initial tools to register */
  tools?: ToolRegistration[];
  /** Initial resources to register */
  resources?: ResourceRegistration[];
  /** Initial prompts to register */
  prompts?: PromptRegistration[];
  /** Enable debug mode */
  debug?: boolean;
  /** Custom logger instance */
  logger?: Logger;
}

/**
 * MCP Server Status
 */
export type MCPServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * MCP Server Class
 *
 * Main entry point for creating and managing an MCP server.
 * Provides a fluent API for registering tools, resources, and prompts.
 */
export class MCPServer {
  private readonly config: MCPServerConfig;
  private readonly logger: Logger;
  private readonly transport: StdioTransport;
  private readonly handler: MCPProtocolHandler;

  private status: MCPServerStatus = 'stopped';
  private startPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;

  constructor(options: MCPServerOptions) {
    // Create logger
    this.logger = options.logger ?? new ConsoleLogger(options.logging?.level ?? 'info');

    // Build configuration
    this.config = {
      name: options.name,
      version: options.version,
      description: options.description,
      capabilities: options.capabilities,
      tools: options.tools ?? [],
      resources: options.resources ?? [],
      prompts: options.prompts ?? [],
      logging: {
        level: options.logging?.level ?? 'info',
        format: options.logging?.format ?? 'text',
      },
    };

    // Create transport
    this.transport = createStdioTransport({
      debug: options.debug ?? false,
    });

    // Create protocol handler
    this.handler = new MCPProtocolHandler(this.config, this.transport, this.logger);

    this.logger.debug('MCP Server created', { name: options.name, version: options.version });
  }

  /**
   * Get the current server status
   */
  public getStatus(): MCPServerStatus {
    return this.status;
  }

  /**
   * Start the MCP server
   */
  public async start(): Promise<void> {
    if (this.status === 'running') {
      this.logger.warning('Server is already running');
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.status = 'starting';
    this.logger.info(`Starting MCP Server: ${this.config.name} v${this.config.version}`);

    this.startPromise = this.doStart();

    try {
      await this.startPromise;
      this.status = 'running';
      this.logger.info('MCP Server started successfully');
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to start MCP Server', error);
      throw error;
    } finally {
      this.startPromise = null;
    }
  }

  /**
   * Stop the MCP server
   */
  public async stop(): Promise<void> {
    if (this.status === 'stopped') {
      this.logger.warning('Server is already stopped');
      return;
    }

    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.status = 'stopping';
    this.logger.info('Stopping MCP Server...');

    this.stopPromise = this.doStop();

    try {
      await this.stopPromise;
      this.status = 'stopped';
      this.logger.info('MCP Server stopped successfully');
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to stop MCP Server', error);
      throw error;
    } finally {
      this.stopPromise = null;
    }
  }

  /**
   * Register a tool with the server
   *
   * @param registration Tool registration including tool definition and handler
   * @returns This server instance for chaining
   */
  public registerTool(registration: ToolRegistration): this {
    this.handler.registerTool(registration);
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
    return this.registerTool({ tool, handler });
  }

  /**
   * Unregister a tool by name
   *
   * @param name Tool name to unregister
   * @returns True if the tool was unregistered
   */
  public unregisterTool(name: string): boolean {
    return this.handler.unregisterTool(name);
  }

  /**
   * Register a resource with the server
   *
   * @param registration Resource registration
   * @returns This server instance for chaining
   */
  public registerResource(registration: ResourceRegistration): this {
    this.handler.registerResource(registration);
    return this;
  }

  /**
   * Register a resource using separate parameters
   *
   * @param resource Resource definition
   * @param handler Resource handler function
   * @returns This server instance for chaining
   */
  public addResource(resource: Resource, handler: ResourceHandler): this {
    return this.registerResource({ resource, handler });
  }

  /**
   * Unregister a resource by URI
   *
   * @param uri Resource URI to unregister
   * @returns True if the resource was unregistered
   */
  public unregisterResource(uri: string): boolean {
    return this.handler.unregisterResource(uri);
  }

  /**
   * Register a prompt with the server
   *
   * @param registration Prompt registration
   * @returns This server instance for chaining
   */
  public registerPrompt(registration: PromptRegistration): this {
    this.handler.registerPrompt(registration);
    return this;
  }

  /**
   * Register a prompt using separate parameters
   *
   * @param prompt Prompt definition
   * @param handler Prompt handler function
   * @returns This server instance for chaining
   */
  public addPrompt(prompt: Prompt, handler: PromptHandler): this {
    return this.registerPrompt({ prompt, handler });
  }

  /**
   * Unregister a prompt by name
   *
   * @param name Prompt name to unregister
   * @returns True if the prompt was unregistered
   */
  public unregisterPrompt(name: string): boolean {
    return this.handler.unregisterPrompt(name);
  }

  /**
   * Get the server configuration
   */
  public getConfig(): Readonly<MCPServerConfig> {
    return this.config;
  }

  /**
   * Get the logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Internal start implementation
   */
  private async doStart(): Promise<void> {
    await this.handler.start();
  }

  /**
   * Internal stop implementation
   */
  private async doStop(): Promise<void> {
    await this.handler.stop();
  }
}

/**
 * Factory function to create an MCP server
 *
 * @param options Server options
 * @returns New MCP server instance
 *
 * @example
 * ```typescript
 * const server = createMCPServer({
 *   name: 'my-server',
 *   version: '1.0.0',
 * });
 *
 * server.addTool(myTool, myHandler);
 * await server.start();
 * ```
 */
export function createMCPServer(options: MCPServerOptions): MCPServer {
  return new MCPServer(options);
}

/**
 * Builder pattern for creating MCP servers
 */
export class MCPServerBuilder {
  private options: MCPServerOptions;

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
   * Set log level
   */
  public logLevel(level: LogLevel): this {
    this.options.logging = { ...this.options.logging, level };
    return this;
  }

  /**
   * Enable debug mode
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
   * Add a resource
   */
  public withResource(resource: Resource, handler: ResourceHandler): this {
    this.options.resources = [...(this.options.resources ?? []), { resource, handler }];
    return this;
  }

  /**
   * Add a prompt
   */
  public withPrompt(prompt: Prompt, handler: PromptHandler): this {
    this.options.prompts = [...(this.options.prompts ?? []), { prompt, handler }];
    return this;
  }

  /**
   * Set custom logger
   */
  public logger(logger: Logger): this {
    this.options.logger = logger;
    return this;
  }

  /**
   * Set capabilities
   */
  public capabilities(caps: Partial<ServerCapabilities>): this {
    this.options.capabilities = caps;
    return this;
  }

  /**
   * Build and return the server
   */
  public build(): MCPServer {
    return new MCPServer(this.options);
  }

  /**
   * Build and start the server
   */
  public async start(): Promise<MCPServer> {
    const server = this.build();
    await server.start();
    return server;
  }
}

/**
 * Start building an MCP server
 *
 * @param name Server name
 * @param version Server version
 * @returns Server builder instance
 *
 * @example
 * ```typescript
 * const server = await buildMCPServer('my-server', '1.0.0')
 *   .description('My awesome MCP server')
 *   .logLevel('debug')
 *   .withTool(myTool, myHandler)
 *   .start();
 * ```
 */
export function buildMCPServer(name: string, version: string): MCPServerBuilder {
  return new MCPServerBuilder(name, version);
}
