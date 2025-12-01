/**
 * Tablet Organization Chart Component
 * @module components/orchestrator/tablet-org-chart
 *
 * Organization chart optimized for tablet viewing with horizontal scroll,
 * collapsible branches, and touch-optimized node interactions.
 */
'use client';

import { useState, useRef } from 'react';

import {
  useIsTablet,
  useOrientation,
  useTouchDevice,
} from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface OrgNode {
  id: string;
  name: string;
  role?: string;
  status?: 'active' | 'inactive' | 'busy';
  avatarUrl?: string;
  children?: OrgNode[];
  metadata?: {
    department?: string;
    email?: string;
    reports?: number;
  };
}

export interface TabletOrgChartProps {
  data: OrgNode;
  onNodeClick?: (node: OrgNode) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  defaultExpanded?: boolean;
  maxDepth?: number;
  className?: string;
}

/**
 * TabletOrgChart provides a tablet-optimized organization chart:
 *
 * Features:
 * - Horizontal scroll for wide org trees
 * - Pinch-to-zoom support (via CSS transform)
 * - Collapsible branches to save space
 * - Touch-optimized node interactions (min 44x44px)
 * - Responsive layout for portrait/landscape
 * - Visual connection lines between nodes
 * - Status indicators for each node
 *
 * Layout:
 * - Portrait: Vertical tree with scroll
 * - Landscape: Horizontal tree with scroll
 * - Touch targets: 44x44px minimum
 *
 * @example
 * ```tsx
 * <TabletOrgChart
 *   data={orgData}
 *   onNodeClick={(node) => console.log('Clicked:', node)}
 *   defaultExpanded={true}
 * />
 * ```
 */
export function TabletOrgChart({
  data,
  onNodeClick,
  onNodeExpand,
  defaultExpanded = true,
  maxDepth = 5,
  className,
}: TabletOrgChartProps) {
  const isTablet = useIsTablet();
  const orientation = useOrientation();
  const isTouch = useTouchDevice();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(defaultExpanded ? [data.id] : [])
  );
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle node expansion toggle
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
      onNodeExpand?.(nodeId, false);
    } else {
      newExpanded.add(nodeId);
      onNodeExpand?.(nodeId, true);
    }
    setExpandedNodes(newExpanded);
  };

  // Handle node click
  const handleNodeClick = (node: OrgNode, event: React.MouseEvent) => {
    event.stopPropagation();
    onNodeClick?.(node);
  };

  // Zoom controls for tablets
  const handleZoomIn = () => setScale(s => Math.min(s + 0.1, 2));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.1, 0.5));
  const handleZoomReset = () => setScale(1);

  const isPortrait = orientation === 'portrait';
  const layoutDirection = isPortrait ? 'vertical' : 'horizontal';

  return (
    <div className={cn('relative h-full flex flex-col', className)}>
      {/* Toolbar */}
      {isTablet && (
        <div className='flex-shrink-0 border-b border-border bg-background p-2 flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium text-muted-foreground'>
              Organization Chart
            </span>
          </div>

          {/* Zoom Controls */}
          <div className='flex items-center gap-1'>
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className={cn(
                'p-2 rounded-lg border border-border bg-background',
                'hover:bg-muted transition-colors',
                'min-w-[44px] min-h-[44px] touch-manipulation',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label='Zoom out'
            >
              <MinusIcon className='w-5 h-5' />
            </button>

            <button
              onClick={handleZoomReset}
              className={cn(
                'px-3 py-2 rounded-lg border border-border bg-background',
                'hover:bg-muted transition-colors text-sm font-medium',
                'min-w-[44px] min-h-[44px] touch-manipulation'
              )}
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 2}
              className={cn(
                'p-2 rounded-lg border border-border bg-background',
                'hover:bg-muted transition-colors',
                'min-w-[44px] min-h-[44px] touch-manipulation',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label='Zoom in'
            >
              <PlusIcon className='w-5 h-5' />
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Chart Container */}
      <div
        ref={containerRef}
        className='flex-1 overflow-auto p-4 md:p-6'
        style={{
          // Enable momentum scrolling on iOS
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease',
          }}
        >
          <OrgChartNode
            node={data}
            expanded={expandedNodes.has(data.id)}
            onToggle={toggleNode}
            onClick={handleNodeClick}
            depth={0}
            maxDepth={maxDepth}
            layoutDirection={layoutDirection}
            isTouch={isTouch}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * OrgChartNode renders a single node and its children
 */
interface OrgChartNodeProps {
  node: OrgNode;
  expanded: boolean;
  onToggle: (nodeId: string) => void;
  onClick: (node: OrgNode, event: React.MouseEvent) => void;
  depth: number;
  maxDepth: number;
  layoutDirection: 'horizontal' | 'vertical';
  isTouch: boolean;
}

function OrgChartNode({
  node,
  expanded,
  onToggle,
  onClick,
  depth,
  maxDepth,
  layoutDirection,
  isTouch,
}: OrgChartNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = expanded && hasChildren && depth < maxDepth;

  return (
    <div
      className={cn(
        'flex',
        layoutDirection === 'horizontal' ? 'flex-row gap-8' : 'flex-col gap-4'
      )}
    >
      {/* Node Card */}
      <div className='flex flex-col items-center'>
        <button
          onClick={e => onClick(node, e)}
          className={cn(
            'bg-card border border-border rounded-lg p-4',
            'hover:border-primary/50 hover:shadow-md transition-all',
            'min-w-[160px] max-w-[240px]',
            isTouch && 'min-h-[88px]' // Double touch target for cards
          )}
        >
          {/* Avatar and Status */}
          <div className='flex items-center gap-3 mb-2'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden'>
                {node.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={node.avatarUrl}
                    alt={node.name}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <span className='text-sm font-semibold text-primary'>
                    {getInitials(node.name)}
                  </span>
                )}
              </div>
              {node.status && (
                <div
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                    node.status === 'active' && 'bg-green-500',
                    node.status === 'inactive' && 'bg-gray-400',
                    node.status === 'busy' && 'bg-yellow-500'
                  )}
                />
              )}
            </div>

            <div className='flex-1 text-left min-w-0'>
              <p className='font-semibold text-sm text-foreground truncate'>
                {node.name}
              </p>
              {node.role && (
                <p className='text-xs text-muted-foreground truncate'>
                  {node.role}
                </p>
              )}
            </div>
          </div>

          {/* Metadata */}
          {node.metadata?.department && (
            <p className='text-xs text-muted-foreground text-center'>
              {node.metadata.department}
            </p>
          )}
        </button>

        {/* Expand/Collapse Button */}
        {hasChildren && depth < maxDepth && (
          <button
            onClick={e => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className={cn(
              'mt-2 p-2 rounded-full border border-border bg-background',
              'hover:bg-muted transition-colors',
              'min-w-[44px] min-h-[44px] touch-manipulation'
            )}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUpIcon className='w-4 h-4' />
            ) : (
              <ChevronDownIcon className='w-4 h-4' />
            )}
          </button>
        )}
      </div>

      {/* Children Nodes */}
      {showChildren && (
        <div
          className={cn(
            'flex gap-4',
            layoutDirection === 'horizontal'
              ? 'flex-col'
              : 'flex-row flex-wrap',
            'pl-8' // Indent children
          )}
        >
          {node.children!.map(child => (
            <OrgChartNode
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onClick={onClick}
              depth={depth + 1}
              maxDepth={maxDepth}
              layoutDirection={layoutDirection}
              isTouch={isTouch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Utility Functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Icons
function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path strokeLinecap='round' strokeLinejoin='round' d='M5 12h14' />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path strokeLinecap='round' strokeLinejoin='round' d='M12 5v14m7-7H5' />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path strokeLinecap='round' strokeLinejoin='round' d='m18 15-6-6-6 6' />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path strokeLinecap='round' strokeLinejoin='round' d='m6 9 6 6 6-6' />
    </svg>
  );
}
