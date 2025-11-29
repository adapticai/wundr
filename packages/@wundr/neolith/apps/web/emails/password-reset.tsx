/**
 * Password Reset Email Template
 * Sent when a user requests to reset their password
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

interface PasswordResetEmailProps {
  username?: string;
  resetUrl?: string;
  expirationTime?: string;
}

export const PasswordResetEmail = ({
  username = 'there',
  resetUrl = 'http://localhost:3000/reset-password',
  expirationTime = '1 hour',
}: PasswordResetEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your Neolith password - Action required</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Password Reset Request</Heading>
          <Text style={text}>Hello {username},</Text>
          <Text style={text}>
            We received a request to reset the password for your Neolith account.
            If you made this request, click the button below to set a new password.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>
          <Text style={text}>
            This link will expire in <strong>{expirationTime}</strong> for security
            reasons.
          </Text>
          <Hr style={hr} />
          <Section style={warningBox}>
            <Text style={warningTitle}>Security Notice</Text>
            <Text style={warningText}>
              For your security, please do not share this password reset link with
              anyone. If you forward this email, the link will allow others to access
              and change your account password.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t request a password reset, you can safely ignore this
            email. Your password will remain unchanged.
          </Text>
          <Text style={footer}>
            Need help? Contact our support team at{' '}
            <Link href='mailto:support@neolith.ai' style={link}>
              support@neolith.ai
            </Link>{' '}
            or visit our{' '}
            <Link href='https://neolith.ai/docs' style={link}>
              help center
            </Link>
            .
          </Text>
          <Hr style={hr} />
          <Text style={smallFooter}>
            This is an automated security email from Neolith. Please do not reply to
            this message.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

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
  margin: '16px 0',
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

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const warningBox = {
  backgroundColor: '#fff4e5',
  borderLeft: '4px solid #ff9800',
  padding: '16px 20px',
  margin: '20px 24px',
  borderRadius: '4px',
};

const warningTitle = {
  color: '#e65100',
  fontSize: '14px',
  fontWeight: '700',
  margin: '0 0 8px 0',
  padding: '0',
};

const warningText = {
  color: '#5f4d37',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
  padding: '0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  margin: '12px 0',
};

const smallFooter = {
  color: '#aab7c4',
  fontSize: '12px',
  lineHeight: '20px',
  padding: '0 24px',
  margin: '8px 0',
};

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
};
