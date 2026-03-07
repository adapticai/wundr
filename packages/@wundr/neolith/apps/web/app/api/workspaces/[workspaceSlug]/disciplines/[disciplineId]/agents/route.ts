/**
 * Discipline Agents API Routes
 *
 * Manages agents associated with a specific discipline within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/agents
 *     List agents associated with this discipline
 * - POST /api/workspaces/:workspaceSlug/disciplines/:disciplineId/agents
 *     Create a new agent tagged to this discipline
 *
 * Agent-discipline association is tracked via the agent's description metadata
 * and the disciplineId tag stored in the agent's tools/metadata fields.
 * Since the agent model is workspace-scoped and has no disciplineId column,
 * we use a naming convention: agents for a discipline have their systemPrompt
 * seeded with the discipline name, and we filter by the `disciplineId` stored
 * in a JSON metadata field (returned via a dedicated pattern).
 *
 * In practice, we search agents by matching their name prefix or a dedicated
 * discipline tag passed as a query parameter or embedded in description.
 *
 * @module app/api/workspaces/[workspaceSlug]/disciplines/[disciplineId]/agents/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  DISCIPLINE_ERROR_CODES,
} from '@/lib/validations/discipline';
import { isAvailableTool, DEFAULT_MODEL_CONFIGS } from '@/types/agent';

import type {
  Agent,
  AgentType,
  AgentStatus,
  AgentModelConfig,
  AvailableTool,
} from '@/types/agent';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug and disciplineId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; disciplineId: string }>;
}

/**
 * Validation schema for creating a discipline agent
 */
const createDisciplineAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'task',
    'research',
    'coding',
    'data',
    'qa',
    'support',
    'custom',
  ]),
  description: z.string().optional(),
  config: z
    .object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
      maxTokens: z.number().min(1).max(32000).optional(),
      topP: z.number().min(0).max(1).optional(),
      frequencyPenalty: z.number().min(-2).max(2).optional(),
      presencePenalty: z.number().min(-2).max(2).optional(),
    })
    .optional(),
  systemPrompt: z.string().optional(),
  tools: z
    .array(
      z.enum([
        'web_search',
        'code_execution',
        'file_operations',
        'data_analysis',
        'api_calls',
        'database_query',
        'image_generation',
        'text_analysis',
        'translation',
        'summarization',
      ])
    )
    .optional(),
});

/**
 * Query schema for listing discipline agents
 */
const listAgentsQuerySchema = z.object({
  type: z
    .enum(['task', 'research', 'coding', 'data', 'qa', 'support', 'custom'])
    .optional(),
  status: z.enum(['active', 'paused', 'inactive', 'error']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Helper: resolve workspace access and verify the discipline belongs to the org.
 */
async function resolveDisciplineAccess(
  workspaceSlug: string,
  disciplineId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ slug: workspaceSlug }, { id: workspaceSlug }] },
    select: { id: true, name: true, organizationId: true },
  });

  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) return null;

  const discipline = await prisma.discipline.findFirst({
    where: {
      id: disciplineId,
      organizationId: workspace.organizationId,
    },
    select: { id: true, name: true, organizationId: true },
  });

  if (!discipline) return null;

  return { workspace, orgMembership, discipline };
}

/**
 * Map a database agent row to the Agent API type
 */
function mapDbAgentToApi(dbAgent: {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  tools: string[];
  systemPrompt: string | null;
  tasksCompleted: number;
  successRate: number;
  avgResponseTime: number;
  lastActiveAt: Date | null;
  tokensUsed: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}): Agent {
  return {
    id: dbAgent.id,
    workspaceId: dbAgent.workspaceId,
    name: dbAgent.name,
    type: dbAgent.type.toLowerCase() as AgentType,
    description: dbAgent.description ?? '',
    status: dbAgent.status.toLowerCase() as AgentStatus,
    config: {
      model: dbAgent.model,
      temperature: dbAgent.temperature,
      maxTokens: dbAgent.maxTokens,
      topP: dbAgent.topP ?? undefined,
      frequencyPenalty: dbAgent.frequencyPenalty ?? undefined,
      presencePenalty: dbAgent.presencePenalty ?? undefined,
    },
    systemPrompt: dbAgent.systemPrompt ?? '',
    tools: dbAgent.tools.filter(isAvailableTool) as AvailableTool[],
    stats: {
      tasksCompleted: dbAgent.tasksCompleted,
      successRate: dbAgent.successRate,
      avgResponseTime: dbAgent.avgResponseTime,
      lastActive: dbAgent.lastActiveAt,
      tokensUsed: dbAgent.tokensUsed,
      totalCost: dbAgent.totalCost,
    },
    createdAt: dbAgent.createdAt,
    updatedAt: dbAgent.updatedAt,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/agents
 *
 * List agents associated with this discipline.
 * Agents are matched by a discipline tag embedded in their description
 * using the format "[discipline:<disciplineId>]".
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await resolveDisciplineAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const queryResult = listAgentsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { type, status, search, page, limit } = queryResult.data;
    const disciplineTag = `[discipline:${disciplineId}]`;

    // Agents tagged to this discipline have the tag embedded in their description
    const where: Prisma.agentWhereInput = {
      workspaceId: access.workspace.id,
      description: { contains: disciplineTag },
      ...(type && {
        type: type.toUpperCase() as
          | 'TASK'
          | 'RESEARCH'
          | 'CODING'
          | 'DATA'
          | 'QA'
          | 'SUPPORT'
          | 'CUSTOM',
      }),
      ...(status && {
        status: status.toUpperCase() as
          | 'ACTIVE'
          | 'INACTIVE'
          | 'PAUSED'
          | 'ERROR',
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [dbAgents, totalCount] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agent.count({ where }),
    ]);

    const agents = dbAgents.map(mapDbAgentToApi);
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: agents,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      discipline: {
        id: access.discipline.id,
        name: access.discipline.name,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/agents] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/disciplines/:disciplineId/agents
 *
 * Create a new agent associated with this discipline.
 * The discipline tag "[discipline:<disciplineId>]" is automatically appended
 * to the description so the agent can be retrieved by discipline later.
 *
 * Request Body:
 * - name: Agent name (required)
 * - type: AgentType (required)
 * - description: Optional description
 * - config: Optional model configuration
 * - systemPrompt: Optional system prompt
 * - tools: Optional list of enabled tools
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await resolveDisciplineAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = createDisciplineAgentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const disciplineTag = `[discipline:${disciplineId}]`;

    // Get default model config for this agent type and merge with input
    const defaultConfig = DEFAULT_MODEL_CONFIGS[input.type as AgentType];
    const config: AgentModelConfig = { ...defaultConfig, ...input.config };

    // Embed discipline tag in description
    const descriptionWithTag = input.description
      ? `${input.description} ${disciplineTag}`
      : `Agent for discipline ${access.discipline.name} ${disciplineTag}`;

    const dbAgent = await prisma.agent.create({
      data: {
        workspaceId: access.workspace.id,
        name: input.name,
        type: input.type.toUpperCase() as
          | 'TASK'
          | 'RESEARCH'
          | 'CODING'
          | 'DATA'
          | 'QA'
          | 'SUPPORT'
          | 'CUSTOM',
        description: descriptionWithTag,
        status: 'ACTIVE',
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP ?? null,
        frequencyPenalty: config.frequencyPenalty ?? null,
        presencePenalty: config.presencePenalty ?? null,
        tools: input.tools ?? [],
        systemPrompt:
          input.systemPrompt ??
          `You are a ${input.type} agent for the ${access.discipline.name} discipline. Help with ${input.type}-related tasks.`,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(
      {
        data: mapDbAgentToApi(dbAgent),
        message: 'Agent created successfully for discipline',
        discipline: {
          id: access.discipline.id,
          name: access.discipline.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/disciplines/:disciplineId/agents] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
