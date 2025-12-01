/**
 * Password Changed Email Template
 * Sent when a user's password has been successfully changed
 */

import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from '@react-email/components';
import * as React from 'react';
import {
  EmailHeader,
  EmailFooter,
  EmailText,
  main,
  container,
  colors,
} from './components';

interface PasswordChangedEmailProps {
  username?: string;
  email?: string;
  timestamp?: string;
  ipAddress?: string;
  loginUrl?: string;
}

export const PasswordChangedEmail = ({
  username = 'there',
  email,
  timestamp,
  ipAddress,
  loginUrl: _loginUrl = 'http://localhost:3000/login',
}: PasswordChangedEmailProps) => {
  const formattedTimestamp = timestamp
    ? new Date(timestamp).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });

  return (
    <Html>
      <Head />
      <Preview>Your Neolith password has been changed</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader />

          <Section style={contentSection}>
            <EmailText variant='h1'>Password Changed Successfully</EmailText>

            <EmailText>Hello {username},</EmailText>

            <EmailText>
              This email confirms that your Neolith password has been changed
              successfully.
            </EmailText>

            <Section style={detailsContainer}>
              <EmailText variant='h2' style={detailsHeading}>
                Change Details:
              </EmailText>
              {email && (
                <EmailText style={detailItem}>
                  <strong>Account:</strong> {email}
                </EmailText>
              )}
              <EmailText style={detailItem}>
                <strong>Time:</strong> {formattedTimestamp}
              </EmailText>
              {ipAddress && (
                <EmailText style={detailItem}>
                  <strong>IP Address:</strong> {ipAddress}
                </EmailText>
              )}
            </Section>

            <Section style={warningSection}>
              <EmailText style={warningTitle}>
                <strong>Did you make this change?</strong>
              </EmailText>
              <EmailText style={warningText}>
                If you did not request this password change, please contact our
                support team immediately. Your account security is important to
                us.
              </EmailText>
            </Section>

            <EmailText variant='small'>
              For security reasons, we recommend:
            </EmailText>
            <ul style={list}>
              <li style={listItem}>Using a strong, unique password</li>
              <li style={listItem}>
                Enabling two-factor authentication if available
              </li>
              <li style={listItem}>Never sharing your password with anyone</li>
            </ul>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordChangedEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const detailsContainer = {
  backgroundColor: colors.gray50,
  borderRadius: '8px',
  margin: '20px 24px',
  padding: '20px',
};

const detailsHeading = {
  color: colors.black,
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
  padding: '0',
};

const detailItem = {
  color: colors.gray700,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '8px 0',
  padding: '0',
};

const warningSection = {
  backgroundColor: colors.errorLight,
  borderLeft: `4px solid ${colors.error}`,
  margin: '20px 24px',
  padding: '20px',
  borderRadius: '4px',
};

const warningTitle = {
  color: colors.gray900,
  fontSize: '16px',
  margin: '0 0 12px 0',
  padding: '0',
};

const warningText = {
  color: colors.gray700,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
  padding: '0',
};

const list = {
  color: colors.gray700,
  fontSize: '14px',
  lineHeight: '1.5',
  paddingLeft: '48px',
  margin: '0 0 24px 24px',
};

const listItem = {
  marginBottom: '8px',
};
