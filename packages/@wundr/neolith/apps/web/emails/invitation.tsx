/**
 * Workspace Invitation Email Template
 * Sent when a user is invited to join a Neolith workspace
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

interface InvitationEmailProps {
  inviterName?: string;
  inviterEmail?: string;
  workspaceName?: string;
  workspaceDescription?: string;
  inviteUrl?: string;
  expiresAt?: string;
}

export const InvitationEmail = ({
  inviterName = 'A team member',
  inviterEmail = 'member@example.com',
  workspaceName = 'Example Workspace',
  workspaceDescription,
  inviteUrl = 'http://localhost:3000/invite/accept',
  expiresAt = '7 days',
}: InvitationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {workspaceName} on Neolith
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You&apos;re invited!</Heading>

          <Text style={text}>
            <strong>{inviterName}</strong> ({inviterEmail}) has invited you to join{' '}
            <strong>{workspaceName}</strong> on Neolith.
          </Text>

          {workspaceDescription && (
            <Section style={descriptionSection}>
              <Text style={descriptionText}>{workspaceDescription}</Text>
            </Section>
          )}

          <Text style={text}>
            Neolith is an AI-powered workspace platform that enables you to build
            intelligent organizations with custom agent hierarchies, automated workflows,
            and real-time collaboration.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>

          <Text style={linkText}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={urlText}>
            <Link href={inviteUrl} style={urlLink}>
              {inviteUrl}
            </Link>
          </Text>

          <Section style={warningSection}>
            <Text style={warningText}>
              This invitation expires in {expiresAt}. Accept it soon to join the workspace.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            If you weren&apos;t expecting this invitation, you can safely ignore this email.
            The invitation will expire automatically.
          </Text>
          <Text style={footer}>
            Need help? Reply to this email or contact our support team at{' '}
            <Link href='mailto:support@neolith.ai' style={link}>
              support@neolith.ai
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InvitationEmail;

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
  marginBottom: '16px',
};

const descriptionSection = {
  backgroundColor: '#f6f9fc',
  borderRadius: '4px',
  margin: '24px 24px',
  padding: '16px',
};

const descriptionText = {
  color: '#555',
  fontSize: '15px',
  lineHeight: '24px',
  fontStyle: 'italic',
  margin: '0',
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
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  marginBottom: '8px',
};

const urlText = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  marginBottom: '24px',
  wordBreak: 'break-all' as const,
};

const urlLink = {
  color: '#5469d4',
  textDecoration: 'underline',
};

const warningSection = {
  backgroundColor: '#fff3cd',
  borderLeft: '4px solid #ffc107',
  margin: '24px 24px',
  padding: '12px 16px',
};

const warningText = {
  color: '#856404',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
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
