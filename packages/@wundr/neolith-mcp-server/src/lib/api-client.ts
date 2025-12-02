/**
 * API Client Re-exports
 *
 * Barrel file that re-exports the Neolith API client from the client module
 * to maintain backwards compatibility with existing imports.
 *
 * @module @wundr/neolith-mcp-server/lib/api-client
 */

export {
  NeolithApiClient,
  createNeolithClient as createNeolithApiClient,
  type NeolithApiClientConfig,
  type ApiRequestOptions,
  type ApiResponse,
  type HttpMethod,
} from '../client/neolith-api-client';
