/**
 * Neolith API Client Module
 *
 * Exports the Neolith API client and associated types for communicating
 * with the Neolith web application.
 *
 * @module neolith
 */

export { NeolithApiClient } from './api-client';
export type {
  AuthResponse,
  RefreshResponse,
  HeartbeatMetrics,
  HeartbeatOptions,
  HeartbeatResponse,
  MessageAuthor,
  MessageAttachment,
  Message,
  GetMessagesOptions,
  MessagesResponse,
  SendMessageOptions,
  SendMessageResponse,
  OrchestratorStatus,
  UpdateStatusOptions,
  OrchestratorConfig,
  ApiError,
  NeolithApiConfig,
  RequestOptions,
} from './types';
