/**
 * Welcome Email Template
 * Sent when a new user signs up for Neolith
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
          <Heading style={h1}>Welcome to Neolith</Heading>
          <Text style={text}>Hello {username},</Text>
          <Text style={text}>
            Thank you for signing up for Neolith! We&apos;re excited to have you on
            board.
          </Text>
          <Text style={text}>
            Neolith is your AI-powered workspace for building and managing
            intelligent organizations. With Neolith, you can:
          </Text>
          <ul style={list}>
            <li style={listItem}>Create custom AI agent hierarchies</li>
            <li style={listItem}>Design automated workflows and processes</li>
            <li style={listItem}>Collaborate with your team in real-time</li>
            <li style={listItem}>Build governance structures</li>
          </ul>
          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Get Started
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t create this account, you can safely ignore this email.
          </Text>
          <Text style={footer}>
            Need help? Reply to this email or visit our{' '}
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

export default WelcomeEmail;

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

const list = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  paddingLeft: '48px',
};

const listItem = {
  marginBottom: '8px',
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
