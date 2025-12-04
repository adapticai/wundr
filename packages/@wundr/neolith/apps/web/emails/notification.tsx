/**
 * Notification Email Template
 * Generic notification template supporting multiple notification types
 */

import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
} from '@react-email/components';
import * as React from 'react';

import {
  EmailHeader,
  EmailFooter,
  EmailButton,
  EmailText,
  main,
  container,
  colors,
} from './components';

export type NotificationType =
  | 'mention'
  | 'message'
  | 'channel'
  | 'task'
  | 'system';

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
  mention: { label: 'Mention', color: colors.success, emoji: '@' },
  message: { label: 'New Message', color: colors.black, emoji: '💬' },
  channel: { label: 'Channel Update', color: colors.warning, emoji: '#' },
  task: { label: 'Task Assignment', color: colors.gray700, emoji: '✓' },
  system: { label: 'System Notification', color: colors.gray600, emoji: 'ℹ' },
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
          <EmailHeader />

          <Section style={contentSection}>
            {/* Notification Type Badge */}
            <Section style={badgeContainer}>
              <div style={getBadgeStyle(config.color)}>
                <span style={badgeEmoji}>{config.emoji}</span>
                <span style={badgeText}>{config.label}</span>
              </div>
            </Section>

            {/* Title */}
            <EmailText variant='h1'>{title}</EmailText>

            {/* Message */}
            <EmailText>{message}</EmailText>

            {/* Action Button */}
            {actionUrl && actionText && (
              <Section style={buttonContainer}>
                <EmailButton href={actionUrl}>{actionText}</EmailButton>
              </Section>
            )}

            {/* Timestamp */}
            <EmailText variant='caption' style={timestampText}>
              {formattedTimestamp}
            </EmailText>

            {/* Preferences Section */}
            <Section style={preferencesSection}>
              <EmailText style={preferencesText}>
                <Link href={preferencesUrl} style={preferencesLink}>
                  Manage notification preferences
                </Link>
              </EmailText>
            </Section>
          </Section>

          <EmailFooter includeUnsubscribe unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
};

export default NotificationEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const badgeContainer = {
  padding: '0 24px 24px',
};

const getBadgeStyle = (color: string) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: colors.gray100,
  borderRadius: '20px',
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: '600',
  color: color,
  border: `2px solid ${color}`,
});

const badgeEmoji = {
  fontSize: '16px',
  lineHeight: '1',
};

const badgeText = {
  lineHeight: '1',
};

const buttonContainer = {
  padding: '8px 24px 24px',
  textAlign: 'center' as const,
};

const timestampText = {
  color: colors.gray500,
  fontSize: '13px',
  padding: '0 24px',
  margin: '0',
};

const preferencesSection = {
  padding: '24px 24px 0',
  textAlign: 'center' as const,
};

const preferencesText = {
  margin: '0',
  padding: '0',
};

const preferencesLink = {
  color: colors.black,
  textDecoration: 'underline',
  fontSize: '14px',
  fontWeight: '500',
};
