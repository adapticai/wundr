/**
 * Neolith MCP Server CLI Entry Point
 *
 * Command-line interface for starting the Neolith MCP server with stdio transport.
 * Handles configuration from environment variables and CLI arguments.
 *
 * @module @wundr/neolith-mcp-server/cli
 */

import { createNeolithMCPServer } from './server/neolith-mcp-server';
import type { NeolithMCPServerOptions } from './server/neolith-mcp-server';

// Import all tool categories
import { workspaceTools } from './tools/workspace/index';
import { channelTools } from './tools/channels/index';
import { fileTools } from './tools/files/index';
import { USER_TOOLS } from './tools/users/index';
import { searchTools } from './tools/search/index';

// Import orchestrator tools separately since they have different export structure
import {
  listOrchestrators,
  getOrchestrator,
  getOrchestratorConfig,
  updateOrchestratorConfig,
  getOrchestratorMemory,
  storeOrchestratorMemory,
  getOrchestratorTasks,
  createTask,
} from './tools/orchestrators/index';

// Import messaging tools - they have a different export structure
import {
  sendMessageHandler,
  getMessagesHandler,
  getThreadHandler,
  replyToThreadHandler,
  editMessageHandler,
  deleteMessageHandler,
  addReactionHandler,
  removeReactionHandler,
  getDMChannelsHandler,
  createDMHandler,
} from './tools/messaging/index';

/**
 * CLI Configuration from environment variables and arguments
 */
export interface CLIConfig {
  /** Neolith API base URL */
  apiUrl: string;
  /** Authentication token */
  authToken: string;
  /** Optional workspace slug */
  workspaceSlug?: string;
  /** Log level */
  logLevel: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  /** Enable debug mode */
  debug: boolean;
  /** Enable API debug logging */
  debugApi: boolean;
  /** API request timeout in milliseconds */
  timeout: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<CLIConfig> {
  const args = process.argv.slice(2);
  const config: Partial<CLIConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--api-url':
        config.apiUrl = args[++i];
        break;
      case '--auth-token':
        config.authToken = args[++i];
        break;
      case '--workspace':
        config.workspaceSlug = args[++i];
        break;
      case '--log-level':
        config.logLevel = args[++i] as CLIConfig['logLevel'];
        break;
      case '--debug':
        config.debug = true;
        break;
      case '--debug-api':
        config.debugApi = true;
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--version':
      case '-v':
        printVersion();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return config;
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<CLIConfig> {
  return {
    apiUrl: process.env.NEOLITH_API_URL,
    authToken: process.env.NEOLITH_AUTH_TOKEN,
    workspaceSlug: process.env.NEOLITH_WORKSPACE,
    logLevel: (process.env.NEOLITH_LOG_LEVEL || process.env.LOG_LEVEL) as CLIConfig['logLevel'],
    debug: process.env.NEOLITH_DEBUG === 'true' || process.env.DEBUG === 'true',
    debugApi: process.env.NEOLITH_DEBUG_API === 'true',
    timeout: process.env.NEOLITH_TIMEOUT ? parseInt(process.env.NEOLITH_TIMEOUT, 10) : undefined,
  };
}

/**
 * Merge configurations with precedence: CLI args > Env vars > Defaults
 */
function mergeConfig(envConfig: Partial<CLIConfig>, cliConfig: Partial<CLIConfig>): CLIConfig {
  const defaults: CLIConfig = {
    apiUrl: 'http://localhost:3000',
    authToken: '',
    logLevel: 'info',
    debug: false,
    debugApi: false,
    timeout: 30000,
  };

  return {
    apiUrl: cliConfig.apiUrl || envConfig.apiUrl || defaults.apiUrl,
    authToken: cliConfig.authToken || envConfig.authToken || defaults.authToken,
    workspaceSlug: cliConfig.workspaceSlug || envConfig.workspaceSlug,
    logLevel: cliConfig.logLevel || envConfig.logLevel || defaults.logLevel,
    debug: cliConfig.debug ?? envConfig.debug ?? defaults.debug,
    debugApi: cliConfig.debugApi ?? envConfig.debugApi ?? defaults.debugApi,
    timeout: cliConfig.timeout || envConfig.timeout || defaults.timeout,
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: CLIConfig): void {
  if (!config.authToken) {
    throw new Error(
      'Authentication token is required. Set NEOLITH_AUTH_TOKEN environment variable or use --auth-token flag.'
    );
  }

  if (!config.apiUrl) {
    throw new Error(
      'API URL is required. Set NEOLITH_API_URL environment variable or use --api-url flag.'
    );
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Neolith MCP Server - Model Context Protocol server for Neolith workspace management

USAGE:
  neolith-mcp-server [OPTIONS]

OPTIONS:
  --api-url <url>         Neolith API base URL (default: http://localhost:3000)
  --auth-token <token>    Authentication token (required)
  --workspace <slug>      Default workspace slug
  --log-level <level>     Log level: debug|info|warning|error (default: info)
  --debug                 Enable debug mode
  --debug-api             Enable API request/response logging
  --timeout <ms>          API request timeout in milliseconds (default: 30000)
  -h, --help              Show this help message
  -v, --version           Show version information

ENVIRONMENT VARIABLES:
  NEOLITH_API_URL         Neolith API base URL
  NEOLITH_AUTH_TOKEN      Authentication token (required if not via --auth-token)
  NEOLITH_WORKSPACE       Default workspace slug
  NEOLITH_LOG_LEVEL       Log level (debug|info|warning|error)
  NEOLITH_DEBUG           Enable debug mode (true|false)
  NEOLITH_DEBUG_API       Enable API debug logging (true|false)
  NEOLITH_TIMEOUT         API request timeout in milliseconds

EXAMPLES:
  # Start with environment variables
  export NEOLITH_API_URL=https://api.neolith.dev
  export NEOLITH_AUTH_TOKEN=your-token-here
  neolith-mcp-server

  # Start with CLI arguments
  neolith-mcp-server --api-url https://api.neolith.dev --auth-token your-token-here

  # Enable debug mode
  neolith-mcp-server --debug --debug-api --log-level debug

  # MCP Integration via stdio
  claude mcp add neolith npx @wundr.io/neolith-mcp-server

For more information, visit: https://wundr.io/docs/neolith-mcp-server
`);
}

/**
 * Print version information
 */
function printVersion(): void {
  // Read version from package.json
  const version = '1.0.0'; // TODO: Import from package.json
  console.log(`neolith-mcp-server v${version}`);
}

/**
 * Log configuration to stderr (stdout is reserved for MCP messages)
 */
function logConfig(config: CLIConfig): void {
  console.error('[Neolith MCP Server] Configuration:');
  console.error(`  API URL: ${config.apiUrl}`);
  console.error(`  Workspace: ${config.workspaceSlug || '(not set)'}`);
  console.error(`  Log Level: ${config.logLevel}`);
  console.error(`  Debug Mode: ${config.debug}`);
  console.error(`  Debug API: ${config.debugApi}`);
  console.error(`  Timeout: ${config.timeout}ms`);
  console.error('');
}

/**
 * Create messaging tool registrations
 * These have a different structure than other tool categories
 */
function createMessagingTools() {
  return [
    {
      tool: {
        name: 'neolith_send_message',
        description: 'Send a message to a channel with optional attachments and mentions',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            content: { type: 'string' },
            attachments: { type: 'array', items: { type: 'string' } },
            mentions: { type: 'array', items: { type: 'string' } },
          },
          required: ['workspaceSlug', 'channelId', 'content'],
        },
      },
      handler: sendMessageHandler,
    },
    {
      tool: {
        name: 'neolith_get_messages',
        description: 'Get messages from a channel with pagination',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            limit: { type: 'number' },
            before: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId'],
        },
      },
      handler: getMessagesHandler,
    },
    {
      tool: {
        name: 'neolith_get_thread',
        description: 'Get thread replies for a parent message',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId', 'messageId'],
        },
      },
      handler: getThreadHandler,
    },
    {
      tool: {
        name: 'neolith_reply_to_thread',
        description: 'Reply to a thread (parent message)',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            parentMessageId: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId', 'parentMessageId', 'content'],
        },
      },
      handler: replyToThreadHandler,
    },
    {
      tool: {
        name: 'neolith_edit_message',
        description: 'Edit an existing message (only your own messages)',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            messageId: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId', 'messageId', 'content'],
        },
      },
      handler: editMessageHandler,
    },
    {
      tool: {
        name: 'neolith_delete_message',
        description: 'Delete a message (only your own messages)',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId', 'messageId'],
        },
      },
      handler: deleteMessageHandler,
    },
    {
      tool: {
        name: 'neolith_add_reaction',
        description: 'Add an emoji reaction to a message',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            messageId: { type: 'string' },
            emoji: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId', 'messageId', 'emoji'],
        },
      },
      handler: addReactionHandler,
    },
    {
      tool: {
        name: 'neolith_remove_reaction',
        description: 'Remove an emoji reaction from a message',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            channelId: { type: 'string' },
            messageId: { type: 'string' },
            emoji: { type: 'string' },
          },
          required: ['workspaceSlug', 'channelId', 'messageId', 'emoji'],
        },
      },
      handler: removeReactionHandler,
    },
    {
      tool: {
        name: 'neolith_get_dm_channels',
        description: 'Get all DM and group DM conversations',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
          },
          required: ['workspaceSlug'],
        },
      },
      handler: getDMChannelsHandler,
    },
    {
      tool: {
        name: 'neolith_create_dm',
        description: 'Create a new DM or group DM conversation with optional initial message',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            userIds: { type: 'array', items: { type: 'string' } },
            initialMessage: { type: 'string' },
          },
          required: ['workspaceSlug', 'userIds'],
        },
      },
      handler: createDMHandler,
    },
  ];
}

/**
 * Create orchestrator tool registrations
 */
function createOrchestratorTools() {
  return [
    {
      tool: {
        name: 'neolith_list_orchestrators',
        description: 'List all orchestrators in a workspace',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
          required: ['workspaceSlug'],
        },
      },
      handler: listOrchestrators,
    },
    {
      tool: {
        name: 'neolith_get_orchestrator',
        description: 'Get details of a specific orchestrator',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
          },
          required: ['workspaceSlug', 'orchestratorId'],
        },
      },
      handler: getOrchestrator,
    },
    {
      tool: {
        name: 'neolith_get_orchestrator_config',
        description: 'Get configuration for an orchestrator',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
          },
          required: ['workspaceSlug', 'orchestratorId'],
        },
      },
      handler: getOrchestratorConfig,
    },
    {
      tool: {
        name: 'neolith_update_orchestrator_config',
        description: 'Update configuration for an orchestrator',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
            config: { type: 'object' },
          },
          required: ['workspaceSlug', 'orchestratorId', 'config'],
        },
      },
      handler: updateOrchestratorConfig,
    },
    {
      tool: {
        name: 'neolith_get_orchestrator_memory',
        description: 'Retrieve orchestrator memory/state',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
            key: { type: 'string' },
          },
          required: ['workspaceSlug', 'orchestratorId'],
        },
      },
      handler: getOrchestratorMemory,
    },
    {
      tool: {
        name: 'neolith_store_orchestrator_memory',
        description: 'Store orchestrator memory/state',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
            key: { type: 'string' },
            value: {},
          },
          required: ['workspaceSlug', 'orchestratorId', 'key', 'value'],
        },
      },
      handler: storeOrchestratorMemory,
    },
    {
      tool: {
        name: 'neolith_get_orchestrator_tasks',
        description: 'Get tasks for an orchestrator',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
            status: { type: 'string' },
          },
          required: ['workspaceSlug', 'orchestratorId'],
        },
      },
      handler: getOrchestratorTasks,
    },
    {
      tool: {
        name: 'neolith_create_task',
        description: 'Create a new task for an orchestrator',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workspaceSlug: { type: 'string' },
            orchestratorId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['workspaceSlug', 'orchestratorId', 'title'],
        },
      },
      handler: createTask,
    },
  ];
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  try {
    // Parse configuration
    const envConfig = loadEnvConfig();
    const cliConfig = parseArgs();
    const config = mergeConfig(envConfig, cliConfig);

    // Validate configuration
    validateConfig(config);

    // Log configuration to stderr
    if (config.debug) {
      logConfig(config);
    }

    console.error('[Neolith MCP Server] Starting...');

    // Create server options
    const serverOptions: NeolithMCPServerOptions = {
      name: 'neolith-mcp-server',
      version: '1.0.0',
      description: 'Neolith workspace management MCP server',
      neolithApiUrl: config.apiUrl,
      authToken: config.authToken,
      workspaceSlug: config.workspaceSlug,
      timeout: config.timeout,
      debugApi: config.debugApi,
      debug: config.debug,
      logging: {
        level: config.logLevel,
      },
      capabilities: {
        tools: {},
      },
    };

    // Create the server
    const server = createNeolithMCPServer(serverOptions);

    console.error('[Neolith MCP Server] Registering tools...');

    // Register all tool categories
    let toolCount = 0;

    // Helper function to convert Neolith tool format to MCP ToolRegistration format
    const wrapTool = (toolDef: any) => {
      if (toolDef.tool && toolDef.handler) {
        // Already in correct format
        return toolDef;
      }
      // Convert from Neolith format to MCP format
      const { name, description, inputSchema, handler } = toolDef;
      return {
        tool: { name, description, inputSchema },
        handler,
      };
    };

    // Register workspace tools
    for (const toolDef of workspaceTools) {
      server.registerTool(wrapTool(toolDef));
      toolCount++;
    }

    // Register channel tools
    for (const toolDef of channelTools) {
      server.registerTool(wrapTool(toolDef));
      toolCount++;
    }

    // Register messaging tools
    for (const toolReg of createMessagingTools()) {
      server.registerTool(wrapTool(toolReg));
      toolCount++;
    }

    // Register file tools
    for (const toolDef of fileTools) {
      server.registerTool(wrapTool(toolDef));
      toolCount++;
    }

    // Register user tools
    for (const toolDef of USER_TOOLS) {
      server.registerTool(wrapTool(toolDef));
      toolCount++;
    }

    // Register search tools
    for (const toolDef of searchTools) {
      server.registerTool(wrapTool(toolDef));
      toolCount++;
    }

    // Register orchestrator tools
    for (const toolReg of createOrchestratorTools()) {
      server.registerTool(wrapTool(toolReg));
      toolCount++;
    }

    console.error(`[Neolith MCP Server] Registered ${toolCount} tools`);

    // Start the server
    await server.start();

    console.error('[Neolith MCP Server] Server started successfully');
    console.error('[Neolith MCP Server] Listening for MCP messages on stdio...');

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      console.error(`\n[Neolith MCP Server] Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        console.error('[Neolith MCP Server] Server stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('[Neolith MCP Server] Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('[Neolith MCP Server] Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Neolith MCP Server] Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  } catch (error) {
    console.error('[Neolith MCP Server] Fatal error:', error);
    process.exit(1);
  }
}

// Export for testing
export { parseArgs, loadEnvConfig, mergeConfig, validateConfig };
