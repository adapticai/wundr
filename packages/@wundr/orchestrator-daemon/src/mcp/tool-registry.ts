/**
 * MCP Tool Registry - Real, functional tools for orchestrator-daemon
 *
 * Provides a registry of executable MCP tools including:
 * - File operations (read, write)
 * - Bash execution
 * - Web fetching
 * - Integration with neolith-mcp-server tools
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * MCP Tool Registry interface
 */
export interface McpToolRegistry {
  executeTool(
    toolId: string,
    operation: string,
    params: any,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: any;
  }>;
  getTool(toolId: string): McpToolDefinition | undefined;
  listTools(): string[];
  registerTool(tool: McpToolDefinition): void;
  unregisterTool?(toolId: string): boolean;
}

/**
 * MCP Tool Definition
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
  metadata?: Record<string, any>;
}

/**
 * MCP Tool Registry Implementation
 */
export class McpToolRegistryImpl implements McpToolRegistry {
  private tools: Map<string, McpToolDefinition>;
  private logger: Logger;
  private safetyChecks: boolean;

  constructor(options: { safetyChecks?: boolean } = {}) {
    this.tools = new Map();
    this.logger = new Logger('McpToolRegistry');
    this.safetyChecks = options.safetyChecks ?? true;
    this.registerDefaultTools();
  }

  /**
   * Execute a tool by ID
   */
  async executeTool(
    toolId: string,
    operation: string,
    params: any,
  ): Promise<ToolResult> {
    this.logger.info(`Executing tool: ${toolId}, operation: ${operation}`);

    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        message: `Tool not found: ${toolId}`,
        error: `No tool registered with ID: ${toolId}`,
      };
    }

    try {
      const result = await tool.execute(params);
      return {
        success: true,
        message: `Tool ${toolId} executed successfully`,
        data: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tool ${toolId} execution failed: ${errorMessage}`, error);

      return {
        success: false,
        message: `Tool ${toolId} execution failed`,
        error: errorMessage,
      };
    }
  }

  /**
   * Get a tool definition
   */
  getTool(toolId: string): McpToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * List all registered tool IDs
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: McpToolDefinition): void {
    this.logger.info(`Registering tool: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  /**
   * Register default built-in tools
   */
  private registerDefaultTools(): void {
    // File Read Tool
    this.registerTool({
      name: 'file_read',
      description: 'Read contents of a file from the filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file',
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
          },
        },
        required: ['path'],
      },
      execute: async (params: { path: string; encoding?: string }) => {
        const { path: filePath, encoding = 'utf8' } = params;

        // Security check
        if (this.safetyChecks && this.isPathDangerous(filePath)) {
          throw new Error(`Access denied: Path is unsafe - ${filePath}`);
        }

        const resolvedPath = path.resolve(filePath);
        const content = await fs.readFile(resolvedPath, encoding as BufferEncoding);

        return {
          path: resolvedPath,
          content,
          size: Buffer.byteLength(content),
          encoding,
        };
      },
    });

    // File Write Tool
    this.registerTool({
      name: 'file_write',
      description: 'Write content to a file on the filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
          },
          createDirectories: {
            type: 'boolean',
            description: 'Create parent directories if they do not exist',
            default: true,
          },
        },
        required: ['path', 'content'],
      },
      execute: async (params: {
        path: string;
        content: string;
        encoding?: string;
        createDirectories?: boolean;
      }) => {
        const {
          path: filePath,
          content,
          encoding = 'utf8',
          createDirectories = true,
        } = params;

        // Security check
        if (this.safetyChecks && this.isPathDangerous(filePath)) {
          throw new Error(`Access denied: Path is unsafe - ${filePath}`);
        }

        const resolvedPath = path.resolve(filePath);

        // Create parent directories if needed
        if (createDirectories) {
          const dir = path.dirname(resolvedPath);
          await fs.mkdir(dir, { recursive: true });
        }

        await fs.writeFile(resolvedPath, content, encoding as BufferEncoding);

        return {
          path: resolvedPath,
          size: Buffer.byteLength(content),
          encoding,
        };
      },
    });

    // Bash Execute Tool
    this.registerTool({
      name: 'bash_execute',
      description: 'Execute a bash command with safety checks',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Bash command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Working directory for the command',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['command'],
      },
      execute: async (params: {
        command: string;
        cwd?: string;
        timeout?: number;
      }) => {
        const { command, cwd, timeout = 30000 } = params;

        // Safety checks for dangerous commands
        if (this.safetyChecks && this.isCommandDangerous(command)) {
          throw new Error(
            `Command rejected: Contains potentially dangerous operations - ${command}`,
          );
        }

        const options: any = {
          timeout,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        };

        if (cwd) {
          options.cwd = path.resolve(cwd);
        }

        const { stdout, stderr } = await execAsync(command, options);

        return {
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
          exitCode: 0,
          command,
        };
      },
    });

    // Web Fetch Tool
    this.registerTool({
      name: 'web_fetch',
      description: 'Fetch content from a URL via HTTP/HTTPS',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch',
          },
          method: {
            type: 'string',
            description: 'HTTP method (GET, POST, etc.)',
            default: 'GET',
          },
          headers: {
            type: 'object',
            description: 'HTTP headers',
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in milliseconds (default: 10000)',
            default: 10000,
          },
        },
        required: ['url'],
      },
      execute: async (params: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        timeout?: number;
      }) => {
        const { url, method = 'GET', headers = {}, timeout = 10000 } = params;

        // Validate URL
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error(`Unsupported protocol: ${urlObj.protocol}`);
        }

        return new Promise((resolve, reject) => {
          const client = urlObj.protocol === 'https:' ? https : http;

          const options = {
            method,
            headers: {
              'User-Agent': 'Wundr-OrchestratorDaemon/1.0',
              ...headers,
            },
            timeout,
          };

          const req = client.request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
              data += chunk;
            });

            res.on('end', () => {
              resolve({
                url,
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                headers: res.headers,
                body: data,
                size: Buffer.byteLength(data),
              });
            });
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
          });

          req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
          });

          req.end();
        });
      },
    });

    // File List Tool
    this.registerTool({
      name: 'file_list',
      description: 'List files and directories in a path',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list',
          },
          recursive: {
            type: 'boolean',
            description: 'List files recursively',
            default: false,
          },
        },
        required: ['path'],
      },
      execute: async (params: { path: string; recursive?: boolean }) => {
        const { path: dirPath, recursive = false } = params;

        if (this.safetyChecks && this.isPathDangerous(dirPath)) {
          throw new Error(`Access denied: Path is unsafe - ${dirPath}`);
        }

        const resolvedPath = path.resolve(dirPath);
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

        const files = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(resolvedPath, entry.name);
            const stats = await fs.stat(fullPath);

            return {
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime,
            };
          }),
        );

        return {
          path: resolvedPath,
          count: files.length,
          files,
        };
      },
    });

    // File Delete Tool
    this.registerTool({
      name: 'file_delete',
      description: 'Delete a file or directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to delete',
          },
          recursive: {
            type: 'boolean',
            description: 'Recursively delete directories',
            default: false,
          },
        },
        required: ['path'],
      },
      execute: async (params: { path: string; recursive?: boolean }) => {
        const { path: targetPath, recursive = false } = params;

        if (this.safetyChecks && this.isPathDangerous(targetPath)) {
          throw new Error(`Access denied: Path is unsafe - ${targetPath}`);
        }

        const resolvedPath = path.resolve(targetPath);
        const stats = await fs.stat(resolvedPath);

        if (stats.isDirectory()) {
          await fs.rm(resolvedPath, { recursive, force: true });
        } else {
          await fs.unlink(resolvedPath);
        }

        return {
          path: resolvedPath,
          deleted: true,
          type: stats.isDirectory() ? 'directory' : 'file',
        };
      },
    });

    this.logger.info(
      `Registered ${this.tools.size} default tools: ${this.listTools().join(', ')}`,
    );
  }

  /**
   * Check if a path is potentially dangerous
   */
  private isPathDangerous(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(filePath);

    // Check for path traversal in the input
    if (filePath.includes('..')) {
      return true;
    }

    // Allow temp directories
    const tmpDir = path.normalize(require('os').tmpdir());
    if (resolved.startsWith(tmpDir)) {
      return false;
    }

    // Allow current working directory and subdirectories
    const cwd = process.cwd();
    if (resolved.startsWith(cwd)) {
      return false;
    }

    // Allow user home directory
    const homeDir = require('os').homedir();
    if (resolved.startsWith(homeDir)) {
      return false;
    }

    // Check for critical system directories (only block direct access to these roots)
    const criticalPaths = ['/etc/', '/sys/', '/proc/', '/dev/'];
    for (const critical of criticalPaths) {
      if (resolved === critical.slice(0, -1) || resolved.startsWith(critical)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a command is potentially dangerous
   */
  private isCommandDangerous(command: string): boolean {
    const dangerous = [
      'rm -rf /',
      'rm -rf /*',
      'mkfs',
      'dd if=/dev/zero',
      ':(){:|:&};:',  // Fork bomb
      'curl | sh',
      'wget | sh',
      '> /dev/sda',
    ];

    for (const pattern of dangerous) {
      if (command.includes(pattern)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a default MCP tool registry instance
 */
export function createMcpToolRegistry(
  options: { safetyChecks?: boolean } = {},
): McpToolRegistry {
  return new McpToolRegistryImpl(options);
}
