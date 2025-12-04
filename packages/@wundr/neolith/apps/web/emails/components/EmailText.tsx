/**
 * Email Text Component
 * Styled text components with consistent typography
 */

import { Text as ReactEmailText } from '@react-email/components';
import * as React from 'react';

import { text, textSmall, h1, h2, colors } from './email-styles';

interface EmailTextProps {
  children: React.ReactNode;
  variant?: 'body' | 'small' | 'h1' | 'h2' | 'caption';
  style?: React.CSSProperties;
}

export const EmailText = ({
  children,
  variant = 'body',
  style: customStyle = {},
}: EmailTextProps) => {
  let baseStyle = text;

  switch (variant) {
    case 'small':
      baseStyle = textSmall;
      break;
    case 'h1':
      baseStyle = h1;
      break;
    case 'h2':
      baseStyle = h2;
      break;
    case 'caption':
      baseStyle = captionStyle;
      break;
    default:
      baseStyle = text;
  }

  return (
    <ReactEmailText style={{ ...baseStyle, ...customStyle }}>
      {children}
    </ReactEmailText>
  );
};

// Additional text styles
const captionStyle = {
  color: colors.gray500,
  fontSize: '13px',
  lineHeight: '1.4',
  margin: '0 0 8px',
  padding: '0 24px',
};

export default EmailText;
