/**
 * Unit tests for MCP Server
 */

import {
  MCPServer,
  createMCPServer,
  MCPServerOptions,
} from '../../src/server/MCPServer';

describe('MCPServer', () => {
  let server: MCPServer;
  const defaultOptions: MCPServerOptions = {
    name: 'test-server',
    version: '1.0.0',
    description: 'Test MCP server',
  };

  beforeEach(() => {
    server = createMCPServer(defaultOptions);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('createMCPServer', () => {
    it('should create a server instance with default options', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(MCPServer);
    });

    it('should configure server with provided options', () => {
      const customServer = createMCPServer({
        name: 'custom-server',
        version: '2.0.0',
        description: 'Custom test server',
      });

      expect(customServer).toBeDefined();
    });
  });

  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      const tool = {
        tool: {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object' as const,
            properties: {
              message: { type: 'string' },
            },
          },
        },
        handler: async () => ({
          content: [{ type: 'text' as const, text: 'Success' }],
        }),
      };

      expect(() => server.registerTool(tool)).not.toThrow();
    });

    it('should throw when registering duplicate tool', () => {
      const tool = {
        tool: {
          name: 'duplicate-tool',
          description: 'A duplicate tool',
          inputSchema: { type: 'object' as const, properties: {} },
        },
        handler: async () => ({
          content: [{ type: 'text' as const, text: 'Success' }],
        }),
      };

      server.registerTool(tool);
      expect(() => server.registerTool(tool)).toThrow();
    });
  });

  describe('registerResource', () => {
    it('should register a resource successfully', () => {
      const resource = {
        resource: {
          uri: 'test://resource',
          name: 'Test Resource',
          description: 'A test resource',
          mimeType: 'application/json',
        },
        handler: async () => ({
          uri: 'test://resource',
          mimeType: 'application/json',
          text: '{}',
        }),
      };

      expect(() => server.registerResource(resource)).not.toThrow();
    });
  });

  describe('registerPrompt', () => {
    it('should register a prompt successfully', () => {
      const prompt = {
        prompt: {
          name: 'test-prompt',
          description: 'A test prompt',
        },
        handler: async () => ({
          description: 'Test prompt result',
          messages: [
            {
              role: 'user' as const,
              content: { type: 'text' as const, text: 'Hello' },
            },
          ],
        }),
      };

      expect(() => server.registerPrompt(prompt)).not.toThrow();
    });
  });
});

describe('Server Configuration', () => {
  it('should accept logging configuration', () => {
    const server = createMCPServer({
      name: 'logging-test',
      version: '1.0.0',
      logging: {
        level: 'debug',
      },
    });

    expect(server).toBeDefined();
  });

  it('should accept capabilities configuration', () => {
    const server = createMCPServer({
      name: 'capabilities-test',
      version: '1.0.0',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    });

    expect(server).toBeDefined();
  });
});
