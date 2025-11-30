/**
 * Search Tools Module
 *
 * Exports all search-related MCP tools for the Neolith workspace API.
 * Provides global search, message search, and file search functionality.
 *
 * @module @wundr/neolith-mcp-server/tools/search
 */

// =============================================================================
// Global Search
// =============================================================================

export {
  globalSearchHandler,
  globalSearchTool,
  GlobalSearchSchema,
  type GlobalSearchInput,
  type GlobalSearchResponse,
  type GlobalSearchResult,
  type SearchResultItem,
} from './global-search';

// =============================================================================
// Message Search
// =============================================================================

export {
  messageSearchHandler,
  messageSearchTool,
  MessageSearchSchema,
  type MessageSearchInput,
  type MessageSearchResponse,
  type MessageSearchResult,
  type MessageResultItem,
} from './message-search';

// =============================================================================
// File Search
// =============================================================================

export {
  fileSearchHandler,
  fileSearchTool,
  FileSearchSchema,
  type FileSearchInput,
  type FileSearchResponse,
  type FileSearchResult,
  type FileResultItem,
} from './file-search';

// =============================================================================
// Convenience Exports
// =============================================================================

import {
  globalSearchHandler as _globalSearchHandler,
  globalSearchTool as _globalSearchTool,
  GlobalSearchSchema as _GlobalSearchSchema,
} from './global-search';

import {
  messageSearchHandler as _messageSearchHandler,
  messageSearchTool as _messageSearchTool,
  MessageSearchSchema as _MessageSearchSchema,
} from './message-search';

import {
  fileSearchHandler as _fileSearchHandler,
  fileSearchTool as _fileSearchTool,
  FileSearchSchema as _FileSearchSchema,
} from './file-search';

/**
 * All search tool definitions for registration
 */
export const searchTools = [
  _globalSearchTool,
  _messageSearchTool,
  _fileSearchTool,
] as const;

/**
 * All search tool handlers mapped by tool name
 */
export const searchHandlers = {
  neolith_global_search: _globalSearchHandler,
  neolith_message_search: _messageSearchHandler,
  neolith_file_search: _fileSearchHandler,
} as const;

/**
 * All search Zod schemas for validation
 */
export const searchSchemas = {
  globalSearch: _GlobalSearchSchema,
  messageSearch: _MessageSearchSchema,
  fileSearch: _FileSearchSchema,
} as const;
