/**
 * Email Utility Functions
 *
 * Handles sending various email types using Resend.
 * Requires RESEND_API_KEY and FROM_EMAIL environment variables.
 *
 * @module lib/email
 */

import crypto from 'crypto';

import { Resend } from 'resend';

/**
 * Email types supported by the application
 */
export type EmailType =
  | 'welcome'
  | 'verification'
  | 'password_reset'
  | 'password_changed'
  | 'invitation'
  | 'channel_invitation'
  | 'notification'
  | 'all';

/**
 * Response from email sending functions
 */
export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Configuration for email sending
 */
const EMAIL_FROM =
  process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@neolith.app';

const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Neolith';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000';

/**
 * Lazily initialised Resend client.
 * Returns null when the API key is not configured so callers can degrade
 * gracefully rather than crash the server.
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY is not set. Emails will not be sent.');
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Format the "from" header as "Name <email>"
 */
function fromAddress(): string {
  return `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`;
}

// ---------------------------------------------------------------------------
// HTML email templates
// ---------------------------------------------------------------------------

function invitationEmailHtml(params: {
  inviterName: string;
  workspaceName: string;
  invitationUrl: string;
  role?: string;
  message?: string;
}): string {
  const roleLabel = params.role
    ? params.role.charAt(0).toUpperCase() + params.role.slice(1).toLowerCase()
    : 'Member';

  const personalMessageBlock = params.message
    ? `
    <tr>
      <td style="padding:0 0 16px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;font-style:italic;border-left:3px solid #6366f1;padding-left:12px;">
          "${params.message}"
        </p>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to ${params.workspaceName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                ${params.workspaceName}
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">
                You've been invited to join
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 20px;">
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#111827;">
                      <strong>${params.inviterName}</strong> has invited you to join
                      <strong>${params.workspaceName}</strong> as a
                      <strong>${roleLabel}</strong>.
                    </p>
                  </td>
                </tr>
                ${personalMessageBlock}
                <tr>
                  <td style="padding:0 0 32px;">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                      Click the button below to accept this invitation and get started.
                      This link expires in 7 days.
                    </p>
                  </td>
                </tr>
                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${params.invitationUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;letter-spacing:0.2px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
                <!-- Fallback link -->
                <tr>
                  <td style="padding:0 0 24px;border-top:1px solid #e5e7eb;padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                      If the button above doesn't work, copy and paste this URL into your browser:
                    </p>
                    <p style="margin:8px 0 0;font-size:12px;color:#6366f1;word-break:break-all;">
                      ${params.invitationUrl}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this email because someone invited you to ${params.workspaceName}.
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function channelInvitationEmailHtml(params: {
  inviterName: string;
  inviterEmail?: string;
  channelName: string;
  channelType?: 'public' | 'private';
  channelDescription?: string;
  workspaceName: string;
  invitationUrl: string;
  message?: string;
}): string {
  const channelLabel =
    params.channelType === 'private' ? 'private channel' : 'channel';
  const descriptionBlock = params.channelDescription
    ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${params.channelDescription}</p>`
    : '';
  const personalMessageBlock = params.message
    ? `
    <tr>
      <td style="padding:0 0 16px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;font-style:italic;border-left:3px solid #6366f1;padding-left:12px;">
          "${params.message}"
        </p>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to #${params.channelName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">
                #${params.channelName}
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">
                ${params.workspaceName}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 20px;">
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#111827;">
                      <strong>${params.inviterName}</strong> has invited you to join the
                      <strong>${channelLabel} #${params.channelName}</strong> in
                      <strong>${params.workspaceName}</strong>.
                    </p>
                    ${descriptionBlock}
                  </td>
                </tr>
                ${personalMessageBlock}
                <tr>
                  <td style="padding:0 0 32px;">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                      Click the button below to accept and join the channel.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${params.invitationUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;">
                      Join Channel
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 0;border-top:1px solid #e5e7eb;padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                      If the button above doesn't work, copy and paste this URL into your browser:
                    </p>
                    <p style="margin:8px 0 0;font-size:12px;color:#6366f1;word-break:break-all;">
                      ${params.invitationUrl}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this email because ${params.inviterName} invited you to a channel in ${params.workspaceName}.
                If this was unexpected, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function verificationEmailHtml(email: string, verificationUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email address</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Verify your email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 20px;">
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#111827;">
                      Please verify your email address <strong>${email}</strong> to finish setting up your account.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${verificationUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 0;border-top:1px solid #e5e7eb;padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      This link expires in 24 hours. If you did not create an account, ignore this email.
                    </p>
                    <p style="margin:8px 0 0;font-size:12px;color:#6366f1;word-break:break-all;">${verificationUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function passwordResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Reset your password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 20px;">
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#111827;">
                      We received a request to reset the password for your account.
                      Click the button below to set a new password.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 20px;">
                    <p style="margin:0;font-size:14px;color:#6b7280;">
                      This link expires in 1 hour. If you did not request a password reset, ignore this email — your password will not change.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #e5e7eb;padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:#6366f1;word-break:break-all;">${resetUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function passwordChangedEmailHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your password has been changed</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Password changed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#111827;">
                The password for <strong>${email}</strong> was successfully changed.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                If you did not make this change, please contact support immediately or
                reset your password from the login page.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomeEmailHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Neolith</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Welcome to Neolith</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#111827;">
                Hi <strong>${name}</strong>, welcome aboard!
              </p>
              <p style="margin:0 0 32px;font-size:14px;line-height:1.6;color:#6b7280;">
                Your account is ready. Head to the app to get started.
              </p>
              <a href="${APP_URL}"
                 style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;">
                Open Neolith
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain-text fallbacks
// ---------------------------------------------------------------------------

function invitationEmailText(params: {
  inviterName: string;
  workspaceName: string;
  invitationUrl: string;
  role?: string;
  message?: string;
}): string {
  const lines: string[] = [
    `${params.inviterName} has invited you to join ${params.workspaceName}.`,
    '',
  ];
  if (params.message) {
    lines.push(`Message: "${params.message}"`, '');
  }
  lines.push(
    `Accept your invitation here: ${params.invitationUrl}`,
    '',
    'This link expires in 7 days.'
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<EmailResponse> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping welcome email to ${email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: `Welcome to Neolith, ${name}!`,
      html: welcomeEmailHtml(name),
      text: `Hi ${name}, welcome to Neolith! Open the app here: ${APP_URL}`,
    });

    if (error) {
      console.error('[Email] Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Exception sending welcome email:', err);
    return { success: false, error: message };
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<EmailResponse> {
  const verificationUrl = `${APP_URL}/auth/verify-email?token=${token}`;

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping verification email to ${email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: 'Verify your email address',
      html: verificationEmailHtml(email, verificationUrl),
      text: `Verify your email address: ${verificationUrl}`,
    });

    if (error) {
      console.error('[Email] Failed to send verification email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Exception sending verification email:', err);
    return { success: false, error: message };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<EmailResponse> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping password reset email to ${email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: 'Reset your Neolith password',
      html: passwordResetEmailHtml(resetUrl),
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });

    if (error) {
      console.error('[Email] Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Exception sending password reset email:', err);
    return { success: false, error: message };
  }
}

/**
 * Send password changed confirmation email
 */
export async function sendPasswordChangedEmail(
  email: string
): Promise<EmailResponse> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping password-changed email to ${email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: 'Your Neolith password has been changed',
      html: passwordChangedEmailHtml(email),
      text: `The password for ${email} was successfully changed. If you did not make this change, contact support immediately.`,
    });

    if (error) {
      console.error('[Email] Failed to send password-changed email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Exception sending password-changed email:', err);
    return { success: false, error: message };
  }
}

/**
 * Send workspace invitation email
 */
export async function sendInvitationEmail(params: {
  email: string;
  inviterName: string;
  workspaceName: string;
  invitationUrl: string;
  role?: string;
  message?: string;
}): Promise<EmailResponse> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping invitation email to ${params.email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: params.email,
      subject: `${params.inviterName} invited you to ${params.workspaceName}`,
      html: invitationEmailHtml(params),
      text: invitationEmailText(params),
    });

    if (error) {
      console.error(
        `[Email] Failed to send invitation email to ${params.email}:`,
        error
      );
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[Email] Exception sending invitation email to ${params.email}:`,
      err
    );
    return { success: false, error: message };
  }
}

/**
 * Send channel invitation email
 */
export async function sendChannelInvitationEmail(params: {
  email: string;
  inviterName: string;
  inviterEmail?: string;
  channelName: string;
  channelType?: 'public' | 'private';
  channelDescription?: string;
  workspaceName: string;
  invitationUrl: string;
  message?: string;
}): Promise<EmailResponse> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping channel invitation email to ${params.email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: params.email,
      subject: `${params.inviterName} invited you to #${params.channelName} in ${params.workspaceName}`,
      html: channelInvitationEmailHtml(params),
      text: `${params.inviterName} has invited you to join #${params.channelName} in ${params.workspaceName}.\n\nJoin here: ${params.invitationUrl}`,
    });

    if (error) {
      console.error(
        `[Email] Failed to send channel invitation email to ${params.email}:`,
        error
      );
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[Email] Exception sending channel invitation email to ${params.email}:`,
      err
    );
    return { success: false, error: message };
  }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  email: string,
  subject: string,
  body: string
): Promise<EmailResponse> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      `[Email] Skipping notification email to ${email} — no RESEND_API_KEY`
    );
    return { success: false, error: 'Email service not configured' };
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${body}</p>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject,
      html,
      text: body,
    });

    if (error) {
      console.error('[Email] Failed to send notification email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Exception sending notification email:', err);
    return { success: false, error: message };
  }
}

/**
 * Send test email (admin only)
 */
export async function sendTestEmail(
  to: string,
  emailType: EmailType
): Promise<EmailResponse> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`[Email] Skipping test email to ${to} — no RESEND_API_KEY`);
    return { success: false, error: 'Email service not configured' };
  }

  const subject = `[Test] Neolith ${emailType} email`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <h2>Test email: ${emailType}</h2>
  <p>This is a test email for the <strong>${emailType}</strong> template sent from Neolith.</p>
  <p style="color:#6b7280;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html,
      text: `Test email: ${emailType}. Sent at ${new Date().toISOString()}`,
    });

    if (error) {
      console.error('[Email] Failed to send test email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Exception sending test email:', err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Unsubscribe helpers (unchanged — these are stateless token utilities)
// ---------------------------------------------------------------------------

/**
 * Generate unsubscribe URL with token
 */
export function generateUnsubscribeUrl(
  userId: string,
  emailType: EmailType
): string {
  const token = generateUnsubscribeToken(userId, emailType);
  return `${APP_URL}/api/unsubscribe?token=${token}`;
}

/**
 * Generate unsubscribe token
 */
function generateUnsubscribeToken(
  userId: string,
  emailType: EmailType
): string {
  const secret = process.env.AUTH_SECRET || 'development-secret';
  const payload = `${userId}:${emailType}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify unsubscribe token
 */
export function verifyUnsubscribeToken(
  token: string
): { userId: string; emailType: EmailType } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length !== 4) {
      return null;
    }

    const [userId, emailType, timestamp, signature] = parts;
    const secret = process.env.AUTH_SECRET || 'development-secret';
    const payload = `${userId}:${emailType}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }

    // Token valid for 30 days
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      return null;
    }

    return { userId, emailType: emailType as EmailType };
  } catch {
    return null;
  }
}

/**
 * Check if user is unsubscribed from email type
 */
export async function isUnsubscribed(
  userId: string,
  emailType: EmailType
): Promise<boolean> {
  const { prisma } = await import('@neolith/database');

  const preference = await (prisma as any).emailPreference.findUnique({
    where: { userId_category: { userId, category: emailType } },
    select: { unsubscribed: true },
  });

  return preference?.unsubscribed === true;
}

/**
 * Get unsubscribe status for all email types
 */
export async function getUnsubscribeStatus(
  userId: string
): Promise<Record<EmailType, boolean>> {
  const { prisma } = await import('@neolith/database');

  const rows = await (prisma as any).emailPreference.findMany({
    where: { userId },
    select: { category: true, unsubscribed: true },
  });

  const defaults: Record<EmailType, boolean> = {
    welcome: false,
    verification: false,
    password_reset: false,
    password_changed: false,
    invitation: false,
    channel_invitation: false,
    notification: false,
    all: false,
  };

  for (const row of rows as Array<{
    category: string;
    unsubscribed: boolean;
  }>) {
    if (Object.prototype.hasOwnProperty.call(defaults, row.category)) {
      defaults[row.category as EmailType] = row.unsubscribed;
    }
  }

  return defaults;
}
