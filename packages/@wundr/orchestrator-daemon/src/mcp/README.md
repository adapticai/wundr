# MCP Tool Registry

Real, functional MCP (Model Context Protocol) tools for the Orchestrator Daemon.

## Overview

The MCP Tool Registry provides a collection of executable tools that can be invoked by AI agents, LLMs, and the orchestrator daemon. Each tool is fully functional with proper error handling, safety checks, and logging.

## Architecture

```
┌─────────────────────────────────────┐
│    Orchestrator Daemon              │
│                                     │
│  ┌───────────────────────────────┐ │
│  │   Session Executor             │ │
│  │   (LLM Tool Calls)            │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│  ┌───────────▼───────────────────┐ │
│  │   Tool Executor                │ │
│  │   (Converts to MCP format)    │ │
│  └───────────┬───────────────────┘ │
│              │                      │
│  ┌───────────▼───────────────────┐ │
│  │   MCP Tool Registry            │ │
│  │   ┌─────────────────────────┐ │ │
│  │   │ Built-in Tools:         │ │ │
│  │   │ - file_read             │ │ │
│  │   │ - file_write            │ │ │
│  │   │ - bash_execute          │ │ │
│  │   │ - web_fetch             │ │ │
│  │   │ - file_list             │ │ │
│  │   │ - file_delete           │ │ │
│  │   └─────────────────────────┘ │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Available Tools

### 1. File Read (`file_read`)

Read contents of a file from the filesystem.

**Input Schema:**
```typescript
{
  path: string;        // Absolute or relative path
  encoding?: string;   // Default: 'utf8'
}
```

**Output:**
```typescript
{
  path: string;        // Resolved absolute path
  content: string;     // File contents
  size: number;        // Content size in bytes
  encoding: string;    // Encoding used
}
```

**Example:**
```typescript
const result = await registry.executeTool('file_read', 'read', {
  path: './config.json',
  encoding: 'utf8'
});

console.log(result.data.content);
```

### 2. File Write (`file_write`)

Write content to a file on the filesystem.

**Input Schema:**
```typescript
{
  path: string;              // Absolute or relative path
  content: string;           // Content to write
  encoding?: string;         // Default: 'utf8'
  createDirectories?: boolean; // Default: true
}
```

**Output:**
```typescript
{
  path: string;     // Resolved absolute path
  size: number;     // Written size in bytes
  encoding: string; // Encoding used
}
```

**Example:**
```typescript
const result = await registry.executeTool('file_write', 'write', {
  path: './output/data.json',
  content: JSON.stringify(data, null, 2),
  createDirectories: true
});
```

### 3. Bash Execute (`bash_execute`)

Execute a bash command with safety checks.

**Input Schema:**
```typescript
{
  command: string;   // Bash command to execute
  cwd?: string;      // Working directory
  timeout?: number;  // Timeout in ms (default: 30000)
}
```

**Output:**
```typescript
{
  stdout: string;    // Standard output
  stderr: string;    // Standard error
  exitCode: number;  // Exit code (0 = success)
  command: string;   // Executed command
}
```

**Safety Checks:**
- Blocks dangerous commands (rm -rf /, fork bombs, etc.)
- 10MB output buffer limit
- Configurable timeout
- Command logging

**Example:**
```typescript
const result = await registry.executeTool('bash_execute', 'execute', {
  command: 'ls -la',
  cwd: '/tmp',
  timeout: 5000
});

console.log(result.data.stdout);
```

### 4. Web Fetch (`web_fetch`)

Fetch content from a URL via HTTP/HTTPS.

**Input Schema:**
```typescript
{
  url: string;                      // URL to fetch
  method?: string;                  // HTTP method (default: 'GET')
  headers?: Record<string, string>; // HTTP headers
  timeout?: number;                 // Timeout in ms (default: 10000)
}
```

**Output:**
```typescript
{
  url: string;                      // Fetched URL
  statusCode: number;               // HTTP status code
  statusMessage: string;            // HTTP status message
  headers: Record<string, string>;  // Response headers
  body: string;                     // Response body
  size: number;                     // Body size in bytes
}
```

**Safety Checks:**
- Only allows HTTP/HTTPS protocols
- Configurable timeout
- Custom User-Agent

**Example:**
```typescript
const result = await registry.executeTool('web_fetch', 'fetch', {
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  },
  timeout: 5000
});

const data = JSON.parse(result.data.body);
```

### 5. File List (`file_list`)

List files and directories in a path.

**Input Schema:**
```typescript
{
  path: string;        // Directory path to list
  recursive?: boolean; // List recursively (default: false)
}
```

**Output:**
```typescript
{
  path: string;        // Resolved directory path
  count: number;       // Number of entries
  files: Array<{
    name: string;      // Entry name
    path: string;      // Full path
    type: 'file' | 'directory';
    size: number;      // Size in bytes
    modified: Date;    // Last modified time
  }>;
}
```

**Example:**
```typescript
const result = await registry.executeTool('file_list', 'list', {
  path: './src',
  recursive: false
});

result.data.files.forEach(file => {
  console.log(`${file.type}: ${file.name} (${file.size} bytes)`);
});
```

### 6. File Delete (`file_delete`)

Delete a file or directory.

**Input Schema:**
```typescript
{
  path: string;        // Path to delete
  recursive?: boolean; // Recursively delete directories (default: false)
}
```

**Output:**
```typescript
{
  path: string;              // Deleted path
  deleted: boolean;          // Deletion success
  type: 'file' | 'directory'; // Type of deleted entry
}
```

**Example:**
```typescript
const result = await registry.executeTool('file_delete', 'delete', {
  path: './temp/cache',
  recursive: true
});

console.log(`Deleted ${result.data.type}: ${result.data.path}`);
```

## Safety Features

### Path Safety
- Blocks path traversal attempts (`..`)
- Prevents access to system directories (`/etc`, `/var`, `/sys`, etc.)
- Normalizes all paths before operations

### Command Safety
- Blocks dangerous commands:
  - `rm -rf /`
  - Fork bombs
  - Disk wiping commands
  - Arbitrary code execution patterns
- Output buffer limits
- Timeout enforcement

### Network Safety
- Protocol whitelist (HTTP/HTTPS only)
- Timeout enforcement
- User-Agent identification

## Usage

### Basic Usage

```typescript
import { createMcpToolRegistry } from '@wundr.io/orchestrator-daemon/mcp';

// Create registry with safety checks enabled
const registry = createMcpToolRegistry({ safetyChecks: true });

// List available tools
console.log('Available tools:', registry.listTools());

// Get tool definition
const tool = registry.getTool('file_read');
console.log('Tool schema:', tool?.inputSchema);

// Execute tool
const result = await registry.executeTool('file_read', 'read', {
  path: './config.json'
});

if (result.success) {
  console.log('Content:', result.data.content);
} else {
  console.error('Error:', result.error);
}
```

### Integration with Tool Executor

```typescript
import { ToolExecutor } from '@wundr.io/orchestrator-daemon/session';
import { createMcpToolRegistry } from '@wundr.io/orchestrator-daemon/mcp';

const registry = createMcpToolRegistry();
const executor = new ToolExecutor(registry);

// Execute LLM tool calls
const toolCalls = [
  {
    id: 'call_1',
    name: 'file_read',
    arguments: JSON.stringify({ path: './data.json' })
  }
];

const results = await executor.executeToolCalls(toolCalls);
const messages = executor.convertResultsToMessages(results);
```

### Custom Tool Registration

```typescript
import { createMcpToolRegistry, McpToolDefinition } from '@wundr.io/orchestrator-daemon/mcp';

const registry = createMcpToolRegistry();

// Define custom tool
const customTool: McpToolDefinition = {
  name: 'custom_tool',
  description: 'My custom tool',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    },
    required: ['input']
  },
  execute: async (params) => {
    // Custom logic
    return { result: params.input.toUpperCase() };
  }
};

// Register custom tool
registry.registerTool(customTool);

// Use it
const result = await registry.executeTool('custom_tool', 'execute', {
  input: 'hello'
});
```

## Error Handling

All tools return a standardized result format:

```typescript
interface ToolResult {
  success: boolean;
  message: string;
  data?: any;      // Present on success
  error?: any;     // Present on failure
  metadata?: Record<string, any>;
}
```

**Success Example:**
```typescript
{
  success: true,
  message: "Tool file_read executed successfully",
  data: {
    path: "/absolute/path/to/file.txt",
    content: "file contents",
    size: 1234,
    encoding: "utf8"
  }
}
```

**Error Example:**
```typescript
{
  success: false,
  message: "Tool file_read execution failed",
  error: "ENOENT: no such file or directory"
}
```

## Testing

Comprehensive test suite included:

```bash
npm test src/mcp/__tests__/tool-registry.test.ts
```

Tests cover:
- Tool registration and listing
- File operations (read, write, list, delete)
- Bash command execution
- Web fetching
- Safety checks
- Error handling

## Performance Considerations

- **File Operations**: Async I/O for non-blocking operations
- **Command Execution**: 10MB buffer limit, 30s default timeout
- **Web Requests**: 10s default timeout, streaming responses
- **Memory**: Efficient buffer handling, no unnecessary copies

## Security Best Practices

1. **Always enable safety checks in production**
   ```typescript
   const registry = createMcpToolRegistry({ safetyChecks: true });
   ```

2. **Validate user input before tool execution**
   ```typescript
   if (!isValidPath(userInput)) {
     throw new Error('Invalid path');
   }
   ```

3. **Use timeouts for all operations**
   ```typescript
   await registry.executeTool('bash_execute', 'execute', {
     command: cmd,
     timeout: 5000 // Always set timeout
   });
   ```

4. **Log all tool executions for auditing**
   ```typescript
   // Built-in logging via Logger utility
   ```

## Future Enhancements

- Integration with neolith-mcp-server tools
- Enhanced tool discovery and registration
- Tool composition and chaining
- Streaming support for large outputs
- Rate limiting and resource quotas
- Tool execution sandboxing

## Related Modules

- `session/tool-executor.ts` - Converts LLM tool calls to MCP format
- `session/session-executor.ts` - Orchestrates tool execution in sessions
- `@wundr.io/neolith-mcp-server` - Neolith workspace tools

## License

MIT License - Part of the Wundr platform by Adaptic.ai
