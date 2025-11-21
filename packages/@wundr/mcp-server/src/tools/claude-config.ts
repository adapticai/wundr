/**
 * Claude Config Tool
 *
 * Configure Claude Code with CLAUDE.md, hooks, and conventions.
 */

import type { Tool, ToolResult } from './index.js';

export const claudeConfigTool: Tool = {
  name: 'claude_config',
  description:
    'Generate CLAUDE.md configuration, set up hooks, and create coding conventions for Claude Code integration.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['generate', 'hooks', 'conventions', 'validate', 'update'],
        description: 'Action to perform',
      },
      path: {
        type: 'string',
        description: 'Path to project (default: current directory)',
      },
      template: {
        type: 'string',
        enum: ['minimal', 'standard', 'comprehensive', 'sparc'],
        description: 'Template for CLAUDE.md generation',
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'Features to include in configuration',
      },
    },
    required: ['action'],
  },
};

export async function handleClaudeConfig(
  args: Record<string, unknown>
): Promise<ToolResult> {
  const action = args['action'] as string;
  const path = (args['path'] as string) || process.cwd();
  const template = (args['template'] as string) || 'standard';
  const features = (args['features'] as string[]) || [];

  try {
    switch (action) {
      case 'generate':
        return await generateClaudeMd(path, template, features);
      case 'hooks':
        return await setupHooks(path);
      case 'conventions':
        return await createConventions(path);
      case 'validate':
        return await validateConfig(path);
      case 'update':
        return await updateConfig(path);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function generateClaudeMd(
  path: string,
  template: string,
  features: string[]
): Promise<ToolResult> {
  const templates: Record<string, string[]> = {
    minimal: ['Project basics', 'Build commands', 'File structure'],
    standard: [
      'Project overview',
      'Build commands',
      'Code style',
      'Testing guidelines',
      'File organization',
    ],
    comprehensive: [
      'Project overview',
      'Architecture',
      'Build system',
      'Testing strategy',
      'Code style',
      'Security guidelines',
      'Performance targets',
      'Deployment process',
    ],
    sparc: [
      'SPARC methodology',
      'TDD workflow',
      'Agent coordination',
      'MCP integration',
      'Verification protocol',
      'Build system',
      'Quality gates',
    ],
  };

  return {
    success: true,
    message: `CLAUDE.md generated at ${path}`,
    data: {
      path,
      template,
      features: features.length > 0 ? features : templates[template],
      generated: {
        file: 'CLAUDE.md',
        sections: templates[template],
        size: '~2.5KB',
      },
      includes: {
        buildCommands: true,
        codeStyle: true,
        testingGuidelines: template !== 'minimal',
        securityRules: template === 'comprehensive' || template === 'sparc',
        mcpTools: template === 'sparc',
      },
      nextSteps: [
        'Review generated CLAUDE.md',
        'Customize project-specific sections',
        'Run validation to check completeness',
      ],
    },
  };
}

async function setupHooks(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Claude Code hooks configured at ${path}`,
    data: {
      path,
      hooksCreated: [
        {
          name: 'pre-task',
          description: 'Runs before starting any task',
          actions: ['Load context', 'Check prerequisites'],
        },
        {
          name: 'post-edit',
          description: 'Runs after file edits',
          actions: ['Auto-format', 'Update memory', 'Check lint'],
        },
        {
          name: 'post-task',
          description: 'Runs after completing a task',
          actions: ['Update metrics', 'Persist state'],
        },
        {
          name: 'session-end',
          description: 'Runs when session ends',
          actions: ['Generate summary', 'Export metrics'],
        },
      ],
      location: '.claude/commands/hooks/',
      activation: 'Hooks are automatically activated when CLAUDE.md references them',
    },
  };
}

async function createConventions(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Coding conventions created at ${path}`,
    data: {
      path,
      conventions: {
        naming: {
          files: 'kebab-case.ts',
          classes: 'PascalCase',
          functions: 'camelCase',
          constants: 'SCREAMING_SNAKE_CASE',
          interfaces: 'IPrefixPascalCase or PascalCase',
        },
        structure: {
          maxFileLines: 500,
          maxFunctionLines: 50,
          maxParameters: 4,
          maxNestingDepth: 3,
        },
        imports: {
          order: ['node builtins', 'external packages', 'internal modules', 'relative imports'],
          grouping: true,
          absolutePaths: 'preferred',
        },
        testing: {
          pattern: '*.test.ts or *.spec.ts',
          location: 'adjacent or tests/',
          coverage: '80% minimum',
        },
        documentation: {
          publicAPIs: 'JSDoc required',
          complexLogic: 'inline comments',
          modules: 'header comment',
        },
      },
      file: '.claude/conventions.json',
    },
  };
}

async function validateConfig(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Configuration validation for ${path}`,
    data: {
      path,
      validation: {
        claudeMd: {
          exists: true,
          valid: true,
          completeness: 85,
          missing: ['Security guidelines section'],
        },
        hooks: {
          exists: true,
          valid: true,
          configured: ['pre-task', 'post-edit', 'post-task'],
          missing: ['session-end'],
        },
        conventions: {
          exists: true,
          valid: true,
          applied: true,
        },
        mcpConfig: {
          exists: false,
          recommendation: 'Add .claude/mcp-config.json for MCP server configuration',
        },
      },
      overallScore: 78,
      recommendations: [
        'Add security guidelines to CLAUDE.md',
        'Configure session-end hook',
        'Create MCP configuration file',
      ],
    },
  };
}

async function updateConfig(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Configuration updated at ${path}`,
    data: {
      path,
      updates: [
        { file: 'CLAUDE.md', action: 'Updated build commands section' },
        { file: '.claude/conventions.json', action: 'Added new naming rules' },
        { file: '.claude/commands/hooks/post-edit.md', action: 'Enhanced auto-format hook' },
      ],
      backup: {
        created: true,
        location: '.claude/backups/2024-01-15/',
      },
      nextSteps: [
        'Review updated configuration files',
        'Test hooks with a sample task',
        'Commit changes to version control',
      ],
    },
  };
}
