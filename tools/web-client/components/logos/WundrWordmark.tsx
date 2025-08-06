import React from 'react';

interface WundrWordmarkProps {
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
}

export const WundrWordmark: React.FC<WundrWordmarkProps> = ({ 
  className = '',
  theme = 'auto'
}) => {
  const textColor = theme === 'dark' ? '#FFFFFF' : (theme === 'light' ? '#0E1A24' : 'currentColor');
  
  return (
    <svg
      width="80"
      height="24"
      viewBox="0 0 80 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="18"
        fontFamily="'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        fontSize="20"
        fontWeight="500"
        fill={textColor}
        letterSpacing="-0.02em"
        className={theme === 'auto' ? 'fill-[#0E1A24] dark:fill-white' : ''}
      >
        wundr
      </text>
    </svg>
  );
};

export default WundrWordmark;