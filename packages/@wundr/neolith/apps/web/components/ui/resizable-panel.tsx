/**
 * Resizable Panel Component
 * Allows users to resize panels by dragging a handle
 * @module components/ui/resizable-panel
 */
'use client';

import { GripVertical } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface ResizablePanelProps {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  children: React.ReactNode;
  side: 'left' | 'right';
  className?: string;
  storageKey?: string;
  onResize?: (size: number) => void;
}

export function ResizablePanel({
  defaultSize = 300,
  minSize = 200,
  maxSize = 600,
  children,
  side,
  className,
  storageKey,
  onResize,
}: ResizablePanelProps) {
  const [size, setSize] = React.useState(defaultSize);
  const [isResizing, setIsResizing] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Load size from localStorage on mount
  React.useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const savedSize = localStorage.getItem(storageKey);
      if (savedSize) {
        const parsedSize = parseInt(savedSize, 10);
        if (
          !isNaN(parsedSize) &&
          parsedSize >= minSize &&
          parsedSize <= maxSize
        ) {
          setSize(parsedSize);
        }
      }
    }
  }, [storageKey, minSize, maxSize]);

  // Save size to localStorage when it changes
  React.useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, size.toString());
    }
    onResize?.(size);
  }, [size, storageKey, onResize]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) {
        return;
      }

      const panel = panelRef.current;
      const rect = panel.getBoundingClientRect();

      let newSize: number;
      if (side === 'left') {
        newSize = e.clientX - rect.left;
      } else {
        newSize = rect.right - e.clientX;
      }

      // Constrain size to min/max
      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      setSize(newSize);
    },
    [isResizing, side, minSize, maxSize],
  );

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleStyle: React.CSSProperties =
    side === 'left'
      ? { right: -4, cursor: 'col-resize' }
      : { left: -4, cursor: 'col-resize' };

  return (
    <div
      ref={panelRef}
      className={cn('relative flex-shrink-0', className)}
      style={{ width: `${size}px` }}
    >
      {children}

      {/* Resize Handle */}
      <div
        className={cn(
          'absolute top-0 bottom-0 w-1 group',
          'hover:bg-primary/20 transition-colors',
          isResizing && 'bg-primary/30',
        )}
        style={handleStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Visual grip indicator */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'p-1 rounded',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'bg-background border border-border shadow-sm',
            isResizing && 'opacity-100',
          )}
        >
          <GripVertical className='h-4 w-4 text-muted-foreground' />
        </div>
      </div>
    </div>
  );
}

/**
 * Container for resizable panels
 */
interface ResizablePanelContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ResizablePanelContainer({
  children,
  className,
}: ResizablePanelContainerProps) {
  return (
    <div className={cn('flex h-full overflow-hidden', className)}>
      {children}
    </div>
  );
}

/**
 * Main content area that flexes to fill remaining space
 */
interface ResizablePanelMainProps {
  children: React.ReactNode;
  className?: string;
}

export function ResizablePanelMain({
  children,
  className,
}: ResizablePanelMainProps) {
  return (
    <div className={cn('flex-1 overflow-auto', className)}>{children}</div>
  );
}
