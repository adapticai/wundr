#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @wundr.io/mcp-server CLI entry point
 *
 * This script starts the Wundr MCP server for Claude Code integration.
 *
 * Usage:
 *   wundr-mcp [options]
 *   wundr-mcp start [options]
 *
 * Options:
 *   --stdio           Use stdio transport (default)
 *   --http [port]     Use HTTP transport on specified port
 *   --config <path>   Path to configuration file
 *   --debug           Enable debug logging
 *   --version         Show version number
 *   --help            Show help
 *
 * Environment Variables:
 *   WUNDR_MCP_DEBUG   Enable debug mode (1 or true)
 *   WUNDR_MCP_PORT    HTTP port (default: 3000)
 *   WUNDR_CONFIG_PATH Path to config file
 */

'use strict';

// Check Node.js version
const nodeVersion = process.versions.node.split('.').map(Number);
if (nodeVersion[0] < 18) {
  console.error('Error: @wundr.io/mcp-server requires Node.js 18 or higher.');
  console.error(`Current version: ${process.versions.node}`);
  process.exit(1);
}

// Load and run the server
try {
  const { startServer } = require('../dist/index.js');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    transport: 'stdio',
    port: parseInt(process.env.WUNDR_MCP_PORT || '3000', 10),
    debug: process.env.WUNDR_MCP_DEBUG === '1' || process.env.WUNDR_MCP_DEBUG === 'true',
    configPath: process.env.WUNDR_CONFIG_PATH || null,
  };

  // Simple argument parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--version' || arg === '-v') {
      const pkg = require('../package.json');
      console.log(pkg.version);
      process.exit(0);
    }

    if (arg === '--help' || arg === '-h') {
      console.log(`
@wundr.io/mcp-server - Wundr MCP Server for Claude Code

Usage:
  wundr-mcp [options]
  wundr-mcp start [options]

Options:
  --stdio             Use stdio transport (default for Claude Code)
  --http [port]       Use HTTP transport on specified port (default: 3000)
  --config <path>     Path to configuration file
  --debug             Enable debug logging
  -v, --version       Show version number
  -h, --help          Show this help message

Claude Code Integration:
  claude mcp add wundr npx @wundr.io/mcp-server

Examples:
  wundr-mcp                    # Start with stdio (default)
  wundr-mcp --debug            # Start with debug logging
  wundr-mcp --http 3001        # Start HTTP server on port 3001
  wundr-mcp --config ./mcp.json # Use custom config file
`);
      process.exit(0);
    }

    if (arg === '--stdio') {
      options.transport = 'stdio';
    }

    if (arg === '--http') {
      options.transport = 'http';
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options.port = parseInt(nextArg, 10);
        i++;
      }
    }

    if (arg === '--config') {
      options.configPath = args[++i];
    }

    if (arg === '--debug') {
      options.debug = true;
    }

    // 'start' command is implicit
    if (arg === 'start') {
      continue;
    }
  }

  // Start the server
  startServer(options).catch((error) => {
    console.error('Failed to start MCP server:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  });
} catch (error) {
  // Handle case where dist is not built
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('Error: Server not built. Run "npm run build" first.');
    console.error('Or use "npm run start:dev" for development.');
  } else {
    console.error('Error starting MCP server:', error.message);
  }
  process.exit(1);
}
