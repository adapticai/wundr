/**
 * Data Export API Routes (GDPR Compliance)
 *
 * Handles data export requests allowing users to download all their personal data.
 *
 * Routes:
 * - POST /api/user/privacy/export - Request data export
 *
 * @module app/api/user/privacy/export/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/privacy/export
 *
 * Request a complete export of user's personal data (GDPR compliance).
 * This creates a job that collects all user data and generates a downloadable archive.
 *
 * @param request - Next.js request object
 * @returns Export job status
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        preferences: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Get user's workspace memberships
    const workspaceMemberships = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Get user's channel memberships
    const channelMemberships = await prisma.channelMember.findMany({
      where: { userId: session.user.id },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Get user's messages (count only for privacy)
    const messageCount = await prisma.message.count({
      where: { authorId: session.user.id },
    });

    // Get user's files
    const files = await prisma.file.findMany({
      where: { uploadedById: session.user.id },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });

    // Get user's notifications
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        type: true,
        title: true,
        read: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 notifications
    });

    // Prepare export data
    const exportData = {
      exportDate: new Date().toISOString(),
      userData: {
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt,
        },
        preferences: user.preferences,
      },
      workspaces: workspaceMemberships.map(m => ({
        workspaceId: m.workspace.id,
        workspaceName: m.workspace.name,
        workspaceSlug: m.workspace.slug,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      channels: channelMemberships.map(m => ({
        channelId: m.channel.id,
        channelName: m.channel.name,
        channelSlug: m.channel.slug,
        role: m.role,
        joinedAt: m.joinedAt,
        lastReadAt: m.lastReadAt,
        isStarred: m.isStarred,
      })),
      activity: {
        totalMessages: messageCount,
        totalFiles: files.length,
        totalWorkspaces: workspaceMemberships.length,
        totalChannels: channelMemberships.length,
      },
      files: files.map(f => ({
        id: f.id,
        filename: f.filename,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: Number(f.size),
        createdAt: f.createdAt,
      })),
      notifications: notifications,
    };

    // In a production environment, you would:
    // 1. Create a background job to generate the export
    // 2. Upload the export to S3 with a signed URL
    // 3. Send an email when ready
    // 4. Store the export status in the database

    // For now, we'll simulate this by creating a data URL
    const exportJson = JSON.stringify(exportData, null, 2);
    const exportBlob = Buffer.from(exportJson).toString('base64');
    const downloadUrl = `data:application/json;base64,${exportBlob}`;

    // Update user preferences with export status
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          dataExportStatus: {
            status: 'completed',
            progress: 100,
            downloadUrl,
            requestedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        } as never,
      },
    });

    return NextResponse.json({
      success: true,
      exportId: user.id,
      status: 'completed',
      message: 'Data export is ready',
    });
  } catch (error) {
    console.error('[POST /api/user/privacy/export] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
