/**
 * Split View Component
 * @module components/layout/split-view
 *
 * Master-detail pattern component optimized for tablet devices.
 * Left panel (list view) and right panel (detail view) with responsive layout.
 */
'use client';

import { useState } from 'react';

import { useIsTablet, useIsMobile } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

interface SplitViewProps {
  /** Left panel content (list/master view) */
  leftPanel: React.ReactNode;
  /** Right panel content (detail view) */
  rightPanel: React.ReactNode;
  /** Initial selection state */
  hasSelection?: boolean;
  /** Left panel width ratio (default: 40%) */
  leftPanelWidth?: number;
  /** Additional CSS classes */
  className?: string;
  /** Enable mobile stacking */
  enableMobileStack?: boolean;
}

/**
 * SplitView implements a master-detail pattern with responsive behavior:
 *
 * - Mobile (< 768px): Stacked layout, toggle between panels
 * - Tablet (768px-1024px): Side-by-side with configurable widths
 * - Desktop (> 1024px): Side-by-side with smooth transitions
 *
 * Touch-friendly with minimum 44x44px interaction areas.
 *
 * @example
 * ```tsx
 * <SplitView
 *   leftPanel={<ItemList onSelect={handleSelect} />}
 *   rightPanel={<ItemDetail item={selectedItem} />}
 *   hasSelection={!!selectedItem}
 * />
 * ```
 */
export function SplitView({
  leftPanel,
  rightPanel,
  hasSelection = false,
  leftPanelWidth = 40,
  className,
  enableMobileStack = true,
}: SplitViewProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [showDetail, setShowDetail] = useState(false);

  // On mobile, show either list or detail view
  if (isMobile && enableMobileStack) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        {/* Mobile: Toggle between views */}
        {!showDetail || !hasSelection ? (
          <div className="flex-1 overflow-auto">
            {leftPanel}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Back button for mobile */}
            <div className="sticky top-0 z-10 bg-background border-b border-border">
              <button
                onClick={() => setShowDetail(false)}
                className="flex items-center gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors min-h-[44px]"
                aria-label="Back to list"
              >
                <ChevronLeftIcon className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
            </div>
            {rightPanel}
          </div>
        )}
      </div>
    );
  }

  // Tablet and Desktop: Side-by-side layout
  const leftWidth = isTablet ? leftPanelWidth : 40;
  const rightWidth = 100 - leftWidth;

  return (
    <div className={cn('h-full flex', className)}>
      {/* Left Panel (List/Master View) */}
      <div
        className={cn(
          'flex-shrink-0 border-r border-border overflow-y-auto transition-all duration-300',
          'bg-background',
        )}
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Right Panel (Detail View) */}
      <div
        className="flex-1 overflow-y-auto transition-all duration-300 bg-muted/30"
        style={{ width: `${rightWidth}%` }}
      >
        {hasSelection ? (
          rightPanel
        ) : (
          <EmptyDetailView />
        )}
      </div>
    </div>
  );
}

/**
 * Empty state for when no item is selected in detail view
 */
function EmptyDetailView() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <DocumentIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No Selection
        </h3>
        <p className="text-sm text-muted-foreground">
          Select an item from the list to view details
        </p>
      </div>
    </div>
  );
}

/**
 * Split view list item with tablet-optimized touch targets
 */
export function SplitViewListItem({
  children,
  selected = false,
  onClick,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border transition-colors',
        'min-h-[44px] touch-manipulation', // Touch-friendly minimum size
        selected
          ? 'bg-primary/10 border-l-4 border-l-primary'
          : 'hover:bg-muted/50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Split view header with consistent styling
 */
export function SplitViewHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'sticky top-0 z-10 bg-background border-b border-border px-4 py-3',
      'min-h-[56px] flex items-center',
      className,
    )}>
      {children}
    </div>
  );
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
