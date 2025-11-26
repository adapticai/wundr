/**
 * Entity Generation API
 * Creates entities from confirmed specs
 *
 * Routes:
 * - POST /api/creation/generate - Create entity from spec
 *
 * @module app/api/creation/generate/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generateRequestSchema,
  orchestratorSpecSchema,
  workflowSpecSchema,
  channelSpecSchema,
  workspaceSpecSchema,
  sessionManagerFullSpecSchema,
  subagentFullSpecSchema,
  createCreationErrorResponse,
  CREATION_ERROR_CODES,
} from '@/lib/validations/creation';

import type { NextRequest } from 'next/server';
import type { OrchestratorSpec, WorkflowSpec, ChannelSpec, WorkspaceSpec, SessionManagerSpec, SubagentSpec } from '@/lib/validations/creation';

/**
 * Create an orchestrator from spec
 */
async function createOrchestrator(spec: OrchestratorSpec, workspaceId: string) {
  // First, get the workspace to get organization ID
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  // Create a user for the VP/Orchestrator
  const vpUser = await prisma.user.create({
    data: {
      name: spec.name,
      email: `${spec.name.toLowerCase().replace(/\s+/g, '-')}@orchestrator.neolith.ai`,
      avatarUrl: null, // Could generate avatar later
      isVP: true,
    },
  });

  // Create the VP (Orchestrator)
  const vp = await prisma.vP.create({
    data: {
      userId: vpUser.id,
      workspaceId,
      organizationId: workspace.organizationId,
      role: spec.role,
      discipline: spec.discipline || spec.role,
      capabilities: {
        charter: spec.charter,
        communicationStyle: spec.communicationStyle,
        escalationRules: spec.escalationRules || null,
        responsePatterns: spec.responsePatterns || null,
        channels: spec.channels || [],
      } as Prisma.InputJsonValue,
      status: 'OFFLINE',
    },
  });

  // Note: Session managers and subagents are not in the current schema
  // They would be added in future schema updates
  // For now, store them in the VP's capabilities JSON

  return vp;
}

/**
 * Create a workflow from spec
 */
async function createWorkflow(spec: WorkflowSpec, userId: string, workspaceId: string) {
  const workflow = await prisma.workflow.create({
    data: {
      workspaceId,
      name: spec.name,
      description: spec.description || null,
      trigger: spec.trigger as Prisma.InputJsonValue,
      actions: spec.steps as unknown as Prisma.InputJsonValue,
      status: spec.isActive ? 'ACTIVE' : 'DRAFT',
      tags: spec.tags || [],
      createdBy: userId,
      metadata: {
        successOutcome: spec.successOutcome || null,
        failureOutcome: spec.failureOutcome || null,
      } as Prisma.InputJsonValue,
    },
  });

  return workflow;
}

/**
 * Create a channel from spec
 */
async function createChannel(spec: ChannelSpec, userId: string, workspaceId: string) {
  // Create a slug from the name (remove # prefix if present)
  const slug = spec.name.replace(/^#/, '').toLowerCase();

  const channel = await prisma.channel.create({
    data: {
      workspaceId,
      name: spec.displayName || spec.name,
      slug,
      type: spec.type || 'PUBLIC',
      description: spec.description || null,
      topic: spec.purpose || null,
      createdById: userId,
      settings: {
        rules: spec.rules || [],
        tags: spec.tags || [],
        orchestratorIds: spec.orchestratorIds || [],
      } as Prisma.InputJsonValue,
    },
  });

  // Add initial members
  if (spec.initialMembers && spec.initialMembers.length > 0) {
    await prisma.channelMember.createMany({
      data: spec.initialMembers.map((memberId) => ({
        channelId: channel.id,
        userId: memberId,
        role: 'MEMBER',
      })),
    });
  }

  // Add creator as admin
  await prisma.channelMember.create({
    data: {
      channelId: channel.id,
      userId,
      role: 'ADMIN',
    },
  });

  return channel;
}

/**
 * Create a workspace from spec
 */
async function createWorkspace(spec: WorkspaceSpec, userId: string, organizationId: string) {
  const workspace = await prisma.$transaction(async (tx) => {
    // Create a slug from the name
    const slug = spec.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Create workspace
    const ws = await tx.workspace.create({
      data: {
        organizationId,
        name: spec.name,
        slug,
        description: spec.description || null,
        settings: {
          industry: spec.industry || null,
          teamSize: spec.teamSize || null,
          departments: spec.departments || [],
        } as Prisma.InputJsonValue,
      },
    });

    // Add creator as member
    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: 'OWNER',
      },
    });

    // Create initial channels
    if (spec.initialChannels && spec.initialChannels.length > 0) {
      for (const channelSpec of spec.initialChannels) {
        await createChannel(channelSpec, userId, ws.id);
      }
    }

    // Create initial orchestrators
    if (spec.initialOrchestrators && spec.initialOrchestrators.length > 0) {
      for (const orchSpec of spec.initialOrchestrators) {
        await createOrchestrator(orchSpec, ws.id);
      }
    }

    // Create initial workflows
    if (spec.initialWorkflows && spec.initialWorkflows.length > 0) {
      for (const wfSpec of spec.initialWorkflows) {
        await createWorkflow(wfSpec, userId, ws.id);
      }
    }

    return ws;
  });

  return workspace;
}

/**
 * Create a session manager from spec
 * Note: Session managers are not yet in the schema, so we store them in VP capabilities
 */
async function createSessionManager(spec: SessionManagerSpec) {
  // Get the parent VP and update its capabilities
  const vp = await prisma.vP.findUnique({
    where: { id: spec.orchestratorId },
  });

  if (!vp) {
    throw new Error('Parent orchestrator not found');
  }

  const capabilities = (vp.capabilities as Record<string, unknown>) || {};
  const sessionManagers = (capabilities.sessionManagers as Array<unknown>) || [];

  sessionManagers.push({
    name: spec.name,
    purpose: spec.purpose,
    channelId: spec.channelId || null,
    context: spec.context || null,
    responsibilities: spec.responsibilities || [],
    escalationCriteria: spec.escalationCriteria || [],
    subagents: spec.subagents || [],
  });

  await prisma.vP.update({
    where: { id: spec.orchestratorId },
    data: {
      capabilities: {
        ...capabilities,
        sessionManagers,
      } as Prisma.InputJsonValue,
    },
  });

  return { id: `sm_${Date.now()}`, ...spec };
}

/**
 * Create a subagent from spec
 * Note: Subagents are not yet in the schema, so we store them in VP capabilities
 */
async function createSubagent(spec: SubagentSpec) {
  // Get the parent and update its capabilities
  const vp = await prisma.vP.findUnique({
    where: { id: spec.parentId },
  });

  if (!vp) {
    throw new Error('Parent not found');
  }

  const capabilities = (vp.capabilities as Record<string, unknown>) || {};
  const subagents = (capabilities.subagents as Array<unknown>) || [];

  subagents.push({
    name: spec.name,
    capability: spec.capability,
    taskType: spec.taskType,
    inputFormat: spec.inputFormat || null,
    outputFormat: spec.outputFormat || null,
    errorHandling: spec.errorHandling || null,
    examples: spec.examples || [],
  });

  await prisma.vP.update({
    where: { id: spec.parentId },
    data: {
      capabilities: {
        ...capabilities,
        subagents,
      } as Prisma.InputJsonValue,
    },
  });

  return { id: `sa_${Date.now()}`, ...spec };
}

/**
 * POST /api/creation/generate
 *
 * Create an entity from a validated specification.
 *
 * @param request - Next.js request with generation data
 * @returns Created entity
 *
 * @example
 * ```
 * POST /api/creation/generate
 * Content-Type: application/json
 *
 * {
 *   "entityType": "orchestrator",
 *   "spec": { ... validated spec ... },
 *   "workspaceId": "ws_123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "entity": { ... created entity ... },
 *   "entityId": "vp_456"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createCreationErrorResponse('Authentication required', CREATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createCreationErrorResponse('Invalid JSON body', CREATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate request structure
    const requestParseResult = generateRequestSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        createCreationErrorResponse('Invalid request structure', CREATION_ERROR_CODES.VALIDATION_ERROR, {
          errors: requestParseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const { entityType, spec, workspaceId, organizationId } = requestParseResult.data;

    // Validate and create entity based on type
    let entity;
    let specParseResult;

    switch (entityType) {
      case 'orchestrator':
        if (!workspaceId) {
          return NextResponse.json(
            createCreationErrorResponse('workspaceId is required for orchestrators', CREATION_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        // Verify workspace exists
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (!workspace) {
          return NextResponse.json(
            createCreationErrorResponse('Workspace not found', CREATION_ERROR_CODES.WORKSPACE_NOT_FOUND),
            { status: 404 },
          );
        }

        specParseResult = orchestratorSpecSchema.safeParse(spec);
        if (!specParseResult.success) {
          return NextResponse.json(
            createCreationErrorResponse('Invalid orchestrator spec', CREATION_ERROR_CODES.SPEC_PARSE_ERROR, {
              errors: specParseResult.error.flatten().fieldErrors,
            }),
            { status: 422 },
          );
        }

        entity = await createOrchestrator(specParseResult.data, workspaceId);
        break;

      case 'workflow':
        if (!workspaceId) {
          return NextResponse.json(
            createCreationErrorResponse('workspaceId is required for workflows', CREATION_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        specParseResult = workflowSpecSchema.safeParse(spec);
        if (!specParseResult.success) {
          return NextResponse.json(
            createCreationErrorResponse('Invalid workflow spec', CREATION_ERROR_CODES.SPEC_PARSE_ERROR, {
              errors: specParseResult.error.flatten().fieldErrors,
            }),
            { status: 422 },
          );
        }

        entity = await createWorkflow(specParseResult.data, session.user.id, workspaceId);
        break;

      case 'channel':
        if (!workspaceId) {
          return NextResponse.json(
            createCreationErrorResponse('workspaceId is required for channels', CREATION_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        specParseResult = channelSpecSchema.safeParse(spec);
        if (!specParseResult.success) {
          return NextResponse.json(
            createCreationErrorResponse('Invalid channel spec', CREATION_ERROR_CODES.SPEC_PARSE_ERROR, {
              errors: specParseResult.error.flatten().fieldErrors,
            }),
            { status: 422 },
          );
        }

        entity = await createChannel(specParseResult.data, session.user.id, workspaceId);
        break;

      case 'workspace':
        if (!organizationId) {
          return NextResponse.json(
            createCreationErrorResponse('organizationId is required for workspaces', CREATION_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        specParseResult = workspaceSpecSchema.safeParse(spec);
        if (!specParseResult.success) {
          return NextResponse.json(
            createCreationErrorResponse('Invalid workspace spec', CREATION_ERROR_CODES.SPEC_PARSE_ERROR, {
              errors: specParseResult.error.flatten().fieldErrors,
            }),
            { status: 422 },
          );
        }

        entity = await createWorkspace(specParseResult.data, session.user.id, organizationId);
        break;

      case 'session-manager':
        specParseResult = sessionManagerFullSpecSchema.safeParse(spec);
        if (!specParseResult.success) {
          return NextResponse.json(
            createCreationErrorResponse('Invalid session manager spec', CREATION_ERROR_CODES.SPEC_PARSE_ERROR, {
              errors: specParseResult.error.flatten().fieldErrors,
            }),
            { status: 422 },
          );
        }

        // Verify parent orchestrator exists
        const parentOrch = await prisma.vP.findUnique({
          where: { id: specParseResult.data.orchestratorId },
        });
        if (!parentOrch) {
          return NextResponse.json(
            createCreationErrorResponse('Parent orchestrator not found', CREATION_ERROR_CODES.PARENT_NOT_FOUND),
            { status: 404 },
          );
        }

        entity = await createSessionManager(specParseResult.data);
        break;

      case 'subagent':
        specParseResult = subagentFullSpecSchema.safeParse(spec);
        if (!specParseResult.success) {
          return NextResponse.json(
            createCreationErrorResponse('Invalid subagent spec', CREATION_ERROR_CODES.SPEC_PARSE_ERROR, {
              errors: specParseResult.error.flatten().fieldErrors,
            }),
            { status: 422 },
          );
        }

        // Verify parent exists (only orchestrator is supported for now)
        const parentVP = await prisma.vP.findUnique({
          where: { id: specParseResult.data.parentId },
        });
        if (!parentVP) {
          return NextResponse.json(
            createCreationErrorResponse('Parent orchestrator not found', CREATION_ERROR_CODES.PARENT_NOT_FOUND),
            { status: 404 },
          );
        }

        entity = await createSubagent(specParseResult.data);
        break;

      default:
        return NextResponse.json(
          createCreationErrorResponse(`Unsupported entity type: ${entityType}`, CREATION_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
    }

    return NextResponse.json(
      {
        success: true,
        entity,
        entityId: entity.id,
        entityType,
        message: `${entityType} created successfully`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/creation/generate] Error:', error);

    // Handle Prisma unique constraint errors
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        createCreationErrorResponse('An entity with these details already exists', CREATION_ERROR_CODES.ENTITY_EXISTS),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createCreationErrorResponse('An internal error occurred', CREATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
