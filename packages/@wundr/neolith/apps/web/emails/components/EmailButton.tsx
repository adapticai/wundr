/**
 * Email Button Component
 * Branded CTA button with consistent styling
 */

import { Button } from '@react-email/components';
import * as React from 'react';

import { colors } from './email-styles';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
}

export const EmailButton = ({
  href,
  children,
  variant = 'primary',
}: EmailButtonProps) => {
  const buttonStyle =
    variant === 'primary'
      ? primaryButton
      : variant === 'secondary'
        ? secondaryButton
        : outlineButton;

  return (
    <Button style={buttonStyle} href={href}>
      {children}
    </Button>
  );
};

// Styles
const baseButton = {
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const primaryButton = {
  ...baseButton,
  backgroundColor: colors.black,
  color: colors.white,
  border: `2px solid ${colors.black}`,
};

const secondaryButton = {
  ...baseButton,
  backgroundColor: colors.white,
  color: colors.black,
  border: `2px solid ${colors.black}`,
};

const outlineButton = {
  ...baseButton,
  backgroundColor: 'transparent',
  color: colors.black,
  border: `2px solid ${colors.gray300}`,
};

export default EmailButton;
