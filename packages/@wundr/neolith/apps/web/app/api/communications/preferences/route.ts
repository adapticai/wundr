/**
 * Communication Preferences API Routes
 *
 * Routes:
 * - GET /api/communications/preferences - Get communication preferences for the authenticated orchestrator
 * - PUT /api/communications/preferences - Upsert communication preferences
 *
 * @module app/api/communications/preferences/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateCommunicationPreferenceSchema,
  COMMUNICATION_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/communication';

import type { NextRequest } from 'next/server';

/**
 * GET /api/communications/preferences
 *
 * Get communication preferences for the current user's orchestrator.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', COMMUNICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Resolve the orchestrator linked to this user
    const orchestrator = await prisma.orchestrator.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });

    const orchestratorId = orchestrator?.id ?? null;
    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'No orchestrator associated with this user',
          COMMUNICATION_ERROR_CODES.PREFERENCE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const preferences = await db.communicationPreference.findUnique({
      where: { orchestratorId },
    });

    if (!preferences) {
      return NextResponse.json(
        createErrorResponse(
          'Communication preferences not found',
          COMMUNICATION_ERROR_CODES.PREFERENCE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error('[GET /api/communications/preferences] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', COMMUNICATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/communications/preferences
 *
 * Create or update communication preferences for the current user's orchestrator.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', COMMUNICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const orchestrator = await prisma.orchestrator.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });

    const orchestratorId = orchestrator?.id ?? null;
    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'No orchestrator associated with this user',
          COMMUNICATION_ERROR_CODES.PREFERENCE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', COMMUNICATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    const parseResult = updateCommunicationPreferenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation failed', COMMUNICATION_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const preferences = await db.communicationPreference.upsert({
      where: { orchestratorId },
      create: {
        orchestratorId,
        ...parseResult.data,
        channelRanking: parseResult.data.channelRanking ?? [],
        notificationRules: parseResult.data.notificationRules ?? {},
      },
      update: parseResult.data,
    });

    return NextResponse.json({ data: preferences, message: 'Preferences updated' });
  } catch (error) {
    console.error('[PUT /api/communications/preferences] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', COMMUNICATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
