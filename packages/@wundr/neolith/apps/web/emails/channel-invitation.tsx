/**
 * Channel Invitation Email Template
 * Sent when a user is invited to join a channel in a Neolith workspace
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

interface ChannelInvitationEmailProps {
  inviterName: string;
  inviterEmail: string;
  workspaceName: string;
  channelName: string;
  channelType: 'public' | 'private';
  channelDescription?: string;
  inviteUrl: string;
  expiresAt?: string;
}

export const ChannelInvitationEmail = ({
  inviterName = 'A team member',
  inviterEmail = 'member@example.com',
  workspaceName = 'Example Workspace',
  channelName = 'general',
  channelType = 'public',
  channelDescription,
  inviteUrl = 'http://localhost:3000/invite/channel/accept',
  expiresAt = '7 days',
}: ChannelInvitationEmailProps) => {
  const channelTypeLabel = channelType === 'private' ? 'Private' : 'Public';
  const channelIcon = channelType === 'private' ? '🔒' : '#';

  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {channelIcon}
        {channelName} in {workspaceName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader />

          <Section style={contentSection}>
            <EmailText variant='h1'>
              You&apos;re invited to a channel!
            </EmailText>

            <EmailText>
              <strong>{inviterName}</strong> ({inviterEmail}) has invited you to
              join the{' '}
              <strong>
                {channelIcon} {channelName}
              </strong>{' '}
              channel in <strong>{workspaceName}</strong>.
            </EmailText>

            <Section style={channelInfoSection}>
              <EmailText style={channelInfoLabel}>Channel Type</EmailText>
              <EmailText style={channelInfoValue}>
                {channelTypeLabel} Channel
              </EmailText>
              {channelDescription && (
                <>
                  <EmailText style={channelInfoLabel}>Description</EmailText>
                  <EmailText style={channelInfoValue}>
                    {channelDescription}
                  </EmailText>
                </>
              )}
            </Section>

            <EmailText>
              {channelType === 'private'
                ? 'This is a private channel. Only invited members can access it and see its contents.'
                : 'This is a public channel. All workspace members can discover and join it.'}
            </EmailText>

            <Section style={buttonContainer}>
              <EmailButton href={inviteUrl}>Accept Invitation</EmailButton>
            </Section>

            <EmailText variant='small'>
              Or copy and paste this link into your browser:
            </EmailText>
            <EmailText style={urlText}>
              <Link href={inviteUrl} style={urlLink}>
                {inviteUrl}
              </Link>
            </EmailText>

            <Section style={warningSection}>
              <EmailText style={warningText}>
                This invitation expires in {expiresAt}. Accept it soon to join
                the channel.
              </EmailText>
            </Section>

            <EmailText variant='small'>
              If you weren&apos;t expecting this invitation, you can safely
              ignore this email. The invitation will expire automatically.
            </EmailText>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
};

export default ChannelInvitationEmail;

// Additional styles
const contentSection = {
  padding: '40px 0',
};

const channelInfoSection = {
  backgroundColor: colors.gray50,
  borderRadius: '8px',
  margin: '24px 24px',
  padding: '20px',
};

const channelInfoLabel = {
  color: colors.gray600,
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px 0',
  padding: '0',
};

const channelInfoValue = {
  color: colors.black,
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0 0 12px 0',
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
