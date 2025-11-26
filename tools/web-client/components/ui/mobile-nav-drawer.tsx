'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader } from '@/components/ui/drawer';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface MobileNavDrawerProps {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  className?: string;
  itemClassName?: string;
  onNavigate?: (href: string) => void;
}

/**
 * Mobile Navigation Drawer Component
 *
 * A mobile-friendly navigation drawer that slides in from the left/bottom.
 * Optimized for touch interaction with proper spacing.
 *
 * Features:
 * - Touch-friendly button sizes (44x44px minimum)
 * - Smooth slide animation
 * - Badge support for notifications
 * - Icon support
 * - Automatic close on navigation
 * - Accessible keyboard navigation
 *
 * @example
 * const navItems = [
 *   { label: 'Home', href: '/' },
 *   { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
 * ];
 *
 * return (
 *   <MobileNavDrawer
 *     items={navItems}
 *     open={drawerOpen}
 *     onOpenChange={setDrawerOpen}
 *   />
 * );
 */
export function MobileNavDrawer({
  items,
  open,
  onOpenChange,
  title = 'Menu',
  className,
  itemClassName,
  onNavigate,
}: MobileNavDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={className}>
        <DrawerHeader className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
        </DrawerHeader>

        <nav className="space-y-1 px-2 pb-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // Base styles
                'flex items-center gap-3 rounded-lg px-3 py-3',
                // Touch target sizing (minimum 44x44px)
                'min-h-[44px]',
                // Hover and active states
                'transition-colors duration-200',
                'hover:bg-accent hover:text-accent-foreground',
                'active:bg-accent/80',
                // Focus styles for keyboard navigation
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                itemClassName
              )}
              onClick={() => {
                onNavigate?.(item.href);
                onOpenChange(false);
              }}
            >
              {item.icon && (
                <span className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 font-medium text-sm">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}

interface MobileNavToggleProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

/**
 * Mobile Navigation Toggle Button
 *
 * A hamburger menu button optimized for mobile devices.
 *
 * Features:
 * - Touch-friendly size (44x44px)
 * - Accessible label
 * - Icon that indicates open state
 * - Keyboard accessible
 */
export function MobileNavToggle({
  onClick,
  className,
  label = 'Toggle menu',
}: MobileNavToggleProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md',
        // Touch target sizing (minimum 44x44px)
        'h-11 w-11',
        // Visual styles
        'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        // Transitions
        'transition-colors duration-200',
        // Focus styles
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Hidden on desktop
        'md:hidden',
        className
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export default MobileNavDrawer;
