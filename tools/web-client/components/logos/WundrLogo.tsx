import React from 'react';

interface WundrLogoProps {
  size?: number;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
}

export const WundrLogo: React.FC<WundrLogoProps> = ({ 
  size = 32, 
  className = '',
  theme = 'auto'
}) => {
  const strokeColor = theme === 'dark' ? '#FFFFFF' : (theme === 'light' ? '#0E1A24' : 'currentColor');
  const viewBoxSize = 48;
  const strokeWidth = 2; // 2pt stroke width
  const radius = 20;
  const centerX = viewBoxSize / 2;
  const centerY = viewBoxSize / 2;
  const breakOffset = 2; // One segment offset radially outward by 2px
  
  // Calculate 8 equal arc segments forming a circle
  const segmentAngle = 360 / 8; // 45 degrees per segment
  const segments = [];
  
  for (let i = 0; i < 8; i++) {
    const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
    
    // Offset segment 2 radially outward by 2px
    const r = i === 2 ? radius + breakOffset : radius;
    
    const x1 = centerX + r * Math.cos(startAngle);
    const y1 = centerY + r * Math.sin(startAngle);
    const x2 = centerX + r * Math.cos(endAngle);
    const y2 = centerY + r * Math.sin(endAngle);
    
    const largeArcFlag = 0;
    
    segments.push(
      <path
        key={i}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="miter" // Sharp joins for perfect geometry
        className={theme === 'auto' ? 'stroke-[#0E1A24] dark:stroke-white' : ''}
      />
    );
  }
  
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {segments}
    </svg>
  );
};

export default WundrLogo;