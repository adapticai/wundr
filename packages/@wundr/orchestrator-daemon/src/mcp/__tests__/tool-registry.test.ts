/**
 * MCP Tool Registry Tests
 */


import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createMcpToolRegistry } from '../tool-registry';

import type { McpToolRegistry } from '../tool-registry';

describe('McpToolRegistry', () => {
  let registry: McpToolRegistry;
  let tempDir: string;

  beforeEach(async () => {
    registry = createMcpToolRegistry({ safetyChecks: true });
    // Resolve the real path to handle macOS symlinks (/var -> /private/var)
    tempDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-')));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Tool Registration', () => {
    test('should list all registered tools', () => {
      const tools = registry.listTools();
      expect(tools).toContain('file_read');
      expect(tools).toContain('file_write');
      expect(tools).toContain('bash_execute');
      expect(tools).toContain('web_fetch');
      expect(tools).toContain('file_list');
      expect(tools).toContain('file_delete');
    });

    test('should get tool definition', () => {
      const tool = registry.getTool('file_read');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('file_read');
      expect(tool?.description).toBeTruthy();
      expect(tool?.inputSchema).toBeDefined();
    });

    test('should return undefined for non-existent tool', () => {
      const tool = registry.getTool('non_existent_tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('File Read Tool', () => {
    test('should read file content', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const testContent = 'Hello, World!';
      await fs.writeFile(testFile, testContent);

      const result = await registry.executeTool('file_read', 'read', {
        path: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe(testContent);
      expect(result.data?.encoding).toBe('utf8');
    });

    test('should fail on non-existent file', async () => {
      const result = await registry.executeTool('file_read', 'read', {
        path: path.join(tempDir, 'non-existent.txt'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('File Write Tool', () => {
    test('should write file content', async () => {
      const testFile = path.join(tempDir, 'write-test.txt');
      const testContent = 'Test content';

      const result = await registry.executeTool('file_write', 'write', {
        path: testFile,
        content: testContent,
      });

      expect(result.success).toBe(true);
      expect(result.data?.path).toBe(testFile);

      // Verify file was actually written
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe(testContent);
    });

    test('should create parent directories', async () => {
      const testFile = path.join(tempDir, 'nested', 'dir', 'test.txt');
      const testContent = 'Nested content';

      const result = await registry.executeTool('file_write', 'write', {
        path: testFile,
        content: testContent,
        createDirectories: true,
      });

      expect(result.success).toBe(true);

      // Verify file was created in nested directory
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe(testContent);
    });
  });

  describe('Bash Execute Tool', () => {
    test('should execute simple command', async () => {
      const result = await registry.executeTool('bash_execute', 'execute', {
        command: 'echo "test"',
      });

      expect(result.success).toBe(true);
      expect(result.data?.stdout).toBe('test');
      expect(result.data?.exitCode).toBe(0);
    });

    test('should reject dangerous commands', async () => {
      const result = await registry.executeTool('bash_execute', 'execute', {
        command: 'rm -rf /',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('dangerous');
    });

    test('should execute command in specific directory', async () => {
      const result = await registry.executeTool('bash_execute', 'execute', {
        command: 'pwd',
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      // tempDir is already resolved via fs.realpath in beforeEach
      expect(result.data?.stdout).toBe(tempDir);
    });
  });

  describe('File List Tool', () => {
    test('should list files in directory', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(tempDir, 'subdir'));

      const result = await registry.executeTool('file_list', 'list', {
        path: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(3);
      expect(result.data?.files).toHaveLength(3);

      const fileNames = result.data?.files.map((f: any) => f.name);
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('file2.txt');
      expect(fileNames).toContain('subdir');
    });
  });

  describe('File Delete Tool', () => {
    test('should delete file', async () => {
      const testFile = path.join(tempDir, 'delete-test.txt');
      await fs.writeFile(testFile, 'to be deleted');

      const result = await registry.executeTool('file_delete', 'delete', {
        path: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(true);

      // Verify file was deleted
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    test('should delete directory recursively', async () => {
      const testDir = path.join(tempDir, 'delete-dir');
      await fs.mkdir(testDir);
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content');

      const result = await registry.executeTool('file_delete', 'delete', {
        path: testDir,
        recursive: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('directory');

      // Verify directory was deleted
      await expect(fs.access(testDir)).rejects.toThrow();
    });
  });

  describe('Web Fetch Tool', () => {
    test('should fetch URL content', async () => {
      // Use a reliable test endpoint
      const result = await registry.executeTool('web_fetch', 'fetch', {
        url: 'https://httpbin.org/get',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data?.statusCode).toBe(200);
      expect(result.data?.body).toBeTruthy();
    }, 10000); // Increased timeout for network request

    test('should reject invalid protocols', async () => {
      const result = await registry.executeTool('web_fetch', 'fetch', {
        url: 'file:///etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('protocol');
    });
  });

  describe('Safety Checks', () => {
    test('should block path traversal attempts', async () => {
      const result = await registry.executeTool('file_read', 'read', {
        path: '../../etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('unsafe');
    });

    test('should block system directory access', async () => {
      const result = await registry.executeTool('file_read', 'read', {
        path: '/etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('unsafe');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent tool gracefully', async () => {
      const result = await registry.executeTool(
        'non_existent_tool',
        'operation',
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tool registered with ID');
    });

    test('should handle tool execution errors', async () => {
      const result = await registry.executeTool('bash_execute', 'execute', {
        command: 'exit 1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
