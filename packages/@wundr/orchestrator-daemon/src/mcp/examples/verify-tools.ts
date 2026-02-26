#!/usr/bin/env ts-node
/**
 * MCP Tool Registry Verification Script
 *
 * Quick verification that all tools are functional
 */

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createMcpToolRegistry } from '../tool-registry';

async function verifyTools() {
  console.log('🔧 MCP Tool Registry Verification\n');

  const registry = createMcpToolRegistry({ safetyChecks: true });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-verify-'));

  let passed = 0;
  let failed = 0;

  console.log(`Temp directory: ${tempDir}\n`);

  // Test 1: List Tools
  console.log('✓ Test 1: List Tools');
  const tools = registry.listTools();
  console.log(`  Found ${tools.length} tools: ${tools.join(', ')}\n`);
  passed++;

  // Test 2: File Write
  console.log('✓ Test 2: File Write');
  const testFile = path.join(tempDir, 'test.txt');
  const writeResult = await registry.executeTool('file_write', 'write', {
    path: testFile,
    content: 'Test content',
  });

  if (writeResult.success) {
    console.log(`  ✅ Write successful: ${writeResult.data?.path}\n`);
    passed++;
  } else {
    console.log(`  ❌ Write failed: ${writeResult.error}\n`);
    failed++;
  }

  // Test 3: File Read
  console.log('✓ Test 3: File Read');
  const readResult = await registry.executeTool('file_read', 'read', {
    path: testFile,
  });

  if (readResult.success && readResult.data?.content === 'Test content') {
    console.log(`  ✅ Read successful: ${readResult.data?.size} bytes\n`);
    passed++;
  } else {
    console.log(`  ❌ Read failed: ${readResult.error}\n`);
    failed++;
  }

  // Test 4: File List
  console.log('✓ Test 4: File List');
  const listResult = await registry.executeTool('file_list', 'list', {
    path: tempDir,
  });

  if (listResult.success && listResult.data?.count > 0) {
    console.log(`  ✅ List successful: ${listResult.data?.count} files\n`);
    passed++;
  } else {
    console.log(`  ❌ List failed: ${listResult.error}\n`);
    failed++;
  }

  // Test 5: Bash Execute
  console.log('✓ Test 5: Bash Execute');
  const execResult = await registry.executeTool('bash_execute', 'execute', {
    command: 'echo "MCP Tools Work!"',
  });

  if (
    execResult.success &&
    execResult.data?.stdout.includes('MCP Tools Work')
  ) {
    console.log(`  ✅ Execute successful: ${execResult.data?.stdout}\n`);
    passed++;
  } else {
    console.log(`  ❌ Execute failed: ${execResult.error}\n`);
    failed++;
  }

  // Test 6: Safety Check
  console.log('✓ Test 6: Safety Check (Dangerous Command)');
  const dangerResult = await registry.executeTool('bash_execute', 'execute', {
    command: 'rm -rf /',
  });

  if (!dangerResult.success && dangerResult.error?.includes('dangerous')) {
    console.log('  ✅ Dangerous command blocked correctly\n');
    passed++;
  } else {
    console.log('  ❌ Safety check failed!\n');
    failed++;
  }

  // Test 7: File Delete
  console.log('✓ Test 7: File Delete');
  const deleteResult = await registry.executeTool('file_delete', 'delete', {
    path: testFile,
  });

  if (deleteResult.success) {
    console.log('  ✅ Delete successful\n');
    passed++;
  } else {
    console.log(`  ❌ Delete failed: ${deleteResult.error}\n`);
    failed++;
  }

  // Test 8: Custom Tool Registration
  console.log('✓ Test 8: Custom Tool Registration');
  registry.registerTool({
    name: 'test_custom',
    description: 'Test custom tool',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'number' },
      },
      required: ['value'],
    },
    execute: async (params: { value: number }) => ({
      doubled: params.value * 2,
    }),
  });

  const customResult = await registry.executeTool('test_custom', 'execute', {
    value: 21,
  });

  if (customResult.success && customResult.data?.doubled === 42) {
    console.log(
      `  ✅ Custom tool works: 21 * 2 = ${customResult.data?.doubled}\n`
    );
    passed++;
  } else {
    console.log('  ❌ Custom tool failed\n');
    failed++;
  }

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true });

  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═══════════════════════════════════════\n');

  if (failed === 0) {
    console.log('✨ All tools verified successfully!\n');
    return 0;
  } else {
    console.log('⚠️  Some tools failed verification.\n');
    return 1;
  }
}

// Run verification
if (require.main === module) {
  verifyTools()
    .then(code => process.exit(code))
    .catch(error => {
      console.error('❌ Verification error:', error);
      process.exit(1);
    });
}

export { verifyTools };
