/**
 * Email Verification Template
 * Sent when a user needs to verify their email address
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

interface VerificationEmailProps {
  username?: string;
  verificationUrl?: string;
  expiresInHours?: number;
}

export const VerificationEmail = ({
  username = 'there',
  verificationUrl = 'http://localhost:3000/verify-email?token=example',
  expiresInHours = 24,
}: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address for Neolith</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader />

          <Section style={contentSection}>
            <EmailText variant='h1'>Verify Your Email</EmailText>

            <EmailText>Hello {username},</EmailText>

            <EmailText>
              Thank you for signing up for Neolith! To complete your
              registration and start using your AI-powered workspace, please
              verify your email address.
            </EmailText>

            <Section style={buttonContainer}>
              <EmailButton href={verificationUrl}>
                Verify Email Address
              </EmailButton>
            </Section>

            <EmailText variant='small'>
              Or copy and paste this link into your browser:
            </EmailText>
            <EmailText style={linkText}>{verificationUrl}</EmailText>

            <Section style={noticeBox}>
              <EmailText style={noticeText}>
                This verification link will expire in {expiresInHours} hours for
                security purposes.
              </EmailText>
            </Section>

            <EmailText variant='small'>
              If you didn&apos;t create an account with Neolith, you can safely
              ignore this email. No account will be created without
              verification.
            </EmailText>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

export default VerificationEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const buttonContainer = {
  padding: '8px 24px 24px',
  textAlign: 'center' as const,
};

const linkText = {
  color: colors.gray700,
  fontSize: '14px',
  lineHeight: '1.5',
  padding: '0 24px',
  marginBottom: '24px',
  wordBreak: 'break-all' as const,
  overflowWrap: 'break-word' as const,
};

const noticeBox = {
  backgroundColor: colors.warningLight,
  borderLeft: `4px solid ${colors.warning}`,
  borderRadius: '4px',
  margin: '24px 24px',
  padding: '16px 20px',
};

const noticeText = {
  color: colors.gray800,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
  padding: '0',
};
