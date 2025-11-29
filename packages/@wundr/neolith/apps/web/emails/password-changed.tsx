/**
 * Password Changed Email Template
 * Sent when a user's password has been successfully changed
 */

import {
  Body,
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
          <Heading style={h1}>Password Changed Successfully</Heading>
          <Text style={text}>Hello {username},</Text>
          <Text style={text}>
            This email confirms that your Neolith password has been changed successfully.
          </Text>

          <Section style={detailsContainer}>
            <Text style={detailsHeading}>Change Details:</Text>
            {email && (
              <Text style={detailItem}>
                <strong>Account:</strong> {email}
              </Text>
            )}
            <Text style={detailItem}>
              <strong>Time:</strong> {formattedTimestamp}
            </Text>
            {ipAddress && (
              <Text style={detailItem}>
                <strong>IP Address:</strong> {ipAddress}
              </Text>
            )}
          </Section>

          <Hr style={hr} />

          <Section style={warningSection}>
            <Text style={warningText}>
              <strong>Did you make this change?</strong>
            </Text>
            <Text style={text}>
              If you did not request this password change, please contact our support team
              immediately. Your account security is important to us.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            For security reasons, we recommend:
          </Text>
          <ul style={list}>
            <li style={listItem}>Using a strong, unique password</li>
            <li style={listItem}>Enabling two-factor authentication if available</li>
            <li style={listItem}>Never sharing your password with anyone</li>
          </ul>

          <Text style={footer}>
            Need help? Reply to this email or visit our{' '}
            <Link href='https://neolith.ai/support' style={link}>
              support center
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordChangedEmail;

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

const h1 = {
  color: '#333',
  fontSize: '32px',
  fontWeight: '700',
  margin: '40px 0',
  padding: '0 24px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 24px',
  margin: '12px 0',
};

const detailsContainer = {
  backgroundColor: '#f8f9fa',
  borderRadius: '4px',
  margin: '20px 24px',
  padding: '16px',
};

const detailsHeading = {
  color: '#333',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const detailItem = {
  color: '#555',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '8px 0',
};

const warningSection = {
  backgroundColor: '#fff3cd',
  borderLeft: '4px solid #ffc107',
  margin: '20px 24px',
  padding: '16px',
};

const warningText = {
  color: '#856404',
  fontSize: '16px',
  margin: '0 0 8px 0',
};

const list = {
  color: '#555',
  fontSize: '14px',
  lineHeight: '22px',
  paddingLeft: '48px',
  margin: '12px 0',
};

const listItem = {
  marginBottom: '8px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '24px 24px',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  margin: '12px 0',
};

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
};
