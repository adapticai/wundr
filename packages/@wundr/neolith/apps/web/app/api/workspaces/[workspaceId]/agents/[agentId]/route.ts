/**
 * Single Agent API Routes
 *
 * Handles operations on individual agent entities.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/agents/:agentId - Get agent details
 * - PATCH /api/workspaces/:workspaceId/agents/:agentId - Update agent
 * - DELETE /api/workspaces/:workspaceId/agents/:agentId - Delete agent
 *
 * @module app/api/workspaces/[workspaceId]/agents/[agentId]/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import type { Agent, UpdateAgentInput } from '@/types/agent';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and agent ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; agentId: string }>;
}

/**
 * Validation schema for updating an agent
 */
const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['task', 'research', 'coding', 'data', 'qa', 'support', 'custom']).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'inactive']).optional(),
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

// In-memory storage (same as in route.ts)
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
 * GET /api/workspaces/:workspaceId/agents/:agentId
 *
 * Get details for a specific agent.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and agent IDs
 * @returns Agent details
 */
export async function GET(
  _request: NextRequest,
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
    const { workspaceId, agentId } = params;

    // Find agent
    const agents = getWorkspaceAgents(workspaceId);
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: agent });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/agents/:agentId] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/agents/:agentId
 *
 * Update an existing agent.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace and agent IDs
 * @returns Updated agent object
 */
export async function PATCH(
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
    const { workspaceId, agentId } = params;

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
    const parseResult = updateAgentSchema.safeParse(body);
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

    const input: UpdateAgentInput = parseResult.data;

    // Find and update agent
    const agents = getWorkspaceAgents(workspaceId);
    const agentIndex = agents.findIndex((a) => a.id === agentId);

    if (agentIndex === -1) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 },
      );
    }

    const existingAgent = agents[agentIndex];

    // Update agent
    const updatedAgent: Agent = {
      ...existingAgent,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.config !== undefined && {
        config: { ...existingAgent.config, ...input.config },
      }),
      ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
      ...(input.tools !== undefined && { tools: input.tools }),
      updatedAt: new Date(),
    };

    agents[agentIndex] = updatedAgent;
    saveWorkspaceAgents(workspaceId, agents);

    return NextResponse.json({
      data: updatedAgent,
      message: 'Agent updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/agents/:agentId] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/agents/:agentId
 *
 * Delete an agent.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and agent IDs
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
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
    const { workspaceId, agentId } = params;

    // Find and delete agent
    const agents = getWorkspaceAgents(workspaceId);
    const agentIndex = agents.findIndex((a) => a.id === agentId);

    if (agentIndex === -1) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 },
      );
    }

    agents.splice(agentIndex, 1);
    saveWorkspaceAgents(workspaceId, agents);

    return NextResponse.json({
      message: 'Agent deleted successfully',
      deletedId: agentId,
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/agents/:agentId] Error:', error);
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 },
    );
  }
}
