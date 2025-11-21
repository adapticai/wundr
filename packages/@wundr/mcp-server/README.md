# @wundr.io/mcp-server

Model Context Protocol (MCP) server implementation for Claude Code integration with stdio transport.

## Overview

This package provides a complete MCP server implementation that enables Claude Code and other AI assistants to interact with Wundr's development toolkit through the standardized Model Context Protocol.

### Key Features

- **Stdio Transport**: Reliable JSON-RPC 2.0 communication over stdin/stdout
- **Tool Discovery**: Dynamic tool registration and invocation
- **Resource Management**: URI-based resource access
- **Prompt Templates**: Reusable prompt definitions
- **TypeScript First**: Full type safety with strict mode enabled
- **Extensible Architecture**: Easy to add custom tools, resources, and prompts

## Architecture

```
+------------------+      +-------------------+      +------------------+
|   Claude Code    |<---->|   Stdio Transport |<---->| Protocol Handler |
|   (MCP Client)   | JSON |   (stdin/stdout)  |      |   (JSON-RPC)     |
+------------------+ RPC  +-------------------+      +--------+---------+
                                                              |
                                                              v
                    +--------------------------------------------+
                    |              MCP Server                     |
                    |  +----------+ +------------+ +----------+  |
                    |  |  Tools   | | Resources  | |  Prompts |  |
                    |  | Registry | |  Registry  | | Registry |  |
                    |  +----------+ +------------+ +----------+  |
                    +--------------------------------------------+
```

## Installation

```bash
pnpm add @wundr.io/mcp-server
```

## Quick Start

### Basic Server Setup

```typescript
import { createMCPServer } from '@wundr.io/mcp-server';

const server = createMCPServer({
  name: 'my-mcp-server',
  version: '1.0.0',
  description: 'My MCP server for development tools',
});

// Register a tool
server.addTool(
  {
    name: 'greet',
    description: 'Greets a user by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' },
      },
      required: ['name'],
    },
  },
  async (params, context) => {
    const name = params.name as string;
    context.logger.info(`Greeting ${name}`);
    return {
      content: [{ type: 'text', text: `Hello, ${name}!` }],
    };
  }
);

// Start the server
await server.start();
```

### Builder Pattern

```typescript
import { buildMCPServer } from '@wundr.io/mcp-server';

const server = await buildMCPServer('my-server', '1.0.0')
  .description('My awesome MCP server')
  .logLevel('debug')
  .withTool(greetTool, greetHandler)
  .withTool(analyzeTool, analyzeHandler)
  .withResource(configResource, configHandler)
  .start();
```

### Claude Code Integration

Add to your Claude Code configuration:

```json
{
  "mcpServers": {
    "wundr": {
      "command": "npx",
      "args": ["@wundr.io/mcp-server"]
    }
  }
}
```

Or with a local installation:

```json
{
  "mcpServers": {
    "wundr": {
      "command": "node",
      "args": ["./node_modules/@wundr.io/mcp-server/dist/index.js"]
    }
  }
}
```

## API Reference

### createMCPServer(options)

Creates a new MCP server instance.

```typescript
interface MCPServerOptions {
  name: string;                              // Server name (required)
  version: string;                           // Server version (required)
  description?: string;                      // Server description
  capabilities?: Partial<ServerCapabilities>; // Override default capabilities
  logging?: {
    level?: LogLevel;                        // 'debug' | 'info' | 'warning' | 'error'
    format?: 'json' | 'text';                // Log output format
  };
  tools?: ToolRegistration[];                // Initial tools to register
  resources?: ResourceRegistration[];        // Initial resources to register
  prompts?: PromptRegistration[];            // Initial prompts to register
  debug?: boolean;                           // Enable debug mode
}
```

### MCPServer Class

#### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start the server and begin accepting connections |
| `stop()` | Stop the server gracefully |
| `registerTool(registration)` | Register a tool with handler |
| `addTool(tool, handler)` | Convenience method for tool registration |
| `unregisterTool(name)` | Remove a registered tool |
| `registerResource(registration)` | Register a resource with handler |
| `addResource(resource, handler)` | Convenience method for resource registration |
| `unregisterResource(uri)` | Remove a registered resource |
| `registerPrompt(registration)` | Register a prompt with handler |
| `addPrompt(prompt, handler)` | Convenience method for prompt registration |
| `unregisterPrompt(name)` | Remove a registered prompt |
| `getStatus()` | Get current server status |

### Tool Definition

```typescript
interface Tool {
  name: string;                    // Unique tool identifier
  description: string;             // Human-readable description
  inputSchema: ToolInputSchema;    // JSON Schema for input validation
}

interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
}
```

### Tool Handler

```typescript
type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolCallResult>;

interface ToolContext {
  requestId: JsonRpcId;
  signal?: AbortSignal;            // For cancellation support
  logger: Logger;                  // Context-aware logger
  progress: (progress: number, total?: number) => void; // Progress reporting
}

interface ToolCallResult {
  content: ToolContent[];          // Result content
  isError?: boolean;               // Indicates error result
}
```

### Resource Definition

```typescript
interface Resource {
  uri: string;                     // Unique resource URI
  name: string;                    // Display name
  description?: string;            // Human-readable description
  mimeType?: string;               // Content MIME type
}
```

### Prompt Definition

```typescript
interface Prompt {
  name: string;                    // Unique prompt identifier
  description?: string;            // Human-readable description
  arguments?: PromptArgument[];    // Required/optional arguments
}
```

## MCP Protocol Implementation

This package implements the [Model Context Protocol](https://spec.modelcontextprotocol.io/) specification:

### Supported Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize the MCP session |
| `tools/list` | List available tools |
| `tools/call` | Execute a tool |
| `resources/list` | List available resources |
| `resources/read` | Read resource contents |
| `prompts/list` | List available prompts |
| `prompts/get` | Get prompt with arguments |
| `ping` | Health check |
| `shutdown` | Graceful shutdown |

### Notifications

| Notification | Description |
|--------------|-------------|
| `notifications/initialized` | Client confirms initialization |
| `notifications/tools/list_changed` | Tool list has been modified |
| `notifications/resources/list_changed` | Resource list has been modified |
| `notifications/prompts/list_changed` | Prompt list has been modified |
| `notifications/progress` | Progress update for long operations |

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC request |
| -32601 | Method Not Found | Unknown method |
| -32602 | Invalid Params | Invalid method parameters |
| -32603 | Internal Error | Server error |
| -32001 | Tool Not Found | Requested tool not registered |
| -32002 | Tool Execution Error | Tool handler threw error |
| -32003 | Resource Not Found | Requested resource not registered |
| -32004 | Prompt Not Found | Requested prompt not registered |

## Logging

The server logs to stderr to avoid interfering with the stdout-based MCP protocol communication.

```typescript
import { ConsoleLogger, JsonLogger, createMCPLogger } from '@wundr.io/mcp-server';

// Text format logger
const textLogger = new ConsoleLogger('debug', 'MyServer');

// JSON format logger (for log aggregation)
const jsonLogger = new JsonLogger('info', { service: 'my-mcp-server' });

// Factory function
const logger = createMCPLogger('info', 'json', { version: '1.0.0' });
```

## Examples

### Progress Reporting

```typescript
server.addTool(
  {
    name: 'long-operation',
    description: 'A tool that takes time',
    inputSchema: { type: 'object', properties: {} },
  },
  async (params, context) => {
    const total = 100;

    for (let i = 0; i <= total; i += 10) {
      // Report progress
      context.progress(i, total);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      content: [{ type: 'text', text: 'Operation completed!' }],
    };
  }
);
```

### Cancellation Support

```typescript
server.addTool(
  {
    name: 'cancellable-operation',
    description: 'A tool that can be cancelled',
    inputSchema: { type: 'object', properties: {} },
  },
  async (params, context) => {
    for (let i = 0; i < 100; i++) {
      // Check for cancellation
      if (context.signal?.aborted) {
        return {
          content: [{ type: 'text', text: 'Operation cancelled' }],
          isError: true,
        };
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      content: [{ type: 'text', text: 'Completed!' }],
    };
  }
);
```

### Error Handling

```typescript
import { createTextResult } from '@wundr.io/mcp-server';

server.addTool(
  {
    name: 'might-fail',
    description: 'A tool that might fail',
    inputSchema: { type: 'object', properties: {} },
  },
  async (params, context) => {
    try {
      // Your logic here
      const result = await riskyOperation();
      return createTextResult(JSON.stringify(result));
    } catch (error) {
      context.logger.error('Operation failed', error);
      return createTextResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true // isError
      );
    }
  }
);
```

## Type Exports

All MCP protocol types are exported for TypeScript users:

```typescript
import type {
  Tool,
  ToolHandler,
  ToolContext,
  ToolCallResult,
  Resource,
  ResourceHandler,
  Prompt,
  PromptHandler,
  ServerCapabilities,
  MCPServerConfig,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@wundr.io/mcp-server';
```

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Related Packages

- `@wundr.io/ai-integration` - AI Integration Hive for swarm intelligence
- `@wundr.io/cli` - Wundr CLI tools
- `@wundr.io/core` - Core functionality

## License

MIT
