#!/usr/bin/env node

/**
 * Neolith MCP Server Executable
 *
 * Entry point for starting the Neolith MCP server via npx or direct execution.
 * This script:
 * - Loads the compiled TypeScript code from dist/
 * - Passes control to the main() function in cli.ts
 * - Handles any startup errors gracefully
 *
 * Usage:
 *   neolith-mcp-server [OPTIONS]
 *   npx @wundr.io/neolith-mcp-server [OPTIONS]
 *
 * Environment Variables:
 *   NEOLITH_API_URL       - Neolith API base URL
 *   NEOLITH_AUTH_TOKEN    - Authentication token (required)
 *   NEOLITH_WORKSPACE     - Default workspace slug
 *   NEOLITH_LOG_LEVEL     - Log level (debug|info|warning|error)
 *   NEOLITH_DEBUG         - Enable debug mode (true|false)
 *   NEOLITH_DEBUG_API     - Enable API debug logging (true|false)
 *   NEOLITH_TIMEOUT       - API request timeout in milliseconds
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Determine the path to the compiled CLI module
const distPath = path.join(__dirname, '..', 'dist', 'cli.js');

// Check if the compiled code exists
if (!fs.existsSync(distPath)) {
  console.error('Error: Compiled code not found. Please build the project first:');
  console.error('  npm run build');
  console.error('');
  console.error('If you are developing, you can use:');
  console.error('  npm run start:dev');
  process.exit(1);
}

// Import and run the main function
(async () => {
  try {
    // Import the compiled CLI module
    const { main } = await import(distPath);

    // Run the main function
    await main();
  } catch (error) {
    // Log error to stderr (stdout is reserved for MCP messages)
    console.error('[Neolith MCP Server] Fatal error during startup:');
    console.error(error);
    process.exit(1);
  }
})();
