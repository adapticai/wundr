/**
 * Tool Initialization
 *
 * Imports and registers all available AI tools.
 * Import this file to ensure all tools are registered before use.
 */

// Import all tool modules to trigger registration
import './workflow-tools';
import './search-tools';
import './data-tools';

// Export the registry for external use
export { toolRegistry, registerTool } from './index';
export type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolParameter,
} from './index';

/**
 * Initialize all tools
 * Call this function during app initialization
 */
export function initializeTools() {
  // Tools are automatically registered via import side effects
  // This function exists for explicit initialization if needed
  console.log('[AI Tools] All tools initialized');
}
