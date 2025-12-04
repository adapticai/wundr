/**
 * Email Footer Component
 * Consistent footer with logo, social links, address, and company information
 */

import { Section, Text, Link, Hr } from '@react-email/components';
import * as React from 'react';

import { colors, link } from './email-styles';

interface EmailFooterProps {
  includeUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export const EmailFooter = ({
  includeUnsubscribe = false,
  unsubscribeUrl,
}: EmailFooterProps) => {
  return (
    <>
      <Hr style={hr} />
      <Section style={footerSection}>
        {/* Logo */}
        <Text style={logoText}>NEOLITH</Text>

        {/* Social Media Links */}
        <table style={socialTable}>
          <tbody>
            <tr>
              <td style={socialCell}>
                <Link
                  href='https://x.com/neolith'
                  target='_blank'
                  rel='noopener noreferrer'
                  style={socialLink}
                >
                  <span style={socialIcon}>𝕏</span>
                </Link>
              </td>
              <td style={socialCell}>
                <Link
                  href='https://instagram.com/neolith'
                  target='_blank'
                  rel='noopener noreferrer'
                  style={socialLink}
                >
                  <span style={socialIcon}>📷</span>
                </Link>
              </td>
              <td style={socialCell}>
                <Link
                  href='https://github.com/neolith'
                  target='_blank'
                  rel='noopener noreferrer'
                  style={socialLink}
                >
                  <span style={socialIcon}>⚙</span>
                </Link>
              </td>
              <td style={socialCell}>
                <Link
                  href='https://linkedin.com/company/neolith'
                  target='_blank'
                  rel='noopener noreferrer'
                  style={socialLink}
                >
                  <span style={socialIcon}>in</span>
                </Link>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Company Address */}
        <Text style={addressText}>
          521 5th Avenue, 17th Floor
          <br />
          New York, NY 10175, USA
        </Text>

        {/* Links */}
        <Text style={footerLinks}>
          <Link
            href='https://neolith.ai'
            target='_blank'
            rel='noopener noreferrer'
            style={footerLink}
          >
            Website
          </Link>
          {' • '}
          <Link
            href='https://neolith.ai/docs'
            target='_blank'
            rel='noopener noreferrer'
            style={footerLink}
          >
            Documentation
          </Link>
          {' • '}
          <Link
            href='https://neolith.ai/support'
            target='_blank'
            rel='noopener noreferrer'
            style={footerLink}
          >
            Support
          </Link>
        </Text>

        {/* Unsubscribe */}
        {includeUnsubscribe && unsubscribeUrl && (
          <Text style={footerText}>
            <Link
              href={unsubscribeUrl}
              target='_blank'
              rel='noopener noreferrer'
              style={unsubscribeLink}
            >
              Unsubscribe from these emails
            </Link>
          </Text>
        )}

        {/* Copyright */}
        <Text style={footerSmall}>
          © {new Date().getFullYear()} Neolith, Inc. All rights reserved.
        </Text>

        <Text style={footerSmall}>
          This email was sent from a notification-only address. Please do not
          reply.
        </Text>
      </Section>
    </>
  );
};

// Styles
const hr = {
  borderColor: colors.gray200,
  borderWidth: '1px',
  margin: '40px 0 32px',
};

const footerSection = {
  backgroundColor: colors.gray50,
  padding: '32px 24px',
  textAlign: 'center' as const,
};

const logoText = {
  color: colors.black,
  fontSize: '20px',
  fontWeight: '700',
  letterSpacing: '2px',
  margin: '0 0 20px',
  padding: '0',
};

const socialTable = {
  width: 'auto',
  margin: '0 auto 24px',
  borderSpacing: '0',
  borderCollapse: 'collapse' as const,
};

const socialCell = {
  padding: '0 12px',
  textAlign: 'center' as const,
};

const socialLink = {
  color: colors.gray600,
  textDecoration: 'none',
  display: 'inline-block',
};

const socialIcon = {
  fontSize: '20px',
  lineHeight: '1',
  display: 'inline-block',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: colors.gray200,
  padding: '6px',
  textAlign: 'center' as const,
  transition: 'background-color 0.2s',
};

const addressText = {
  color: colors.gray600,
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0 0 20px',
  padding: '0',
};

const footerText = {
  color: colors.gray700,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 12px',
  padding: '0',
};

const footerLinks = {
  color: colors.gray600,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 20px',
  padding: '0',
};

const footerLink = {
  ...link,
  color: colors.black,
  fontSize: '14px',
};

const unsubscribeLink = {
  color: colors.gray600,
  textDecoration: 'underline',
  fontSize: '13px',
};

const footerSmall = {
  color: colors.gray500,
  fontSize: '12px',
  lineHeight: '1.4',
  margin: '8px 0 0',
  padding: '0',
};

export default EmailFooter;
