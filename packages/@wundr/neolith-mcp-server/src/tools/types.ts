/**
 * Common Types for MCP Tools
 *
 * Shared type definitions used across all Neolith MCP tools.
 *
 * @module tools/types
 */

/**
 * Standard MCP tool result structure
 */
export interface McpToolResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data (only present on success) */
  data?: unknown;
  /** Success message */
  message?: string;
  /** Error message (only present on failure) */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Detailed error information (only present on failure) */
  errorDetails?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
  /** Warning messages */
  warnings?: string[];
}

/**
 * MCP tool definition for registration
 */
export interface McpTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** Handler function */
  handler: (input: unknown) => Promise<McpToolResult>;
}

/**
 * Neolith API client interface
 */
export interface NeolithApiClient {
  /** Make a GET request */
  get(path: string, params?: Record<string, unknown>): Promise<unknown>;
  /** Make a POST request */
  post(path: string, data: unknown): Promise<unknown>;
  /** Make a PATCH request */
  patch(path: string, data: unknown): Promise<unknown>;
  /** Make a DELETE request */
  delete(path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** API client instance */
  apiClient: NeolithApiClient;
  /** Authenticated user ID */
  userId?: string;
  /** Current workspace ID */
  workspaceId?: string;
}
