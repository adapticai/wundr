'use client';

import { useEffect, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

interface AdminLayoutClientProps {
  children: React.ReactNode;
}

/**
 * Client component that auto-collapses the main workspace sidebar
 * when entering admin routes, and restores it when leaving.
 */
export function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const { setOpen, open } = useSidebar();
  const previousOpenState = useRef<boolean | null>(null);

  useEffect(() => {
    // Store the previous state on mount
    if (previousOpenState.current === null) {
      previousOpenState.current = open;
    }

    // Collapse the sidebar when entering admin routes
    setOpen(false);

    // Restore the previous state when leaving admin routes
    return () => {
      if (previousOpenState.current !== null) {
        setOpen(previousOpenState.current);
      }
    };
  }, [setOpen, open]);

  return <>{children}</>;
}
