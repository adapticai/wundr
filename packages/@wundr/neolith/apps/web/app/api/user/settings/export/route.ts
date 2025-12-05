/**
 * Data Export API Route
 *
 * Handles user data export requests. Creates background job for data compilation
 * and notifies user when export is ready.
 *
 * Routes:
 * - POST /api/user/settings/export - Request data export
 * - GET /api/user/settings/export - Get export status
 *
 * @module app/api/user/settings/export/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  dataExportRequestSchema,
  createSettingsErrorResponse,
  SETTINGS_ERROR_CODES,
} from '@/lib/validations/settings';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Data export status
 */
interface ExportStatus {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  requestedAt?: string;
  completedAt?: string;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * GET /api/user/settings/export
 *
 * Get the status of the current or most recent data export.
 *
 * @param request - Next.js request object
 * @returns Export status and download URL if ready
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Authentication required',
          SETTINGS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get user preferences for export status
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'User not found',
          SETTINGS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const exportStatus: ExportStatus =
      (prefs.dataExportStatus as ExportStatus) ||
      ({
        status: 'idle',
        progress: 0,
      } as ExportStatus);

    return NextResponse.json({
      success: true,
      data: exportStatus,
    });
  } catch (error) {
    console.error('[GET /api/user/settings/export] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/settings/export
 *
 * Request a new data export. Creates a background job to compile user data.
 *
 * @param request - Request with export options
 * @returns Export job details
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Authentication required',
          SETTINGS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Invalid JSON body',
          SETTINGS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = dataExportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Validation failed',
          SETTINGS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const exportOptions = parseResult.data;

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'User not found',
          SETTINGS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const currentExportStatus = prefs.dataExportStatus as
      | ExportStatus
      | undefined;

    // Check if export is already in progress
    if (
      currentExportStatus &&
      (currentExportStatus.status === 'pending' ||
        currentExportStatus.status === 'processing')
    ) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Data export already in progress',
          SETTINGS_ERROR_CODES.EXPORT_IN_PROGRESS,
          { currentStatus: currentExportStatus }
        ),
        { status: 409 }
      );
    }

    // Create new export status
    const newExportStatus: ExportStatus = {
      status: 'pending',
      progress: 0,
      requestedAt: new Date().toISOString(),
    };

    // Update user preferences with new export status
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...prefs,
          dataExportStatus: newExportStatus,
          dataExportOptions: exportOptions,
        } as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // In a production app, you would:
    // 1. Create a job in a queue (e.g., BullMQ, Agenda)
    // 2. Process data export in background worker
    // 3. Upload to temporary storage (e.g., S3)
    // 4. Update status and send notification when ready
    // 5. Set expiration (e.g., 7 days)

    // For now, we'll simulate the job creation
    console.log(
      '[Data Export] Job created for user:',
      session.user.id,
      exportOptions
    );

    // Simulate background processing (in production this would be a queue job)
    setTimeout(async () => {
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            preferences: {
              ...prefs,
              dataExportStatus: {
                status: 'processing',
                progress: 50,
                requestedAt: newExportStatus.requestedAt,
              },
            } as unknown as Prisma.InputJsonValue,
          },
        });

        // Simulate completion after 10 seconds (in production this would take much longer)
        setTimeout(async () => {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

          await prisma.user.update({
            where: { id: session.user.id },
            data: {
              preferences: {
                ...prefs,
                dataExportStatus: {
                  status: 'completed',
                  progress: 100,
                  requestedAt: newExportStatus.requestedAt,
                  completedAt: new Date().toISOString(),
                  downloadUrl: `/api/user/settings/export/download/${session.user.id}`,
                  expiresAt: expiresAt.toISOString(),
                },
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }, 10000);
      } catch (error) {
        console.error('[Data Export] Background processing error:', error);
      }
    }, 1000);

    return NextResponse.json(
      {
        success: true,
        message: 'Data export requested successfully',
        data: newExportStatus,
      },
      { status: 202 } // Accepted
    );
  } catch (error) {
    console.error('[POST /api/user/settings/export] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.EXPORT_FAILED
      ),
      { status: 500 }
    );
  }
}
