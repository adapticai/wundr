/**
 * MCP (Model Context Protocol) Module
 *
 * Provides MCP tool registry and integration for orchestrator-daemon.
 * This module exports tools that can be executed by AI agents and
 * integrated with neolith-mcp-server.
 */

export {
  McpToolRegistry,
  McpToolDefinition,
  ToolResult,
  McpToolRegistryImpl,
  createMcpToolRegistry,
} from './tool-registry';

export type {
  McpToolRegistry as IMcpToolRegistry,
  McpToolDefinition as IMcpToolDefinition,
} from './tool-registry';
