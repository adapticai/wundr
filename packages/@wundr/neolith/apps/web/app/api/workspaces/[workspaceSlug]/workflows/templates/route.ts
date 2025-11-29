/**
 * Workflow Templates API Routes
 *
 * Handles listing available templates and creating workflows from templates.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/templates - List templates
 * - POST /api/workspaces/:workspaceId/workflows/templates - Create workflow from template
 *
 * @module app/api/workspaces/[workspaceId]/workflows/templates/route
 */

import { prisma } from '@neolith/database';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import type { CreateFromTemplateInput, TemplateFiltersInput, WorkflowTemplate } from '@/lib/validations/workflow';
import {
  createErrorResponse,
  createFromTemplateSchema,
  templateFiltersSchema,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

/**
 * Route context with workspaceId parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Built-in workflow templates
 */
const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'template-welcome-new-member',
    name: 'Welcome New Members',
    description: 'Send a welcome message when a new member joins the workspace',
    category: 'onboarding',
    trigger: {
      type: 'member.joined',
      config: {},
      conditions: [],
    },
    actions: [
      {
        type: 'message.send',
        name: 'Send Welcome Message',
        config: {
          channel: '{{trigger.channelId}}',
          message: 'Welcome to the workspace, {{trigger.user.name}}! Feel free to introduce yourself.',
        },
        conditions: [],
        onError: 'continue',
      },
    ],
    tags: ['onboarding', 'welcome', 'new-member'],
    isBuiltIn: true,
  },
  {
    id: 'template-notify-channel-created',
    name: 'Notify on Channel Creation',
    description: 'Send a notification to a designated channel when a new channel is created',
    category: 'notifications',
    trigger: {
      type: 'channel.created',
      config: {},
      conditions: [],
    },
    actions: [
      {
        type: 'notification.send',
        name: 'Send Channel Creation Notification',
        config: {
          targetChannel: 'general',
          message: 'A new channel "{{trigger.channel.name}}" was created by {{trigger.createdBy.name}}',
        },
        conditions: [],
        onError: 'continue',
      },
    ],
    tags: ['notifications', 'channels'],
    isBuiltIn: true,
  },
  {
    id: 'template-orchestrator-status-monitor',
    name: 'Orchestrator Status Monitor',
    description: 'Notify admins when an Orchestrator goes offline unexpectedly',
    category: 'automation',
    trigger: {
      type: 'orchestrator.status_changed',
      config: {},
      conditions: [
        { field: 'newStatus', operator: 'equals', value: 'OFFLINE' },
      ],
    },
    actions: [
      {
        type: 'notification.send',
        name: 'Notify Admins',
        config: {
          targetRole: 'ADMIN',
          message: 'Orchestrator "{{trigger.orchestrator.name}}" has gone offline',
          priority: 'high',
        },
        conditions: [],
        onError: 'continue',
      },
    ],
    tags: ['orchestrator', 'monitoring', 'alerts'],
    isBuiltIn: true,
  },
  {
    id: 'template-daily-summary',
    name: 'Daily Summary Report',
    description: 'Send a daily summary of workspace activity',
    category: 'scheduling',
    trigger: {
      type: 'schedule.cron',
      config: {
        cron: '0 9 * * *', // Every day at 9 AM
        timezone: 'UTC',
      },
      conditions: [],
    },
    actions: [
      {
        type: 'message.send',
        name: 'Post Daily Summary',
        config: {
          channel: 'general',
          message: 'Daily Activity Summary:\n- Messages: {{stats.messageCount}}\n- Active Orchestrators: {{stats.activeOrchestratorCount}}\n- New Members: {{stats.newMemberCount}}',
        },
        conditions: [],
        onError: 'continue',
      },
    ],
    tags: ['scheduling', 'reports', 'summary'],
    isBuiltIn: true,
  },
  {
    id: 'template-keyword-alert',
    name: 'Keyword Alert',
    description: 'Send an alert when specific keywords are mentioned in messages',
    category: 'moderation',
    trigger: {
      type: 'message.created',
      config: {},
      conditions: [],
      filters: {},
    },
    actions: [
      {
        type: 'condition',
        name: 'Check Keywords',
        config: {
          keywords: ['urgent', 'help', 'emergency'],
          matchType: 'any',
        },
        conditions: [],
        onError: 'stop',
      },
      {
        type: 'notification.send',
        name: 'Send Alert',
        config: {
          targetRole: 'ADMIN',
          message: 'Keyword alert in {{trigger.channel.name}}: "{{trigger.message.content}}"',
          priority: 'high',
        },
        conditions: [],
        onError: 'continue',
      },
    ],
    tags: ['moderation', 'alerts', 'keywords'],
    isBuiltIn: true,
  },
  {
    id: 'template-webhook-integration',
    name: 'External Webhook Integration',
    description: 'Forward events to an external webhook endpoint',
    category: 'integration',
    trigger: {
      type: 'message.created',
      config: {},
      conditions: [],
    },
    actions: [
      {
        type: 'webhook.call',
        name: 'Call External Webhook',
        config: {
          url: '{{config.webhookUrl}}',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            event: 'message.created',
            channel: '{{trigger.channel.id}}',
            message: '{{trigger.message}}',
            timestamp: '{{trigger.timestamp}}',
          },
        },
        conditions: [],
        onError: 'retry',
        retryConfig: {
          maxRetries: 3,
          delayMs: 5000,
        },
      },
    ],
    tags: ['integration', 'webhook', 'external'],
    isBuiltIn: true,
  },
  {
    id: 'template-auto-archive-inactive',
    name: 'Auto-Archive Inactive Channels',
    description: 'Automatically archive channels with no activity for a specified period',
    category: 'automation',
    trigger: {
      type: 'schedule.interval',
      config: {
        interval: 86400000, // 24 hours in milliseconds
      },
      conditions: [],
    },
    actions: [
      {
        type: 'custom.function',
        name: 'Find Inactive Channels',
        config: {
          function: 'findInactiveChannels',
          params: {
            inactiveDays: 30,
          },
        },
        conditions: [],
        onError: 'stop',
      },
      {
        type: 'channel.archive',
        name: 'Archive Channels',
        config: {
          channels: '{{previousStep.inactiveChannels}}',
        },
        conditions: [],
        onError: 'continue',
      },
    ],
    tags: ['automation', 'channels', 'cleanup'],
    isBuiltIn: true,
  },
];

/**
 * GET /api/workspaces/:workspaceId/workflows/templates
 *
 * List available workflow templates.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId
 * @returns List of templates
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = templateFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: TemplateFiltersInput = parseResult.data;

    // Filter built-in templates by category if specified
    let builtInTemplates = BUILT_IN_TEMPLATES;
    if (filters.category) {
      builtInTemplates = builtInTemplates.filter((t) => t.category === filters.category);
    }

    // Fetch custom templates from database
    const customTemplateWorkflows = await prisma.workflow.findMany({
      where: {
        workspaceId,
        metadata: {
          path: ['isTemplate'],
          equals: true,
        },
        ...(filters.category && {
          metadata: {
            path: ['category'],
            equals: filters.category,
          },
        }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert custom template workflows to WorkflowTemplate format
    const customTemplates: WorkflowTemplate[] = customTemplateWorkflows.map((workflow) => {
      const metadata = workflow.metadata as { category?: string } | null;
      const actions = workflow.actions as unknown as WorkflowTemplate['actions'];

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description ?? '',
        category: (metadata?.category as WorkflowTemplate['category']) ?? 'custom',
        trigger: workflow.trigger as unknown as WorkflowTemplate['trigger'],
        actions,
        tags: workflow.tags,
        isBuiltIn: false,
      };
    });

    // Combine built-in and custom templates
    const allTemplates = [...builtInTemplates, ...customTemplates];

    return NextResponse.json({
      templates: allTemplates,
      counts: {
        builtIn: builtInTemplates.length,
        custom: customTemplates.length,
        total: allTemplates.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/workflows/templates] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * Schema for saving a workflow as a template
 */
const saveAsTemplateSchema = z.object({
  /** Source workflow ID to copy from */
  workflowId: z.string().min(1, 'Workflow ID is required'),
  /** Template name */
  name: z.string().min(1, 'Template name is required').max(100),
  /** Template description */
  description: z.string().max(500).optional(),
  /** Template category */
  category: z.enum(['onboarding', 'notifications', 'automation', 'integration', 'moderation', 'scheduling', 'custom']).default('custom'),
  /** Tags for organization */
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;

/**
 * POST /api/workspaces/:workspaceId/workflows/templates
 *
 * Create a new workflow from a template OR save existing workflow as template.
 * Behavior is determined by the request body:
 * - If `templateId` is provided: Creates workflow from template
 * - If `workflowId` is provided: Saves workflow as custom template
 *
 * @param request - Next.js request with template ID or workflow ID
 * @param context - Route context with workspaceId
 * @returns Created workflow or template
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check workspace membership
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse('You must be a workspace member to create workflows', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', WORKFLOW_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Determine if this is creating from template or saving as template
    const bodyObj = body as Record<string, unknown>;

    if ('workflowId' in bodyObj) {
      // SAVE WORKFLOW AS TEMPLATE
      const parseResult = saveAsTemplateSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          createErrorResponse(
            'Validation failed',
            WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
            { errors: parseResult.error.flatten().fieldErrors },
          ),
          { status: 400 },
        );
      }

      const input: SaveAsTemplateInput = parseResult.data;

      // Find source workflow
      const sourceWorkflow = await prisma.workflow.findUnique({
        where: {
          id: input.workflowId,
          workspaceId, // Ensure workflow belongs to this workspace
        },
      });

      if (!sourceWorkflow) {
        return NextResponse.json(
          createErrorResponse('Source workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 },
        );
      }

      // Create new workflow as template (marked with isTemplate metadata)
      const template = await prisma.workflow.create({
        data: {
          name: input.name,
          description: input.description ?? sourceWorkflow.description,
          trigger: sourceWorkflow.trigger as Prisma.InputJsonValue,
          actions: sourceWorkflow.actions as Prisma.InputJsonValue,
          status: 'DRAFT',
          tags: input.tags.length > 0 ? input.tags : sourceWorkflow.tags,
          metadata: {
            isTemplate: true,
            category: input.category,
            sourceWorkflowId: sourceWorkflow.id,
            createdFromWorkflow: {
              id: sourceWorkflow.id,
              name: sourceWorkflow.name,
            },
          } as Prisma.InputJsonValue,
          workspaceId,
          createdBy: session.user.id,
        },
        include: {
          _count: {
            select: {
              workflowExecutions: true,
            },
          },
        },
      });

      return NextResponse.json(
        {
          template,
          message: 'Workflow saved as template successfully',
        },
        { status: 201 },
      );
    } else {
      // CREATE WORKFLOW FROM TEMPLATE
      const parseResult = createFromTemplateSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          createErrorResponse(
            'Validation failed',
            WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
            { errors: parseResult.error.flatten().fieldErrors },
          ),
          { status: 400 },
        );
      }

      const input: CreateFromTemplateInput = parseResult.data;

      // Check if it's a built-in template
      let template = BUILT_IN_TEMPLATES.find((t) => t.id === input.templateId);
      let isBuiltIn = true;

      // If not built-in, check custom templates
      if (!template) {
        const customTemplate = await prisma.workflow.findFirst({
          where: {
            id: input.templateId,
            workspaceId,
            metadata: {
              path: ['isTemplate'],
              equals: true,
            },
          },
        });

        if (!customTemplate) {
          return NextResponse.json(
            createErrorResponse('Template not found', WORKFLOW_ERROR_CODES.TEMPLATE_NOT_FOUND),
            { status: 404 },
          );
        }

        // Convert custom template to WorkflowTemplate format
        const metadata = customTemplate.metadata as { category?: string } | null;
        template = {
          id: customTemplate.id,
          name: customTemplate.name,
          description: customTemplate.description ?? '',
          category: (metadata?.category as WorkflowTemplate['category']) ?? 'custom',
          trigger: customTemplate.trigger as unknown as WorkflowTemplate['trigger'],
          actions: customTemplate.actions as unknown as WorkflowTemplate['actions'],
          tags: customTemplate.tags,
          isBuiltIn: false,
        };
        isBuiltIn = false;
      }

      // Create workflow from template
      const workflow = await prisma.workflow.create({
        data: {
          name: input.name ?? template.name,
          description: template.description,
          trigger: template.trigger as unknown as Prisma.InputJsonValue,
          actions: template.actions as unknown as Prisma.InputJsonValue,
          status: 'DRAFT', // Start as draft so user can configure before activating
          tags: template.tags,
          metadata: {
            createdFromTemplate: template.id,
            templateName: template.name,
            isBuiltInTemplate: isBuiltIn,
          } as Prisma.InputJsonValue,
          workspaceId,
          createdBy: session.user.id,
        },
        include: {
          _count: {
            select: {
              workflowExecutions: true,
            },
          },
        },
      });

      return NextResponse.json(
        { workflow, message: 'Workflow created from template successfully' },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/workflows/templates] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
