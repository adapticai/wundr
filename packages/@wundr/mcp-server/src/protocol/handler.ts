/**
 * MCP Protocol Handler
 *
 * Handles MCP protocol messages including initialization, tool discovery,
 * tool invocation, resource management, and prompt handling.
 *
 * @see https://spec.modelcontextprotocol.io/specification/
 */

import { v4 as uuidv4 } from 'uuid';
import {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcErrorCodes,
  MCPMethods,
  MCP_PROTOCOL_VERSION,
  ServerInfo,
  ServerCapabilities,
  ClientCapabilities,
  ClientInfo,
  InitializeParams,
  InitializeResult,
  InitializeParamsSchema,
  ListToolsResult,
  CallToolParams,
  CallToolParamsSchema,
  CallToolResult,
  ListResourcesResult,
  ReadResourceParams,
  ReadResourceParamsSchema,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptParams,
  GetPromptParamsSchema,
  GetPromptResult,
  Tool,
  Resource,
  Prompt,
  ToolRegistration,
  ResourceRegistration,
  PromptRegistration,
  ToolContext,
  ResourceContext,
  PromptContext,
  Logger,
  LogLevel,
  MCPServerConfig,
  TextContent,
} from '../types';
import { StdioTransport, ResponseBuilder, TransportError } from './transport';

/**
 * MCP Protocol Handler State
 */
type HandlerState = 'uninitialized' | 'initializing' | 'ready' | 'shutdown';

/**
 * MCP Protocol Handler
 *
 * Core handler for processing MCP protocol messages. Manages the lifecycle
 * of the MCP session and dispatches requests to registered handlers.
 */
export class MCPProtocolHandler {
  private readonly transport: StdioTransport;
  private readonly serverInfo: ServerInfo;
  private readonly serverCapabilities: ServerCapabilities;
  private readonly logger: Logger;

  private state: HandlerState = 'uninitialized';
  private clientInfo: ClientInfo | null = null;
  private clientCapabilities: ClientCapabilities | null = null;

  // Registered handlers
  private readonly tools: Map<string, ToolRegistration> = new Map();
  private readonly resources: Map<string, ResourceRegistration> = new Map();
  private readonly prompts: Map<string, PromptRegistration> = new Map();

  // Pending requests for cancellation support
  private readonly pendingRequests: Map<JsonRpcId, AbortController> = new Map();

  constructor(config: MCPServerConfig, transport: StdioTransport, logger: Logger) {
    this.transport = transport;
    this.logger = logger;

    this.serverInfo = {
      name: config.name,
      version: config.version,
      protocolVersion: MCP_PROTOCOL_VERSION,
    };

    this.serverCapabilities = {
      tools: config.capabilities?.tools ?? { listChanged: true },
      resources: config.capabilities?.resources ?? { subscribe: false, listChanged: true },
      prompts: config.capabilities?.prompts ?? { listChanged: true },
      logging: config.capabilities?.logging ?? { levels: ['debug', 'info', 'warning', 'error'] },
      experimental: config.capabilities?.experimental,
    };

    // Register initial tools, resources, and prompts
    config.tools?.forEach((reg) => this.registerTool(reg));
    config.resources?.forEach((reg) => this.registerResource(reg));
    config.prompts?.forEach((reg) => this.registerPrompt(reg));

    // Set up transport message handler
    this.transport.onMessage = this.handleMessage.bind(this);
    this.transport.onError = this.handleTransportError.bind(this);
    this.transport.onClose = this.handleTransportClose.bind(this);
  }

  /**
   * Start the protocol handler
   */
  public async start(): Promise<void> {
    this.logger.info('Starting MCP Protocol Handler');
    await this.transport.start();
    this.logger.info('MCP Protocol Handler started, waiting for initialization');
  }

  /**
   * Stop the protocol handler
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping MCP Protocol Handler');
    this.state = 'shutdown';

    // Cancel all pending requests
    this.pendingRequests.forEach((controller) => {
      controller.abort();
    });
    this.pendingRequests.clear();

    await this.transport.stop();
    this.logger.info('MCP Protocol Handler stopped');
  }

  /**
   * Register a tool with the handler
   */
  public registerTool(registration: ToolRegistration): void {
    this.tools.set(registration.tool.name, registration);
    this.logger.debug(`Registered tool: ${registration.tool.name}`);

    // Send notification if already initialized
    if (this.state === 'ready') {
      this.sendNotification(MCPMethods.TOOLS_LIST_CHANGED, {});
    }
  }

  /**
   * Unregister a tool
   */
  public unregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted && this.state === 'ready') {
      this.sendNotification(MCPMethods.TOOLS_LIST_CHANGED, {});
    }
    return deleted;
  }

  /**
   * Register a resource with the handler
   */
  public registerResource(registration: ResourceRegistration): void {
    this.resources.set(registration.resource.uri, registration);
    this.logger.debug(`Registered resource: ${registration.resource.uri}`);

    if (this.state === 'ready') {
      this.sendNotification(MCPMethods.RESOURCES_LIST_CHANGED, {});
    }
  }

  /**
   * Unregister a resource
   */
  public unregisterResource(uri: string): boolean {
    const deleted = this.resources.delete(uri);
    if (deleted && this.state === 'ready') {
      this.sendNotification(MCPMethods.RESOURCES_LIST_CHANGED, {});
    }
    return deleted;
  }

  /**
   * Register a prompt with the handler
   */
  public registerPrompt(registration: PromptRegistration): void {
    this.prompts.set(registration.prompt.name, registration);
    this.logger.debug(`Registered prompt: ${registration.prompt.name}`);

    if (this.state === 'ready') {
      this.sendNotification(MCPMethods.PROMPTS_LIST_CHANGED, {});
    }
  }

  /**
   * Unregister a prompt
   */
  public unregisterPrompt(name: string): boolean {
    const deleted = this.prompts.delete(name);
    if (deleted && this.state === 'ready') {
      this.sendNotification(MCPMethods.PROMPTS_LIST_CHANGED, {});
    }
    return deleted;
  }

  /**
   * Handle incoming message from transport
   */
  private handleMessage(message: JsonRpcRequest | JsonRpcNotification): void {
    if ('id' in message) {
      // It's a request - needs a response
      this.handleRequest(message as JsonRpcRequest).catch((error) => {
        this.logger.error(`Error handling request: ${error}`);
      });
    } else {
      // It's a notification - no response needed
      this.handleNotification(message as JsonRpcNotification).catch((error) => {
        this.logger.error(`Error handling notification: ${error}`);
      });
    }
  }

  /**
   * Handle a JSON-RPC request
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request;

    this.logger.debug(`Handling request: ${method}`, { id, params });

    try {
      let result: unknown;

      switch (method) {
        case MCPMethods.INITIALIZE:
          result = await this.handleInitialize(params as Record<string, unknown>);
          break;

        case MCPMethods.LIST_TOOLS:
          this.requireInitialized();
          result = await this.handleListTools();
          break;

        case MCPMethods.CALL_TOOL:
          this.requireInitialized();
          result = await this.handleCallTool(id, params as Record<string, unknown>);
          break;

        case MCPMethods.LIST_RESOURCES:
          this.requireInitialized();
          result = await this.handleListResources();
          break;

        case MCPMethods.READ_RESOURCE:
          this.requireInitialized();
          result = await this.handleReadResource(id, params as Record<string, unknown>);
          break;

        case MCPMethods.LIST_PROMPTS:
          this.requireInitialized();
          result = await this.handleListPrompts();
          break;

        case MCPMethods.GET_PROMPT:
          this.requireInitialized();
          result = await this.handleGetPrompt(id, params as Record<string, unknown>);
          break;

        case MCPMethods.PING:
          result = {};
          break;

        case MCPMethods.SHUTDOWN:
          result = await this.handleShutdown();
          break;

        default:
          throw new ProtocolError(
            JsonRpcErrorCodes.METHOD_NOT_FOUND,
            `Method not found: ${method}`
          );
      }

      await this.sendResponse(id, result);
    } catch (error) {
      await this.sendErrorResponse(id, error);
    }
  }

  /**
   * Handle a JSON-RPC notification
   */
  private async handleNotification(notification: JsonRpcNotification): Promise<void> {
    const { method, params } = notification;

    this.logger.debug(`Handling notification: ${method}`, { params });

    switch (method) {
      case MCPMethods.INITIALIZED:
        // Client confirms initialization is complete
        this.state = 'ready';
        this.logger.info('Client confirmed initialization');
        break;

      case MCPMethods.CANCEL:
        this.handleCancellation(params as Record<string, unknown>);
        break;

      default:
        this.logger.warning(`Unknown notification: ${method}`);
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: Record<string, unknown>): Promise<InitializeResult> {
    if (this.state !== 'uninitialized') {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_REQUEST,
        'Server already initialized'
      );
    }

    this.state = 'initializing';

    // Validate params
    const validated = InitializeParamsSchema.safeParse(params);
    if (!validated.success) {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_PARAMS,
        `Invalid initialize params: ${validated.error.message}`
      );
    }

    const initParams = validated.data as InitializeParams;

    // Store client info
    this.clientInfo = initParams.clientInfo;
    this.clientCapabilities = initParams.capabilities;

    this.logger.info(`Client connected: ${this.clientInfo.name} v${this.clientInfo.version}`);

    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: this.serverCapabilities,
      serverInfo: this.serverInfo,
      instructions: `Wundr MCP Server - Provides governance and code quality tools for development workflows.`,
    };
  }

  /**
   * Handle list tools request
   */
  private async handleListTools(): Promise<ListToolsResult> {
    const tools: Tool[] = Array.from(this.tools.values()).map((reg) => reg.tool);
    return { tools };
  }

  /**
   * Handle call tool request
   */
  private async handleCallTool(
    requestId: JsonRpcId,
    params: Record<string, unknown>
  ): Promise<CallToolResult> {
    const validated = CallToolParamsSchema.safeParse(params);
    if (!validated.success) {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_PARAMS,
        `Invalid call tool params: ${validated.error.message}`
      );
    }

    const { name, arguments: args } = validated.data as CallToolParams;
    const registration = this.tools.get(name);

    if (!registration) {
      throw new ProtocolError(
        JsonRpcErrorCodes.TOOL_NOT_FOUND,
        `Tool not found: ${name}`
      );
    }

    // Set up abort controller for cancellation
    const abortController = new AbortController();
    this.pendingRequests.set(requestId, abortController);

    try {
      const context: ToolContext = {
        requestId,
        signal: abortController.signal,
        logger: this.logger,
        progress: (progress: number, total?: number) => {
          this.sendProgress(requestId, progress, total);
        },
      };

      const result = await registration.handler(args ?? {}, context);
      return result;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new ProtocolError(
          JsonRpcErrorCodes.INTERNAL_ERROR,
          'Request cancelled'
        );
      }

      // Return error as tool result
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          } as TextContent,
        ],
        isError: true,
      };
    } finally {
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Handle list resources request
   */
  private async handleListResources(): Promise<ListResourcesResult> {
    const resources: Resource[] = Array.from(this.resources.values()).map(
      (reg) => reg.resource
    );
    return { resources };
  }

  /**
   * Handle read resource request
   */
  private async handleReadResource(
    requestId: JsonRpcId,
    params: Record<string, unknown>
  ): Promise<ReadResourceResult> {
    const validated = ReadResourceParamsSchema.safeParse(params);
    if (!validated.success) {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_PARAMS,
        `Invalid read resource params: ${validated.error.message}`
      );
    }

    const { uri } = validated.data as ReadResourceParams;
    const registration = this.resources.get(uri);

    if (!registration) {
      throw new ProtocolError(
        JsonRpcErrorCodes.RESOURCE_NOT_FOUND,
        `Resource not found: ${uri}`
      );
    }

    const context: ResourceContext = {
      requestId,
      logger: this.logger,
    };

    const contents = await registration.handler(uri, context);
    return { contents: [contents] };
  }

  /**
   * Handle list prompts request
   */
  private async handleListPrompts(): Promise<ListPromptsResult> {
    const prompts: Prompt[] = Array.from(this.prompts.values()).map(
      (reg) => reg.prompt
    );
    return { prompts };
  }

  /**
   * Handle get prompt request
   */
  private async handleGetPrompt(
    requestId: JsonRpcId,
    params: Record<string, unknown>
  ): Promise<GetPromptResult> {
    const validated = GetPromptParamsSchema.safeParse(params);
    if (!validated.success) {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_PARAMS,
        `Invalid get prompt params: ${validated.error.message}`
      );
    }

    const { name, arguments: args } = validated.data as GetPromptParams;
    const registration = this.prompts.get(name);

    if (!registration) {
      throw new ProtocolError(
        JsonRpcErrorCodes.PROMPT_NOT_FOUND,
        `Prompt not found: ${name}`
      );
    }

    const context: PromptContext = {
      requestId,
      logger: this.logger,
    };

    return await registration.handler(args ?? {}, context);
  }

  /**
   * Handle shutdown request
   */
  private async handleShutdown(): Promise<Record<string, never>> {
    this.logger.info('Shutdown requested');
    this.state = 'shutdown';
    return {};
  }

  /**
   * Handle cancellation notification
   */
  private handleCancellation(params: Record<string, unknown>): void {
    const requestId = params['requestId'] as JsonRpcId;
    const controller = this.pendingRequests.get(requestId);

    if (controller) {
      this.logger.debug(`Cancelling request: ${String(requestId)}`);
      controller.abort();
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Send a success response
   */
  private async sendResponse(id: JsonRpcId, result: unknown): Promise<void> {
    const response = ResponseBuilder.success(id, result);
    await this.transport.send(response);
  }

  /**
   * Send an error response
   */
  private async sendErrorResponse(id: JsonRpcId, error: unknown): Promise<void> {
    let code: number;
    let message: string;
    let data: unknown;

    if (error instanceof ProtocolError) {
      code = error.code;
      message = error.message;
      data = error.data;
    } else if (error instanceof Error) {
      code = JsonRpcErrorCodes.INTERNAL_ERROR;
      message = error.message;
    } else {
      code = JsonRpcErrorCodes.INTERNAL_ERROR;
      message = String(error);
    }

    const response = ResponseBuilder.error(id, code, message, data);
    await this.transport.send(response);
  }

  /**
   * Send a notification
   */
  private async sendNotification(
    method: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const notification = ResponseBuilder.notification(method, params);
    await this.transport.send(notification);
  }

  /**
   * Send progress notification
   */
  private sendProgress(
    requestId: JsonRpcId,
    progress: number,
    total?: number
  ): void {
    this.sendNotification(MCPMethods.PROGRESS, {
      progressToken: requestId,
      progress,
      ...(total !== undefined ? { total } : {}),
    }).catch((error) => {
      this.logger.error(`Failed to send progress notification: ${error}`);
    });
  }

  /**
   * Require that the handler is initialized
   */
  private requireInitialized(): void {
    if (this.state === 'uninitialized' || this.state === 'initializing') {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_REQUEST,
        'Server not initialized'
      );
    }

    if (this.state === 'shutdown') {
      throw new ProtocolError(
        JsonRpcErrorCodes.INVALID_REQUEST,
        'Server is shutting down'
      );
    }
  }

  /**
   * Handle transport errors
   */
  private handleTransportError(error: Error): void {
    this.logger.error(`Transport error: ${error.message}`);
  }

  /**
   * Handle transport close
   */
  private handleTransportClose(): void {
    this.logger.info('Transport closed');
    this.state = 'shutdown';
  }
}

/**
 * Protocol-specific error class
 */
export class ProtocolError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, ProtocolError.prototype);
  }
}

/**
 * Create a tool context helper
 */
export function createToolContext(
  requestId: JsonRpcId,
  logger: Logger,
  signal?: AbortSignal
): ToolContext {
  return {
    requestId,
    signal,
    logger,
    progress: () => {
      // No-op for standalone context
    },
  };
}

/**
 * Create a simple text result
 */
export function createTextResult(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

/**
 * Create a JSON result
 */
export function createJsonResult(
  data: unknown,
  isError = false
): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}
