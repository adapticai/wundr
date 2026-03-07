/**
 * Task Intelligent Routing API Route
 *
 * Accepts a task submission and routes it to the appropriate orchestrator
 * based on discipline matching, availability, and load balancing. Creates
 * a task record and routing decision, then forwards to the daemon if connected.
 *
 * Routes:
 * - POST /api/workspaces/[workspaceSlug]/tasks/route - Submit a task for routing
 *
 * @module app/api/workspaces/[workspaceSlug]/tasks/route/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';

import type { Prisma, TaskPriority } from '@neolith/database';
import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const submitTaskForRoutingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .default('MEDIUM'),
  discipline: z.string().optional(),
  preferredAgent: z.string().optional(),
});

// =============================================================================
// Route Context
// =============================================================================

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Infer discipline from task title and description using keyword heuristics.
 * In production this would call an LLM or a dedicated classification service.
 */
function inferDiscipline(title: string, description?: string): string {
  const text = `${title} ${description ?? ''}`.toLowerCase();

  const disciplineKeywords: Record<string, string[]> = {
    engineering: [
      'code',
      'bug',
      'feature',
      'deploy',
      'api',
      'database',
      'backend',
      'frontend',
      'test',
      'refactor',
      'architecture',
      'performance',
      'security',
    ],
    product: [
      'roadmap',
      'requirement',
      'user story',
      'acceptance criteria',
      'mvp',
      'backlog',
      'sprint',
      'stakeholder',
      'feature request',
      'product',
    ],
    design: [
      'ui',
      'ux',
      'wireframe',
      'mockup',
      'figma',
      'prototype',
      'design',
      'accessibility',
      'brand',
      'typography',
      'color',
    ],
    data: [
      'analytics',
      'dashboard',
      'report',
      'metric',
      'kpi',
      'data',
      'pipeline',
      'etl',
      'warehouse',
      'bi',
      'insight',
    ],
    qa: [
      'test',
      'qa',
      'quality',
      'regression',
      'automation',
      'e2e',
      'unit test',
      'integration test',
      'bug report',
      'defect',
    ],
  };

  let bestMatch = 'engineering';
  let bestScore = 0;

  for (const [disc, keywords] of Object.entries(disciplineKeywords)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = disc;
    }
  }

  return bestMatch;
}

/**
 * Check if a daemon is currently connected for a given orchestrator by
 * looking up the heartbeat key in Redis.
 */
async function isDaemonConnected(orchestratorId: string): Promise<boolean> {
  try {
    const heartbeat = await redis.get(`daemon:heartbeat:${orchestratorId}`);
    return heartbeat !== null;
  } catch {
    return false;
  }
}

/**
 * Forward the task payload to the daemon via HTTP if the daemon has registered
 * an endpoint. Failures are non-fatal - the task record and routing decision
 * are already persisted.
 */
async function forwardToDaemon(
  orchestratorId: string,
  payload: {
    taskId: string;
    title: string;
    description?: string;
    priority: string;
    routingDecisionId: string;
  }
): Promise<{ forwarded: boolean; sessionId?: string }> {
  try {
    // Retrieve daemon registration from Redis to get its endpoint
    const registrationRaw = await redis.get(
      `daemon:registration:${orchestratorId}`
    );
    if (!registrationRaw) {
      return { forwarded: false };
    }

    const registration = JSON.parse(registrationRaw) as {
      host: string;
      port: number;
      protocol: string;
    };

    const daemonBaseUrl = `${registration.protocol}://${registration.host}:${registration.port}`;
    const response = await fetch(`${daemonBaseUrl}/tasks/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = (await response.json()) as { sessionId?: string };
      return { forwarded: true, sessionId: data.sessionId };
    }

    return { forwarded: false };
  } catch {
    // Daemon may be unreachable - this is expected and non-fatal
    return { forwarded: false };
  }
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /api/workspaces/[workspaceSlug]/tasks/route
 *
 * Submit a task for intelligent routing to an orchestrator. The endpoint:
 * 1. Validates the requesting user is a workspace member.
 * 2. Creates a task record in the database.
 * 3. Analyzes the task content to determine the discipline if not supplied.
 * 4. Selects the most suitable available orchestrator for that discipline.
 * 5. Creates a routingDecision record in the database.
 * 6. Optionally forwards to the daemon for immediate execution.
 *
 * Request body:
 * {
 *   "title": "Implement OAuth2 flow",
 *   "description": "Add Google OAuth2 sign-in to the mobile app",
 *   "priority": "HIGH",
 *   "discipline": "engineering",
 *   "preferredAgent": "orch_abc123"
 * }
 *
 * @param request - Next.js request with task data
 * @param context - Route context with workspace slug
 * @returns Created task with routing decision
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
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this workspace',
          TASK_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          TASK_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = submitTaskForRoutingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Determine discipline
    const targetDiscipline =
      input.discipline ?? inferDiscipline(input.title, input.description);

    // Find available orchestrators for this discipline within the organization.
    // If a preferred agent is specified, try to use that one first.
    const routingStartMs = Date.now();
    let targetOrchestrator: {
      id: string;
      discipline: string;
      role: string;
      user: { id: string; name: string | null };
      sessionManagers: { id: string; name: string; status: string }[];
    } | null = null;

    if (input.preferredAgent) {
      targetOrchestrator = await prisma.orchestrator.findFirst({
        where: {
          id: input.preferredAgent,
          organizationId: workspace.organizationId,
          status: { in: ['ONLINE', 'BUSY'] },
        },
        select: {
          id: true,
          discipline: true,
          role: true,
          user: { select: { id: true, name: true } },
          sessionManagers: {
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, status: true },
            take: 1,
          },
        },
      });
    }

    // Fall back to discipline-based matching
    if (!targetOrchestrator) {
      targetOrchestrator = await prisma.orchestrator.findFirst({
        where: {
          organizationId: workspace.organizationId,
          discipline: { contains: targetDiscipline, mode: 'insensitive' },
          status: { in: ['ONLINE', 'BUSY'] },
        },
        orderBy: [
          // Prefer ONLINE over BUSY
          { status: 'asc' },
          { updatedAt: 'asc' },
        ],
        select: {
          id: true,
          discipline: true,
          role: true,
          user: { select: { id: true, name: true } },
          sessionManagers: {
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, status: true },
            take: 1,
          },
        },
      });
    }

    // If still no online orchestrator, find any orchestrator in the org as fallback
    if (!targetOrchestrator) {
      targetOrchestrator = await prisma.orchestrator.findFirst({
        where: { organizationId: workspace.organizationId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          discipline: true,
          role: true,
          user: { select: { id: true, name: true } },
          sessionManagers: {
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, status: true },
            take: 1,
          },
        },
      });
    }

    if (!targetOrchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'No orchestrators available in this organization',
          TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 503 }
      );
    }

    const routingLatencyMs = Date.now() - routingStartMs;
    const targetSessionManager = targetOrchestrator.sessionManagers[0] ?? null;

    // Determine match reason
    let matchedBy = 'discipline_match';
    if (
      input.preferredAgent &&
      targetOrchestrator.id === input.preferredAgent
    ) {
      matchedBy = 'direct_mention';
    } else if (
      !targetOrchestrator.discipline
        .toLowerCase()
        .includes(targetDiscipline.toLowerCase())
    ) {
      matchedBy = 'fallback';
    }

    // Build routing reasoning
    const reasoning = `Task matched to orchestrator "${targetOrchestrator.user.name ?? targetOrchestrator.id}" (${targetOrchestrator.discipline}) via ${matchedBy}. Inferred discipline: ${targetDiscipline}.`;

    // Create the task and routing decision in a transaction
    const { task, routingDecision } = await prisma.$transaction(async tx => {
      const createdTask = await tx.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority as TaskPriority,
          status: 'TODO',
          orchestratorId: targetOrchestrator!.id,
          workspaceId: workspace.id,
          createdById: session.user.id,
          metadata: {
            discipline: targetDiscipline,
            routingRequested: true,
          } as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          createdAt: true,
        },
      });

      const createdDecision = await tx.routingDecision.create({
        data: {
          organizationId: workspace.organizationId,
          agentId: targetOrchestrator!.user.id,
          agentName: targetOrchestrator!.user.name,
          confidence:
            matchedBy === 'direct_mention'
              ? 1.0
              : matchedBy === 'discipline_match'
                ? 0.85
                : 0.5,
          reasoning,
          matchedBy,
          fallbackUsed: matchedBy === 'fallback',
          routingLatencyMs,
          metadata: {
            taskId: createdTask.id,
            discipline: targetDiscipline,
            sessionManagerId: targetSessionManager?.id ?? null,
            workspaceId: workspace.id,
          } as Prisma.InputJsonValue,
        },
      });

      return { task: createdTask, routingDecision: createdDecision };
    });

    // Attempt to forward to daemon (non-blocking, best-effort)
    let daemonResult: { forwarded: boolean; sessionId?: string } = {
      forwarded: false,
    };
    const daemonConnected = await isDaemonConnected(targetOrchestrator.id);
    if (daemonConnected) {
      daemonResult = await forwardToDaemon(targetOrchestrator.id, {
        taskId: task.id,
        title: task.title,
        description: task.description ?? undefined,
        priority: task.priority,
        routingDecisionId: routingDecision.id,
      });
    }

    return NextResponse.json(
      {
        taskId: task.id,
        task,
        routingDecision: {
          id: routingDecision.id,
          targetOrchestrator: {
            id: targetOrchestrator.id,
            discipline: targetOrchestrator.discipline,
            role: targetOrchestrator.role,
            agentName: targetOrchestrator.user.name,
          },
          targetSessionManager: targetSessionManager
            ? { id: targetSessionManager.id, name: targetSessionManager.name }
            : null,
          reasoning,
          matchedBy,
          confidence: routingDecision.confidence,
          routingLatencyMs,
        },
        daemon: {
          connected: daemonConnected,
          forwarded: daemonResult.forwarded,
          sessionId: daemonResult.sessionId ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceSlug]/tasks/route] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
