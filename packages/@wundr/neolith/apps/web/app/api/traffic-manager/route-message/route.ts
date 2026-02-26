/**
 * Traffic Manager Route Message API
 *
 * Routes:
 * - POST /api/traffic-manager/route-message - Route a message to the right agent
 *
 * @module app/api/traffic-manager/route-message/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  routeMessageInputSchema,
  createErrorResponse,
  TRAFFIC_MANAGER_ERROR_CODES,
} from '@/lib/validations/traffic-manager';

import type { NextRequest } from 'next/server';

/**
 * Discipline keyword matching for content-based routing
 */
const DISCIPLINE_KEYWORDS: Record<string, string[]> = {
  engineering: [
    'deploy',
    'code',
    'bug',
    'api',
    'database',
    'server',
    'build',
    'test',
    'CI',
    'pipeline',
    'git',
  ],
  design: ['design', 'UI', 'UX', 'wireframe', 'mockup', 'figma', 'prototype'],
  marketing: [
    'campaign',
    'SEO',
    'analytics',
    'funnel',
    'conversion',
    'brand',
    'content',
  ],
  finance: [
    'budget',
    'invoice',
    'expense',
    'revenue',
    'forecast',
    'cost',
    'payment',
  ],
  hr: [
    'hiring',
    'onboarding',
    'performance review',
    'PTO',
    'benefits',
    'compensation',
  ],
  legal: ['contract', 'compliance', 'NDA', 'terms', 'policy', 'regulation'],
  operations: ['process', 'workflow', 'SOP', 'vendor', 'logistics'],
  product: [
    'roadmap',
    'feature',
    'backlog',
    'user story',
    'requirement',
    'milestone',
    'release',
  ],
};

function detectDisciplines(content: string): string[] {
  const lower = content.toLowerCase();
  const matches: string[] = [];
  for (const [discipline, keywords] of Object.entries(DISCIPLINE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      matches.push(discipline);
    }
  }
  return matches;
}

function detectUrgency(content: string): string {
  const lower = content.toLowerCase();
  if (
    ['emergency', 'down', 'outage', 'critical', 'broken'].some(w =>
      lower.includes(w)
    )
  )
    return 'CRITICAL';
  if (
    ['urgent', 'asap', 'immediately', 'blocking'].some(w => lower.includes(w))
  )
    return 'URGENT';
  if (['important', 'priority', 'soon'].some(w => lower.includes(w)))
    return 'HIGH';
  return 'NORMAL';
}

/**
 * POST /api/traffic-manager/route-message
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TRAFFIC_MANAGER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          TRAFFIC_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = routeMessageInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          TRAFFIC_MANAGER_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const startMs = Date.now();

    // Check for direct mention in metadata
    const directMention = (input.metadata as Record<string, unknown>)
      ?.directMention as string | undefined;

    // Get available orchestrator agents in the channel
    const channelMembers = await prisma.channelMember.findMany({
      where: {
        channelId: input.channelId,
        user: { isOrchestrator: true },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            orchestratorConfig: {
              select: {
                id: true,
                discipline: true,
                role: true,
                capabilities: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'No agents available in channel',
          TRAFFIC_MANAGER_ERROR_CODES.AGENT_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    let selectedAgent = channelMembers[0];
    let matchedBy = 'fallback';
    let confidence = 0.3;
    let reasoning = 'Default agent selected';
    let escalated = false;

    // 1. Direct mention
    if (directMention) {
      const mentioned = channelMembers.find(m => m.userId === directMention);
      if (mentioned) {
        selectedAgent = mentioned;
        matchedBy = 'direct_mention';
        confidence = 1.0;
        reasoning = `Directly mentioned @${mentioned.user.displayName || mentioned.user.name}`;
      }
    }

    // 2. Discipline match
    if (matchedBy === 'fallback') {
      const disciplines = detectDisciplines(input.messageContent);
      if (disciplines.length > 0) {
        const disciplineMatch = channelMembers.find(m =>
          disciplines.some(
            d =>
              m.user.orchestratorConfig?.discipline?.toLowerCase() === d ||
              (
                m.user.orchestratorConfig?.capabilities as string[] | null
              )?.some((c: string) => c.toLowerCase().includes(d))
          )
        );
        if (disciplineMatch) {
          selectedAgent = disciplineMatch;
          matchedBy = 'discipline_match';
          confidence = 0.75;
          reasoning = `Matched discipline: ${disciplines.join(', ')}`;
        }
      }
    }

    // 3. Check urgency for escalation
    const urgency = detectUrgency(input.messageContent);
    if (urgency === 'CRITICAL' || urgency === 'URGENT') {
      const vpAgent = channelMembers.find(
        m =>
          m.user.orchestratorConfig?.role?.toLowerCase().includes('vp') ||
          m.user.orchestratorConfig?.role?.toLowerCase().includes('chief')
      );
      if (vpAgent && vpAgent.userId !== selectedAgent.userId) {
        selectedAgent = vpAgent;
        matchedBy = 'seniority_escalation';
        confidence = 0.85;
        reasoning = `Escalated due to ${urgency} priority`;
        escalated = true;
      }
    }

    const routingLatencyMs = Date.now() - startMs;

    // Record routing decision
    const channel = await prisma.channel.findUnique({
      where: { id: input.channelId },
      select: { workspace: { select: { organizationId: true } } },
    });

    await (prisma as any).routingDecision.create({
      data: {
        messageId:
          ((input.metadata as Record<string, unknown>)?.messageId as string) ||
          null,
        organizationId: channel?.workspace?.organizationId ?? '',
        agentId: selectedAgent.userId,
        agentName: selectedAgent.user.displayName || selectedAgent.user.name,
        confidence,
        reasoning,
        matchedBy,
        fallbackUsed: matchedBy === 'fallback',
        escalated,
        routingLatencyMs,
        channelId: input.channelId,
        metadata: input.metadata ?? {},
      },
    });

    const fallbackChain = channelMembers
      .filter(m => m.userId !== selectedAgent.userId)
      .slice(0, 3)
      .map(m => m.userId);

    return NextResponse.json({
      data: {
        agentId: selectedAgent.userId,
        agentName: selectedAgent.user.displayName || selectedAgent.user.name,
        confidence,
        reasoning,
        matchedBy,
        fallbackChain,
        escalated,
        routingLatencyMs,
      },
    });
  } catch (error) {
    console.error('[POST /api/traffic-manager/route-message] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TRAFFIC_MANAGER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
