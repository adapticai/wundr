/**
 * Bottom Tab Navigation Component
 * Mobile-first navigation bar for primary app sections
 * @module components/ui/bottom-tab-navigation
 */

'use client';

import { Home, Hash, Users, Activity, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface BottomTabNavigationProps {
  tabs?: TabItem[];
  className?: string;
  showLabels?: boolean;
}

const DEFAULT_TABS: TabItem[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: Home,
  },
  {
    href: '/channels',
    label: 'Channels',
    icon: Hash,
  },
  {
    href: '/orchestrators',
    label: 'VPs',
    icon: Users,
  },
  {
    href: '/activity',
    label: 'Activity',
    icon: Activity,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
  },
];

/**
 * Bottom tab navigation bar for mobile devices
 * - Fixed at bottom of screen on mobile
 * - Hidden on desktop (md and above)
 * - Touch-optimized with 44x44px minimum touch targets
 * - Active state indication
 * - Badge support for notifications
 *
 * @example
 * <BottomTabNavigation
 *   tabs={[
 *     { href: '/home', label: 'Home', icon: Home },
 *     { href: '/channels', label: 'Channels', icon: Hash, badge: 3 },
 *   ]}
 * />
 */
export function BottomTabNavigation({
  tabs = DEFAULT_TABS,
  className,
  showLabels = true,
}: BottomTabNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        // Fixed positioning at bottom
        'fixed bottom-0 left-0 right-0 z-50',
        // Mobile-only (hidden on desktop)
        'md:hidden',
        // Background and border
        'border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        // Safe area for iOS notch
        'pb-safe',
        className
      )}
      role='navigation'
      aria-label='Bottom navigation'
    >
      <div className='flex items-center justify-around h-16'>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href || pathname?.startsWith(tab.href + '/');

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                // Flex container for icon and label
                'flex flex-col items-center justify-center',
                // Touch target - minimum 44x44px
                'min-w-[44px] min-h-[44px] flex-1 px-2',
                // Transitions
                'transition-colors duration-200',
                // Focus styles
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                // Rounded for better focus ring
                'rounded-md',
                // Active state colors
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className='relative'>
                <Icon
                  className={cn(
                    'h-6 w-6',
                    isActive ? 'scale-110' : 'scale-100',
                    'transition-transform duration-200'
                  )}
                  aria-hidden='true'
                />
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1',
                      'flex items-center justify-center',
                      'min-w-[16px] h-4 px-1',
                      'text-[10px] font-bold text-white',
                      'bg-destructive rounded-full'
                    )}
                    aria-label={`${tab.badge} notifications`}
                  >
                    {typeof tab.badge === 'number' && tab.badge > 99
                      ? '99+'
                      : tab.badge}
                  </span>
                )}
              </div>
              {showLabels && (
                <span
                  className={cn(
                    'text-xs mt-1',
                    'transition-all duration-200',
                    isActive ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {tab.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export interface BottomTabNavigationSpacerProps {
  className?: string;
}

/**
 * Spacer component to add padding at bottom of scrollable content
 * Prevents content from being hidden behind the bottom tab navigation
 *
 * @example
 * <div className="overflow-y-auto">
 *   <Content />
 *   <BottomTabNavigationSpacer />
 * </div>
 */
export function BottomTabNavigationSpacer({
  className,
}: BottomTabNavigationSpacerProps) {
  return (
    <div
      className={cn(
        // Height matches bottom tab navigation (16 = h-16)
        'h-16',
        // Mobile-only (hidden on desktop)
        'md:hidden',
        className
      )}
      aria-hidden='true'
    />
  );
}

export { DEFAULT_TABS };
