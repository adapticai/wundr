/**
 * Color Blindness SVG Filters
 * @module components/accessibility/ColorBlindnessFilters
 *
 * Provides SVG filter definitions for color blindness simulation modes
 */

export function ColorBlindnessFilters() {
  return (
    <svg
      className='colorblind-filters'
      aria-hidden='true'
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {/* Deuteranopia (red-green color blindness, most common) */}
        <filter id='deuteranopia-filter'>
          <feColorMatrix
            type='matrix'
            values='0.625 0.375 0   0 0
                    0.7   0.3   0   0 0
                    0     0.3   0.7 0 0
                    0     0     0   1 0'
          />
        </filter>

        {/* Protanopia (red color blindness) */}
        <filter id='protanopia-filter'>
          <feColorMatrix
            type='matrix'
            values='0.567 0.433 0     0 0
                    0.558 0.442 0     0 0
                    0     0.242 0.758 0 0
                    0     0     0     1 0'
          />
        </filter>

        {/* Tritanopia (blue-yellow color blindness, rare) */}
        <filter id='tritanopia-filter'>
          <feColorMatrix
            type='matrix'
            values='0.95  0.05  0     0 0
                    0     0.433 0.567 0 0
                    0     0.475 0.525 0 0
                    0     0     0     1 0'
          />
        </filter>
      </defs>
    </svg>
  );
}
