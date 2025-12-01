# Email Unsubscribe - Usage Examples

## Quick Reference

### 1. Sending Emails with Unsubscribe Links

#### Notification Emails (Automatic)

```typescript
import { sendNotificationEmail } from '@/lib/email';

// Unsubscribe URL is automatically generated if userId is provided
await sendNotificationEmail({
  email: 'user@example.com',
  userId: 'user-123', // 👈 Include this to auto-generate unsubscribe link
  title: 'You have a new mention',
  message: 'John mentioned you in #general',
  type: 'mention',
  actionUrl: 'https://app.neolith.ai/channel/general',
  actionText: 'View Mention',
});
```

#### Custom Emails (Manual)

```typescript
import { generateUnsubscribeUrl } from '@/lib/email';

const userId = 'user-123';
const emailType = 'marketing'; // or 'notifications', 'digest', 'all'

// Generate unsubscribe URL
const unsubscribeUrl = generateUnsubscribeUrl(userId, emailType);
// Returns: https://app.neolith.ai/api/unsubscribe?token=eyJ1c2VySWQi...

// Use in your email template
const emailHTML = `
  <html>
    <body>
      <h1>Special Offer!</h1>
      <p>Check out our latest features...</p>

      <hr>
      <small>
        Don't want to receive marketing emails?
        <a href="${unsubscribeUrl}">Unsubscribe</a>
      </small>
    </body>
  </html>
`;
```

### 2. Checking Unsubscribe Status Before Sending

#### Simple Check

```typescript
import { isUnsubscribed } from '@/lib/email';
import { prisma } from '@neolith/database';

async function sendMarketingEmail(userId: string) {
  // Fetch user with preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preferences: true,
    },
  });

  // Check if user has unsubscribed
  if (isUnsubscribed(user.preferences, 'marketing')) {
    console.log('User has unsubscribed from marketing emails');
    return { success: false, reason: 'unsubscribed' };
  }

  // Send email...
  await sendEmail({
    to: user.email,
    subject: 'New Features Available!',
    // ...
  });

  return { success: true };
}
```

#### Bulk Email with Filtering

```typescript
import { isUnsubscribed } from '@/lib/email';
import { prisma } from '@neolith/database';

async function sendBulkMarketingEmail() {
  // Fetch all users
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      preferences: true,
    },
  });

  // Filter out unsubscribed users
  const subscribedUsers = users.filter(user => !isUnsubscribed(user.preferences, 'marketing'));

  console.log(`Sending to ${subscribedUsers.length} of ${users.length} users`);

  // Send emails
  for (const user of subscribedUsers) {
    await sendMarketingEmail(user.id);
  }
}
```

### 3. User Preference Management

#### Get All Unsubscribe Statuses

```typescript
import { getUnsubscribeStatus } from '@/lib/email';
import { prisma } from '@neolith/database';

async function getUserEmailPreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const unsubscribeStatus = getUnsubscribeStatus(user.preferences);

  return {
    marketing: !unsubscribeStatus.marketing,
    notifications: !unsubscribeStatus.notifications,
    digest: !unsubscribeStatus.digest,
    isSubscribedToAll: !unsubscribeStatus.all,
  };
}

// Usage
const prefs = await getUserEmailPreferences('user-123');
console.log(prefs);
// {
//   marketing: true,        // User is subscribed to marketing
//   notifications: false,   // User has unsubscribed from notifications
//   digest: true,           // User is subscribed to digest
//   isSubscribedToAll: true // User hasn't unsubscribed from all
// }
```

#### Update Preferences Programmatically

```typescript
import { prisma } from '@neolith/database';

async function updateEmailPreferences(
  userId: string,
  preferences: {
    marketing?: boolean;
    notifications?: boolean;
    digest?: boolean;
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const currentPrefs = (user.preferences as any) || {};
  const emailUnsubscribed = currentPrefs.emailUnsubscribed || {};
  const unsubscribedAt = currentPrefs.unsubscribedAt || {};

  const now = new Date().toISOString();

  // Update preferences
  if (preferences.marketing !== undefined) {
    emailUnsubscribed.marketing = !preferences.marketing;
    if (!preferences.marketing) {
      unsubscribedAt.marketing = now;
    }
  }

  if (preferences.notifications !== undefined) {
    emailUnsubscribed.notifications = !preferences.notifications;
    if (!preferences.notifications) {
      unsubscribedAt.notifications = now;
    }
  }

  if (preferences.digest !== undefined) {
    emailUnsubscribed.digest = !preferences.digest;
    if (!preferences.digest) {
      unsubscribedAt.digest = now;
    }
  }

  // Save to database
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...currentPrefs,
        emailUnsubscribed,
        unsubscribedAt,
      },
    },
  });
}

// Usage
await updateEmailPreferences('user-123', {
  marketing: false, // Unsubscribe from marketing
  notifications: true, // Subscribe to notifications
  digest: true, // Subscribe to digest
});
```

### 4. Email Template Integration

#### React Email Template

```typescript
import { Link, Text } from '@react-email/components';

interface MarketingEmailProps {
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export const MarketingEmail = ({
  unsubscribeUrl,
  preferencesUrl,
}: MarketingEmailProps) => {
  return (
    <>
      {/* Email content here */}

      {/* Footer with unsubscribe link */}
      <Text style={footer}>
        You&apos;re receiving this email because you opted in to receive
        marketing communications from Neolith.
      </Text>
      <Text style={footer}>
        <Link href={preferencesUrl} style={link}>
          Manage preferences
        </Link>
        {' | '}
        <Link href={unsubscribeUrl} style={link}>
          Unsubscribe from marketing emails
        </Link>
      </Text>
    </>
  );
};

// Usage
import { generateUnsubscribeUrl } from '@/lib/email';

const unsubscribeUrl = generateUnsubscribeUrl(userId, 'marketing');
const preferencesUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications`;

await sendEmail({
  to: user.email,
  subject: 'New Features!',
  react: MarketingEmail({ unsubscribeUrl, preferencesUrl }),
});
```

### 5. API Route Integration

#### Settings Page API

```typescript
// app/api/users/me/email-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@neolith/database';
import { getUnsubscribeStatus } from '@/lib/email';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { preferences: true },
  });

  const status = getUnsubscribeStatus(user.preferences);

  return NextResponse.json({
    emailPreferences: {
      marketing: !status.marketing,
      notifications: !status.notifications,
      digest: !status.digest,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { marketing, notifications, digest } = body;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, preferences: true },
  });

  const currentPrefs = (user.preferences as any) || {};
  const emailUnsubscribed = currentPrefs.emailUnsubscribed || {};
  const unsubscribedAt = currentPrefs.unsubscribedAt || {};
  const now = new Date().toISOString();

  // Update preferences
  if (marketing !== undefined) {
    emailUnsubscribed.marketing = !marketing;
    if (!marketing) unsubscribedAt.marketing = now;
  }
  if (notifications !== undefined) {
    emailUnsubscribed.notifications = !notifications;
    if (!notifications) unsubscribedAt.notifications = now;
  }
  if (digest !== undefined) {
    emailUnsubscribed.digest = !digest;
    if (!digest) unsubscribedAt.digest = now;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: {
        ...currentPrefs,
        emailUnsubscribed,
        unsubscribedAt,
      },
    },
  });

  return NextResponse.json({ success: true });
}
```

### 6. Testing

#### Run Test Script

```bash
# Set environment variable
export NEXTAUTH_SECRET="your-secret-here"

# Run test
npx tsx scripts/test-unsubscribe.ts
```

#### Manual Testing

```typescript
import { generateUnsubscribeUrl, verifyUnsubscribeToken } from '@/lib/email';

// Generate a test token
const testUrl = generateUnsubscribeUrl('test-user-123', 'marketing');
console.log('Test URL:', testUrl);

// Extract token from URL
const url = new URL(testUrl);
const token = url.searchParams.get('token');

// Verify token
const payload = verifyUnsubscribeToken(token!);
console.log('Verified payload:', payload);
// {
//   userId: 'test-user-123',
//   emailType: 'marketing',
//   timestamp: 1700000000000
// }
```

### 7. Common Patterns

#### Email Campaign Service

```typescript
class EmailCampaignService {
  async sendCampaign(campaignId: string, emailType: 'marketing' | 'digest') {
    const campaign = await this.getCampaign(campaignId);

    // Get all subscribed users
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, email: true, preferences: true },
    });

    const subscribedUsers = users.filter(user => !isUnsubscribed(user.preferences, emailType));

    console.log(
      `Campaign: ${subscribedUsers.length} recipients (${users.length - subscribedUsers.length} unsubscribed)`
    );

    // Send emails with rate limiting
    for (const user of subscribedUsers) {
      const unsubscribeUrl = generateUnsubscribeUrl(user.id, emailType);

      await this.sendCampaignEmail({
        to: user.email,
        campaign,
        unsubscribeUrl,
      });

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

#### Notification Queue Processor

```typescript
async function processNotificationQueue() {
  const pendingNotifications = await getNotificationsToSend();

  for (const notification of pendingNotifications) {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, preferences: true },
    });

    // Skip if user has unsubscribed from notifications
    if (isUnsubscribed(user.preferences, 'notifications')) {
      await markNotificationAsSkipped(notification.id, 'unsubscribed');
      continue;
    }

    // Send notification email
    await sendNotificationEmail({
      email: user.email,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
    });

    await markNotificationAsSent(notification.id);
  }
}
```

## Additional Resources

- [Full Implementation Documentation](./UNSUBSCRIBE_IMPLEMENTATION.md)
- [CAN-SPAM Act Compliance](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [React Email Documentation](https://react.email/docs)

---

**Note:** Always test unsubscribe functionality thoroughly before deploying to production. Verify
that:

1. Tokens are properly signed and verified
2. Database updates work correctly
3. Email templates display unsubscribe links
4. Confirmation pages render properly on all devices
