'use client';

import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery, BREAKPOINTS } from '@/hooks/use-media-query';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /**
   * Breakpoint at which to switch from drawer to dialog
   * Default: 'md' (768px) - drawer on mobile, dialog on tablet+
   */
  breakpoint?: 'sm' | 'md' | 'lg';
}

/**
 * Responsive Modal Component
 *
 * Automatically switches between a Drawer on mobile and a Dialog on desktop.
 * Provides consistent API while adapting to device capabilities.
 *
 * Features:
 * - Automatic responsive behavior
 * - Swipe-to-close on mobile
 * - Configurable breakpoint
 * - Consistent styling
 * - Accessible on all devices
 * - Touch-friendly spacing (44x44px minimum targets)
 *
 * @example
 * const [open, setOpen] = useState(false);
 *
 * return (
 *   <ResponsiveModal
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Confirm Action"
 *     description="Are you sure you want to proceed?"
 *   >
 *     <div>Modal content here</div>
 *   </ResponsiveModal>
 * );
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  breakpoint = 'md',
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery(
    `(min-width: ${BREAKPOINTS[breakpoint]}px)`
  );

  // Prevent rendering mismatch on initial load
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  // Render as drawer on mobile, dialog on desktop
  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={className}>
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1.5">
                {description}
              </p>
            )}
          </DrawerHeader>

          <div className={cn('px-4 overflow-y-auto', contentClassName)}>
            {children}
          </div>

          {footer && (
            <div className="border-t p-4 mt-4 space-y-2 sm:space-y-0 sm:flex gap-2 justify-end">
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5">
              {description}
            </p>
          )}
        </DialogHeader>

        <div className={cn('py-4', contentClassName)}>{children}</div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export default ResponsiveModal;
