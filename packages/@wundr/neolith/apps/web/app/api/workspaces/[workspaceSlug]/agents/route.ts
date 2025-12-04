/**
 * Agents API Routes
 *
 * Handles operations for AI agents within a workspace.
 * Agents are specialized worker agents for task automation.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/agents - List agents
 * - POST /api/workspaces/:workspaceId/agents - Create agent
 *
 * @module app/api/workspaces/[workspaceId]/agents/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { isAvailableTool, DEFAULT_MODEL_CONFIGS } from '@/types/agent';

import type {
  Agent,
  AgentType,
  AgentStatus,
  CreateAgentInput,
  AgentModelConfig,
  AvailableTool,
} from '@/types/agent';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Validation schema for creating an agent
 */
const createAgentSchema = z.object({
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
 * Validation schema for query parameters
 */
const querySchema = z.object({
  type: z
    .enum(['task', 'research', 'coding', 'data', 'qa', 'support', 'custom'])
    .optional(),
  status: z.enum(['active', 'paused', 'inactive']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * GET /api/workspaces/:workspaceId/agents
 *
 * List all agents in a workspace with optional filtering.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns List of agents
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const queryResult = querySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid query parameters',
            errors: queryResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { type, status, search } = queryResult.data;

    // Build where clause for filters
    const where: Prisma.agentWhereInput = {
      workspaceId,
    };

    if (type) {
      where.type = type.toUpperCase() as
        | 'TASK'
        | 'RESEARCH'
        | 'CODING'
        | 'DATA'
        | 'QA'
        | 'SUPPORT'
        | 'CUSTOM';
    }

    if (status) {
      where.status = status.toUpperCase() as 'ACTIVE' | 'PAUSED' | 'INACTIVE';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch agents from database
    const dbAgents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Transform to API format
    const agents: Agent[] = dbAgents.map(dbAgent => ({
      id: dbAgent.id,
      workspaceId: dbAgent.workspaceId,
      name: dbAgent.name,
      type: dbAgent.type.toLowerCase() as AgentType,
      description: dbAgent.description || '',
      status: dbAgent.status.toLowerCase() as AgentStatus,
      config: {
        model: dbAgent.model,
        temperature: dbAgent.temperature,
        maxTokens: dbAgent.maxTokens,
        topP: dbAgent.topP || undefined,
        frequencyPenalty: dbAgent.frequencyPenalty || undefined,
        presencePenalty: dbAgent.presencePenalty || undefined,
      },
      systemPrompt: dbAgent.systemPrompt || '',
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
    }));

    return NextResponse.json({ data: agents });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/agents] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/agents
 *
 * Create a new agent in the workspace.
 *
 * @param request - Next.js request with agent data
 * @param context - Route context containing workspace ID
 * @returns Created agent object
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

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

    // Validate input
    const parseResult = createAgentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Validation failed',
            errors: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const input: CreateAgentInput = parseResult.data;

    // Get default config for the agent type
    const defaultConfig = DEFAULT_MODEL_CONFIGS[input.type as AgentType];

    // Merge with provided config
    const config: AgentModelConfig = {
      ...defaultConfig,
      ...input.config,
    };

    // Create agent in database
    const dbAgent = await prisma.agent.create({
      data: {
        workspaceId,
        name: input.name,
        type: input.type.toUpperCase() as
          | 'TASK'
          | 'RESEARCH'
          | 'CODING'
          | 'DATA'
          | 'QA'
          | 'SUPPORT'
          | 'CUSTOM',
        description: input.description || null,
        status: 'ACTIVE',
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP || null,
        frequencyPenalty: config.frequencyPenalty || null,
        presencePenalty: config.presencePenalty || null,
        tools: input.tools || [],
        systemPrompt:
          input.systemPrompt ||
          `You are a ${input.type} agent. Help users with ${input.type}-related tasks.`,
        createdById: session.user.id,
      },
    });

    // Transform to API format
    const newAgent: Agent = {
      id: dbAgent.id,
      workspaceId: dbAgent.workspaceId,
      name: dbAgent.name,
      type: dbAgent.type.toLowerCase() as AgentType,
      description: dbAgent.description || '',
      status: dbAgent.status.toLowerCase() as AgentStatus,
      config: {
        model: dbAgent.model,
        temperature: dbAgent.temperature,
        maxTokens: dbAgent.maxTokens,
        topP: dbAgent.topP || undefined,
        frequencyPenalty: dbAgent.frequencyPenalty || undefined,
        presencePenalty: dbAgent.presencePenalty || undefined,
      },
      systemPrompt: dbAgent.systemPrompt || '',
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

    return NextResponse.json(
      {
        data: newAgent,
        message: 'Agent created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/agents] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
    );
  }
}
