/**
 * Search Validation Schemas
 *
 * Zod schemas and error codes for search-related API endpoints.
 *
 * @module lib/validations/search
 */

import { z } from 'zod';

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Search error codes
 */
export const SEARCH_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  QUERY_TOO_SHORT: 'QUERY_TOO_SHORT',
  QUERY_TOO_LONG: 'QUERY_TOO_LONG',
  INVALID_SEARCH_TYPE: 'INVALID_SEARCH_TYPE',
  INVALID_PAGINATION: 'INVALID_PAGINATION',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type SearchErrorCode =
  (typeof SEARCH_ERROR_CODES)[keyof typeof SEARCH_ERROR_CODES];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a standardized search error response
 */
export function createSearchErrorResponse(
  message: string,
  code: SearchErrorCode,
  extraData?: Record<string, unknown>
): { error: SearchErrorCode; message: string } & Record<string, unknown> {
  return {
    error: code,
    message,
    ...extraData,
  };
}

// =============================================================================
// SEARCH TYPE ENUM
// =============================================================================

/**
 * Valid search types
 */
export const SEARCH_TYPES = [
  'all',
  'channels',
  'messages',
  'files',
  'users',
  'orchestrators',
  'dms',
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

// =============================================================================
// SEARCH SCHEMAS
// =============================================================================

/**
 * Search query schema
 */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(500, 'Search query must be less than 500 characters'),
  type: z.enum(SEARCH_TYPES).optional().default('all'),
  types: z
    .string()
    .optional()
    .transform(val => (val ? val.split(',').map(t => t.trim()) : undefined)),
  channelId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform(val => Math.min(parseInt(val, 10), 100)),
  offset: z
    .string()
    .optional()
    .default('0')
    .transform(val => Math.max(parseInt(val, 10), 0)),
  highlight: z
    .string()
    .optional()
    .default('true')
    .transform(val => val !== 'false'),
  facets: z
    .string()
    .optional()
    .default('false')
    .transform(val => val === 'true'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * Search suggestions query schema
 */
export const searchSuggestionsSchema = z.object({
  q: z
    .string()
    .min(1, 'Query is required')
    .max(100, 'Query must be less than 100 characters'),
  limit: z
    .string()
    .optional()
    .default('5')
    .transform(val => Math.min(parseInt(val, 10), 20)),
});

export type SearchSuggestionsQuery = z.infer<typeof searchSuggestionsSchema>;

/**
 * Message search query schema
 * Supports both 'query' and 'q' as search terms, with filtering by userId, type, and date range
 */
export const messageSearchSchema = z
  .object({
    query: z
      .string()
      .min(1, 'Search query is required')
      .max(500, 'Search query must be less than 500 characters')
      .optional(),
    q: z
      .string()
      .min(1, 'Search query is required')
      .max(500, 'Search query must be less than 500 characters')
      .optional(),
    userId: z.string().optional(),
    type: z.enum(SEARCH_TYPES).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    channelId: z.string().optional(),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform(val => Math.min(parseInt(val, 10), 100)),
    offset: z
      .string()
      .optional()
      .default('0')
      .transform(val => Math.max(parseInt(val, 10), 0)),
    highlight: z
      .string()
      .optional()
      .default('true')
      .transform(val => val !== 'false'),
  })
  .refine(data => data.query || data.q, {
    message: 'Either query or q parameter is required',
    path: ['query'],
  })
  .transform(data => ({
    ...data,
    // Use q as alias for query if query is not provided
    query: data.query || data.q,
  }));

export type MessageSearchQuery = z.infer<typeof messageSearchSchema>;

/**
 * Date range filter schema
 */
export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

/**
 * Search filters schema
 */
export const searchFiltersSchema = z.object({
  types: z.array(z.enum(SEARCH_TYPES)).optional(),
  channelIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  dateRange: dateRangeSchema.optional(),
  fileTypes: z.array(z.string()).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

// =============================================================================
// SEARCH RESULT SCHEMAS
// =============================================================================

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0),
  limit: z.coerce.number().int().min(1).max(100),
  totalCount: z.coerce.number().int().min(0),
  hasMore: z.boolean(),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Search facets schema
 */
export const searchFacetsSchema = z.object({
  types: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().min(0),
    })
  ),
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      count: z.number().int().min(0),
    })
  ),
});

export type SearchFacets = z.infer<typeof searchFacetsSchema>;

/**
 * Highlight schema
 */
export const highlightSchema = z.record(z.string(), z.string().optional());

export type Highlight = z.infer<typeof highlightSchema>;

/**
 * Channel result schema
 */
export const channelResultSchema = z.object({
  type: z.literal('channel'),
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  topic: z.string().nullable(),
  type_value: z.string(),
  memberCount: z.number().int().min(0),
  messageCount: z.number().int().min(0),
  createdAt: z.date(),
  highlighted: highlightSchema.optional(),
});

export type ChannelResult = z.infer<typeof channelResultSchema>;

/**
 * Message result schema
 */
export const messageResultSchema = z.object({
  type: z.literal('message'),
  id: z.string(),
  content: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  authorAvatarUrl: z.string().nullable(),
  authorIsOrchestrator: z.boolean(),
  createdAt: z.date(),
  isEdited: z.boolean(),
  replyCount: z.number().int().min(0),
  highlighted: highlightSchema.optional(),
});

export type MessageResult = z.infer<typeof messageResultSchema>;

/**
 * File result schema
 */
export const fileResultSchema = z.object({
  type: z.literal('file'),
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().min(0),
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  uploadedById: z.string(),
  uploaderName: z.string().nullable(),
  channelId: z.string().optional(),
  channelName: z.string().optional(),
  createdAt: z.date(),
  highlighted: highlightSchema.optional(),
});

export type FileResult = z.infer<typeof fileResultSchema>;

/**
 * User result schema
 */
export const userResultSchema = z.object({
  type: z.literal('user'),
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
  isOrchestrator: z.boolean(),
  highlighted: highlightSchema.optional(),
});

export type UserResult = z.infer<typeof userResultSchema>;

/**
 * Orchestrator result schema
 */
export const orchestratorResultSchema = z.object({
  type: z.literal('orchestrator'),
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
  discipline: z.string().nullable(),
  role: z.string().nullable(),
  highlighted: highlightSchema.optional(),
});

export type OrchestratorResult = z.infer<typeof orchestratorResultSchema>;

/**
 * DM result schema
 */
export const dmResultSchema = z.object({
  type: z.literal('dm'),
  id: z.string(),
  name: z.string(),
  participants: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      isOrchestrator: z.boolean(),
    })
  ),
  lastMessageAt: z.date().nullable(),
  highlighted: highlightSchema.optional(),
});

export type DMResult = z.infer<typeof dmResultSchema>;

/**
 * Search result union schema
 */
export const searchResultSchema = z.union([
  channelResultSchema,
  messageResultSchema,
  fileResultSchema,
  userResultSchema,
  orchestratorResultSchema,
  dmResultSchema,
]);

export type SearchResult = z.infer<typeof searchResultSchema>;

/**
 * Search response schema
 */
export const searchResponseSchema = z.object({
  data: z.array(searchResultSchema),
  pagination: paginationSchema,
  facets: searchFacetsSchema.optional(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;
