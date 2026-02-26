/**
 * Communication Log Detail API Routes
 *
 * Routes:
 * - GET /api/communications/:logId - Get a single communication log entry
 * - PATCH /api/communications/:logId - Update status of a communication log
 *
 * @module app/api/communications/[logId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  logIdParamSchema,
  updateCommunicationLogSchema,
  COMMUNICATION_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/communication';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ logId: string }>;
}

/**
 * GET /api/communications/:logId
 *
 * Retrieve a single communication log entry by ID.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', COMMUNICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const params = await context.params;
    const paramResult = logIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid log ID', COMMUNICATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const log = await db.communicationLog.findUnique({
      where: { id: params.logId },
    });

    if (!log) {
      return NextResponse.json(
        createErrorResponse('Communication log not found', COMMUNICATION_ERROR_CODES.LOG_NOT_FOUND),
        { status: 404 }
      );
    }

    return NextResponse.json({ data: log });
  } catch (error) {
    console.error('[GET /api/communications/:logId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', COMMUNICATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/communications/:logId
 *
 * Update the status (and related fields) of a communication log entry.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', COMMUNICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const params = await context.params;
    const paramResult = logIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid log ID', COMMUNICATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
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

    const parseResult = updateCommunicationLogSchema.safeParse(body);
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
    const existing = await db.communicationLog.findUnique({
      where: { id: params.logId },
    });

    if (!existing) {
      return NextResponse.json(
        createErrorResponse('Communication log not found', COMMUNICATION_ERROR_CODES.LOG_NOT_FOUND),
        { status: 404 }
      );
    }

    const data = parseResult.data;
    const updated = await db.communicationLog.update({
      where: { id: params.logId },
      data: {
        ...data,
        ...(data.sentAt && { sentAt: new Date(data.sentAt) }),
        ...(data.deliveredAt && { deliveredAt: new Date(data.deliveredAt) }),
      },
    });

    return NextResponse.json({ data: updated, message: 'Communication log updated' });
  } catch (error) {
    console.error('[PATCH /api/communications/:logId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', COMMUNICATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
