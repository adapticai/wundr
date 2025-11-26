'use client';

import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DrawerContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DrawerContext = React.createContext<DrawerContextType | undefined>(undefined);

function useDrawer() {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within a Drawer');
  }
  return context;
}

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Drawer Component
 *
 * A mobile-friendly drawer that slides in from the bottom.
 * Built with accessibility and touch gestures in mind.
 *
 * Features:
 * - Swipe to dismiss
 * - Click outside to close
 * - Keyboard support (ESC to close)
 * - Smooth animations
 * - Touch-friendly sizing
 * - Prevents body scroll when open
 */
export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <DrawerContext.Provider value={{ isOpen: open, setIsOpen: onOpenChange }}>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onOpenChange(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onOpenChange(false);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      )}
    </DrawerContext.Provider>
  );
}

interface DrawerContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DrawerContent({ children, className }: DrawerContentProps) {
  const { isOpen, setIsOpen } = useDrawer();
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // Handle swipe gesture to close
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    // Only allow swipe down (positive values)
    if (diff > 0 && contentRef.current) {
      contentRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    const diff = currentYRef.current - startYRef.current;
    const threshold = 100; // pixels to trigger close

    if (contentRef.current) {
      if (diff > threshold) {
        // Swipe down enough to close
        setIsOpen(false);
        contentRef.current.style.transform = '';
      } else {
        // Snap back
        contentRef.current.style.transform = '';
      }
    }
  };

  return (
    <div
      ref={contentRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-lg shadow-lg',
        'max-h-[85vh] overflow-y-auto',
        'transform transition-transform duration-300 ease-out',
        'touch-none',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
    >
      {/* Drag indicator */}
      <div className="flex justify-center pt-2 pb-2">
        <div className="h-1 w-12 rounded-full bg-muted" aria-hidden="true" />
      </div>

      {/* Close button for keyboard/non-touch users */}
      <button
        onClick={() => setIsOpen(false)}
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none md:hidden"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pt-2">{children}</div>
    </div>
  );
}

interface DrawerHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerHeader({ className, children }: DrawerHeaderProps) {
  return (
    <div className={cn('px-4 py-3 text-left sm:text-center', className)}>
      {children}
    </div>
  );
}

interface DrawerTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerTitle({ className, children }: DrawerTitleProps) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold leading-none tracking-tight',
        className
      )}
    >
      {children}
    </h2>
  );
}

interface DrawerDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerDescription({ className, children }: DrawerDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
    >
      {children}
    </p>
  );
}

interface DrawerFooterProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerFooter({ className, children }: DrawerFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4 border-t sm:flex-row sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  );
}

export default Drawer;
