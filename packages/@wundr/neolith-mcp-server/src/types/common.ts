/**
 * Common types for Neolith MCP Server
 *
 * @module @wundr.io/neolith-mcp-server/types/common
 */

/**
 * MCP Tool Result - matches the standard MCP tool result interface
 */
export interface McpToolResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Human-readable message describing the result */
  message?: string;
  /** Error message if failed */
  error?: string;
  /** Detailed error information */
  errorDetails?: {
    code: string;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
  /** Warnings that don't prevent success */
  warnings?: string[];
  /** Metadata about the operation */
  metadata?: {
    duration?: number;
    timestamp?: string;
    toolVersion?: string;
  };
}

/**
 * Helper to create success result
 */
export function successResult<T>(data: T, message?: string, warnings?: string[]): McpToolResult<T> {
  return {
    success: true,
    data,
    message,
    warnings,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Helper to create error result
 */
export function errorResult(
  error: string,
  code: string,
  context?: Record<string, unknown>,
): McpToolResult<never> {
  return {
    success: false,
    error,
    errorDetails: {
      code,
      message: error,
      context,
    },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Workspace member role
 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

/**
 * Workspace member data
 */
export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
}

/**
 * Workspace data
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  settings?: Record<string, unknown>;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  general?: {
    defaultLanguage?: string;
    timezone?: string;
  };
  notifications?: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
  };
  security?: {
    requireTwoFactor?: boolean;
    sessionTimeout?: number;
  };
  [key: string]: unknown;
}

/**
 * Workspace invitation
 */
export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
}
