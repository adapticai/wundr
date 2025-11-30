/**
 * Realtime Tools Index
 *
 * Exports all real-time messaging and WebSocket-related MCP tools
 * for the Neolith MCP Server.
 *
 * @module tools/realtime
 */

export {
  BroadcastToChannelSchema,
  broadcastToChannelHandler,
  type BroadcastToChannelInput,
  type BroadcastResponse,
} from './broadcast-to-channel';

export {
  GetPresenceSchema,
  getPresenceHandler,
  type GetPresenceInput,
  type PresenceResponse,
  type UserPresence,
  type PresenceStatus,
} from './get-presence';

export {
  SendTypingSchema,
  sendTypingHandler,
  startTyping,
  stopTyping,
  type SendTypingInput,
  type TypingResponse,
} from './send-typing';

export {
  GetConnectionStatsSchema,
  getConnectionStatsHandler,
  type GetConnectionStatsInput,
  type ConnectionStats,
} from './get-connection-stats';
