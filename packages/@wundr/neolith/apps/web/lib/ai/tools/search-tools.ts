/**
 * Search and Discovery Tools
 *
 * Tools for searching across workspace content, messages, files, and users.
 */

import { registerTool } from './index';
import type { ToolContext, ToolResult } from './index';

/**
 * Search Messages Tool
 */
registerTool({
  name: 'search_messages',
  description: 'Search for messages across channels and direct messages',
  category: 'search',
  requiredPermissions: ['message:read'],
  cacheable: true,
  cacheTTL: 120,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      channelId: {
        type: 'string',
        description: 'Limit search to specific channel',
      },
      from: {
        type: 'string',
        description: 'Filter by sender user ID',
      },
      dateFrom: {
        type: 'string',
        description: 'Start date for search (ISO 8601)',
      },
      dateTo: {
        type: 'string',
        description: 'End date for search (ISO 8601)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 20,
      },
    },
    required: ['query'],
  },
  async execute(
    input: {
      query: string;
      channelId?: string;
      from?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
    context: ToolContext
  ): Promise<
    ToolResult<
      Array<{
        id: string;
        content: string;
        channelId: string;
        senderId: string;
        timestamp: string;
      }>
    >
  > {
    try {
      const params = new URLSearchParams({
        q: input.query,
        limit: (input.limit || 20).toString(),
      });
      if (input.channelId) params.append('channelId', input.channelId);
      if (input.from) params.append('from', input.from);
      if (input.dateFrom) params.append('dateFrom', input.dateFrom);
      if (input.dateTo) params.append('dateTo', input.dateTo);

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/messages/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const results = await response.json();

      return {
        success: true,
        data: results.messages || [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search messages',
      };
    }
  },
});

/**
 * Search Files Tool
 */
registerTool({
  name: 'search_files',
  description: 'Search for files and attachments in the workspace',
  category: 'search',
  requiredPermissions: ['file:read'],
  cacheable: true,
  cacheTTL: 180,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for file names or content',
      },
      fileType: {
        type: 'string',
        description: 'Filter by file type',
        enum: [
          'image',
          'video',
          'document',
          'spreadsheet',
          'presentation',
          'pdf',
          'code',
        ],
      },
      uploadedBy: {
        type: 'string',
        description: 'Filter by uploader user ID',
      },
      channelId: {
        type: 'string',
        description: 'Filter by channel',
      },
      minSize: {
        type: 'number',
        description: 'Minimum file size in bytes',
      },
      maxSize: {
        type: 'number',
        description: 'Maximum file size in bytes',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 20,
      },
    },
    required: ['query'],
  },
  async execute(
    input: {
      query: string;
      fileType?: string;
      uploadedBy?: string;
      channelId?: string;
      minSize?: number;
      maxSize?: number;
      limit?: number;
    },
    context: ToolContext
  ): Promise<
    ToolResult<
      Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        url: string;
        uploadedAt: string;
      }>
    >
  > {
    try {
      const params = new URLSearchParams({
        q: input.query,
        limit: (input.limit || 20).toString(),
      });
      if (input.fileType) params.append('type', input.fileType);
      if (input.uploadedBy) params.append('uploadedBy', input.uploadedBy);
      if (input.channelId) params.append('channelId', input.channelId);
      if (input.minSize) params.append('minSize', input.minSize.toString());
      if (input.maxSize) params.append('maxSize', input.maxSize.toString());

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/files/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`File search failed: ${response.statusText}`);
      }

      const results = await response.json();

      return {
        success: true,
        data: results.files || [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search files',
      };
    }
  },
});

/**
 * Search Users Tool
 */
registerTool({
  name: 'search_users',
  description: 'Search for users in the workspace',
  category: 'search',
  requiredPermissions: ['user:read'],
  cacheable: true,
  cacheTTL: 300,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for user name or email',
      },
      role: {
        type: 'string',
        description: 'Filter by role',
        enum: ['admin', 'member', 'guest'],
      },
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['active', 'inactive', 'invited'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 20,
      },
    },
    required: ['query'],
  },
  async execute(
    input: {
      query: string;
      role?: string;
      status?: string;
      limit?: number;
    },
    context: ToolContext
  ): Promise<
    ToolResult<
      Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        avatar?: string;
      }>
    >
  > {
    try {
      const params = new URLSearchParams({
        q: input.query,
        limit: (input.limit || 20).toString(),
      });
      if (input.role) params.append('role', input.role);
      if (input.status) params.append('status', input.status);

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/users/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`User search failed: ${response.statusText}`);
      }

      const results = await response.json();

      return {
        success: true,
        data: results.users || [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search users',
      };
    }
  },
});

/**
 * Semantic Search Tool (RAG)
 */
registerTool({
  name: 'semantic_search',
  description:
    'Perform semantic search using AI embeddings to find related content',
  category: 'search',
  requiredPermissions: ['search:semantic'],
  cacheable: true,
  cacheTTL: 300,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query',
      },
      contentType: {
        type: 'string',
        description: 'Type of content to search',
        enum: ['messages', 'files', 'workflows', 'all'],
        default: 'all',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
      },
      minScore: {
        type: 'number',
        description: 'Minimum similarity score (0-1)',
        default: 0.7,
      },
    },
    required: ['query'],
  },
  async execute(
    input: {
      query: string;
      contentType?: string;
      limit?: number;
      minScore?: number;
    },
    context: ToolContext
  ): Promise<
    ToolResult<
      Array<{
        id: string;
        type: string;
        content: string;
        score: number;
        metadata: Record<string, unknown>;
      }>
    >
  > {
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/search/semantic`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: input.query,
            contentType: input.contentType || 'all',
            limit: input.limit || 10,
            minScore: input.minScore || 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Semantic search failed: ${response.statusText}`);
      }

      const results = await response.json();

      return {
        success: true,
        data: results.results || [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to perform semantic search',
      };
    }
  },
});

/**
 * Search Channels Tool
 */
registerTool({
  name: 'search_channels',
  description: 'Search for channels in the workspace',
  category: 'search',
  requiredPermissions: ['channel:read'],
  cacheable: true,
  cacheTTL: 180,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for channel name or topic',
      },
      type: {
        type: 'string',
        description: 'Filter by channel type',
        enum: ['public', 'private', 'dm'],
      },
      includeArchived: {
        type: 'boolean',
        description: 'Include archived channels',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 20,
      },
    },
    required: ['query'],
  },
  async execute(
    input: {
      query: string;
      type?: string;
      includeArchived?: boolean;
      limit?: number;
    },
    context: ToolContext
  ): Promise<
    ToolResult<
      Array<{
        id: string;
        name: string;
        topic?: string;
        type: string;
        memberCount: number;
        isArchived: boolean;
      }>
    >
  > {
    try {
      const params = new URLSearchParams({
        q: input.query,
        limit: (input.limit || 20).toString(),
        includeArchived: (input.includeArchived || false).toString(),
      });
      if (input.type) params.append('type', input.type);

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/channels/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Channel search failed: ${response.statusText}`);
      }

      const results = await response.json();

      return {
        success: true,
        data: results.channels || [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search channels',
      };
    }
  },
});
