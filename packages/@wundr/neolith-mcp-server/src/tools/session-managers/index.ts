/**
 * Session Manager Tools Index
 *
 * Exports all session manager-related MCP tools for Neolith workspace management.
 */

// Export tool handlers
export { listSessionManagers } from './list-session-managers';
export { getSessionManager } from './get-session-manager';
export { createSessionManager } from './create-session-manager';
export { updateSessionManager } from './update-session-manager';
export { activateSessionManager } from './activate-session-manager';
export { deactivateSessionManager } from './deactivate-session-manager';

// Export input schemas
export { listSessionManagersInputSchema } from './list-session-managers';
export { getSessionManagerInputSchema } from './get-session-manager';
export { createSessionManagerInputSchema } from './create-session-manager';
export { updateSessionManagerInputSchema } from './update-session-manager';
export { activateSessionManagerInputSchema } from './activate-session-manager';
export { deactivateSessionManagerInputSchema } from './deactivate-session-manager';

// Export types
export type { ListSessionManagersInput, SessionManager, ListSessionManagersResponse, SessionManagerStatistics } from './list-session-managers';
export type { GetSessionManagerInput, GetSessionManagerResponse } from './get-session-manager';
export type { CreateSessionManagerInput, CreateSessionManagerResponse } from './create-session-manager';
export type { UpdateSessionManagerInput, UpdateSessionManagerResponse } from './update-session-manager';
export type { ActivateSessionManagerInput, ActivateSessionManagerResponse } from './activate-session-manager';
export type { DeactivateSessionManagerInput, DeactivateSessionManagerResponse } from './deactivate-session-manager';
