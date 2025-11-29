/**
 * Email Verification Template
 * Sent when a user needs to verify their email address
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
          <Heading style={h1}>Verify Your Email</Heading>
          <Text style={text}>Hello {username},</Text>
          <Text style={text}>
            Thank you for signing up for Neolith! To complete your registration
            and start using your AI-powered workspace, please verify your email
            address.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Verify Email Address
            </Button>
          </Section>
          <Text style={text}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>{verificationUrl}</Text>
          <Section style={noticeBox}>
            <Text style={noticeText}>
              ⏱️ This verification link will expire in {expiresInHours} hours for
              security purposes.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t create an account with Neolith, you can safely
            ignore this email. No account will be created without verification.
          </Text>
          <Text style={footer}>
            Need help? Contact our support team at{' '}
            <Link href='mailto:support@neolith.ai' style={link}>
              support@neolith.ai
            </Link>{' '}
            or visit our{' '}
            <Link href='https://neolith.ai/docs' style={link}>
              documentation
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default VerificationEmail;

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

const linkText = {
  color: '#5469d4',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  wordBreak: 'break-all' as const,
  overflowWrap: 'break-word' as const,
};

const noticeBox = {
  backgroundColor: '#fff4e6',
  borderLeft: '4px solid #ff9800',
  borderRadius: '4px',
  margin: '24px 24px',
  padding: '16px',
};

const noticeText = {
  color: '#663c00',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
  padding: '0',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
};

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
};
