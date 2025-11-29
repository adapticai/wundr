/**
 * Workspace Invitation Email Template
 * Sent when a user is invited to join a Neolith workspace
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
          <EmailHeader />

          <Section style={contentSection}>
            <EmailText variant="h1">You&apos;re invited!</EmailText>

            <EmailText>
              <strong>{inviterName}</strong> ({inviterEmail}) has invited you to join{' '}
              <strong>{workspaceName}</strong> on Neolith.
            </EmailText>

            {workspaceDescription && (
              <Section style={descriptionSection}>
                <EmailText style={descriptionText}>{workspaceDescription}</EmailText>
              </Section>
            )}

            <EmailText>
              Neolith is an AI-powered workspace platform that enables you to build
              intelligent organizations with custom agent hierarchies, automated workflows,
              and real-time collaboration.
            </EmailText>

            <Section style={buttonContainer}>
              <EmailButton href={inviteUrl}>
                Accept Invitation
              </EmailButton>
            </Section>

            <EmailText variant="small">
              Or copy and paste this link into your browser:
            </EmailText>
            <EmailText style={urlText}>
              <Link href={inviteUrl} style={urlLink}>
                {inviteUrl}
              </Link>
            </EmailText>

            <Section style={warningSection}>
              <EmailText style={warningText}>
                This invitation expires in {expiresAt}. Accept it soon to join the workspace.
              </EmailText>
            </Section>

            <EmailText variant="small">
              If you weren&apos;t expecting this invitation, you can safely ignore this email.
              The invitation will expire automatically.
            </EmailText>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

export default InvitationEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const descriptionSection = {
  backgroundColor: colors.gray50,
  borderRadius: '8px',
  margin: '24px 24px',
  padding: '20px',
};

const descriptionText = {
  color: colors.gray700,
  fontSize: '15px',
  lineHeight: '1.5',
  fontStyle: 'italic' as const,
  margin: '0',
  padding: '0',
};

const buttonContainer = {
  padding: '8px 24px 24px',
  textAlign: 'center' as const,
};

const urlText = {
  color: colors.gray700,
  fontSize: '14px',
  lineHeight: '1.5',
  padding: '0 24px',
  marginBottom: '24px',
  wordBreak: 'break-all' as const,
};

const urlLink = {
  color: colors.black,
  textDecoration: 'underline',
  fontWeight: '500',
};

const warningSection = {
  backgroundColor: colors.warningLight,
  borderLeft: `4px solid ${colors.warning}`,
  margin: '24px 24px',
  padding: '16px 20px',
  borderRadius: '4px',
};

const warningText = {
  color: colors.gray800,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
  padding: '0',
};
