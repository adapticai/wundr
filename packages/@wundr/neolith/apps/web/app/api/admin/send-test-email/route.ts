/**
 * Send Test Email API Route
 *
 * Allows administrators to send test emails using any template.
 * Useful for testing email delivery and template rendering.
 *
 * Routes:
 * - POST /api/admin/send-test-email - Send a test email
 *
 * Request Body:
 * - template: Email template name (required)
 * - to: Recipient email address (required)
 * - props: Template-specific properties (optional)
 *
 * Security:
 * - Only accessible in development mode or by authenticated admin users
 *
 * @module app/api/admin/send-test-email/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendInvitationEmail,
  sendNotificationEmail,
  sendPasswordChangedEmail,
} from '@/lib/email';

import type { NextRequest } from 'next/server';

const isDevelopment = process.env.NODE_ENV === 'development';

interface SendTestEmailRequest {
  template: string;
  to: string;
  props?: Record<string, any>;
}

/**
 * POST /api/admin/send-test-email
 *
 * Send a test email using the specified template.
 *
 * @param request - Next.js request object
 * @returns Email send result
 *
 * @example
 * ```json
 * POST /api/admin/send-test-email
 * {
 *   "template": "welcome",
 *   "to": "test@example.com",
 *   "props": {
 *     "username": "Test User"
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Security check: only allow in development or for admin users
    if (!isDevelopment) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check if user is admin
      // Note: Adjust this check based on your actual admin role implementation
      const isAdmin = session.user.email?.includes('admin') || false;
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as SendTestEmailRequest;
    const { template, to, props = {} } = body;

    if (!template || !to) {
      return NextResponse.json(
        { error: 'Missing required fields: template and to are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let result;

    // Send email based on template type
    switch (template) {
      case 'welcome':
        result = await sendWelcomeEmail(to, props.username || 'Test User');
        break;

      case 'password-reset':
        result = await sendPasswordResetEmail(to, props.token || 'test-token');
        break;

      case 'verification':
        result = await sendVerificationEmail(to, props.token || 'test-token');
        break;

      case 'invitation':
        result = await sendInvitationEmail(
          to,
          props.inviterName || 'Admin User',
          props.workspaceName || 'Test Workspace',
          props.token || 'test-token'
        );
        break;

      case 'notification':
        result = await sendNotificationEmail(
          to,
          props.title || 'Test Notification',
          props.message || 'This is a test notification.'
        );
        break;

      case 'password-changed':
        result = await sendPasswordChangedEmail(to);
        break;

      default:
        return NextResponse.json(
          {
            error: 'Invalid template',
            availableTemplates: [
              'welcome',
              'password-reset',
              'verification',
              'invitation',
              'notification',
              'password-changed',
            ],
          },
          { status: 400 }
        );
    }

    // Check if email was sent successfully
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: `Test email sent successfully to ${to}`,
          template,
          messageId: result.messageId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send email',
          details: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Send Test Email] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
