# Email Preview and Testing Utilities

Email testing tools for development and admin testing of email templates.

## Overview

This module provides three main components for testing email templates:

1. **Email Preview API** - Renders email templates to HTML without sending
2. **Send Test Email API** - Actually sends test emails using templates
3. **Email Preview Page** - Interactive UI for previewing and testing emails

## Features

- Preview all email templates (welcome, password-reset, verification, invitation, notification, password-changed)
- Live preview with customizable props
- Send test emails to verify delivery
- Only accessible in development or by admin users
- Template-specific form fields for easy testing

## Usage

### Access the Preview Page

Navigate to `/email-preview` in your development environment:

```
http://localhost:3000/email-preview
```

### Using the Preview Page

1. Select a template from the dropdown
2. Fill in template-specific properties
3. Click "Refresh Preview" to see changes
4. Click "Send Test Email" to send to the specified email address

### API Endpoints

#### Preview Email Template

**GET** `/api/admin/email-preview`

Query parameters:
- `template` (required) - Template name
- `email` - Recipient email for context
- Additional template-specific parameters

Example:
```bash
curl "http://localhost:3000/api/admin/email-preview?template=welcome&email=user@example.com&username=John"
```

Returns rendered HTML of the email template.

#### Send Test Email

**POST** `/api/admin/send-test-email`

Request body:
```json
{
  "template": "welcome",
  "to": "test@example.com",
  "props": {
    "username": "Test User"
  }
}
```

Example:
```bash
curl -X POST http://localhost:3000/api/admin/send-test-email \
  -H "Content-Type: application/json" \
  -d '{
    "template": "welcome",
    "to": "test@example.com",
    "props": {
      "username": "John Doe"
    }
  }'
```

## Available Templates

### 1. Welcome Email
Sent when a new user signs up.

Props:
- `username` - User's display name
- `loginUrl` - URL to login page

### 2. Password Reset
Sent when user requests password reset.

Props:
- `username` - User's display name
- `resetUrl` - Password reset link with token

### 3. Email Verification
Sent to verify email address.

Props:
- `username` - User's display name
- `verificationUrl` - Verification link with token

### 4. Workspace Invitation
Sent when user is invited to workspace.

Props:
- `inviterName` - Name of person sending invite
- `inviterEmail` - Email of person sending invite
- `workspaceName` - Name of workspace
- `inviteUrl` - Invitation acceptance link

### 5. Notification
Generic notification email.

Props:
- `type` - Notification type (mention, message, channel, task, system)
- `title` - Notification title
- `message` - Notification message
- `actionUrl` - URL for action button
- `actionText` - Text for action button

### 6. Password Changed
Confirmation that password was changed.

Props:
- `username` - User's display name
- `email` - User's email
- `timestamp` - When password was changed
- `ipAddress` - IP address of change

## Security

- In production, only accessible to authenticated admin users
- In development, no authentication required
- Admin check can be customized based on your role implementation

## Development Tips

1. **Test all templates** - Make sure to test each template with various props
2. **Check email deliverability** - Verify emails aren't marked as spam
3. **Responsive testing** - Preview emails on mobile and desktop
4. **Content review** - Check all links and content are correct

## Troubleshooting

### Email not sending

1. Check that `RESEND_API_KEY` is set in `.env`
2. Verify the "from" email is authorized in Resend
3. Check API response for detailed error messages

### Preview not rendering

1. Verify all required props are provided
2. Check browser console for errors
3. Try refreshing the preview iframe

### Access denied

1. In production, ensure user has admin role
2. In development, check `NODE_ENV` is set to `development`

## Integration with Email Service

These utilities use the existing email service (`/lib/email.ts`) which includes:

- Retry logic with exponential backoff
- Rate limiting
- Comprehensive error logging
- Support for all email templates

## Next Steps

- Add email template versioning
- Add A/B testing capabilities
- Add email analytics integration
- Add multi-language support
