/**
 * Personal Data Inventory API Routes
 *
 * Provides a comprehensive overview of all personal data stored about a user.
 *
 * Routes:
 * - GET /api/user/privacy/inventory - Get personal data inventory
 *
 * @module app/api/user/privacy/inventory/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * GET /api/user/privacy/inventory
 *
 * Get a comprehensive inventory of all personal data stored about the user.
 *
 * @param request - Next.js request object
 * @returns Personal data inventory
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Get user profile data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // Get activity statistics
    const [messageCount, fileCount, workspaceCount] = await Promise.all([
      prisma.message.count({
        where: { authorId: session.user.id },
      }),
      prisma.file.count({
        where: { uploadedById: session.user.id },
      }),
      prisma.workspaceMember.count({
        where: { userId: session.user.id },
      }),
    ]);

    // Calculate storage usage
    const files = await prisma.file.findMany({
      where: { uploadedById: session.user.id },
      select: { size: true },
    });

    const totalBytes = files.reduce(
      (sum, file) => sum + Number(file.size),
      0,
    );
    const totalMB = Math.round((totalBytes / 1024 / 1024) * 100) / 100;

    // Storage limit (example: 1GB per user)
    const storageLimitMB = 1024;

    // Format dates
    const formatDate = (date: Date | null | undefined) => {
      if (!date) return 'Never';
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(date));
    };

    return NextResponse.json({
      profile: {
        name: user.displayName || user.name || 'Unknown',
        email: user.email,
        avatar: user.avatarUrl || '',
        createdAt: formatDate(user.createdAt),
      },
      activity: {
        lastActive: formatDate(user.lastActiveAt),
        totalMessages: messageCount,
        totalFiles: fileCount,
        totalWorkspaces: workspaceCount,
      },
      storage: {
        used: totalMB,
        limit: storageLimitMB,
        unit: 'MB',
      },
    });
  } catch (error) {
    console.error('[GET /api/user/privacy/inventory] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
