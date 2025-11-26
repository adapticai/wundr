'use client';

import { Menu, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

export interface MobileNavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface MobileNavDrawerProps {
  items: MobileNavItem[];
  title?: string;
  description?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  footer?: React.ReactNode;
  header?: React.ReactNode;
}

/**
 * Mobile navigation drawer component
 * - Hamburger menu trigger
 * - Drawer with navigation items
 * - Swipe gesture support (via vaul)
 * - Auto-closes on navigation
 *
 * @example
 * <MobileNavDrawer
 *   title="Navigation"
 *   items={[
 *     { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
 *     { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
 *   ]}
 * />
 */
export function MobileNavDrawer({
  items,
  title = 'Menu',
  description,
  className,
  open,
  onOpenChange,
  footer,
  header,
}: MobileNavDrawerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(newOpen);
      } else {
        setIsOpen(newOpen);
      }
    },
    [onOpenChange],
  );

  const handleItemClick = React.useCallback(
    (item: MobileNavItem) => {
      // Close drawer on navigation
      handleOpenChange(false);

      // Call custom onClick if provided
      if (item.onClick) {
        item.onClick();
      }
    },
    [handleOpenChange],
  );

  const isControlled = open !== undefined;
  const drawerOpen = isControlled ? open : isOpen;

  return (
    <Drawer open={drawerOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className={cn('max-h-[85vh]', className)}>
        <DrawerHeader className="text-left">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>{title}</DrawerTitle>
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {header && <div className="px-4">{header}</div>}

        <nav className="flex flex-col gap-1 p-4 overflow-y-auto">
          {items.map((item, index) => (
            <a
              key={index}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                handleItemClick(item);
                window.location.href = item.href;
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3',
                'text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {item.icon && (
                <span className="flex h-5 w-5 items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {footer && (
          <div className="border-t border-border p-4 mt-auto">
            {footer}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export interface MobileNavDrawerItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Individual navigation item for custom layouts
 */
export function MobileNavDrawerItem({
  children,
  onClick,
  className,
}: MobileNavDrawerItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-3 w-full',
        'text-sm font-medium transition-colors text-left',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
    </button>
  );
}
