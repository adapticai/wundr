/**
 * Orchestrator Templates API Routes
 *
 * Handles listing available orchestrator templates and creating orchestrators from templates.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/orchestrators/templates - List templates
 * - POST /api/workspaces/:workspaceSlug/orchestrators/templates - Create orchestrator from template
 *
 * @module app/api/workspaces/[workspaceSlug]/orchestrators/templates/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  ORCHESTRATOR_TEMPLATES,
  getTemplateById,
} from '@/lib/templates/orchestrator-templates';
import {
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { OrchestratorTemplate } from '@/lib/templates/orchestrator-templates';
import type { CreateOrchestratorInput } from '@/types/orchestrator';
import { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Template filters schema
 */
const templateFiltersSchema = z.object({
  category: z
    .enum(['leadership', 'support', 'technical', 'operations', 'custom'])
    .optional(),
  discipline: z.string().optional(),
  search: z.string().optional(),
});

type TemplateFiltersInput = z.infer<typeof templateFiltersSchema>;

/**
 * Helper function to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  return {
    workspace,
    orgMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/orchestrators/templates
 *
 * List available orchestrator templates.
 * Includes both built-in templates and custom workspace templates.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspace slug
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
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = templateFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: TemplateFiltersInput = parseResult.data;

    // Filter built-in templates
    let builtInTemplates = ORCHESTRATOR_TEMPLATES;
    if (filters.category) {
      builtInTemplates = builtInTemplates.filter(
        t => t.category === filters.category,
      );
    }
    if (filters.discipline) {
      builtInTemplates = builtInTemplates.filter(
        t => t.discipline === filters.discipline,
      );
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      builtInTemplates = builtInTemplates.filter(
        t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchLower)),
      );
    }

    // Return templates
    return NextResponse.json({
      templates: builtInTemplates,
      counts: {
        builtIn: builtInTemplates.length,
        custom: 0,
        total: builtInTemplates.length,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/orchestrators/templates] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * Create from template schema
 */
const createFromTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  customizations: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      workHours: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
          timezone: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;

/**
 * POST /api/workspaces/:workspaceSlug/orchestrators/templates
 *
 * Create a new orchestrator from a template.
 * Supports customization of template values.
 *
 * @param request - Next.js request with template ID and customizations
 * @param context - Route context with workspace slug
 * @returns Created orchestrator
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
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for admin/owner role
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin/owner required.',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate request
    const parseResult = createFromTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateFromTemplateInput = parseResult.data;

    // Get template
    const template = getTemplateById(input.templateId);
    if (!template) {
      return NextResponse.json(
        createErrorResponse(
          'Template not found',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Build orchestrator input from template with customizations
    const orchestratorInput: CreateOrchestratorInput = {
      ...template.config,
      organizationId: access.workspace.organizationId,
    };

    // Apply customizations
    if (input.customizations) {
      if (input.customizations.title) {
        orchestratorInput.title = input.customizations.title;
      }
      if (input.customizations.description) {
        orchestratorInput.description = input.customizations.description;
      }
      if (
        input.customizations.workHours &&
        orchestratorInput.charter?.operationalSettings
      ) {
        orchestratorInput.charter.operationalSettings.workHours = {
          ...orchestratorInput.charter.operationalSettings.workHours,
          ...input.customizations.workHours,
        };
      }
    }

    if (input.name) {
      orchestratorInput.title = input.name;
    }

    // Create orchestrator with user in transaction
    const orchestrator = await prisma.$transaction(async tx => {
      // Create user for the orchestrator
      const user = await tx.user.create({
        data: {
          email: `${orchestratorInput.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@neolith.local`,
          name: orchestratorInput.title,
          displayName: orchestratorInput.title,
          isOrchestrator: true,
          status: 'ACTIVE',
        },
      });

      // Create the orchestrator
      // Note: Template metadata stored in capabilities since orchestrator model doesn't have metadata field
      const capabilitiesWithMeta = {
        capabilities: orchestratorInput.capabilities,
        _templateInfo: {
          createdFromTemplate: template.id,
          templateName: template.name,
          isBuiltInTemplate: template.isBuiltIn,
        },
      };

      const newOrchestrator = await tx.orchestrator.create({
        data: {
          discipline: orchestratorInput.discipline,
          role: orchestratorInput.title,
          capabilities: capabilitiesWithMeta as unknown as Prisma.InputJsonValue,
          status: 'OFFLINE',
          userId: user.id,
          organizationId: access.workspace.organizationId,
          workspaceId: workspaceId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              lastActiveAt: true,
              createdAt: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          disciplineRef: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              icon: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      });

      return newOrchestrator;
    });

    // Add statistics to response
    const enhancedOrchestrator = {
      ...orchestrator,
      statistics: {
        totalTasks: 0,
        tasksCompleted: 0,
        activeTasks: 0,
      },
    };

    return NextResponse.json(
      {
        data: enhancedOrchestrator,
        message: 'Orchestrator created from template successfully',
        template: {
          id: template.id,
          name: template.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/orchestrators/templates] Error:',
      error,
    );

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'An orchestrator with these details already exists',
          ORCHESTRATOR_ERROR_CODES.DUPLICATE_EMAIL,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
