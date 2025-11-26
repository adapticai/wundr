'use client';

import { cn } from '@/lib/utils';

interface OrgConnectorProps {
  depth: number;
  isLast?: boolean;
  hasChildren?: boolean;
  className?: string;
}

/**
 * Renders visual connection lines between org hierarchy nodes
 */
export function OrgConnector({ depth, isLast = false, hasChildren = false, className }: OrgConnectorProps) {
  if (depth === 0) return null;

  return (
    <div className={cn('absolute left-0 top-0 h-full w-px', className)}>
      {/* Vertical line from parent */}
      <div className={cn(
        'absolute left-8 top-0 h-1/2 w-px bg-border',
        isLast && 'h-10'
      )} />

      {/* Horizontal line to node */}
      <div className="absolute left-8 top-10 h-px w-8 bg-border" />

      {/* Vertical line to children */}
      {hasChildren && (
        <div className="absolute bottom-0 left-8 top-10 w-px bg-border" />
      )}
    </div>
  );
}

interface DisciplineConnectorProps {
  fromId: string;
  toId: string;
  className?: string;
}

/**
 * Renders reporting line between VPs based on discipline hierarchy
 * This is a simplified version - for complex layouts, consider using SVG paths
 */
export function DisciplineConnector({ fromId, toId, className }: DisciplineConnectorProps) {
  return (
    <svg
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{ zIndex: 0 }}
    >
      <defs>
        <marker
          id={`arrowhead-${fromId}-${toId}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3, 0 6"
            className="fill-muted-foreground"
          />
        </marker>
      </defs>
      <line
        x1="50%"
        y1="0"
        x2="50%"
        y2="100%"
        className="stroke-muted-foreground"
        strokeWidth="1"
        strokeDasharray="4"
        markerEnd={`url(#arrowhead-${fromId}-${toId})`}
      />
    </svg>
  );
}
