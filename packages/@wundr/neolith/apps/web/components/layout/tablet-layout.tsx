/**
 * Tablet Layout Component
 * @module components/layout/tablet-layout
 *
 * Provides tablet-specific layout wrapper with optional 2-column layout.
 * Optimized for screens 768px-1024px with responsive sidebar support.
 */
'use client';

import { useIsTablet } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

interface TabletLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  showSidebar?: boolean;
  className?: string;
}

/**
 * TabletLayout provides a responsive layout wrapper optimized for tablet devices.
 *
 * Features:
 * - Automatic detection of tablet viewport (768px-1024px)
 * - Optional sidebar with 2-column layout
 * - Sidebar width: 288px (18rem / w-72)
 * - Main content area: flexible with overflow handling
 * - Graceful fallback for non-tablet viewports
 *
 * @example
 * ```tsx
 * <TabletLayout sidebar={<Sidebar />} showSidebar={true}>
 *   <MainContent />
 * </TabletLayout>
 * ```
 */
export function TabletLayout({
  children,
  sidebar,
  showSidebar = true,
  className,
}: TabletLayoutProps) {
  const isTablet = useIsTablet();

  // If not tablet or no sidebar to show, render children directly
  if (!isTablet || !sidebar || !showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Sidebar - fixed width, scrollable */}
      <aside className='w-72 flex-shrink-0 border-r border-border bg-muted/30 overflow-y-auto'>
        {sidebar}
      </aside>

      {/* Main content - flexible, scrollable */}
      <main className='flex-1 overflow-auto'>{children}</main>
    </div>
  );
}

/**
 * Tablet content wrapper for consistent padding and spacing
 */
export function TabletContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('p-4 md:p-6', className)}>{children}</div>;
}

/**
 * Tablet grid container with 2-column layout
 */
export function TabletGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
