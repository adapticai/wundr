'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  /**
   * CSS class name to apply to the component
   */
  className?: string;

  /**
   * Variant of the toggle - 'dropdown' or 'compact'
   */
  variant?: 'dropdown' | 'compact';

  /**
   * Whether to show the current theme label
   */
  showLabel?: boolean;
}

type ThemeOption = 'light' | 'dark' | 'system';

interface ThemeConfig {
  value: ThemeOption;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const THEME_OPTIONS: ThemeConfig[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <SunIcon />,
    description: 'Light theme',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <MoonIcon />,
    description: 'Dark theme',
  },
  {
    value: 'system',
    label: 'System',
    icon: <SystemIcon />,
    description: 'Follow system preference',
  },
];

/**
 * ThemeToggle Component
 *
 * A component for switching between light, dark, and system themes.
 * Uses next-themes for theme management with localStorage persistence.
 *
 * Features:
 * - Three theme options: Light, Dark, System
 * - Dropdown interface with descriptions
 * - Smooth theme transitions
 * - localStorage persistence
 * - System preference detection
 * - Keyboard navigation support
 * - Accessibility compliant (WCAG)
 *
 * @example
 * ```tsx
 * // In a client component
 * import { ThemeToggle } from '@/components/layout/theme-toggle';
 *
 * export function Header() {
 *   return (
 *     <header>
 *       <ThemeToggle variant="dropdown" showLabel />
 *     </header>
 *   );
 * }
 * ```
 */
export function ThemeToggle({
  className,
  variant = 'dropdown',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Prevent hydration mismatch by only rendering after client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn('h-9 w-9 rounded-lg bg-muted animate-pulse', className)}
      />
    );
  }

  const currentTheme = THEME_OPTIONS.find(t => t.value === theme);
  const displayLabel = currentTheme?.label || 'System';

  if (variant === 'compact') {
    return (
      <button
        onClick={() => {
          const currentIndex = THEME_OPTIONS.findIndex(t => t.value === theme);
          const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
          const nextTheme = THEME_OPTIONS[nextIndex].value;
          setTheme(nextTheme);
        }}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg p-2',
          'text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'active:scale-95',
          className
        )}
        title={`Theme: ${displayLabel}`}
        aria-label='Toggle theme'
      >
        {currentTheme?.icon}
        {showLabel && <span className='hidden sm:inline'>{displayLabel}</span>}
      </button>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
          if (e.key === 'ArrowDown' && !isOpen) {
            setIsOpen(true);
          }
        }}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg p-2',
          'text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'active:scale-95',
          isOpen && 'bg-accent'
        )}
        aria-expanded={isOpen}
        aria-haspopup='listbox'
        aria-label='Select theme'
        title='Select theme'
      >
        {currentTheme?.icon}
        {showLabel && (
          <>
            <span className='hidden sm:inline text-foreground'>
              {displayLabel}
            </span>
            <ChevronDownIcon
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className='fixed inset-0 z-30'
            onClick={() => setIsOpen(false)}
            onKeyDown={e => e.key === 'Escape' && setIsOpen(false)}
            role='button'
            tabIndex={-1}
            aria-hidden='true'
          />

          {/* Menu */}
          <div
            className={cn(
              'absolute right-0 top-full z-40 mt-2 w-56',
              'origin-top-right rounded-lg border bg-popover shadow-lg',
              'ring-1 ring-black/5 dark:ring-white/5',
              'animate-fade-in'
            )}
            role='listbox'
            aria-label='Theme options'
          >
            <div className='p-2 space-y-1'>
              {THEME_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setIsOpen(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTheme(option.value);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2',
                    'text-sm transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    theme === option.value
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  )}
                  role='option'
                  aria-selected={theme === option.value}
                >
                  <span className='flex h-5 w-5 items-center justify-center rounded border border-muted-foreground/30'>
                    {option.icon}
                  </span>
                  <div className='flex flex-1 flex-col items-start'>
                    <span className='font-medium'>{option.label}</span>
                    <span className='text-xs text-muted-foreground'>
                      {option.description}
                    </span>
                  </div>
                  {theme === option.value && <CheckIcon className='h-4 w-4' />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Simpler button variant for use in compact spaces
 * Cycles through themes on each click
 */
export function ThemeToggleButton() {
  return <ThemeToggle variant='compact' />;
}

/**
 * Theme toggle with label for settings pages
 */
export function ThemeToggleLarge() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className='space-y-4'>
        {[1, 2, 3].map(i => (
          <div key={i} className='h-12 rounded-lg bg-muted animate-pulse' />
        ))}
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {THEME_OPTIONS.map(option => (
        <label
          key={option.value}
          className={cn(
            'flex items-center gap-4 rounded-lg border-2 p-4',
            'cursor-pointer transition-colors',
            theme === option.value
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/50'
          )}
        >
          <input
            type='radio'
            name='theme'
            value={option.value}
            checked={theme === option.value}
            onChange={e => setTheme(e.target.value)}
            className='h-4 w-4 accent-primary'
          />
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              {option.icon}
              <span className='font-medium'>{option.label}</span>
            </div>
            <p className='text-sm text-muted-foreground'>
              {option.description}
            </p>
          </div>
        </label>
      ))}
    </div>
  );
}

// SVG Icons
function SunIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='5' />
      <line x1='12' y1='1' x2='12' y2='3' />
      <line x1='12' y1='21' x2='12' y2='23' />
      <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
      <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
      <line x1='1' y1='12' x2='3' y2='12' />
      <line x1='21' y1='12' x2='23' y2='12' />
      <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
      <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect width='20' height='14' x='2' y='3' rx='2' ry='2' />
      <line x1='8' y1='21' x2='16' y2='21' />
      <line x1='12' y1='17' x2='12' y2='21' />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M20 6 9 17l-5-5' />
    </svg>
  );
}
