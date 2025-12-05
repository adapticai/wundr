/**
 * Multi-Panel Layout Component
 * Advanced layout with resizable panels for desktop applications
 * @module components/layout/multi-panel-layout
 */
'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  ResizablePanel,
  ResizablePanelContainer,
  ResizablePanelMain,
} from '@/components/ui/resizable-panel';
import { cn } from '@/lib/utils';

interface MultiPanelLayoutProps {
  children: React.ReactNode;
  className?: string;
  leftPanel?: {
    content: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  };
  rightPanel?: {
    content: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  };
  bottomPanel?: {
    content: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  };
  storageKey?: string;
}

export function MultiPanelLayout({
  children,
  className,
  leftPanel,
  rightPanel,
  bottomPanel,
  storageKey = 'multi-panel-layout',
}: MultiPanelLayoutProps) {
  const [leftCollapsed, setLeftCollapsed] = React.useState(
    leftPanel?.defaultCollapsed ?? false
  );
  const [rightCollapsed, setRightCollapsed] = React.useState(
    rightPanel?.defaultCollapsed ?? false
  );
  const [bottomCollapsed, setBottomCollapsed] = React.useState(
    bottomPanel?.defaultCollapsed ?? false
  );
  const [bottomSize, setBottomSize] = React.useState(
    bottomPanel?.defaultSize ?? 300
  );

  // Load collapsed states from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const savedState = localStorage.getItem(`${storageKey}-collapsed`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (leftPanel?.collapsible) {
            setLeftCollapsed(parsed.left ?? false);
          }
          if (rightPanel?.collapsible) {
            setRightCollapsed(parsed.right ?? false);
          }
          if (bottomPanel?.collapsible) {
            setBottomCollapsed(parsed.bottom ?? false);
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }, [
    storageKey,
    leftPanel?.collapsible,
    rightPanel?.collapsible,
    bottomPanel?.collapsible,
  ]);

  // Save collapsed states to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      localStorage.setItem(
        `${storageKey}-collapsed`,
        JSON.stringify({
          left: leftCollapsed,
          right: rightCollapsed,
          bottom: bottomCollapsed,
        })
      );
    }
  }, [storageKey, leftCollapsed, rightCollapsed, bottomCollapsed]);

  const toggleLeft = () => setLeftCollapsed(!leftCollapsed);
  const toggleRight = () => setRightCollapsed(!rightCollapsed);
  const toggleBottom = () => setBottomCollapsed(!bottomCollapsed);

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Top section with horizontal panels */}
      <div className='flex-1 flex overflow-hidden'>
        <ResizablePanelContainer>
          {/* Left Panel */}
          {leftPanel && !leftCollapsed && (
            <ResizablePanel
              side='left'
              defaultSize={leftPanel.defaultSize}
              minSize={leftPanel.minSize}
              maxSize={leftPanel.maxSize}
              storageKey={storageKey ? `${storageKey}-left` : undefined}
              className='border-r bg-background/95'
            >
              <div className='h-full flex flex-col'>
                {leftPanel.collapsible && (
                  <div className='flex items-center justify-end p-2 border-b'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={toggleLeft}
                      className='h-7 w-7'
                      aria-label='Collapse left panel'
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                  </div>
                )}
                <div className='flex-1 overflow-auto'>{leftPanel.content}</div>
              </div>
            </ResizablePanel>
          )}

          {/* Collapsed left panel toggle */}
          {leftPanel && leftCollapsed && leftPanel.collapsible && (
            <div className='flex-shrink-0 w-12 border-r bg-background/95 flex items-start justify-center pt-2'>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleLeft}
                className='h-7 w-7'
                aria-label='Expand left panel'
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          )}

          {/* Main Content */}
          <ResizablePanelMain className='bg-background'>
            {children}
          </ResizablePanelMain>

          {/* Collapsed right panel toggle */}
          {rightPanel && rightCollapsed && rightPanel.collapsible && (
            <div className='flex-shrink-0 w-12 border-l bg-background/95 flex items-start justify-center pt-2'>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleRight}
                className='h-7 w-7'
                aria-label='Expand right panel'
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
            </div>
          )}

          {/* Right Panel */}
          {rightPanel && !rightCollapsed && (
            <ResizablePanel
              side='right'
              defaultSize={rightPanel.defaultSize}
              minSize={rightPanel.minSize}
              maxSize={rightPanel.maxSize}
              storageKey={storageKey ? `${storageKey}-right` : undefined}
              className='border-l bg-background/95'
            >
              <div className='h-full flex flex-col'>
                {rightPanel.collapsible && (
                  <div className='flex items-center justify-start p-2 border-b'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={toggleRight}
                      className='h-7 w-7'
                      aria-label='Collapse right panel'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </div>
                )}
                <div className='flex-1 overflow-auto'>{rightPanel.content}</div>
              </div>
            </ResizablePanel>
          )}
        </ResizablePanelContainer>
      </div>

      {/* Bottom Panel */}
      {bottomPanel && (
        <>
          {/* Collapsed bottom panel toggle */}
          {bottomCollapsed && bottomPanel.collapsible && (
            <div className='flex-shrink-0 h-12 border-t bg-background/95 flex items-center justify-center'>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleBottom}
                className='h-7 w-7'
                aria-label='Expand bottom panel'
              >
                <ChevronUp className='h-4 w-4' />
              </Button>
            </div>
          )}

          {/* Expanded bottom panel */}
          {!bottomCollapsed && (
            <div
              className='flex-shrink-0 border-t bg-background/95 flex flex-col'
              style={{ height: `${bottomSize}px` }}
            >
              {/* Resize handle */}
              <div
                className='h-1 cursor-row-resize hover:bg-primary/20 transition-colors group relative'
                onMouseDown={e => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startSize = bottomSize;

                  const handleMouseMove = (e: MouseEvent) => {
                    const deltaY = startY - e.clientY;
                    const newSize = Math.max(
                      bottomPanel.minSize ?? 100,
                      Math.min(bottomPanel.maxSize ?? 600, startSize + deltaY)
                    );
                    setBottomSize(newSize);
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  document.body.style.userSelect = 'none';
                  document.body.style.cursor = 'row-resize';
                }}
              >
                <div className='absolute top-0 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity'>
                  <div className='p-1 rounded bg-background border border-border shadow-sm'>
                    <ChevronUp className='h-3 w-3 text-muted-foreground' />
                  </div>
                </div>
              </div>

              {/* Header with collapse button */}
              {bottomPanel.collapsible && (
                <div className='flex items-center justify-end px-2 py-1 border-b'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={toggleBottom}
                    className='h-7 w-7'
                    aria-label='Collapse bottom panel'
                  >
                    <ChevronDown className='h-4 w-4' />
                  </Button>
                </div>
              )}

              {/* Content */}
              <div className='flex-1 overflow-auto'>{bottomPanel.content}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
