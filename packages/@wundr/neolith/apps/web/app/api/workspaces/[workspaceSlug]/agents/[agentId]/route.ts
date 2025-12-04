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

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { isAvailableTool } from '@/types/agent';

import type {
  Agent,
  UpdateAgentInput,
  AgentType,
  AgentStatus,
  AvailableTool,
} from '@/types/agent';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and agent ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; agentId: string }>;
}

/**
 * Validation schema for updating an agent
 */
const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z
    .enum(['task', 'research', 'coding', 'data', 'qa', 'support', 'custom'])
    .optional(),
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
    const { workspaceSlug: workspaceId, agentId } = params;

    // Find agent in database
    const dbAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        workspaceId,
      },
    });

    if (!dbAgent) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 }
      );
    }

    // Transform to API format
    const agent: Agent = {
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

    return NextResponse.json({ data: agent });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/agents/:agentId] Error:',
      error
    );
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
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
    const { workspaceSlug: workspaceId, agentId } = params;

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
    const parseResult = updateAgentSchema.safeParse(body);
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

    const input: UpdateAgentInput = parseResult.data;

    // Check if agent exists
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        workspaceId,
      },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Prisma.agentUpdateInput = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.type !== undefined) {
      updateData.type = input.type.toUpperCase() as
        | 'TASK'
        | 'RESEARCH'
        | 'CODING'
        | 'DATA'
        | 'QA'
        | 'SUPPORT'
        | 'CUSTOM';
    }
    if (input.description !== undefined) {
      updateData.description = input.description || null;
    }
    if (input.status !== undefined) {
      updateData.status = input.status.toUpperCase() as
        | 'ACTIVE'
        | 'PAUSED'
        | 'INACTIVE';
    }
    if (input.systemPrompt !== undefined) {
      updateData.systemPrompt = input.systemPrompt || null;
    }
    if (input.tools !== undefined) {
      updateData.tools = input.tools;
    }
    if (input.config) {
      if (input.config.model !== undefined) {
        updateData.model = input.config.model;
      }
      if (input.config.temperature !== undefined) {
        updateData.temperature = input.config.temperature;
      }
      if (input.config.maxTokens !== undefined) {
        updateData.maxTokens = input.config.maxTokens;
      }
      if (input.config.topP !== undefined) {
        updateData.topP = input.config.topP;
      }
      if (input.config.frequencyPenalty !== undefined) {
        updateData.frequencyPenalty = input.config.frequencyPenalty;
      }
      if (input.config.presencePenalty !== undefined) {
        updateData.presencePenalty = input.config.presencePenalty;
      }
    }

    // Update agent in database
    const dbAgent = await prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    // Transform to API format
    const updatedAgent: Agent = {
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

    return NextResponse.json({
      data: updatedAgent,
      message: 'Agent updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceId/agents/:agentId] Error:',
      error
    );
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
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
    const { workspaceSlug: workspaceId, agentId } = params;

    // Check if agent exists
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        workspaceId,
      },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 }
      );
    }

    // Delete agent from database
    await prisma.agent.delete({
      where: { id: agentId },
    });

    return NextResponse.json({
      message: 'Agent deleted successfully',
      deletedId: agentId,
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceId/agents/:agentId] Error:',
      error
    );
    return NextResponse.json(
      { error: { message: 'An internal error occurred' } },
      { status: 500 }
    );
  }
}
