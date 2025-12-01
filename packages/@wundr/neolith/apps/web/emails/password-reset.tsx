/**
 * Password Reset Email Template
 * Sent when a user requests to reset their password
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
  EmailButton,
  EmailText,
  main,
  container,
  colors,
} from './components';

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
          <EmailHeader />

          <Section style={contentSection}>
            <EmailText variant='h1'>Password Reset Request</EmailText>

            <EmailText>Hello {username},</EmailText>

            <EmailText>
              We received a request to reset the password for your Neolith
              account. If you made this request, click the button below to set a
              new password.
            </EmailText>

            <Section style={buttonContainer}>
              <EmailButton href={resetUrl}>Reset Password</EmailButton>
            </Section>

            <EmailText>
              This link will expire in <strong>{expirationTime}</strong> for
              security reasons.
            </EmailText>

            <Section style={warningBox}>
              <EmailText variant='h2' style={warningTitle}>
                Security Notice
              </EmailText>
              <EmailText style={warningText}>
                For your security, please do not share this password reset link
                with anyone. If you forward this email, the link will allow
                others to access and change your account password.
              </EmailText>
            </Section>

            <EmailText variant='small'>
              If you didn&apos;t request a password reset, you can safely ignore
              this email. Your password will remain unchanged.
            </EmailText>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const buttonContainer = {
  padding: '8px 24px 24px',
  textAlign: 'center' as const,
};

const warningBox = {
  backgroundColor: colors.warningLight,
  borderLeft: `4px solid ${colors.warning}`,
  padding: '20px',
  margin: '24px 24px',
  borderRadius: '4px',
};

const warningTitle = {
  color: colors.gray900,
  fontSize: '16px',
  fontWeight: '600',
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
