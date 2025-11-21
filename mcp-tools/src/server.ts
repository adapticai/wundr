#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types';

// Import tool handlers
import { DriftDetectionHandler } from './tools/governance/drift-detection-handler.js';
import { PatternStandardizeHandler } from './tools/standardization/pattern-standardize-handler.js';
import { MonorepoManageHandler } from './tools/monorepo/monorepo-manage-handler.js';
import { GovernanceReportHandler } from './tools/governance/governance-report-handler.js';
import { DependencyAnalyzeHandler } from './tools/analysis/dependency-analyze-handler.js';
import { TestBaselineHandler } from './tools/testing/test-baseline-handler.js';
import { ClaudeConfigHandler } from './tools/config/claude-config-handler.js';

// RAG tool handlers
import { RagFileSearchHandler } from './tools/rag/rag-file-search-handler.js';
import { RagStoreManageHandler } from './tools/rag/rag-store-manage-handler.js';
import { RagContextBuilderHandler } from './tools/rag/rag-context-builder-handler.js';

// Define common handler interface
interface ToolHandler {
  execute(args: any): Promise<string>;
}

class WundrMCPServer {
  private server: Server;
  private handlers: Map<string, ToolHandler>;

  constructor() {
    this.server = new Server(
      {
        name: 'wundr-mcp-tools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize handlers
    this.handlers = new Map<string, ToolHandler>();
    this.handlers.set('drift_detection', new DriftDetectionHandler());
    this.handlers.set('pattern_standardize', new PatternStandardizeHandler());
    this.handlers.set('monorepo_manage', new MonorepoManageHandler());
    this.handlers.set('governance_report', new GovernanceReportHandler());
    this.handlers.set('dependency_analyze', new DependencyAnalyzeHandler());
    this.handlers.set('test_baseline', new TestBaselineHandler());
    this.handlers.set('claude_config', new ClaudeConfigHandler());

    // RAG tool handlers
    this.handlers.set('rag_file_search', new RagFileSearchHandler());
    this.handlers.set('rag_store_manage', new RagStoreManageHandler());
    this.handlers.set('rag_context_builder', new RagContextBuilderHandler());

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'drift_detection',
          description: 'Detect code drift by comparing against baselines',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['create-baseline', 'detect', 'list-baselines', 'trends'],
                description: 'The drift detection action to perform',
              },
              baselineVersion: {
                type: 'string',
                description: 'Baseline version to compare against (optional, defaults to latest)',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'pattern_standardize',
          description: 'Apply standardization rules to fix code patterns',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['run', 'review', 'check'],
                description: 'The standardization action',
              },
              rules: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific rules to apply (optional)',
              },
              dryRun: {
                type: 'boolean',
                description: 'Preview changes without applying them',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'monorepo_manage',
          description: 'Initialize and manage monorepo structure',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['init', 'plan', 'add-package', 'check-deps'],
                description: 'The monorepo management action',
              },
              packageName: {
                type: 'string',
                description: 'Package name for add-package action',
              },
              packageType: {
                type: 'string',
                enum: ['app', 'package', 'tool'],
                description: 'Type of package to create',
              },
              analysisReport: {
                type: 'string',
                description: 'Path to analysis report for migration planning',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'governance_report',
          description: 'Generate governance reports and enforce standards',
          inputSchema: {
            type: 'object',
            properties: {
              reportType: {
                type: 'string',
                enum: ['weekly', 'drift', 'quality', 'compliance'],
                description: 'Type of governance report to generate',
              },
              format: {
                type: 'string',
                enum: ['markdown', 'json', 'html'],
                description: 'Output format for the report',
              },
              period: {
                type: 'string',
                description: 'Time period for the report (e.g., "7d", "30d")',
              },
            },
            required: ['reportType'],
          },
        },
        {
          name: 'dependency_analyze',
          description: 'Analyze and map dependencies in the codebase',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                enum: ['all', 'circular', 'unused', 'external'],
                description: 'Scope of dependency analysis',
              },
              target: {
                type: 'string',
                description: 'Specific package or directory to analyze',
              },
              outputFormat: {
                type: 'string',
                enum: ['graph', 'json', 'markdown'],
                description: 'Format for analysis output',
              },
            },
            required: ['scope'],
          },
        },
        {
          name: 'test_baseline',
          description: 'Create and manage test coverage baselines',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['create', 'compare', 'update'],
                description: 'Test baseline action',
              },
              testType: {
                type: 'string',
                enum: ['unit', 'integration', 'e2e', 'all'],
                description: 'Type of tests to baseline',
              },
              threshold: {
                type: 'number',
                description: 'Coverage threshold percentage',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'claude_config',
          description: 'Generate optimized Claude Code configuration',
          inputSchema: {
            type: 'object',
            properties: {
              configType: {
                type: 'string',
                enum: ['claude-md', 'hooks', 'conventions', 'all'],
                description: 'Type of configuration to generate',
              },
              features: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific features to configure',
              },
            },
            required: ['configType'],
          },
        },
        // RAG Tools
        {
          name: 'rag_file_search',
          description: 'Search files using semantic, keyword, or hybrid search with relevance scoring',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query string',
              },
              paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Paths to search within (defaults to current directory)',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
              minScore: {
                type: 'number',
                description: 'Minimum relevance score threshold 0-1 (default: 0.3)',
              },
              mode: {
                type: 'string',
                enum: ['semantic', 'keyword', 'hybrid'],
                description: 'Search mode (default: hybrid)',
              },
              includeContent: {
                type: 'boolean',
                description: 'Include file content snippets in results (default: true)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'rag_store_manage',
          description: 'Create, manage, and maintain vector stores for RAG operations',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['create', 'delete', 'list', 'status', 'index', 'clear', 'optimize', 'backup', 'restore'],
                description: 'Store management action to perform',
              },
              storeName: {
                type: 'string',
                description: 'Store name/identifier',
              },
              config: {
                type: 'object',
                description: 'Store configuration for create action',
                properties: {
                  type: { type: 'string', enum: ['memory', 'chromadb', 'pinecone', 'qdrant', 'weaviate'] },
                  embeddingModel: { type: 'string', enum: ['openai', 'cohere', 'local', 'custom'] },
                  dimensions: { type: 'number' },
                },
              },
              indexPaths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Paths to index for index action',
              },
              backupPath: {
                type: 'string',
                description: 'Backup/restore file path',
              },
              force: {
                type: 'boolean',
                description: 'Force operation without confirmation',
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'rag_context_builder',
          description: 'Build optimal context for LLM queries using multiple sources and strategies',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Query or topic for context building',
              },
              strategy: {
                type: 'string',
                enum: ['relevant', 'recent', 'comprehensive', 'focused', 'custom'],
                description: 'Context building strategy (default: relevant)',
              },
              sources: {
                type: 'array',
                items: { type: 'string', enum: ['files', 'store', 'memory', 'combined'] },
                description: 'Sources to include in context (default: combined)',
              },
              maxTokens: {
                type: 'number',
                description: 'Maximum context tokens/length (default: 4000)',
              },
              storeName: {
                type: 'string',
                description: 'Store name to query',
              },
              additionalPaths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional file paths to include',
              },
              includeCode: {
                type: 'boolean',
                description: 'Include code snippets in context (default: true)',
              },
              includeDocs: {
                type: 'boolean',
                description: 'Include documentation in context (default: true)',
              },
              format: {
                type: 'string',
                enum: ['plain', 'markdown', 'structured'],
                description: 'Output format (default: markdown)',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      const handler = this.handlers.get(name);
      if (!handler) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      try {
        const result = await handler.execute(args);
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Wundr MCP Tools server started');
  }
}

// Start the server
if (require.main === module) {
  const server = new WundrMCPServer();
  server.run().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}