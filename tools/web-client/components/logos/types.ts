/**
 * Common theme options for Wundr logo components
 */
export type LogoTheme = 'light' | 'dark' | 'auto';

/**
 * Logo size options for consistent scaling
 */
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Layout orientation options
 */
export type LogoOrientation = 'horizontal' | 'vertical';

/**
 * Base props shared across logo components
 */
export interface BaseLogoProps {
  className?: string;
  theme?: LogoTheme;
}

/**
 * Props for the main Wundr logo symbol
 */
export interface WundrLogoProps extends BaseLogoProps {
  size?: number;
}

/**
 * Props for the Wundr wordmark
 */
export type WundrWordmarkProps = BaseLogoProps;

/**
 * Props for the complete logo lockup
 */
export interface WundrLogoFullProps extends BaseLogoProps {
  orientation?: LogoOrientation;
  showTagline?: boolean;
  showAttribution?: boolean;
  size?: LogoSize;
}

/**
 * Props for the logo showcase component
 */
export interface LogoShowcaseProps {
  className?: string;
}

/**
 * Configuration object for different logo sizes
 */
export interface LogoSizeConfig {
  logoSize: number;
  wordmarkScale: number;
  gap: string;
  textSize: string;
  taglineSize: string;
  attributionSize: string;
  verticalGap: string;
  taglineGap: string;
}

/**
 * Brand constants
 */
export const BRAND_CONSTANTS = {
  tagline:
    'Transform your monorepo with intelligent code analysis and refactoring',
  attribution: 'A product by Wundr, by Adaptic.ai',
  colors: {
    primary: '#0E1A24',
    primaryLight: '#FFFFFF',
  },
  fonts: {
    primary:
      "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  },
} as const;
