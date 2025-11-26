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

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import type {
  Agent,
  AgentType,
  AgentStatus,
  CreateAgentInput,
  AgentModelConfig,
} from '@/types/agent';
import { DEFAULT_MODEL_CONFIGS } from '@/types/agent';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Validation schema for creating an agent
 */
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['task', 'research', 'coding', 'data', 'qa', 'support', 'custom']),
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
  tools: z.array(z.string()).optional(),
});

/**
 * Validation schema for query parameters
 */
const querySchema = z.object({
  type: z.enum(['task', 'research', 'coding', 'data', 'qa', 'support', 'custom']).optional(),
  status: z.enum(['active', 'paused', 'inactive']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// In-memory storage for agents (temporary until Prisma schema is updated)
// In production, this would be stored in workspace settings or a dedicated table
const agentsStore = new Map<string, Agent[]>();

/**
 * Helper function to get agents for a workspace
 */
function getWorkspaceAgents(workspaceId: string): Agent[] {
  return agentsStore.get(workspaceId) || [];
}

/**
 * Helper function to save agents for a workspace
 */
function saveWorkspaceAgents(workspaceId: string, agents: Agent[]): void {
  agentsStore.set(workspaceId, agents);
}

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
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId } = params;

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const queryResult = querySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: { message: 'Invalid query parameters', errors: queryResult.error.flatten() } },
        { status: 400 },
      );
    }

    const { type, status, search } = queryResult.data;

    // Get agents from storage
    let agents = getWorkspaceAgents(workspaceId);

    // Apply filters
    if (type) {
      agents = agents.filter((agent) => agent.type === type);
    }

    if (status) {
      agents = agents.filter((agent) => agent.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      agents = agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchLower) ||
          (agent.description && agent.description.toLowerCase().includes(searchLower)),
      );
    }

    return NextResponse.json({ data: agents });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/agents] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 },
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
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId } = params;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON body' } },
        { status: 400 },
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
        { status: 400 },
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

    // Create new agent
    const newAgent: Agent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      name: input.name,
      type: input.type as AgentType,
      description: input.description || '',
      status: 'active' as AgentStatus,
      config,
      systemPrompt: input.systemPrompt || `You are a ${input.type} agent. Help users with ${input.type}-related tasks.`,
      tools: input.tools || [],
      stats: {
        tasksCompleted: 0,
        successRate: 0,
        avgResponseTime: 0,
        lastActive: null,
        tokensUsed: 0,
        totalCost: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to storage
    const agents = getWorkspaceAgents(workspaceId);
    agents.push(newAgent);
    saveWorkspaceAgents(workspaceId, agents);

    return NextResponse.json(
      {
        data: newAgent,
        message: 'Agent created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/agents] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 },
    );
  }
}
