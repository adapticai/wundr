# AI Tool Calling System

A comprehensive, production-ready AI tool calling system with OpenAI function calling support,
permission checking, approval flows, caching, and parallel execution.

## Features

- **OpenAI Function Calling Format**: Full compatibility with OpenAI's function calling API
- **Permission System**: Role-based access control for tools
- **Approval Workflow**: Sensitive operations require explicit user approval
- **Result Caching**: Configurable TTL-based caching for tool results
- **Parallel Execution**: Execute multiple tools concurrently
- **Type-Safe**: Full TypeScript support with proper typing
- **Category-Based Organization**: Tools organized by workflow, search, data, etc.
- **Real Implementations**: Fully functional tools, not stubs
- **Rich Result Display**: Category-specific result rendering components

## Architecture

```
lib/ai/tools/
├── index.ts              # Core registry and execution framework
├── init.ts               # Tool initialization
├── workflow-tools.ts     # Workflow management tools
├── search-tools.ts       # Search and discovery tools
├── data-tools.ts         # Data manipulation and analytics tools
└── README.md             # This file

components/ai/
└── tool-result.tsx       # Result display components

app/api/ai/tools/
├── execute/route.ts      # Tool execution endpoint
├── list/route.ts         # Available tools endpoint
└── approve/route.ts      # Approval workflow endpoint
```

## Available Tools

### Workflow Tools (6 tools)

- `create_workflow` - Create new workflows
- `list_workflows` - List all workflows with filtering
- `execute_workflow` - Execute a workflow (requires approval)
- `get_workflow_status` - Get workflow status and stats
- `update_workflow` - Update workflow configuration
- `delete_workflow` - Delete workflow (requires approval)

### Search Tools (5 tools)

- `search_messages` - Search messages across channels
- `search_files` - Search for files and attachments
- `search_users` - Search for workspace users
- `semantic_search` - AI-powered semantic search (RAG)
- `search_channels` - Search for channels

### Data Tools (6 tools)

- `query_data` - Query workspace data with filters
- `transform_data` - Transform and manipulate datasets
- `export_data` - Export data in various formats (requires approval)
- `generate_analytics` - Generate analytics reports
- `create_report` - Create custom reports
- `calculate_statistics` - Calculate statistical metrics

**Total: 17 production-ready tools**

## Usage

### Basic Tool Execution

```typescript
import { toolRegistry } from '@/lib/ai/tools/init';

// Execute a tool
const result = await toolRegistry.execute(
  'search_messages',
  { query: 'meeting notes', limit: 10 },
  {
    userId: 'user_123',
    workspaceId: 'ws_456',
    permissions: ['message:read'],
  }
);

if (result.success) {
  console.log('Search results:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Parallel Tool Execution

```typescript
const results = await toolRegistry.executeParallel(
  [
    { tool: 'search_messages', input: { query: 'update' } },
    { tool: 'search_users', input: { query: 'john' } },
    { tool: 'generate_analytics', input: { metric: 'user_activity' } },
  ],
  context
);
```

### Using React Hook

```typescript
import { useToolExecution } from '@/lib/ai/hooks/use-tool-execution';

function MyComponent() {
  const { executeTool, executions } = useToolExecution({
    workspaceId: 'ws_123',
    onSuccess: (result) => console.log('Success:', result),
    onError: (error) => console.error('Error:', error),
  });

  const handleSearch = async () => {
    await executeTool('search_messages', {
      query: 'meeting',
      limit: 10,
    });
  };

  return (
    <div>
      <button onClick={handleSearch}>Search Messages</button>
      {executions.map((exec) => (
        <ToolResult key={exec.toolName} {...exec} />
      ))}
    </div>
  );
}
```

### Displaying Results

```typescript
import { ToolResult } from '@/components/ai/tool-result';

<ToolResult
  toolName="search_messages"
  category="search"
  success={true}
  data={searchResults}
  metadata={{
    executionTime: 145,
    cached: false,
  }}
/>
```

## Creating Custom Tools

### 1. Define Tool

```typescript
import { registerTool } from './index';

registerTool({
  name: 'my_custom_tool',
  description: 'Does something useful',
  category: 'data',
  requiredPermissions: ['custom:execute'],
  requiresApproval: false,
  cacheable: true,
  cacheTTL: 300, // 5 minutes

  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'First parameter',
      },
      param2: {
        type: 'number',
        description: 'Second parameter',
        default: 10,
      },
    },
    required: ['param1'],
  },

  async execute(input, context) {
    try {
      // Your implementation here
      const result = await doSomething(input.param1, input.param2);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
```

### 2. Add to Init

```typescript
// lib/ai/tools/init.ts
import './my-custom-tools';
```

### 3. Update Permissions

Grant users the required permissions in your permission system.

## API Endpoints

### Execute Tool

```http
POST /api/ai/tools/execute
Content-Type: application/json

{
  "tool": "search_messages",
  "input": {
    "query": "meeting",
    "limit": 10
  },
  "workspaceId": "ws_123"
}
```

### List Available Tools

```http
GET /api/ai/tools/list
GET /api/ai/tools/list?category=workflow
GET /api/ai/tools/list?format=openai
```

### Approve Tool Execution

```http
POST /api/ai/tools/approve
Content-Type: application/json

{
  "approvalId": "approval_xxx",
  "action": "approve"
}
```

## Permission System

Tools can require specific permissions:

```typescript
requiredPermissions: ['workflow:create', 'workflow:execute'];
```

Common permissions:

- `workflow:*` - Workflow operations
- `message:read` - Read messages
- `file:read` - Access files
- `user:read` - View users
- `data:*` - Data operations
- `analytics:read` - View analytics
- `search:semantic` - Use semantic search

## Approval Flow

Sensitive operations (delete, execute, export) require approval:

1. Tool is called with `requiresApproval: true`
2. Returns `approvalId` in metadata
3. User reviews and approves/rejects
4. Approved tools execute with original parameters

```typescript
// Initial call
const result = await executeTool('delete_workflow', { workflowId: 'wf_123' });

if (result.metadata?.requiresApproval) {
  // Show approval UI
  const approvalId = result.metadata.approvalId;

  // User approves
  const finalResult = await approveTool(approvalId);
}
```

## Caching

Tools can cache results to improve performance:

```typescript
cacheable: true,
cacheTTL: 300, // Cache for 5 minutes
```

Cached results include `cached: true` in metadata.

Clear cache:

```typescript
toolRegistry.clearCache(); // Clear all
toolRegistry.clearExpiredCache(); // Clear expired only
```

## Result Types by Category

### Workflow Results

```typescript
{
  workflowId: string;
  executionId?: string;
  status: 'active' | 'completed' | 'failed';
  stats?: { totalRuns: number; successRate: number };
}
```

### Search Results

```typescript
Array<{
  id: string;
  content: string;
  channelId: string;
  timestamp: string;
}>;
```

### Data Results

```typescript
{
  data: Array<Record<string, unknown>>;
  count: number;
  summary?: Record<string, unknown>;
  aggregations?: Record<string, number>;
}
```

## Error Handling

All tools return consistent error format:

```typescript
{
  success: false,
  error: "Error message here",
  metadata: {
    executionTime: 45,
  }
}
```

## Testing

```typescript
// Test tool execution
import { toolRegistry } from '@/lib/ai/tools/init';

test('search_messages returns results', async () => {
  const result = await toolRegistry.execute(
    'search_messages',
    { query: 'test', limit: 5 },
    mockContext
  );

  expect(result.success).toBe(true);
  expect(result.data).toHaveLength(5);
});
```

## Performance

- **Execution Time**: Tracked automatically in metadata
- **Caching**: Reduces API calls for repeated queries
- **Parallel Execution**: Run independent tools concurrently
- **Permission Checks**: Fast in-memory permission validation

## Best Practices

1. **Use Permissions**: Always require appropriate permissions
2. **Approval for Sensitive Ops**: Delete, execute, export should require approval
3. **Cache Read Operations**: Cache search and analytics results
4. **Validate Input**: Use Zod or similar for input validation
5. **Error Handling**: Return descriptive error messages
6. **Document Parameters**: Clear descriptions help AI understand tool usage
7. **Test Tools**: Write tests for tool execution logic

## Integration with AI Models

### OpenAI Function Calling

```typescript
const tools = toolRegistry.getOpenAIFunctions(userPermissions);

const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  tools: tools,
  tool_choice: 'auto',
});
```

### Vercel AI SDK

```typescript
import { toolRegistry } from '@/lib/ai/tools/init';

const tools = toolRegistry.getOpenAIFunctions(permissions);

const response = await streamText({
  model: openai('gpt-4'),
  messages: [...],
  tools: tools,
});
```

## Future Enhancements

- [ ] Tool usage analytics and monitoring
- [ ] Rate limiting per tool/user
- [ ] Tool chaining and workflows
- [ ] Custom validators with Zod
- [ ] Tool versioning
- [ ] Webhook support for async tools
- [ ] Tool marketplace/plugins

## License

MIT
