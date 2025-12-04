/**
 * Email Preview API Route
 *
 * Provides email template preview functionality for development and admin testing.
 * Returns rendered HTML of email templates without actually sending emails.
 *
 * Routes:
 * - GET /api/admin/email-preview - Preview email templates
 *
 * Query Parameters:
 * - template: Email template name (welcome, password-reset, verification, invitation, notification, password-changed)
 * - email: Recipient email (for preview context)
 * - Additional template-specific parameters
 *
 * Security:
 * - Only accessible in development mode or by authenticated admin users
 *
 * @module app/api/admin/email-preview/route
 */

import { render } from '@react-email/render';
import { NextResponse } from 'next/server';

import { InvitationEmail } from '@/emails/invitation';
import { NotificationEmail } from '@/emails/notification';
import { PasswordChangedEmail } from '@/emails/password-changed';
import { PasswordResetEmail } from '@/emails/password-reset';
import { VerificationEmail } from '@/emails/verification';
import { WelcomeEmail } from '@/emails/welcome';
import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * GET /api/admin/email-preview
 *
 * Preview email templates by rendering them to HTML.
 *
 * @param request - Next.js request object
 * @returns Rendered email HTML
 *
 * @example
 * ```
 * GET /api/admin/email-preview?template=welcome&email=user@example.com
 * GET /api/admin/email-preview?template=notification&email=user@example.com&title=Test&message=Hello
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template');
    const email = searchParams.get('email') || 'test@example.com';

    if (!template) {
      return NextResponse.json(
        { error: 'Missing required parameter: template' },
        { status: 400 }
      );
    }

    let emailElement: React.ReactElement;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Generate email template based on type
    switch (template) {
      case 'welcome':
        emailElement = WelcomeEmail({
          username: searchParams.get('username') || 'Test User',
          loginUrl: searchParams.get('loginUrl') || `${baseUrl}/login`,
        });
        break;

      case 'password-reset':
        emailElement = PasswordResetEmail({
          username: searchParams.get('username') || email,
          resetUrl:
            searchParams.get('resetUrl') ||
            `${baseUrl}/reset-password?token=preview-token`,
        });
        break;

      case 'verification':
        emailElement = VerificationEmail({
          username: searchParams.get('username') || email,
          verificationUrl:
            searchParams.get('verificationUrl') ||
            `${baseUrl}/verify-email?token=preview-token`,
        });
        break;

      case 'invitation':
        emailElement = InvitationEmail({
          inviterName: searchParams.get('inviterName') || 'John Doe',
          inviterEmail: searchParams.get('inviterEmail') || 'john@example.com',
          workspaceName: searchParams.get('workspaceName') || 'Test Workspace',
          inviteUrl:
            searchParams.get('inviteUrl') || `${baseUrl}/invite/preview-token`,
        });
        break;

      case 'notification':
        const notificationType = (searchParams.get('type') || 'message') as
          | 'mention'
          | 'message'
          | 'channel'
          | 'task'
          | 'system';
        emailElement = NotificationEmail({
          type: notificationType,
          title: searchParams.get('title') || 'Test Notification',
          message:
            searchParams.get('message') ||
            'This is a test notification message.',
          actionUrl: searchParams.get('actionUrl') || `${baseUrl}/dashboard`,
          actionText: searchParams.get('actionText') || 'View Notification',
          timestamp: new Date(),
          unsubscribeUrl: `${baseUrl}/settings/notifications?unsubscribe=email`,
          preferencesUrl: `${baseUrl}/settings/notifications`,
        });
        break;

      case 'password-changed':
        emailElement = PasswordChangedEmail({
          username: searchParams.get('username') || 'Test User',
          email: email,
          timestamp: new Date().toISOString(),
          ipAddress: searchParams.get('ipAddress') || '192.168.1.1',
        });
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

    // Render email to HTML
    const html = await render(emailElement);

    // Return HTML response
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-Template': template,
        'X-Preview-Mode': 'true',
      },
    });
  } catch (error) {
    console.error('[Email Preview] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to render email template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
