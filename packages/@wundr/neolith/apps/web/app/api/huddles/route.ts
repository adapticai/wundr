/**
 * Huddles API Routes
 *
 * Handles huddle creation and listing operations.
 * Huddles are informal voice/video spaces within a workspace.
 *
 * Routes:
 * - POST /api/huddles - Create a new huddle
 * - GET /api/huddles - List workspace huddles
 *
 * @module app/api/huddles/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createHuddleSchema,
  huddleFiltersSchema,
  CALL_ERROR_CODES,
  type HuddleResponse,
} from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Huddle data stored in workspace settings JSON field.
 * Uses ISO string for dates since JSON doesn't support Date objects.
 */
interface StoredHuddleData {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  roomName: string;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt: string | null;
  createdBy: {
    id: string;
    name: string | null;
  };
  participantCount: number;
}

/**
 * Workspace settings structure containing huddles
 */
interface WorkspaceSettingsWithHuddles {
  huddles?: StoredHuddleData[];
  [key: string]: unknown;
}

// Type assertion helper for JSON values
function toJsonValue<T>(data: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

/**
 * Generate a cryptographically secure short ID.
 *
 * @param length - The length of the ID (default: 8)
 * @returns A random alphanumeric string
 */
function generateSecureId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      result += chars[byte % chars.length];
    }
  }

  return result;
}

/**
 * Generate a unique room name for LiveKit huddle.
 *
 * @param workspaceId - The workspace ID for the huddle
 * @returns A unique room name using cryptographic randomness
 */
function generateHuddleRoomName(workspaceId: string): string {
  const timestamp = Date.now().toString(36);
  const random = generateSecureId(8);
  return `huddle-${workspaceId.slice(-6)}-${timestamp}-${random}`;
}

/**
 * Helper to verify user has access to workspace
 */
async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspaces.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
return null;
}

  // Check organization membership
  const orgMembership = await prisma.organization_members.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
return null;
}

  // Check workspace membership (optional for public workspaces)
  const workspaceMembership = await prisma.workspace_members.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return { workspace, orgMembership, workspaceMembership };
}

/**
 * POST /api/huddles
 *
 * Create a new huddle in a workspace.
 *
 * @param request - Next.js request with huddle creation data
 * @returns Created huddle details with room information
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = createHuddleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { workspaceId, name, description, isPublic } = parseResult.data;

    // Verify workspace access
    const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse('Workspace not found or access denied', CALL_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Generate unique room name
    const roomName = generateHuddleRoomName(workspaceId);

    // Get user info
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, displayName: true },
    });

    // Create huddle record
    const huddleId = `huddle_${Date.now().toString(36)}${generateSecureId(8)}`;
    const now = new Date();

    // Try to create in huddles table
    try {
      await prisma.$executeRaw`
        INSERT INTO huddles (id, workspace_id, name, description, is_public, room_name, status, created_by_id, created_at, updated_at)
        VALUES (${huddleId}, ${workspaceId}, ${name}, ${description ?? null}, ${isPublic ?? true}, ${roomName}, 'active', ${session.user.id}, ${now}, ${now})
      `;
    } catch {
      // If table doesn't exist, store in workspace settings
      const workspace = await prisma.workspaces.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      });

      const currentSettings = workspace?.settings as WorkspaceSettingsWithHuddles | null;
      const existingHuddles = currentSettings?.huddles ?? [];

      const newHuddle: StoredHuddleData = {
        id: huddleId,
        workspaceId,
        name,
        description: description ?? null,
        isPublic: isPublic ?? true,
        roomName,
        status: 'active',
        createdAt: now.toISOString(),
        endedAt: null,
        createdBy: {
          id: session.user.id,
          name: user?.displayName ?? user?.name ?? null,
        },
        participantCount: 1,
      };

      const updatedSettings: Prisma.InputJsonValue = toJsonValue({
        ...currentSettings,
        huddles: [...existingHuddles, newHuddle],
      });

      await prisma.workspaces.update({
        where: { id: workspaceId },
        data: {
          settings: updatedSettings,
        },
      });
    }

    // Add creator as first participant
    try {
      await prisma.$executeRaw`
        INSERT INTO huddle_participants (id, huddle_id, user_id, joined_at, is_audio_enabled, is_video_enabled)
        VALUES (${`hpart_${Date.now().toString(36)}`}, ${huddleId}, ${session.user.id}, ${now}, true, true)
      `;
    } catch {
      // Participants table may not exist
    }

    const response: HuddleResponse = {
      id: huddleId,
      workspaceId,
      name,
      description: description ?? null,
      isPublic: isPublic ?? true,
      roomName,
      status: 'active',
      createdAt: now,
      endedAt: null,
      createdBy: {
        id: session.user.id,
        name: user?.displayName ?? user?.name ?? null,
      },
      participantCount: 1,
    };

    return NextResponse.json({
      data: response,
      message: 'Huddle created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/huddles] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * GET /api/huddles
 *
 * List huddles in workspaces the user has access to.
 *
 * @param request - Next.js request with query parameters
 * @returns List of huddles matching filters
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = huddleFiltersSchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { workspaceId, activeOnly, publicOnly, page, limit, sortBy, sortOrder } = parseResult.data;
    const offset = (page - 1) * limit;

    // Get user's accessible workspaces
    let workspaceIds: string[] = [];

    if (workspaceId) {
      // Verify access to specific workspace
      const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
      if (access) {
        workspaceIds = [workspaceId];
      }
    } else {
      // Get all workspaces user has access to
      const orgMemberships = await prisma.organization_members.findMany({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });

      const orgIds = orgMemberships.map((m) => m.organizationId);

      const workspaces = await prisma.workspaces.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
      });

      workspaceIds = workspaces.map((w) => w.id);
    }

    if (workspaceIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    // Try to get huddles from dedicated table
    let huddles: HuddleResponse[] = [];
    let totalCount = 0;

    try {
      const huddleResults = await prisma.$queryRaw<Array<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        is_public: boolean;
        room_name: string;
        status: string;
        created_at: Date;
        ended_at: Date | null;
        created_by_id: string;
        creator_name: string | null;
        participant_count: number;
      }>>`
        SELECT
          h.id,
          h.workspace_id,
          h.name,
          h.description,
          h.is_public,
          h.room_name,
          h.status,
          h.created_at,
          h.ended_at,
          h.created_by_id,
          u.name as creator_name,
          (SELECT COUNT(*) FROM huddle_participants WHERE huddle_id = h.id AND left_at IS NULL) as participant_count
        FROM huddles h
        LEFT JOIN users u ON h.created_by_id = u.id
        WHERE h.workspace_id = ANY(${workspaceIds})
        ${activeOnly ? prisma.$queryRaw`AND h.status = 'active'` : prisma.$queryRaw``}
        ${publicOnly ? prisma.$queryRaw`AND h.is_public = true` : prisma.$queryRaw``}
        ORDER BY h.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      huddles = huddleResults.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        isPublic: row.is_public,
        roomName: row.room_name,
        status: row.status as 'active' | 'ended',
        createdAt: row.created_at,
        endedAt: row.ended_at,
        createdBy: {
          id: row.created_by_id,
          name: row.creator_name,
        },
        participantCount: Number(row.participant_count),
      }));

      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM huddles WHERE workspace_id = ANY(${workspaceIds})
        ${activeOnly ? prisma.$queryRaw`AND status = 'active'` : prisma.$queryRaw``}
        ${publicOnly ? prisma.$queryRaw`AND is_public = true` : prisma.$queryRaw``}
      `;
      totalCount = Number(countResult[0]?.count ?? 0);
    } catch {
      // Fall back to workspace settings
      const workspaces = await prisma.workspaces.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, settings: true },
      });

      for (const workspace of workspaces) {
        const settings = workspace.settings as WorkspaceSettingsWithHuddles | null;
        if (settings?.huddles) {
          // Convert stored huddle data to HuddleResponse (string dates to Date objects)
          let workspaceHuddles: HuddleResponse[] = settings.huddles.map((h) => ({
            ...h,
            createdAt: new Date(h.createdAt),
            endedAt: h.endedAt ? new Date(h.endedAt) : null,
          }));

          if (activeOnly) {
            workspaceHuddles = workspaceHuddles.filter((h) => h.status === 'active');
          }
          if (publicOnly) {
            workspaceHuddles = workspaceHuddles.filter((h) => h.isPublic);
          }

          huddles.push(...workspaceHuddles);
        }
      }

      // Sort and paginate
      huddles.sort((a, b) => {
        const aVal = a[sortBy as keyof HuddleResponse];
        const bVal = b[sortBy as keyof HuddleResponse];
        if (aVal === null || aVal === undefined || bVal === null || bVal === undefined) {
          return 0;
        }
        if (aVal < bVal) {
          return sortOrder === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortOrder === 'asc' ? 1 : -1;
        }
        return 0;
      });

      totalCount = huddles.length;
      huddles = huddles.slice(offset, offset + limit);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: huddles,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/huddles] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
