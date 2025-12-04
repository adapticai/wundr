/**
 * Email Header Component
 * Consistent header with logo and branding for all emails
 */

import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { colors } from './email-styles';

interface EmailHeaderProps {
  previewText?: string;
}

export const EmailHeader = ({ previewText }: EmailHeaderProps) => {
  return (
    <Section style={headerSection}>
      <div style={logoContainer}>
        <Text style={logoText}>NEOLITH</Text>
      </div>
      {previewText && <Text style={previewTextStyle}>{previewText}</Text>}
    </Section>
  );
};

// Styles
const headerSection = {
  backgroundColor: colors.black,
  padding: '32px 24px',
  textAlign: 'center' as const,
};

const logoContainer = {
  margin: '0 auto',
};

const logoText = {
  color: colors.white,
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '2px',
  margin: '0',
  padding: '0',
};

const previewTextStyle = {
  color: colors.gray300,
  fontSize: '14px',
  lineHeight: '1.4',
  margin: '12px 0 0',
  padding: '0',
};

export default EmailHeader;
