/**
 * Welcome Email Template
 * Sent when a new user signs up for Neolith
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

interface WelcomeEmailProps {
  username?: string;
  loginUrl?: string;
}

export const WelcomeEmail = ({
  username = 'there',
  loginUrl = 'http://localhost:3000/login',
}: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Neolith - Your AI-Powered Workspace</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader />

          <Section style={contentSection}>
            <EmailText variant='h1'>Welcome to Neolith</EmailText>

            <EmailText>Hello {username},</EmailText>

            <EmailText>
              Thank you for signing up for Neolith! We&apos;re excited to have
              you on board.
            </EmailText>

            <EmailText>
              Neolith is your AI-powered workspace for building and managing
              intelligent organizations. With Neolith, you can:
            </EmailText>

            <ul style={list}>
              <li style={listItem}>Create custom AI agent hierarchies</li>
              <li style={listItem}>Design automated workflows and processes</li>
              <li style={listItem}>Collaborate with your team in real-time</li>
              <li style={listItem}>Build governance structures</li>
            </ul>

            <Section style={buttonContainer}>
              <EmailButton href={loginUrl}>Get Started</EmailButton>
            </Section>

            <EmailText variant='small'>
              If you didn&apos;t create this account, you can safely ignore this
              email.
            </EmailText>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const list = {
  color: colors.gray800,
  fontSize: '16px',
  lineHeight: '1.6',
  paddingLeft: '48px',
  margin: '0 0 24px',
};

const listItem = {
  marginBottom: '8px',
};

const buttonContainer = {
  padding: '8px 24px 24px',
  textAlign: 'center' as const,
};
