/**
 * @fileoverview Search types for enterprise full-text search
 *
 * Provides comprehensive type definitions for the enterprise search service,
 * supporting full-text search across messages, files, channels, users, and VPs.
 *
 * @module @genesis/core/types/search
 */

// =============================================================================
// SEARCH QUERY TYPES
// =============================================================================

/**
 * Search query input parameters
 */
export interface SearchQuery {
  /** The search query string */
  query: string;
  /** Optional filters to narrow search results */
  filters?: SearchFilters;
  /** Pagination options */
  pagination?: SearchPagination;
  /** Sort options */
  sort?: SearchSort;
  /** Whether to include highlighted snippets */
  highlight?: boolean;
  /** Which facets to include in response */
  facets?: string[];
}

/**
 * Search filters for narrowing results
 */
export interface SearchFilters {
  /** Filter by workspace ID */
  workspaceId?: string;
  /** Filter by channel IDs */
  channelIds?: string[];
  /** Filter by user/sender IDs */
  userIds?: string[];
  /** Filter by result types */
  types?: SearchResultType[];
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Filter to only results with attachments */
  hasAttachments?: boolean;
  /** Filter to thread replies only */
  isThreadReply?: boolean;
  /** Filter by discipline names */
  disciplines?: string[];
  /** Filter by VP IDs */
  vpIds?: string[];
}

/**
 * Pagination options for search
 */
export interface SearchPagination {
  /** Number of results to return */
  limit: number;
  /** Offset from start of results */
  offset: number;
  /** Optional cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Sort options for search results
 */
export interface SearchSort {
  /** Field to sort by */
  field: 'relevance' | 'date' | 'sender';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

// =============================================================================
// SEARCH RESULT TYPES
// =============================================================================

/**
 * Valid search result types
 */
export type SearchResultType = 'message' | 'file' | 'channel' | 'user' | 'vp';

/**
 * Individual search result
 */
export interface SearchResult {
  /** Unique identifier for the result */
  id: string;
  /** Type of result */
  type: SearchResultType;
  /** Relevance score (higher = more relevant) */
  score: number;
  /** Highlighted snippets if requested */
  highlight?: SearchHighlight;
  /** Result data based on type */
  data: SearchResultData;
}

/**
 * Highlighted text snippets from search
 */
export interface SearchHighlight {
  /** Highlighted content snippets */
  content?: string[];
  /** Highlighted title snippets */
  title?: string[];
  /** Highlighted file name snippets */
  fileName?: string[];
}

/**
 * Union type for all search result data types
 */
export type SearchResultData =
  | MessageSearchResult
  | FileSearchResult
  | ChannelSearchResult
  | UserSearchResult
  | VPSearchResult;

/**
 * Message search result data
 */
export interface MessageSearchResult {
  type: 'message';
  messageId: string;
  content: string;
  channelId: string;
  channelName: string;
  senderId: string;
  senderName: string;
  sentAt: Date;
  threadId?: string;
  hasAttachments: boolean;
}

/**
 * File search result data
 */
export interface FileSearchResult {
  type: 'file';
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  channelId: string;
  channelName: string;
  uploaderId: string;
  uploaderName: string;
  uploadedAt: Date;
  extractedText?: string;
}

/**
 * Channel search result data
 */
export interface ChannelSearchResult {
  type: 'channel';
  channelId: string;
  name: string;
  description?: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: Date;
}

/**
 * User search result data
 */
export interface UserSearchResult {
  type: 'user';
  userId: string;
  name: string;
  email: string;
  role: string;
  discipline?: string;
  avatarUrl?: string;
}

/**
 * VP (Virtual Professional) search result data
 */
export interface VPSearchResult {
  type: 'vp';
  vpId: string;
  name: string;
  discipline: string;
  status: string;
  capabilities: string[];
}

// =============================================================================
// SEARCH RESPONSE TYPES
// =============================================================================

/**
 * Search response containing results and metadata
 */
export interface SearchResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Total number of matching results */
  total: number;
  /** Time taken for search in milliseconds */
  took: number;
  /** Optional facet data for filtering UI */
  facets?: SearchFacets;
  /** Pagination metadata */
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * Facet data for search filtering
 */
export interface SearchFacets {
  /** Facets by result type */
  types?: FacetBucket[];
  /** Facets by channel */
  channels?: FacetBucket[];
  /** Facets by user */
  users?: FacetBucket[];
  /** Facets by date */
  dates?: FacetBucket[];
}

/**
 * Individual facet bucket
 */
export interface FacetBucket {
  /** Unique key for this bucket */
  key: string;
  /** Human-readable label */
  label: string;
  /** Number of results in this bucket */
  count: number;
}

// =============================================================================
// SEARCH INDEX TYPES
// =============================================================================

/**
 * Typed metadata for search index documents.
 */
export interface SearchIndexMetadata {
  /** Channel ID for messages/files */
  channelId?: string;
  /** Channel name for display */
  channelName?: string;
  /** Sender/author ID */
  authorId?: string;
  /** Sender/author name */
  authorName?: string;
  /** File name for file documents */
  fileName?: string;
  /** File size in bytes */
  fileSize?: number;
  /** MIME type for files */
  mimeType?: string;
  /** Thread ID if in a thread */
  threadId?: string;
  /** Whether the document has attachments */
  hasAttachments?: boolean;
  /** Member count for channels */
  memberCount?: number;
  /** Privacy flag for channels */
  isPrivate?: boolean;
  /** User role for user documents */
  role?: string;
  /** User discipline for users/VPs */
  discipline?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** VP capabilities list */
  capabilities?: string[];
  /** VP status */
  status?: string;
  /** Additional string metadata */
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Document to be indexed for search
 */
export interface SearchIndexDocument {
  /** Unique document ID */
  id: string;
  /** Document type */
  type: SearchResultType;
  /** Workspace the document belongs to */
  workspaceId: string;
  /** Main content to be indexed */
  content: string;
  /** Optional title field */
  title?: string;
  /** Additional typed metadata */
  metadata: SearchIndexMetadata;
  /** When the document was created */
  createdAt: Date;
  /** When the document was last updated */
  updatedAt: Date;
}

/**
 * Metadata for search suggestions.
 */
export interface SearchSuggestionMetadata {
  /** Associated channel ID */
  channelId?: string;
  /** Associated user ID */
  userId?: string;
  /** Number of times this suggestion was used */
  usageCount?: number;
  /** Last time this suggestion was used */
  lastUsed?: Date;
  /** Filter type for filter suggestions */
  filterType?: 'channel' | 'user' | 'date' | 'type';
  /** Filter value */
  filterValue?: string;
}

/**
 * Search suggestion for autocomplete
 */
export interface SearchSuggestion {
  /** Suggested text */
  text: string;
  /** Type of suggestion */
  type: 'query' | 'filter' | 'recent';
  /** Additional metadata for the suggestion */
  metadata?: SearchSuggestionMetadata;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if data is a MessageSearchResult
 */
export function isMessageSearchResult(
  data: SearchResultData,
): data is MessageSearchResult {
  return data.type === 'message';
}

/**
 * Type guard to check if data is a FileSearchResult
 */
export function isFileSearchResult(
  data: SearchResultData,
): data is FileSearchResult {
  return data.type === 'file';
}

/**
 * Type guard to check if data is a ChannelSearchResult
 */
export function isChannelSearchResult(
  data: SearchResultData,
): data is ChannelSearchResult {
  return data.type === 'channel';
}

/**
 * Type guard to check if data is a UserSearchResult
 */
export function isUserSearchResult(
  data: SearchResultData,
): data is UserSearchResult {
  return data.type === 'user';
}

/**
 * Type guard to check if data is a VPSearchResult
 */
export function isVPSearchResult(
  data: SearchResultData,
): data is VPSearchResult {
  return data.type === 'vp';
}

/**
 * Type guard to validate SearchResultType
 */
export function isSearchResultType(value: unknown): value is SearchResultType {
  return (
    typeof value === 'string' &&
    ['message', 'file', 'channel', 'user', 'vp'].includes(value)
  );
}

/**
 * Type guard to validate SearchQuery
 */
export function isValidSearchQuery(query: unknown): query is SearchQuery {
  if (!query || typeof query !== 'object') {
return false;
}
  const q = query as SearchQuery;
  return typeof q.query === 'string' && q.query.length > 0;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default pagination settings
 */
export const DEFAULT_SEARCH_PAGINATION: SearchPagination = {
  limit: 20,
  offset: 0,
};

/**
 * Maximum allowed search limit
 */
export const MAX_SEARCH_LIMIT = 100;

/**
 * Default search sort
 */
export const DEFAULT_SEARCH_SORT: SearchSort = {
  field: 'relevance',
  direction: 'desc',
};

/**
 * All valid search result types
 */
export const SEARCH_RESULT_TYPES: readonly SearchResultType[] = [
  'message',
  'file',
  'channel',
  'user',
  'vp',
] as const;

/**
 * Search cache TTL in seconds (5 minutes)
 */
export const SEARCH_CACHE_TTL = 300;

/**
 * Maximum query length
 */
export const MAX_QUERY_LENGTH = 500;

/**
 * Minimum query length for search
 */
export const MIN_QUERY_LENGTH = 2;
