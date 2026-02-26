/**
 * Basic MCP Tool Registry Usage Examples
 *
 * Demonstrates common usage patterns for the MCP tool registry.
 */

import { createMcpToolRegistry } from '../tool-registry';

/**
 * Example 1: Basic File Operations
 */
async function fileOperationsExample() {
  console.log('\n=== File Operations Example ===\n');

  const registry = createMcpToolRegistry({ safetyChecks: true });

  // Write a file
  const writeResult = await registry.executeTool('file_write', 'write', {
    path: './temp/example.json',
    content: JSON.stringify({ hello: 'world', timestamp: Date.now() }, null, 2),
    createDirectories: true,
  });

  console.log('Write result:', writeResult.success);
  console.log('File path:', writeResult.data?.path);

  // Read the file back
  const readResult = await registry.executeTool('file_read', 'read', {
    path: './temp/example.json',
  });

  console.log('Read result:', readResult.success);
  console.log('Content:', readResult.data?.content);

  // List files in directory
  const listResult = await registry.executeTool('file_list', 'list', {
    path: './temp',
  });

  console.log('\nFiles in ./temp:');
  listResult.data?.files.forEach((file: any) => {
    console.log(`  - ${file.name} (${file.type}, ${file.size} bytes)`);
  });

  // Clean up
  const deleteResult = await registry.executeTool('file_delete', 'delete', {
    path: './temp/example.json',
  });

  console.log('\nDeleted:', deleteResult.data?.path);
}

/**
 * Example 2: Command Execution
 */
async function commandExecutionExample() {
  console.log('\n=== Command Execution Example ===\n');

  const registry = createMcpToolRegistry({ safetyChecks: true });

  // Execute a simple command
  const result = await registry.executeTool('bash_execute', 'execute', {
    command: 'echo "Hello from MCP Tool!"',
    timeout: 5000,
  });

  console.log('Command executed:', result.success);
  console.log('Output:', result.data?.stdout);

  // Get system info
  const unameResult = await registry.executeTool('bash_execute', 'execute', {
    command: 'uname -a',
  });

  console.log('\nSystem info:', unameResult.data?.stdout);

  // List current directory
  const lsResult = await registry.executeTool('bash_execute', 'execute', {
    command: 'ls -la | head -10',
  });

  console.log('\nCurrent directory:');
  console.log(lsResult.data?.stdout);

  // Try a dangerous command (will be blocked)
  const dangerousResult = await registry.executeTool(
    'bash_execute',
    'execute',
    {
      command: 'rm -rf /',
    }
  );

  console.log('\nDangerous command blocked:', !dangerousResult.success);
  console.log('Error:', dangerousResult.error);
}

/**
 * Example 3: Web Fetching
 */
async function webFetchExample() {
  console.log('\n=== Web Fetch Example ===\n');

  const registry = createMcpToolRegistry({ safetyChecks: true });

  // Fetch JSON data
  const result = await registry.executeTool('web_fetch', 'fetch', {
    url: 'https://httpbin.org/get',
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    timeout: 5000,
  });

  console.log('Fetch successful:', result.success);
  console.log('Status:', result.data?.statusCode, result.data?.statusMessage);
  console.log('Response size:', result.data?.size, 'bytes');

  try {
    const data = JSON.parse(result.data?.body);
    console.log('\nParsed JSON:');
    console.log('  URL:', data.url);
    console.log('  Headers present:', Object.keys(data.headers).length);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
  }
}

/**
 * Example 4: Tool Discovery
 */
function toolDiscoveryExample() {
  console.log('\n=== Tool Discovery Example ===\n');

  const registry = createMcpToolRegistry();

  // List all available tools
  const tools = registry.listTools();
  console.log(`Available tools (${tools.length}):`);
  tools.forEach(toolId => {
    const tool = registry.getTool(toolId);
    console.log(`\n  ${toolId}:`);
    console.log(`    Description: ${tool?.description}`);
    console.log(
      `    Required params: ${tool?.inputSchema.required?.join(', ') || 'none'}`
    );
  });
}

/**
 * Example 5: Custom Tool Registration
 */
async function customToolExample() {
  console.log('\n=== Custom Tool Example ===\n');

  const registry = createMcpToolRegistry();

  // Register a custom tool
  registry.registerTool({
    name: 'string_transform',
    description: 'Transform strings in various ways',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        operation: {
          type: 'string',
          enum: ['uppercase', 'lowercase', 'reverse', 'length'],
        },
      },
      required: ['text', 'operation'],
    },
    execute: async (params: { text: string; operation: string }) => {
      const { text, operation } = params;

      switch (operation) {
        case 'uppercase':
          return { result: text.toUpperCase() };
        case 'lowercase':
          return { result: text.toLowerCase() };
        case 'reverse':
          return { result: text.split('').reverse().join('') };
        case 'length':
          return { result: text.length };
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    },
  });

  // Use the custom tool
  const uppercaseResult = await registry.executeTool(
    'string_transform',
    'transform',
    {
      text: 'hello world',
      operation: 'uppercase',
    }
  );

  console.log('Uppercase:', uppercaseResult.data?.result);

  const reverseResult = await registry.executeTool(
    'string_transform',
    'transform',
    {
      text: 'hello world',
      operation: 'reverse',
    }
  );

  console.log('Reverse:', reverseResult.data?.result);

  const lengthResult = await registry.executeTool(
    'string_transform',
    'transform',
    {
      text: 'hello world',
      operation: 'length',
    }
  );

  console.log('Length:', lengthResult.data?.result);
}

/**
 * Example 6: Error Handling
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');

  const registry = createMcpToolRegistry({ safetyChecks: true });

  // Try to read a non-existent file
  const result = await registry.executeTool('file_read', 'read', {
    path: '/tmp/non-existent-file-12345.txt',
  });

  console.log('Success:', result.success);
  console.log('Error:', result.error);

  // Try a non-existent tool
  const unknownTool = await registry.executeTool(
    'unknown_tool',
    'operation',
    {}
  );

  console.log('\nUnknown tool - Success:', unknownTool.success);
  console.log('Unknown tool - Error:', unknownTool.error);

  // Try unsafe path
  const unsafePath = await registry.executeTool('file_read', 'read', {
    path: '../../etc/passwd',
  });

  console.log('\nUnsafe path - Success:', unsafePath.success);
  console.log('Unsafe path - Error:', unsafePath.error);
}

/**
 * Example 7: Batch Operations
 */
async function batchOperationsExample() {
  console.log('\n=== Batch Operations Example ===\n');

  const registry = createMcpToolRegistry({ safetyChecks: true });

  // Create multiple files
  const files = [
    { name: 'file1.txt', content: 'First file content' },
    { name: 'file2.txt', content: 'Second file content' },
    { name: 'file3.txt', content: 'Third file content' },
  ];

  console.log('Creating files...');
  const writeResults = await Promise.all(
    files.map(file =>
      registry.executeTool('file_write', 'write', {
        path: `./temp/batch/${file.name}`,
        content: file.content,
        createDirectories: true,
      })
    )
  );

  const successCount = writeResults.filter(r => r.success).length;
  console.log(`Created ${successCount}/${files.length} files`);

  // List all created files
  const listResult = await registry.executeTool('file_list', 'list', {
    path: './temp/batch',
  });

  console.log('\nCreated files:');
  listResult.data?.files.forEach((file: any) => {
    console.log(`  - ${file.name} (${file.size} bytes)`);
  });

  // Clean up all files
  console.log('\nCleaning up...');
  const deleteResult = await registry.executeTool('file_delete', 'delete', {
    path: './temp/batch',
    recursive: true,
  });

  console.log('Deleted directory:', deleteResult.success);
}

/**
 * Main function - Run all examples
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  MCP Tool Registry Usage Examples     ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    // Run examples
    await fileOperationsExample();
    await commandExecutionExample();
    await webFetchExample();
    toolDiscoveryExample();
    await customToolExample();
    await errorHandlingExample();
    await batchOperationsExample();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Run examples if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
export {
  fileOperationsExample,
  commandExecutionExample,
  webFetchExample,
  toolDiscoveryExample,
  customToolExample,
  errorHandlingExample,
  batchOperationsExample,
};
