#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Wundr MCP Server CLI Entry Point
 * Starts the MCP server for Wundr CLI tools
 */

const { initializeCliTools, globalRegistry, VERSION } = require('../dist');

// Check if we're being asked for version
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(`@wundr/mcp-server v${VERSION}`);
  process.exit(0);
}

// Check if we're being asked for help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Wundr MCP Server v${VERSION}

Usage: wundr-mcp [options]

Options:
  -v, --version   Show version number
  -h, --help      Show help
  --list-tools    List all available MCP tools
  --json          Output in JSON format (for --list-tools)

Description:
  This MCP server provides access to all Wundr CLI commands
  through the Model Context Protocol (MCP).

Available tool categories:
  - setup: Machine and environment setup tools
  - project: Project initialization and management
  - governance: Code quality and compliance tools
  - analysis: Dependency and code analysis
  - testing: Test coverage and baseline management

For more information, visit: https://wundr.io
`);
  process.exit(0);
}

// Initialize tools
initializeCliTools();

// Check if we're listing tools
if (process.argv.includes('--list-tools')) {
  const tools = globalRegistry.getAll();
  const jsonOutput = process.argv.includes('--json');

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        tools.map(t => ({
          name: t.name,
          description: t.description,
          category: t.category,
          inputSchema: t.inputSchema,
        })),
        null,
        2
      )
    );
  } else {
    console.log('\\nAvailable MCP Tools:\\n');

    const byCategory = {};
    for (const tool of tools) {
      if (!byCategory[tool.category]) {
        byCategory[tool.category] = [];
      }
      byCategory[tool.category].push(tool);
    }

    for (const [category, categoryTools] of Object.entries(byCategory)) {
      console.log(`[${category.toUpperCase()}]`);
      for (const tool of categoryTools) {
        console.log(`  ${tool.name}`);
        console.log(`    ${tool.description}`);
      }
      console.log();
    }
  }
  process.exit(0);
}

// Start MCP server (placeholder for actual MCP server implementation)
console.log(`Wundr MCP Server v${VERSION}`);
console.log('MCP server ready. Waiting for connections...');
console.log(`Registered ${globalRegistry.getAll().length} tools.`);

// Keep the process alive
process.stdin.resume();
