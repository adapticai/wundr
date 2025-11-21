/**
 * @wundr.io/mcp-server - MCP Server Entry Point
 *
 * Model Context Protocol server for Claude Code integration.
 * Provides stdio transport and tool discovery/invocation capabilities.
 *
 * This package provides:
 * 1. MCP protocol implementation with stdio transport
 * 2. Tool discovery and invocation infrastructure
 * 3. Wundr CLI tool wrappers for AI assistant interaction
 *
 * @example
 * ```typescript
 * import { createMCPServer, MCPServer } from '@wundr.io/mcp-server';
 *
 * const server = createMCPServer({
 *   name: 'wundr-mcp-server',
 *   version: '1.0.0',
 * });
 *
 * server.registerTool({
 *   tool: {
 *     name: 'my-tool',
 *     description: 'Does something useful',
 *     inputSchema: { type: 'object', properties: {} },
 *   },
 *   handler: async (params, context) => {
 *     return { content: [{ type: 'text', text: 'Result' }] };
 *   },
 * });
 *
 * await server.start();
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// MCP Protocol Infrastructure Exports
// =============================================================================

// Server
export { MCPServer, MCPServerOptions, createMCPServer, MCPServerBuilder, buildMCPServer } from './server/MCPServer';

// Protocol Handler
export { MCPProtocolHandler, ProtocolError, createTextResult, createJsonResult, createToolContext } from './protocol/handler';

// Transport
export { StdioTransport, TransportError, createStdioTransport, ResponseBuilder } from './protocol/transport';

// Logger
export {
  LogLevel,
  Logger,
  createLogger,
  ConsoleLogger,
  JsonLogger,
  SilentLogger,
  createMCPLogger,
} from './utils/logger';

// =============================================================================
// MCP Protocol Types Exports
// =============================================================================

export {
  // JSON-RPC Types
  JsonRpcId,
  JSONRPC_VERSION,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcError,
  JsonRpcResponse,
  JsonRpcErrorCodes,
  JsonRpcErrorCode,

  // MCP Protocol Types
  MCP_PROTOCOL_VERSION,
  MCPMethods,
  MCPMethod,
  ServerInfo,
  ClientInfo,
  ServerCapabilities,
  ClientCapabilities,
  ToolsCapability,
  ResourcesCapability,
  PromptsCapability,
  LoggingCapability,
  RootsCapability,
  SamplingCapability,

  // Tool Types
  Tool,
  ToolInputSchema,
  JsonSchema,
  ToolCallParams,
  ToolCallResult,
  ToolContent,
  TextContent,
  ImageContent,
  EmbeddedResource,

  // Resource Types
  Resource,
  ResourceContents,
  ResourceTemplate,

  // Prompt Types
  Prompt,
  PromptArgument,
  PromptMessage,
  GetPromptResult,

  // Logging Types
  LogLevel as MCPLogLevel,
  LogMessage,

  // Request/Response Types
  InitializeParams,
  InitializeResult,
  ListToolsParams,
  ListToolsResult,
  CallToolParams,
  CallToolResult,
  ListResourcesParams,
  ListResourcesResult,
  ReadResourceParams,
  ReadResourceResult,
  ListPromptsParams,
  ListPromptsResult,
  GetPromptParams,

  // Notification Types
  ProgressNotification,
  ResourceUpdatedNotification,
  ToolListChangedNotification,

  // Transport Types
  MCPTransport,
  StdioTransportOptions,

  // Configuration Types
  MCPServerConfig,
  LoggingConfig,
  ToolRegistration,
  ToolHandler,
  ToolContext,
  ResourceRegistration,
  ResourceHandler,
  ResourceContext,
  PromptRegistration,
  PromptHandler,
  PromptContext,
  Logger as MCPLogger,

  // Validation Schemas
  JsonRpcRequestSchema,
  JsonRpcNotificationSchema,
  InitializeParamsSchema,
  CallToolParamsSchema,
  ReadResourceParamsSchema,
  GetPromptParamsSchema,
  ListParamsSchema,
} from './types';

// =============================================================================
// Existing Wundr CLI Tools Integration
// =============================================================================

// Re-export all tools functionality
export * from './tools';

// Export version
export const VERSION = '1.0.0';

/**
 * Get a summary of all available MCP tools
 *
 * @returns Array of tool summaries
 */
export function getToolsSummary(): Array<{
  name: string;
  description: string;
  category: string;
}> {
  try {
    const { ToolSchemas } = require('./tools/schemas');

    return Object.entries(ToolSchemas).map(([name, tool]) => ({
      name,
      description: (tool as Record<string, unknown>).description as string,
      category: (tool as Record<string, unknown>).category as string,
    }));
  } catch {
    return [];
  }
}

/**
 * Get tool count by category
 *
 * @returns Map of category to tool count
 */
export function getToolCountByCategory(): Record<string, number> {
  try {
    const { ToolSchemas } = require('./tools/schemas');

    const counts: Record<string, number> = {};

    for (const tool of Object.values(ToolSchemas)) {
      const category = (tool as Record<string, unknown>).category as string;
      counts[category] = (counts[category] || 0) + 1;
    }

    return counts;
  } catch {
    return {};
  }
}

// =============================================================================
// Quick Start Functions
// =============================================================================

/**
 * Quick start function for creating and starting an MCP server
 *
 * @param options Server configuration options
 * @returns Started MCP server instance
 *
 * @example
 * ```typescript
 * import { startServer } from '@wundr.io/mcp-server';
 *
 * const server = await startServer({
 *   name: 'wundr-tools',
 *   version: '1.0.0',
 * });
 * ```
 */
export async function startServer(options: import('./server/MCPServer').MCPServerOptions): Promise<import('./server/MCPServer').MCPServer> {
  const { createMCPServer: create } = await import('./server/MCPServer');
  const server = create(options);
  await server.start();
  return server;
}

/**
 * Default export - Quick start function
 */
export default startServer;

// =============================================================================
// CLI Entry Point (when run directly)
// =============================================================================

/**
 * Main function for CLI execution
 */
async function main(): Promise<void> {
  const { ConsoleLogger: MCPConsoleLogger } = await import('./utils/logger');
  const logger = new MCPConsoleLogger('info');

  // Check if running as CLI
  const isMainModule = require.main === module;

  if (isMainModule) {
    logger.info('Starting Wundr MCP Server...');

    const { createMCPServer: create } = await import('./server/MCPServer');
    const server = create({
      name: 'wundr-mcp-server',
      version: VERSION,
      description: 'Wundr governance and code quality tools',
      logging: { level: 'info' },
    });

    // Handle graceful shutdown
    const shutdown = async (): Promise<void> => {
      logger.info('Shutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
      await server.start();
      logger.info('MCP Server running. Press Ctrl+C to stop.');
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Run main if this is the entry point
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
