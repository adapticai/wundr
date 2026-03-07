'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import type { DaemonNodeStatus } from './daemon-node-card';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TopologyNode {
  id: string;
  name: string;
  hostname: string;
  status: DaemonNodeStatus;
  orchestratorIds: string[];
  health: {
    cpuUsage: number;
    memoryUsage: number;
    activeSessions: number;
  };
}

export interface FederationTopologyProps {
  nodes: TopologyNode[];
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const NODE_RADIUS = 36;
const CANVAS_PADDING = 60;

const STATUS_COLORS: Record<DaemonNodeStatus, string> = {
  ONLINE: '#22c55e',
  OFFLINE: '#9ca3af',
  DEGRADED: '#eab308',
  MAINTENANCE: '#60a5fa',
};

// ─── Layout ────────────────────────────────────────────────────────────────────

interface LayoutNode extends TopologyNode {
  x: number;
  y: number;
}

/**
 * Distribute nodes in a circle around a central point.
 * With 1 node it is placed at the centre; with 2+ nodes they are arranged
 * evenly on a circle so the diagram looks balanced without requiring a force
 * simulation.
 */
function computeLayout(
  nodes: TopologyNode[],
  width: number,
  height: number
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const cx = width / 2;
  const cy = height / 2;

  if (nodes.length === 1) {
    return [{ ...nodes[0], x: cx, y: cy }];
  }

  const radius = Math.min(cx, cy) - CANVAS_PADDING;

  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

/**
 * Build an adjacency list representing which daemon nodes share at least one
 * orchestrator.  These pairs will be drawn with a connection line.
 */
function buildEdges(nodes: LayoutNode[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const aIds = new Set(nodes[i].orchestratorIds);
      const shared = nodes[j].orchestratorIds.some(id => aIds.has(id));
      if (shared) {
        edges.push([i, j]);
      }
    }
  }
  // If no edges exist (no shared orchestrators), connect everything in a ring
  // so the diagram always shows some topology.
  if (edges.length === 0 && nodes.length > 1) {
    for (let i = 0; i < nodes.length; i++) {
      edges.push([i, (i + 1) % nodes.length]);
    }
  }
  return edges;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FederationTopology({
  nodes,
  selectedNodeId,
  onNodeClick,
  className,
}: FederationTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 360 });

  // Measure container for responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({ width, height: Math.max(280, width * 0.55) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = computeLayout(nodes, dimensions.width, dimensions.height);
  const edges = buildEdges(layout);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onNodeClick?.(nodeId);
    },
    [onNodeClick]
  );

  if (nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-12 text-sm text-muted-foreground',
          className
        )}
      >
        No daemon nodes registered
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
      style={{ height: dimensions.height }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className='absolute inset-0'
        aria-label='Federation topology diagram'
      >
        {/* Defs for glow filter */}
        <defs>
          <filter id='glow' x='-30%' y='-30%' width='160%' height='160%'>
            <feGaussianBlur stdDeviation='3' result='blur' />
            <feMerge>
              <feMergeNode in='blur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {edges.map(([i, j]) => {
          const a = layout[i];
          const b = layout[j];
          const bothOnline = a.status === 'ONLINE' && b.status === 'ONLINE';
          return (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={bothOnline ? '#22c55e' : '#6b7280'}
              strokeWidth={bothOnline ? 2 : 1.5}
              strokeDasharray={bothOnline ? undefined : '6 4'}
              strokeOpacity={0.5}
            />
          );
        })}

        {/* Nodes */}
        {layout.map(node => {
          const color = STATUS_COLORS[node.status] ?? STATUS_COLORS.OFFLINE;
          const isSelected = node.id === selectedNodeId;
          const isOnline = node.status === 'ONLINE';

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => handleNodeClick(node.id)}
              className={cn('cursor-pointer', onNodeClick && 'cursor-pointer')}
              role='button'
              aria-label={`Daemon node ${node.name} - ${node.status}`}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && handleNodeClick(node.id)}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  r={NODE_RADIUS + 6}
                  fill='none'
                  stroke={color}
                  strokeWidth={2.5}
                  strokeOpacity={0.6}
                />
              )}

              {/* Pulse ring for online nodes */}
              {isOnline && (
                <circle
                  r={NODE_RADIUS + 2}
                  fill='none'
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.25}
                />
              )}

              {/* Node circle */}
              <circle
                r={NODE_RADIUS}
                fill='hsl(var(--card))'
                stroke={color}
                strokeWidth={2.5}
                filter={isSelected ? 'url(#glow)' : undefined}
              />

              {/* Server icon path (simplified) */}
              <rect
                x={-10}
                y={-14}
                width={20}
                height={6}
                rx={2}
                fill='none'
                stroke={color}
                strokeWidth={1.5}
              />
              <rect
                x={-10}
                y={-5}
                width={20}
                height={6}
                rx={2}
                fill='none'
                stroke={color}
                strokeWidth={1.5}
              />
              <rect
                x={-10}
                y={4}
                width={20}
                height={6}
                rx={2}
                fill='none'
                stroke={color}
                strokeWidth={1.5}
              />
              {/* LED dots */}
              <circle cx={6} cy={-11} r={1.5} fill={color} />
              <circle
                cx={6}
                cy={-2}
                r={1.5}
                fill={isOnline ? color : '#6b7280'}
              />
              <circle
                cx={6}
                cy={7}
                r={1.5}
                fill={isOnline ? color : '#6b7280'}
              />

              {/* Node name below circle */}
              <text
                y={NODE_RADIUS + 14}
                textAnchor='middle'
                fontSize={10}
                fontWeight={600}
                fill='hsl(var(--foreground))'
                className='select-none'
              >
                {node.name.length > 14
                  ? `${node.name.slice(0, 13)}…`
                  : node.name}
              </text>

              {/* Hostname below name */}
              <text
                y={NODE_RADIUS + 25}
                textAnchor='middle'
                fontSize={9}
                fill='hsl(var(--muted-foreground))'
                className='select-none'
              >
                {node.hostname}
              </text>

              {/* Session count badge */}
              {node.health.activeSessions > 0 && (
                <g
                  transform={`translate(${NODE_RADIUS - 10},${-NODE_RADIUS + 10})`}
                >
                  <circle r={10} fill={color} />
                  <text
                    textAnchor='middle'
                    dy='0.35em'
                    fontSize={9}
                    fontWeight={700}
                    fill='white'
                    className='select-none'
                  >
                    {node.health.activeSessions > 99
                      ? '99+'
                      : node.health.activeSessions}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className='absolute bottom-3 right-3 flex flex-wrap gap-x-3 gap-y-1'>
        {(Object.entries(STATUS_COLORS) as [DaemonNodeStatus, string][]).map(
          ([status, color]) => (
            <div key={status} className='flex items-center gap-1.5'>
              <span
                className='inline-block h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: color }}
              />
              <span className='text-xs text-muted-foreground capitalize'>
                {status.toLowerCase()}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default FederationTopology;
