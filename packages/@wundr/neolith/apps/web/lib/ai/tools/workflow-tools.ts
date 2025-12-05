/**
 * Workflow Management Tools
 *
 * Tools for creating, managing, and executing workflows via AI.
 */

import { registerTool } from './index';
import type { ToolContext, ToolResult } from './index';

/**
 * Create Workflow Tool
 */
registerTool({
  name: 'create_workflow',
  description: 'Create a new workflow with specified steps and configuration',
  category: 'workflow',
  requiredPermissions: ['workflow:create'],
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the workflow',
      },
      description: {
        type: 'string',
        description: 'Description of what the workflow does',
      },
      trigger: {
        type: 'string',
        description: 'Trigger type',
        enum: ['manual', 'scheduled', 'event', 'webhook'],
      },
      steps: {
        type: 'array',
        description: 'Array of workflow steps',
        items: {
          type: 'object',
          description: 'Workflow step definition',
          properties: {
            name: { type: 'string', description: 'Step name' },
            type: { type: 'string', description: 'Step type' },
            config: { type: 'object', description: 'Step configuration' },
          },
        },
      },
      schedule: {
        type: 'string',
        description: 'Cron expression for scheduled workflows',
      },
    },
    required: ['name', 'description', 'trigger', 'steps'],
  },
  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult<{ workflowId: string; status: string }>> {
    const { name, description, trigger, steps, schedule } = input as {
      name: string;
      description: string;
      trigger: string;
      steps: Array<{
        name: string;
        type: string;
        config: Record<string, unknown>;
      }>;
      schedule?: string;
    };
    try {
      // Create workflow via API
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            config: {
              trigger,
              schedule,
              steps,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create workflow: ${response.statusText}`);
      }

      const workflow = await response.json();

      return {
        success: true,
        data: {
          workflowId: workflow.id,
          status: 'created',
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create workflow',
      };
    }
  },
});

/**
 * List Workflows Tool
 */
registerTool({
  name: 'list_workflows',
  description: 'List all workflows in the workspace with optional filtering',
  category: 'workflow',
  requiredPermissions: ['workflow:read'],
  cacheable: true,
  cacheTTL: 60, // Cache for 1 minute
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by workflow status',
        enum: ['active', 'inactive', 'draft', 'archived'],
      },
      search: {
        type: 'string',
        description: 'Search workflows by name or description',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of workflows to return',
        default: 20,
      },
    },
  },
  async execute(
    input: { status?: string; search?: string; limit?: number },
    context: ToolContext
  ): Promise<
    ToolResult<
      Array<{ id: string; name: string; status: string; lastRun?: string }>
    >
  > {
    try {
      const params = new URLSearchParams();
      if (input.status) params.append('status', input.status);
      if (input.search) params.append('search', input.search);
      if (input.limit) params.append('limit', input.limit.toString());

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/workflows?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }

      const workflows = await response.json();

      return {
        success: true,
        data: workflows.map((w: any) => ({
          id: w.id,
          name: w.name,
          status: w.status,
          lastRun: w.lastExecutedAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to list workflows',
      };
    }
  },
});

/**
 * Execute Workflow Tool
 */
registerTool({
  name: 'execute_workflow',
  description: 'Execute a workflow with optional input parameters',
  category: 'workflow',
  requiredPermissions: ['workflow:execute'],
  requiresApproval: true, // Requires approval for sensitive operation
  parameters: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'ID of the workflow to execute',
      },
      input: {
        type: 'object',
        description: 'Input parameters for the workflow',
      },
      async: {
        type: 'boolean',
        description: 'Whether to execute asynchronously',
        default: false,
      },
    },
    required: ['workflowId'],
  },
  async execute(
    input: {
      workflowId: string;
      input?: Record<string, unknown>;
      async?: boolean;
    },
    context: ToolContext
  ): Promise<
    ToolResult<{ executionId: string; status: string; result?: unknown }>
  > {
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/workflows/${input.workflowId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: input.input || {},
            async: input.async || false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to execute workflow: ${response.statusText}`);
      }

      const execution = await response.json();

      return {
        success: true,
        data: {
          executionId: execution.id,
          status: execution.status,
          result: execution.result,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to execute workflow',
      };
    }
  },
});

/**
 * Get Workflow Status Tool
 */
registerTool({
  name: 'get_workflow_status',
  description: 'Get the current status and details of a workflow',
  category: 'workflow',
  requiredPermissions: ['workflow:read'],
  cacheable: true,
  cacheTTL: 30,
  parameters: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'ID of the workflow',
      },
    },
    required: ['workflowId'],
  },
  async execute(
    input: { workflowId: string },
    context: ToolContext
  ): Promise<
    ToolResult<{
      status: string;
      lastRun?: string;
      nextRun?: string;
      stats: Record<string, number>;
    }>
  > {
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/workflows/${input.workflowId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow: ${response.statusText}`);
      }

      const workflow = await response.json();

      return {
        success: true,
        data: {
          status: workflow.status,
          lastRun: workflow.lastExecutedAt,
          nextRun: workflow.nextScheduledAt,
          stats: {
            totalRuns: workflow.executionCount || 0,
            successRate: workflow.successRate || 0,
            avgDuration: workflow.avgDuration || 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get workflow status',
      };
    }
  },
});

/**
 * Update Workflow Tool
 */
registerTool({
  name: 'update_workflow',
  description: 'Update workflow configuration, steps, or settings',
  category: 'workflow',
  requiredPermissions: ['workflow:update'],
  parameters: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'ID of the workflow to update',
      },
      name: {
        type: 'string',
        description: 'New name for the workflow',
      },
      description: {
        type: 'string',
        description: 'New description',
      },
      status: {
        type: 'string',
        description: 'New status',
        enum: ['active', 'inactive', 'draft'],
      },
      steps: {
        type: 'array',
        description: 'Updated workflow steps',
        items: {
          type: 'object',
          description: 'Workflow step object',
        },
      },
    },
    required: ['workflowId'],
  },
  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult<{ success: boolean }>> {
    const { workflowId, name, description, status, steps } = input as {
      workflowId: string;
      name?: string;
      description?: string;
      status?: string;
      steps?: Array<Record<string, unknown>>;
    };
    try {
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (status) updateData.status = status;
      if (steps) updateData.config = { steps };

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/workflows/${workflowId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update workflow: ${response.statusText}`);
      }

      return {
        success: true,
        data: { success: true },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update workflow',
      };
    }
  },
});

/**
 * Delete Workflow Tool
 */
registerTool({
  name: 'delete_workflow',
  description: 'Delete a workflow permanently',
  category: 'workflow',
  requiredPermissions: ['workflow:delete'],
  requiresApproval: true, // Sensitive operation
  parameters: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'ID of the workflow to delete',
      },
    },
    required: ['workflowId'],
  },
  async execute(
    input: { workflowId: string },
    context: ToolContext
  ): Promise<ToolResult<{ success: boolean }>> {
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/workflows/${input.workflowId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete workflow: ${response.statusText}`);
      }

      return {
        success: true,
        data: { success: true },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete workflow',
      };
    }
  },
});
