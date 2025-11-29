/**
 * Email Unsubscribe API Route
 *
 * Handles unsubscribe requests for email notifications (CAN-SPAM compliance).
 * Users can click unsubscribe links in emails to opt-out of specific email types.
 *
 * Routes:
 * - GET /api/unsubscribe?token=... - Process unsubscribe request and show confirmation page
 *
 * @module app/api/unsubscribe/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { verifyUnsubscribeToken } from '@/lib/email';

import type { EmailType } from '@/lib/email';
import type { NextRequest } from 'next/server';

/**
 * Email preferences stored in user.preferences JSON field
 */
interface EmailPreferences {
  emailUnsubscribed?: {
    marketing?: boolean;
    notifications?: boolean;
    digest?: boolean;
    all?: boolean;
  };
  unsubscribedAt?: {
    marketing?: string;
    notifications?: string;
    digest?: string;
    all?: string;
  };
}

/**
 * Generate HTML response for unsubscribe confirmation
 */
function generateUnsubscribeHTML(
  success: boolean,
  emailType?: EmailType,
  userEmail?: string,
  errorMessage?: string
): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Neolith';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (success && emailType && userEmail) {
    const emailTypeDisplay = emailType === 'all' ? 'all emails' : `${emailType} emails`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - ${appName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
      padding: 48px 32px;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      stroke: white;
      stroke-width: 2;
      fill: none;
    }
    h1 {
      font-size: 28px;
      color: #1f2937;
      margin-bottom: 12px;
      font-weight: 700;
    }
    .email-type {
      color: #667eea;
      font-weight: 600;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 16px;
      font-size: 16px;
    }
    .email {
      color: #4b5563;
      font-weight: 500;
      font-family: 'Monaco', 'Courier New', monospace;
      background: #f3f4f6;
      padding: 8px 12px;
      border-radius: 6px;
      display: inline-block;
      margin: 8px 0;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 24px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #5568d3;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 14px;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>Successfully Unsubscribed</h1>
    <p>You've been unsubscribed from <span class="email-type">${emailTypeDisplay}</span></p>
    <div class="email">${userEmail}</div>
    <p>You will no longer receive ${emailTypeDisplay} from ${appName}.</p>
    ${emailType !== 'all' ? `
    <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">
      You can manage all your email preferences in your account settings.
    </p>
    ` : ''}
    <a href="${appUrl}" class="button">Return to ${appName}</a>
    <div class="footer">
      <p>
        Changed your mind? You can update your email preferences in your
        <a href="${appUrl}/settings/notifications">account settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // Error page
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe Error - ${appName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
      padding: 48px 32px;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      stroke: white;
      stroke-width: 2;
      fill: none;
    }
    h1 {
      font-size: 28px;
      color: #1f2937;
      margin-bottom: 12px;
      font-weight: 700;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 16px;
      font-size: 16px;
    }
    .error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 12px;
      border-radius: 8px;
      margin: 24px 0;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 24px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #5568d3;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
    <h1>Unsubscribe Failed</h1>
    <p>We couldn't process your unsubscribe request.</p>
    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
    <p>Please contact support if you continue to receive unwanted emails.</p>
    <a href="${appUrl}" class="button">Return to ${appName}</a>
  </div>
</body>
</html>`;
}

/**
 * GET /api/unsubscribe?token=...
 *
 * Process email unsubscribe request using a signed token.
 * Updates user preferences and returns HTML confirmation page.
 *
 * @param request - Next.js request with token query parameter
 * @returns HTML page confirming unsubscribe or showing error
 *
 * @example
 * ```
 * GET /api/unsubscribe?token=eyJ1c2VySWQiOi...
 * ```
 *
 * @example Response (200 OK)
 * Returns HTML page confirming successful unsubscribe
 *
 * @example Error Response
 * Returns HTML page with error message
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      console.warn('[GET /api/unsubscribe] Missing token parameter');
      return new NextResponse(
        generateUnsubscribeHTML(false, undefined, undefined, 'Missing unsubscribe token'),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // Verify and decode token
    const payload = verifyUnsubscribeToken(token);
    if (!payload) {
      console.warn('[GET /api/unsubscribe] Invalid or expired token');
      return new NextResponse(
        generateUnsubscribeHTML(
          false,
          undefined,
          undefined,
          'This unsubscribe link is invalid or has expired. Unsubscribe links are valid for 90 days.'
        ),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const { userId, emailType } = payload;

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        preferences: true,
      },
    });

    if (!user) {
      console.warn(`[GET /api/unsubscribe] User not found: ${userId}`);
      return new NextResponse(
        generateUnsubscribeHTML(false, undefined, undefined, 'User account not found'),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // Parse existing preferences
    const currentPreferences = (user.preferences as EmailPreferences) || {};
    const emailUnsubscribed = currentPreferences.emailUnsubscribed || {};
    const unsubscribedAt = currentPreferences.unsubscribedAt || {};

    // Update preferences based on email type
    const now = new Date().toISOString();

    if (emailType === 'all') {
      // Unsubscribe from all email types
      emailUnsubscribed.marketing = true;
      emailUnsubscribed.notifications = true;
      emailUnsubscribed.digest = true;
      emailUnsubscribed.all = true;
      unsubscribedAt.all = now;
    } else {
      // Unsubscribe from specific email type
      emailUnsubscribed[emailType] = true;
      unsubscribedAt[emailType] = now;
    }

    // Update user preferences in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...currentPreferences,
          emailUnsubscribed,
          unsubscribedAt,
        },
      },
    });

    console.log(
      `[GET /api/unsubscribe] User ${user.email} (${userId}) unsubscribed from ${emailType} emails`
    );

    // Return success HTML page
    return new NextResponse(
      generateUnsubscribeHTML(true, emailType, user.email),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    // Log error but don't expose details to user
    if (process.env.NODE_ENV === 'development') {
      console.error('[GET /api/unsubscribe] Error:', error);
    } else {
      console.error('[GET /api/unsubscribe] Unsubscribe error occurred');
    }

    return new NextResponse(
      generateUnsubscribeHTML(
        false,
        undefined,
        undefined,
        'An unexpected error occurred. Please try again later or contact support.'
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}
