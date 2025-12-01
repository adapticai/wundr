/**
 * User Tools Module
 *
 * MCP tools for interacting with Neolith user-related API endpoints.
 * Provides functionality for:
 * - Getting current user profile
 * - Getting user by ID
 * - Searching users
 * - Updating profile
 * - Setting presence status
 *
 * @module @wundr/neolith-mcp-server/tools/users
 */

// Export all tool handlers
export {
  getCurrentUser,
  getCurrentUserTool,
  GetCurrentUserInputSchema,
  type GetCurrentUserInput,
  type CurrentUserProfile,
} from './get-current-user';

export {
  getUser,
  getUserTool,
  GetUserInputSchema,
  type GetUserInput,
  type UserProfile,
} from './get-user';

export {
  searchUsers,
  searchUsersTool,
  SearchUsersInputSchema,
  type SearchUsersInput,
  type UserSearchResult,
  type SearchUsersResponse,
} from './search-users';

export {
  updateProfile,
  updateProfileTool,
  UpdateProfileInputSchema,
  type UpdateProfileInput,
} from './update-profile';

export {
  setPresence,
  setPresenceTool,
  SetPresenceInputSchema,
  PresenceStatusSchema,
  type SetPresenceInput,
  type PresenceStatus,
  type UserPresenceResponse,
} from './set-presence';

// Export API client
export { NeolithApiClient, createNeolithApiClient, type NeolithApiClientConfig } from '@/lib/api-client';

/**
 * Collection of all user tool definitions for registration
 */
import { getCurrentUserTool } from './get-current-user';
import { getUserTool } from './get-user';
import { searchUsersTool } from './search-users';
import { updateProfileTool } from './update-profile';
import { setPresenceTool } from './set-presence';

export const USER_TOOLS = [
  getCurrentUserTool,
  getUserTool,
  searchUsersTool,
  updateProfileTool,
  setPresenceTool,
] as const;

/**
 * User tool names for type safety
 */
export type UserToolName =
  | 'neolith_get_current_user'
  | 'neolith_get_user'
  | 'neolith_search_users'
  | 'neolith_update_profile'
  | 'neolith_set_presence';
