/**
 * Communication Logs API Routes
 *
 * Routes:
 * - GET /api/communications - List communication logs with filters and pagination
 * - POST /api/communications - Create a new communication log entry
 *
 * @module app/api/communications/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  communicationLogFilterSchema,
  createCommunicationLogSchema,
  COMMUNICATION_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/communication';

import type { NextRequest } from 'next/server';

/**
 * GET /api/communications
 *
 * List communication logs with optional filters and offset pagination.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', COMMUNICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = communicationLogFilterSchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid query parameters', COMMUNICATION_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 }
      );
    }

    const filters = parseResult.data;
    const { page, limit, sortBy, sortOrder, orchestratorId, channel, direction, status, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (orchestratorId) where.orchestratorId = orchestratorId;
    if (channel) where.channel = channel;
    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const [total, logs] = await Promise.all([
      db.communicationLog.count({ where }),
      db.communicationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/communications] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', COMMUNICATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * POST /api/communications
 *
 * Create a new communication log entry.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', COMMUNICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
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

    const parseResult = createCommunicationLogSchema.safeParse(body);
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
    const log = await db.communicationLog.create({
      data: {
        ...parseResult.data,
        status: 'pending',
        metadata: parseResult.data.metadata ?? {},
      },
    });

    return NextResponse.json({ data: log, message: 'Communication log created' }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/communications] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', COMMUNICATION_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
