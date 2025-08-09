import React from 'react';
import { WundrLogo } from './WundrLogo';
import { WundrWordmark } from './WundrWordmark';

interface WundrLogoFullProps {
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
  orientation?: 'horizontal' | 'vertical';
  showTagline?: boolean;
  showAttribution?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const WundrLogoFull: React.FC<WundrLogoFullProps> = ({
  className = '',
  theme = 'auto',
  orientation = 'horizontal',
  showTagline = true,
  showAttribution = true,
  size = 'md',
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      logoSize: 24,
      wordmarkScale: 0.8,
      gap: 'gap-2',
      textSize: 'text-xs',
      taglineSize: 'text-[10px]',
      attributionSize: 'text-[9px]',
      verticalGap: 'gap-1.5',
      taglineGap: 'mt-0.5',
    },
    md: {
      logoSize: 32,
      wordmarkScale: 1,
      gap: 'gap-3',
      textSize: 'text-sm',
      taglineSize: 'text-xs',
      attributionSize: 'text-[10px]',
      verticalGap: 'gap-2',
      taglineGap: 'mt-1',
    },
    lg: {
      logoSize: 48,
      wordmarkScale: 1.2,
      gap: 'gap-4',
      textSize: 'text-base',
      taglineSize: 'text-sm',
      attributionSize: 'text-xs',
      verticalGap: 'gap-3',
      taglineGap: 'mt-1.5',
    },
    xl: {
      logoSize: 64,
      wordmarkScale: 1.5,
      gap: 'gap-5',
      textSize: 'text-lg',
      taglineSize: 'text-base',
      attributionSize: 'text-sm',
      verticalGap: 'gap-4',
      taglineGap: 'mt-2',
    },
  };

  const config = sizeConfig[size];

  // Theme-aware text colors
  const getTextColorClass = (opacity: number) => {
    if (theme === 'auto') {
      return `text-[#0E1A24]/${opacity} dark:text-white/${opacity}`;
    }
    return '';
  };

  const getTextColorStyle = (opacity: number) => {
    if (theme === 'light')
      return {
        color: `#0E1A24${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0')}`,
      };
    if (theme === 'dark')
      return {
        color: `#FFFFFF${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0')}`,
      };
    return {};
  };

  // Vertical layout
  if (orientation === 'vertical') {
    return (
      <div
        className={`flex flex-col items-center ${config.verticalGap} ${className}`}
      >
        {/* Logo */}
        <WundrLogo size={config.logoSize} theme={theme} />

        {/* Wordmark */}
        <div style={{ transform: `scale(${config.wordmarkScale})` }}>
          <WundrWordmark theme={theme} />
        </div>

        {/* Tagline and Attribution */}
        {(showTagline || showAttribution) && (
          <div className={`text-center ${config.taglineGap} max-w-[280px]`}>
            {showTagline && (
              <div className='space-y-0.5'>
                <p
                  className={`${config.taglineSize} leading-relaxed font-medium ${getTextColorClass(70)}`}
                  style={{
                    fontFamily:
                      "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                    letterSpacing: '-0.01em',
                    ...getTextColorStyle(0.7),
                  }}
                >
                  Transform your monorepo with intelligent
                </p>
                <p
                  className={`${config.taglineSize} leading-relaxed font-medium ${getTextColorClass(70)}`}
                  style={{
                    fontFamily:
                      "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                    letterSpacing: '-0.01em',
                    ...getTextColorStyle(0.7),
                  }}
                >
                  code analysis and refactoring
                </p>
              </div>
            )}

            {showAttribution && (
              <p
                className={`${config.attributionSize} ${showTagline ? 'mt-2' : ''} font-normal ${getTextColorClass(50)}`}
                style={{
                  fontFamily:
                    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                  ...getTextColorStyle(0.5),
                }}
              >
                A product by Wundr, by Adaptic.ai
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      {/* Logo */}
      <WundrLogo size={config.logoSize} theme={theme} />

      {/* Content */}
      <div className='flex flex-col justify-center'>
        {/* Wordmark */}
        <div
          style={{
            transform: `scale(${config.wordmarkScale})`,
            transformOrigin: 'left center',
          }}
        >
          <WundrWordmark theme={theme} />
        </div>

        {/* Tagline and Attribution */}
        {(showTagline || showAttribution) && (
          <div className={`${config.taglineGap} max-w-[400px]`}>
            {showTagline && (
              <p
                className={`${config.taglineSize} leading-relaxed font-medium ${getTextColorClass(70)}`}
                style={{
                  fontFamily:
                    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                  letterSpacing: '-0.01em',
                  ...getTextColorStyle(0.7),
                }}
              >
                Transform your monorepo with intelligent code analysis and
                refactoring
              </p>
            )}

            {showAttribution && (
              <p
                className={`${config.attributionSize} ${showTagline ? 'mt-0.5' : ''} font-normal ${getTextColorClass(50)}`}
                style={{
                  fontFamily:
                    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                  ...getTextColorStyle(0.5),
                }}
              >
                A product by Wundr, by Adaptic.ai
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WundrLogoFull;
