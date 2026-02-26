/**
 * Storage API Routes
 *
 * Handles workspace storage management.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/storage - Get storage overview
 * - PATCH /api/workspaces/:workspaceSlug/storage - Update storage settings
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/storage/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface StorageBreakdown {
  type: string;
  size: number;
  count: number;
  percentage: number;
}

interface StorageUsageOverTime {
  date: string;
  size: number;
}

interface LargeFile {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  url?: string;
}

interface StorageSettings {
  quota: number; // in GB
  retentionDays: number;
  autoCleanup: boolean;
  warningThreshold: number; // percentage
}

interface CleanupRule {
  id: string;
  name: string;
  enabled: boolean;
  fileType?: string;
  olderThanDays?: number;
  minSize?: number;
}

interface StorageAlert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  createdAt: string;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/storage
 *
 * Get storage overview and statistics. Requires admin role.
 */
export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspaceSlug, userId: session.user.id },
      include: { workspace: true },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get storage settings from workspace settings
    const workspaceSettings =
      (membership.workspace.settings as Record<string, unknown>) || {};
    const storageConfig =
      (workspaceSettings.storage as Record<string, unknown>) || {};

    const settings: StorageSettings = {
      quota: (storageConfig.quota as number) || 5, // Default 5GB
      retentionDays: (storageConfig.retentionDays as number) || 365,
      autoCleanup: (storageConfig.autoCleanup as boolean) || false,
      warningThreshold: (storageConfig.warningThreshold as number) || 80,
    };

    const cleanupRules: CleanupRule[] =
      (storageConfig.cleanupRules as CleanupRule[]) || [];

    // Get all files for the workspace
    const files = await prisma.file.findMany({
      where: { workspaceId: workspaceSlug },
      include: {
        uploadedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { size: 'desc' },
    });

    // Calculate total storage (convert BigInt to number)
    const totalSize = files.reduce(
      (sum, file) => sum + Number(file.size || 0n),
      0
    );
    const totalSizeGB = totalSize / (1024 * 1024 * 1024);

    // Calculate storage breakdown by file type
    const typeBreakdown = new Map<string, { size: number; count: number }>();

    files.forEach(file => {
      const extension =
        file.originalName?.split('.').pop()?.toLowerCase() || 'unknown';
      const category = getCategoryFromExtension(extension);

      const current = typeBreakdown.get(category) || { size: 0, count: 0 };
      typeBreakdown.set(category, {
        size: current.size + Number(file.size || 0n),
        count: current.count + 1,
      });
    });

    const breakdown: StorageBreakdown[] = Array.from(
      typeBreakdown.entries()
    ).map(([type, data]) => ({
      type,
      size: data.size,
      count: data.count,
      percentage: totalSize > 0 ? (data.size / totalSize) * 100 : 0,
    }));

    // Get usage over time
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filesOverTime = await prisma.file.findMany({
      where: {
        workspaceId: workspaceSlug,
        createdAt: { gte: cutoffDate },
      },
      select: { createdAt: true, size: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const usageByDate = new Map<string, number>();
    let runningTotal = 0;

    // Get initial total before the period
    const initialFiles = await prisma.file.aggregate({
      where: {
        workspaceId: workspaceSlug,
        createdAt: { lt: cutoffDate },
      },
      _sum: { size: true },
    });
    runningTotal = Number(initialFiles._sum.size || 0n);

    filesOverTime.forEach(file => {
      const date = file.createdAt.toISOString().split('T')[0];
      runningTotal += Number(file.size || 0n);
      usageByDate.set(date, runningTotal);
    });

    const usageOverTime: StorageUsageOverTime[] = Array.from(
      usageByDate.entries()
    ).map(([date, size]) => ({
      date,
      size: size / (1024 * 1024 * 1024), // Convert to GB
    }));

    // Get large files (top 50)
    const largeFiles: LargeFile[] = files.slice(0, 50).map(file => ({
      id: file.id,
      name: file.originalName || 'Unnamed file',
      size: Number(file.size || 0n),
      type: file.mimeType || 'application/octet-stream',
      createdAt: file.createdAt.toISOString(),
      createdBy: file.uploadedById || '',
      createdByName:
        file.uploadedBy?.name || file.uploadedBy?.email || 'Unknown',
      url: file.thumbnailUrl || undefined,
    }));

    // Generate alerts
    const alerts: StorageAlert[] = [];
    const usagePercentage = (totalSizeGB / settings.quota) * 100;

    if (usagePercentage >= 100) {
      alerts.push({
        id: 'storage-full',
        type: 'critical',
        message: `Storage quota exceeded. Using ${totalSizeGB.toFixed(2)} GB of ${settings.quota} GB.`,
        createdAt: new Date().toISOString(),
      });
    } else if (usagePercentage >= settings.warningThreshold) {
      alerts.push({
        id: 'storage-warning',
        type: 'warning',
        message: `Storage is ${usagePercentage.toFixed(1)}% full. Consider cleaning up old files.`,
        createdAt: new Date().toISOString(),
      });
    }

    // Check for old files if retention policy is set
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - settings.retentionDays);

    const oldFilesCount = await prisma.file.count({
      where: {
        workspaceId: workspaceSlug,
        createdAt: { lt: retentionCutoff },
      },
    });

    if (oldFilesCount > 0) {
      alerts.push({
        id: 'old-files',
        type: 'warning',
        message: `${oldFilesCount} files are older than ${settings.retentionDays} days and may be eligible for cleanup.`,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      overview: {
        totalSize,
        totalSizeGB: Math.round(totalSizeGB * 100) / 100,
        quota: settings.quota,
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        fileCount: files.length,
      },
      breakdown,
      usageOverTime,
      largeFiles,
      settings,
      cleanupRules,
      alerts,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/storage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage info' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceSlug/admin/storage
 *
 * Update storage settings. Requires admin role.
 */
export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspaceSlug, userId: session.user.id },
      include: { workspace: true },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get current settings
    const workspaceSettings =
      (membership.workspace.settings as Record<string, unknown>) || {};
    const currentStorageSettings =
      (workspaceSettings.storage as Record<string, unknown>) || {};

    // Merge with new settings
    const updatedStorageSettings = {
      ...currentStorageSettings,
      ...body,
    };

    // Update workspace settings
    await prisma.workspace.update({
      where: { id: membership.workspace.id },
      data: {
        settings: {
          ...workspaceSettings,
          storage: updatedStorageSettings,
        },
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedStorageSettings,
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceSlug/storage] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to update storage settings' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to categorize files by extension
 */
function getCategoryFromExtension(extension: string): string {
  const categories: Record<string, string[]> = {
    Images: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'],
    Videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'],
    Audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
    Documents: [
      'pdf',
      'doc',
      'docx',
      'txt',
      'rtf',
      'odt',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
    ],
    Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
    Code: [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'java',
      'cpp',
      'c',
      'h',
      'css',
      'html',
      'json',
      'xml',
    ],
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }

  return 'Other';
}
