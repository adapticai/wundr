/**
 * Wizard Entity Creation API Route
 *
 * Handles creation of entities from the conversational wizard.
 * Creates entities in the database after data has been extracted and validated.
 *
 * Routes:
 * - POST /api/wizard/create - Create entity from wizard data
 *
 * @module app/api/wizard/create/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { EntityType } from '@/lib/ai';
import type { NextRequest } from 'next/server';
import type { Prisma } from '@neolith/database';

interface CreateEntityRequest {
  entityType: EntityType;
  data: Record<string, unknown>;
}

/**
 * Infer types from Zod schemas for type safety
 */
type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

/**
 * Validation schemas for creating each entity type
 */
const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  organizationType: z.string().optional(),
  teamSize: z.enum(['small', 'medium', 'large']).optional(),
  purpose: z.string().optional(),
});

const createOrchestratorSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  description: z.string().min(1, 'Description is required'),
  capabilities: z.array(z.string()).optional(),
  communicationStyle: z.string().optional(),
});

const createSessionManagerSchema = z.object({
  name: z.string(),
  responsibilities: z.string(),
  parentOrchestrator: z.string().optional(),
  context: z.string().optional(),
  channels: z.array(z.string()).optional(),
  escalationCriteria: z.array(z.string()).optional(),
  workspaceSlug: z.string().optional(),
  workspaceId: z.string().optional(),
});

const createWorkflowSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  trigger: z.object({
    type: z.enum(['schedule', 'event', 'manual', 'webhook']),
    config: z.record(z.unknown()).optional(),
  }),
  actions: z
    .array(
      z.object({
        action: z.string(),
        description: z.string(),
      })
    )
    .min(1, 'At least one action is required'),
});

/**
 * POST /api/wizard/create
 *
 * Create an entity from wizard-extracted data.
 *
 * @param request - Next.js request with entity data
 * @returns Created entity
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: { message: 'Invalid request body' } },
        { status: 400 }
      );
    }

    const req = body as CreateEntityRequest;

    // Validate entity type
    const validEntityTypes: EntityType[] = [
      'workspace',
      'orchestrator',
      'session-manager',
      'workflow',
    ];
    if (!req.entityType || !validEntityTypes.includes(req.entityType)) {
      return NextResponse.json(
        {
          error: {
            message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Create entity based on type
    let result: unknown;

    switch (req.entityType) {
      case 'workspace': {
        const validated = createWorkspaceSchema.parse(req.data);

        // Find user's organization (required for workspace)
        const userOrg = await prisma.organizationMember.findFirst({
          where: { userId: session.user.id },
          include: { organization: true },
        });

        if (!userOrg) {
          return NextResponse.json(
            {
              error: {
                message:
                  'User must belong to an organization to create a workspace',
              },
            },
            { status: 400 }
          );
        }

        // Generate slug from name
        const slug = validated.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Create workspace
        const workspace = await prisma.workspace.create({
          data: {
            name: validated.name,
            slug,
            description: validated.description || '',
            organizationId: userOrg.organizationId,
            visibility: 'PRIVATE',
            settings: {
              organizationType: validated.organizationType,
              teamSize: validated.teamSize,
              purpose: validated.purpose,
            },
          },
        });

        // Add owner as member
        await prisma.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: session.user.id,
            role: 'OWNER',
          },
        });

        result = {
          id: workspace.id,
          name: workspace.name,
          type: 'workspace',
          slug: workspace.slug,
        };
        break;
      }

      case 'orchestrator': {
        const validated = createOrchestratorSchema.parse(req.data);

        // Verify workspace exists and user has access
        const workspace = await prisma.workspace.findFirst({
          where: {
            id: validated.workspaceId,
            workspaceMembers: {
              some: {
                userId: session.user.id,
              },
            },
          },
          include: { organization: true },
        });

        if (!workspace) {
          return NextResponse.json(
            { error: { message: 'Workspace not found or access denied' } },
            { status: 404 }
          );
        }

        // Create orchestrator user
        const orchestratorUser = await prisma.user.create({
          data: {
            name: validated.name,
            email: `${validated.name.toLowerCase().replace(/\s+/g, '.')}@orchestrator.neolith.local`,
            status: 'ACTIVE',
          },
        });

        // Create orchestrator
        const orchestrator = await prisma.orchestrator.create({
          data: {
            discipline: validated.role,
            role: validated.role,
            workspaceId: validated.workspaceId,
            userId: orchestratorUser.id,
            organizationId: workspace.organizationId,
            status: 'OFFLINE',
            capabilities: {
              description: validated.description,
              capabilities: validated.capabilities || [],
              communicationStyle: validated.communicationStyle,
            },
          },
        });

        result = {
          id: orchestrator.id,
          name: validated.name,
          type: 'orchestrator',
          role: orchestrator.role,
        };
        break;
      }

      case 'session-manager': {
        const validated = createSessionManagerSchema.parse(req.data);

        // Find workspace by slug or ID
        let workspace;
        if (validated.workspaceSlug) {
          workspace = await prisma.workspace.findFirst({
            where: { slug: validated.workspaceSlug },
            include: {
              organization: true,
            },
          });
        } else if (validated.workspaceId) {
          workspace = await prisma.workspace.findFirst({
            where: { id: validated.workspaceId },
          });
        }

        if (!workspace) {
          return NextResponse.json(
            { error: { message: 'Workspace not found' } },
            { status: 404 }
          );
        }

        // Check workspace access (either workspace member or org member)
        const hasAccess = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        });

        if (!hasAccess && workspace.organizationId) {
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
              { error: { message: 'Access denied' } },
              { status: 403 }
            );
          }
        } else if (!hasAccess) {
          return NextResponse.json(
            { error: { message: 'Access denied' } },
            { status: 403 }
          );
        }

        // Find orchestrator if specified
        let orchestratorId = validated.parentOrchestrator;
        if (!orchestratorId) {
          // Find first orchestrator in workspace as default
          const defaultOrchestrator = await prisma.orchestrator.findFirst({
            where: { workspaceId: workspace.id },
            orderBy: { createdAt: 'asc' },
          });

          if (!defaultOrchestrator) {
            return NextResponse.json(
              {
                error: {
                  message:
                    'No orchestrators found in workspace. Create an orchestrator first.',
                },
              },
              { status: 400 }
            );
          }

          orchestratorId = defaultOrchestrator.id;
        }

        // Create charter data
        const charterData: Prisma.InputJsonObject = {
          name: validated.name,
          responsibilities: validated.responsibilities,
          context: validated.context || '',
          channels: validated.channels || [],
          escalationCriteria: validated.escalationCriteria || [],
        };

        // Create session manager
        const sessionManager = await prisma.sessionManager.create({
          data: {
            name: validated.name,
            description: validated.responsibilities,
            charterId: `charter-${Date.now()}`,
            charterData,
            orchestratorId,
            status: 'INACTIVE',
          },
        });

        result = {
          id: sessionManager.id,
          name: sessionManager.name,
          type: 'session-manager',
        };
        break;
      }

      case 'workflow': {
        const validated = createWorkflowSchema.parse(req.data);

        // Verify workspace exists and user has access
        const workspace = await prisma.workspace.findFirst({
          where: {
            id: validated.workspaceId,
            workspaceMembers: {
              some: {
                userId: session.user.id,
              },
            },
          },
        });

        if (!workspace) {
          return NextResponse.json(
            { error: { message: 'Workspace not found or access denied' } },
            { status: 404 }
          );
        }

        // Prepare workflow data with proper JSON typing
        const triggerData: Prisma.InputJsonObject = {
          type: validated.trigger.type,
          ...(validated.trigger.config && {
            config: validated.trigger.config as Prisma.InputJsonObject,
          }),
        };

        const actionsData: Prisma.InputJsonArray = validated.actions.map(
          action =>
            ({
              action: action.action,
              description: action.description,
            }) satisfies Prisma.InputJsonObject
        );

        // Create workflow
        const workflow = await prisma.workflow.create({
          data: {
            name: validated.name,
            description: validated.description,
            workspaceId: validated.workspaceId,
            createdBy: session.user.id,
            status: 'DRAFT',
            trigger: triggerData,
            actions: actionsData,
          },
        });

        result = {
          id: workflow.id,
          name: workflow.name,
          type: 'workflow',
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: { message: 'Unknown entity type' } },
          { status: 400 }
        );
    }

    return NextResponse.json({
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/wizard/create] Error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            message: 'Validation failed',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: unknown };
      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: { message: 'An entity with this name already exists' } },
          { status: 409 }
        );
      }
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: { message: 'Required relation not found' } },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'An internal error occurred',
        },
      },
      { status: 500 }
    );
  }
}
