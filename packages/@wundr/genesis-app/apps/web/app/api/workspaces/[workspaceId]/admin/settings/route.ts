import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    // Return default settings
    return NextResponse.json({
      settings: {
        id: 'settings_' + workspaceId,
        workspaceId,
        general: {
          displayName: 'Workspace',
          timezone: 'UTC',
          locale: 'en-US',
          allowGuestAccess: false,
          requireApprovalToJoin: true,
        },
        security: {
          sessionTimeout: 480,
          mfaRequired: false,
          ssoEnabled: false,
        },
        messaging: {
          allowEditing: true,
          editWindowMinutes: 15,
          allowDeleting: true,
          maxMessageLength: 10000,
          enableThreads: true,
          enableReactions: true,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;
    const updates = await request.json();

    // In production, validate admin role and update in database
    return NextResponse.json({
      settings: {
        id: 'settings_' + workspaceId,
        workspaceId,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: session.user.id,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
