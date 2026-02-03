# ScriptRunnerService

A comprehensive, production-ready service for managing and executing scripts securely within the web
client application.

## Features

### 🔐 Security First

- **Sandboxed Execution**: Scripts run in controlled child processes
- **Command Validation**: Whitelist-based command filtering
- **Path Security**: Prevention of directory traversal attacks
- **Parameter Validation**: Input sanitization and type checking
- **Danger Assessment**: Automatic risk level evaluation
- **Resource Limits**: Memory, CPU, and timeout constraints

### 🎯 Script Management

- **Registration**: Dynamic script registration with metadata
- **Categories**: Organized script categorization
- **Versioning**: Script version tracking
- **Permissions**: Fine-grained access control
- **Templates**: Parameter-based script templating

### 📊 Execution Tracking

- **Real-time Output**: Live stdout/stderr capture
- **Execution History**: Complete execution audit trail
- **Status Monitoring**: Running, completed, failed, timeout states
- **Performance Metrics**: Duration and resource usage tracking

### 🚀 Process Management

- **Concurrent Execution**: Multiple scripts running simultaneously
- **Graceful Termination**: SIGTERM followed by SIGKILL
- **Process Monitoring**: PID tracking and status updates
- **Automatic Cleanup**: Memory management and history limits

## API Reference

### Script Registration

```typescript
ScriptRunnerService.registerScript({
  name: 'Build Project',
  description: 'Builds the project using npm',
  category: 'development',
  command: 'npm',
  args: ['run', 'build'],
  timeout: 300000,
  parameters: [
    {
      name: 'environment',
      type: 'select',
      description: 'Target environment',
      required: true,
      validation: {
        options: ['development', 'staging', 'production'],
      },
    },
  ],
  tags: ['build', 'npm'],
  author: 'system',
});
```

### Script Execution

```typescript
const executionId = await ScriptRunnerService.executeScript(
  scriptId,
  { environment: 'production' },
  {
    timeout: 600000,
    userId: 'user123',
    sessionId: 'session456',
  }
);
```

### Monitoring Executions

```typescript
// Get execution details
const execution = ScriptRunnerService.getExecution(executionId);

// Get running executions
const running = ScriptRunnerService.getRunningExecutions();

// Kill execution
await ScriptRunnerService.killExecution(executionId);
```

## Security Model

### Command Whitelisting

Only approved commands are allowed:

- Node.js: `node`, `npm`, `yarn`, `pnpm`, `bun`
- Python: `python`, `python3`, `pip`, `pip3`
- Git: `git`, `gh`
- Docker: `docker`
- File operations: `ls`, `cat`, `echo`, `find`, `grep`
- Testing: `jest`, `vitest`, `mocha`, `cypress`
- Development tools: `eslint`, `tsc`, `prettier`

### Danger Levels

Scripts are automatically classified:

- **Safe**: Basic operations, file reads
- **Low**: Simple commands with minimal risk
- **Medium**: File operations, network requests
- **High**: System commands, privilege escalation
- **Critical**: Destructive operations, dangerous patterns

### Path Security

- Directory traversal prevention (`../`, `~`)
- System directory protection (`/etc`, `/bin`, `C:\Windows`)
- Working directory validation
- Parameter path sanitization

## Default Scripts

The service initializes with these default scripts:

1. **Node.js Version Check** - System information
2. **NPM Install** - Dependency management
3. **Run Tests** - Test execution
4. **Build Project** - Project compilation
5. **Lint Code** - Code quality checking

## Configuration

### Script Parameters

```typescript
interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory' | 'select' | 'multiline';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string; // Regex pattern
    minLength?: number; // Minimum string length
    maxLength?: number; // Maximum string length
    min?: number; // Minimum numeric value
    max?: number; // Maximum numeric value
    options?: string[]; // Select options
  };
  sensitive?: boolean; // Hide in logs
}
```

### Execution Options

```typescript
interface ExecutionOptions {
  timeout?: number; // Max execution time (ms)
  workingDirectory?: string; // Process working directory
  environment?: Record<string, string>; // Environment variables
  captureOutput?: boolean; // Capture stdout/stderr
  streamOutput?: boolean; // Real-time output streaming
  userId?: string; // Executing user ID
  sessionId?: string; // Session identifier
  metadata?: Record<string, any>; // Additional metadata
}
```

## Usage Examples

### Basic Script Registration

```typescript
import { ScriptRunnerService } from '@/lib/services/script';

const script = ScriptRunnerService.registerScript({
  name: 'Hello World',
  description: 'Simple greeting script',
  category: 'utility',
  command: 'echo',
  args: ['Hello, {{name}}!'],
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: 'Name to greet',
      required: true,
      validation: {
        minLength: 1,
        maxLength: 50,
      },
    },
  ],
});
```

### Parameterized Execution

```typescript
const executionId = await ScriptRunnerService.executeScript(script.id, { name: 'World' });

// Monitor execution
const execution = ScriptRunnerService.getExecution(executionId);
console.log('Status:', execution?.status);
console.log('Output:', execution?.output);
```

### Advanced Configuration

```typescript
const complexScript = ScriptRunnerService.registerScript({
  name: 'Database Migration',
  description: 'Run database migrations',
  category: 'deployment',
  command: 'npm',
  args: ['run', 'migrate', '--', '--env={{environment}}'],
  timeout: 900000, // 15 minutes
  workingDirectory: './database',
  environment: {
    NODE_ENV: '{{environment}}',
    DB_TIMEOUT: '30000',
  },
  parameters: [
    {
      name: 'environment',
      type: 'select',
      description: 'Target environment',
      required: true,
      validation: {
        options: ['development', 'staging', 'production'],
      },
    },
    {
      name: 'dryRun',
      type: 'boolean',
      description: 'Perform dry run only',
      required: false,
      defaultValue: false,
    },
  ],
  permissions: {
    canExecute: true,
    canModify: false,
    canDelete: false,
    requiresApproval: true,
    dangerLevel: 'medium',
  },
  tags: ['database', 'migration', 'deployment'],
});
```

## Performance & Limits

- **Max Execution History**: 1,000 executions
- **Default Timeout**: 5 minutes (300,000ms)
- **Maximum Timeout**: 1 hour
- **Concurrent Executions**: Unlimited (system-limited)
- **Output Capture**: Real-time streaming
- **Memory Management**: Automatic cleanup

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors**: Parameter and script validation
- **Execution Errors**: Process failures and timeouts
- **Security Errors**: Command and path violations
- **Resource Errors**: Memory and timeout limits
- **System Errors**: Process management failures

## Integration

### API Routes

The service integrates with Next.js API routes:

- `GET /api/scripts` - List scripts
- `POST /api/scripts` - Register script
- `POST /api/scripts/[id]/execute` - Execute script
- `GET /api/scripts/executions` - List executions
- `GET /api/scripts/executions/[id]` - Get execution details

### React Components

Use with the provided React components:

- `ScriptCard` - Display script information
- `ScriptExecutor` - Execute scripts with parameters
- `ScriptHistory` - View execution history
- `OutputTerminal` - Real-time output display

## Best Practices

1. **Security**: Always validate inputs and use parameter placeholders
2. **Timeouts**: Set appropriate timeouts for long-running scripts
3. **Error Handling**: Implement proper error handling in your scripts
4. **Resource Management**: Monitor resource usage for concurrent executions
5. **Logging**: Use structured logging with execution metadata
6. **Testing**: Test scripts in safe environments before production use

## Troubleshooting

### Common Issues

1. **Command Not Found**: Ensure command is in the whitelist
2. **Permission Denied**: Check script permissions and danger level
3. **Timeout**: Increase timeout for long-running operations
4. **Path Errors**: Verify working directory and file paths
5. **Parameter Errors**: Check parameter validation rules

### Debug Information

```typescript
// Get execution statistics
const stats = ScriptRunnerService.getExecutionStats();
console.log('Total executions:', stats.total);
console.log('Average duration:', stats.avgDuration);

// Get running processes
const running = ScriptRunnerService.getRunningExecutions();
console.log('Currently running:', running.length);
```

## Contributing

When extending the ScriptRunnerService:

1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Update security validations
4. Add appropriate tests
5. Document new features

## License

This service is part of the Wundr web client application and follows the same licensing terms.
