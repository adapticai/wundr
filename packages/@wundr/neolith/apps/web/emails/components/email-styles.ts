/**
 * Shared Email Styles
 * Centralized brand colors and typography for all email templates
 */

export const colors = {
  // Brand colors - Black & White
  primary: '#000000',
  primaryForeground: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',

  // Grays for text and borders
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray900: '#171717',

  // Accent colors for states
  success: '#22C55E',
  successLight: '#F0FDF4',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEF2F2',
};

export const fonts = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

export const spacing = {
  containerPadding: '48px 24px',
  sectionPadding: '24px',
  contentPadding: '0 24px',
  buttonPadding: '16px 32px',
  smallPadding: '12px 16px',
};

// Common styles
export const main = {
  backgroundColor: colors.white,
  fontFamily: fonts.fontFamily,
};

export const container = {
  backgroundColor: colors.white,
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
};

export const h1 = {
  color: colors.black,
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '1.2',
  margin: '0 0 24px',
  padding: spacing.contentPadding,
};

export const h2 = {
  color: colors.black,
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 16px',
  padding: spacing.contentPadding,
};

export const text = {
  color: colors.gray800,
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
  padding: spacing.contentPadding,
};

export const textSmall = {
  color: colors.gray600,
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 12px',
  padding: spacing.contentPadding,
};

export const hr = {
  borderColor: colors.gray200,
  borderWidth: '1px',
  margin: '32px 0',
};

export const link = {
  color: colors.black,
  textDecoration: 'underline',
  fontWeight: '500',
};
