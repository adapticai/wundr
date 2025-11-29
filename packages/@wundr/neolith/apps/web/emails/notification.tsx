/**
 * Notification Email Template
 * Generic notification template supporting multiple notification types
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export type NotificationType = 'mention' | 'message' | 'channel' | 'task' | 'system';

export interface NotificationEmailProps {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  timestamp: Date;
  unsubscribeUrl: string;
  preferencesUrl: string;
}

const notificationConfig: Record<
  NotificationType,
  { label: string; color: string; emoji: string }
> = {
  mention: { label: 'Mention', color: '#10b981', emoji: '@' },
  message: { label: 'New Message', color: '#5469d4', emoji: '💬' },
  channel: { label: 'Channel Update', color: '#f59e0b', emoji: '#' },
  task: { label: 'Task Assignment', color: '#8b5cf6', emoji: '✓' },
  system: { label: 'System Notification', color: '#6b7280', emoji: 'ℹ' },
};

export const NotificationEmail = ({
  type = 'message',
  title = 'You have a new notification',
  message = 'Check your workspace for updates.',
  actionUrl,
  actionText = 'View Notification',
  timestamp = new Date(),
  unsubscribeUrl = 'http://localhost:3000/settings/notifications',
  preferencesUrl = 'http://localhost:3000/settings/notifications',
}: NotificationEmailProps) => {
  const config = notificationConfig[type];
  const formattedTimestamp = timestamp.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Notification Type Badge */}
          <Section style={badgeContainer}>
            <div style={getBadgeStyle(config.color)}>
              <span style={badgeEmoji}>{config.emoji}</span>
              <span style={badgeText}>{config.label}</span>
            </div>
          </Section>

          {/* Title */}
          <Heading style={h1}>{title}</Heading>

          {/* Message */}
          <Text style={messageText}>{message}</Text>

          {/* Action Button */}
          {actionUrl && actionText && (
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                {actionText}
              </Button>
            </Section>
          )}

          {/* Timestamp */}
          <Text style={timestampText}>{formattedTimestamp}</Text>

          <Hr style={hr} />

          {/* Preferences Section */}
          <Section style={preferencesSection}>
            <Text style={preferencesText}>
              <Link href={preferencesUrl} style={link}>
                Manage notification preferences
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Text style={footer}>
            You&apos;re receiving this email because you&apos;re a member of a Neolith
            workspace.
          </Text>
          <Text style={footer}>
            Don&apos;t want to receive these notifications?{' '}
            <Link href={unsubscribeUrl} style={link}>
              Unsubscribe
            </Link>
          </Text>
          <Text style={footer}>
            Need help? Visit our{' '}
            <Link href='https://neolith.ai/docs' style={link}>
              documentation
            </Link>{' '}
            or reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default NotificationEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const badgeContainer = {
  padding: '24px 24px 0',
};

const getBadgeStyle = (color: string) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: color + '15', // 15 is hex for ~8% opacity
  borderRadius: '16px',
  padding: '6px 12px',
  fontSize: '14px',
  fontWeight: '600',
  color: color,
});

const badgeEmoji = {
  fontSize: '16px',
  lineHeight: '1',
};

const badgeText = {
  lineHeight: '1',
};

const h1 = {
  color: '#333',
  fontSize: '28px',
  fontWeight: '700',
  margin: '24px 0',
  padding: '0 24px',
  lineHeight: '1.3',
};

const messageText = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 24px',
  margin: '0 0 20px',
};

const buttonContainer = {
  padding: '27px 24px',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
};

const timestampText = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  padding: '0 24px',
  margin: '0',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const preferencesSection = {
  padding: '0 24px 20px',
  textAlign: 'center' as const,
};

const preferencesText = {
  color: '#5469d4',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  marginTop: '8px',
};

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
};
