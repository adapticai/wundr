# Email Unsubscribe Implementation (CAN-SPAM Compliance)

## Overview

This implementation provides a secure, CAN-SPAM compliant email unsubscribe system for the Neolith platform. Users can unsubscribe from different types of emails using signed tokens that are embedded in email footers.

## Files Created/Modified

### New Files

1. **`/app/api/unsubscribe/route.ts`** - Unsubscribe API endpoint
   - Handles GET requests with signed tokens
   - Updates user preferences in database
   - Returns styled HTML confirmation page

2. **`/scripts/test-unsubscribe.ts`** - Test script
   - Demonstrates token generation and verification
   - Example usage for developers

### Modified Files

1. **`/lib/email.ts`** - Email utilities (added unsubscribe functions)
   - `generateUnsubscribeToken()` - Create signed tokens
   - `generateUnsubscribeUrl()` - Generate complete URLs
   - `verifyUnsubscribeToken()` - Verify and decode tokens
   - `isUnsubscribed()` - Check if user has unsubscribed
   - `getUnsubscribeStatus()` - Get all unsubscribe statuses
   - Updated `sendNotificationEmail()` to auto-generate unsubscribe links

## Email Types

Users can unsubscribe from the following email types:

- `marketing` - Marketing emails and promotions
- `notifications` - Notification emails (mentions, messages, etc.)
- `digest` - Daily/weekly digest emails
- `all` - All emails (unsubscribes from everything)

## Security Features

1. **HMAC-SHA256 Signing** - Tokens are signed using HMAC-SHA256 to prevent tampering
2. **Timing-Safe Comparison** - Uses `crypto.timingSafeEqual()` to prevent timing attacks
3. **Token Expiration** - Tokens are valid for 90 days
4. **Secret Key Management** - Uses `UNSUBSCRIBE_SECRET` env var (falls back to `NEXTAUTH_SECRET`)

## Usage Examples

### Generating Unsubscribe URLs

```typescript
import { generateUnsubscribeUrl } from '@/lib/email';

// Generate URL for marketing emails
const url = generateUnsubscribeUrl('user-id-123', 'marketing');
// Returns: https://app.example.com/api/unsubscribe?token=eyJ1c2VySWQi...

// Use in email template
const emailFooter = `
  <p>
    Don't want to receive marketing emails?
    <a href="${url}">Unsubscribe</a>
  </p>
`;
```

### Sending Emails with Unsubscribe Links

```typescript
import { sendNotificationEmail } from '@/lib/email';

// Automatically generates unsubscribe URL
await sendNotificationEmail({
  email: 'user@example.com',
  userId: 'user-id-123', // Include userId to auto-generate unsubscribe link
  title: 'You have a new mention',
  message: 'Someone mentioned you in a channel',
  type: 'mention',
});
```

### Checking Unsubscribe Status

```typescript
import { isUnsubscribed, getUnsubscribeStatus } from '@/lib/email';
import { prisma } from '@neolith/database';

// Check before sending email
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { preferences: true, email: true }
});

if (isUnsubscribed(user.preferences, 'marketing')) {
  console.log('User has unsubscribed from marketing emails');
  return; // Don't send
}

// Get all unsubscribe statuses
const status = getUnsubscribeStatus(user.preferences);
console.log(status);
// {
//   marketing: false,
//   notifications: true,
//   digest: false,
//   all: false
// }
```

## Database Schema

User preferences are stored in the `user.preferences` JSON field with this structure:

```typescript
{
  emailUnsubscribed: {
    marketing: boolean,
    notifications: boolean,
    digest: boolean,
    all: boolean
  },
  unsubscribedAt: {
    marketing: "2025-11-29T10:30:00.000Z",
    notifications: "2025-11-29T10:30:00.000Z",
    digest: "2025-11-29T10:30:00.000Z",
    all: "2025-11-29T10:30:00.000Z"
  }
}
```

No database migrations are required since `user.preferences` is already a JSON field.

## API Endpoint

### GET /api/unsubscribe

Process unsubscribe request and show confirmation page.

**Query Parameters:**
- `token` (required) - Signed unsubscribe token

**Response:**
- Returns HTML page confirming unsubscribe or showing error
- HTTP 200 for successful unsubscribe
- HTTP 400 for invalid/expired tokens
- HTTP 404 for user not found
- HTTP 500 for server errors

**Example:**
```
GET /api/unsubscribe?token=eyJ1c2VySWQiOiJ1c2VyLTEyMyIsImVtYWlsVHlwZSI6Im1hcmtldGluZyIsInRpbWVzdGFtcCI6MTcwMDAwMDAwMH0.d4f2c3b1a0
```

## Environment Variables

Required environment variable (one of):
- `UNSUBSCRIBE_SECRET` - Dedicated secret for unsubscribe tokens (recommended)
- `NEXTAUTH_SECRET` - Falls back to this if `UNSUBSCRIBE_SECRET` not set

Example in `.env.local`:
```bash
# Dedicated secret for unsubscribe tokens (recommended)
UNSUBSCRIBE_SECRET=your-secret-here-generate-with-openssl-rand-base64-32

# Or rely on existing NEXTAUTH_SECRET
NEXTAUTH_SECRET=your-nextauth-secret
```

Generate a secret:
```bash
openssl rand -base64 32
```

## Testing

Run the test script to verify functionality:

```bash
# Set required environment variables first
export NEXTAUTH_SECRET="test-secret-for-development"

# Run test script
npx tsx scripts/test-unsubscribe.ts
```

## User Experience

### Unsubscribe Confirmation Page

When users click the unsubscribe link, they see a styled HTML page with:

**Success Page:**
- Green checkmark icon
- "Successfully Unsubscribed" heading
- Confirmation of email type unsubscribed from
- User's email address
- Link to return to the app
- Link to manage preferences (if not unsubscribed from all)

**Error Page:**
- Red X icon
- "Unsubscribe Failed" heading
- Error message explaining the issue
- Link to return to the app
- Suggestion to contact support

### Mobile Responsive

The confirmation pages are fully responsive and work on all device sizes.

## CAN-SPAM Compliance

This implementation meets CAN-SPAM Act requirements:

1. ✅ **One-Click Unsubscribe** - Users can unsubscribe with a single click
2. ✅ **Immediate Processing** - Unsubscribe requests are processed immediately
3. ✅ **Clear Identification** - Emails clearly identify what type of email it is
4. ✅ **No Login Required** - Users don't need to login to unsubscribe
5. ✅ **Preference Management** - Users can manage preferences (link provided)
6. ✅ **Token Validity** - Tokens are valid for 90 days (exceeds 30-day requirement)

## Best Practices

### Always Include Unsubscribe Links

For all non-transactional emails (marketing, notifications, digests), always include:

```typescript
import { generateUnsubscribeUrl } from '@/lib/email';

const unsubscribeUrl = generateUnsubscribeUrl(userId, 'marketing');

// Add to email footer
`<p>
  <a href="${unsubscribeUrl}">Unsubscribe from marketing emails</a>
</p>`
```

### Check Before Sending

Always check unsubscribe status before sending emails:

```typescript
import { isUnsubscribed } from '@/lib/email';

const user = await prisma.user.findUnique({ where: { id: userId } });

if (isUnsubscribed(user.preferences, 'marketing')) {
  return; // Don't send email
}

// Send email...
```

### Transactional Emails

For critical transactional emails (password resets, account verification), you may skip the unsubscribe check:

- Password reset emails
- Email verification
- Account security alerts
- Order confirmations
- Service notifications

## Future Enhancements

Potential improvements for future iterations:

1. **Email Preference Center** - Web UI for managing all email preferences
2. **Re-subscription** - Allow users to re-subscribe through UI
3. **Analytics Dashboard** - Track unsubscribe rates by email type
4. **A/B Testing** - Test different email content to reduce unsubscribes
5. **Preference Migration** - Bulk import/export of preferences
6. **GDPR Compliance** - Add data export and deletion features

## Support

For questions or issues:
1. Check this documentation
2. Review test script examples
3. Contact the engineering team

---

**Version:** 1.0.0
**Last Updated:** 2025-11-29
**Author:** Backend Engineering Team
