'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import type { EntityData } from '@/app/api/analysis/entities/route';

interface EntityRelationshipGraphProps {
  entities: EntityData[];
}

interface Node {
  id: string;
  name: string;
  type: string;
  complexity: number;
  dependencies: string[];
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string;
  target: string;
  type: 'dependency';
}

export function EntityRelationshipGraph({ entities }: EntityRelationshipGraphProps) {
  const { theme, resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [layoutType, setLayoutType] = useState<'force' | 'circular' | 'hierarchical'>('force');
  const [showLabels, setShowLabels] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark');

  // Create nodes and links from entities
  const { nodes, links } = React.useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const linkSet = new Set<string>();
    const generatedLinks: Link[] = [];

    // Create nodes
    entities.forEach((entity, index) => {
      nodeMap.set(entity.name, {
        id: entity.name,
        name: entity.name,
        type: entity.type,
        complexity: entity.complexity || 0,
        dependencies: entity.dependencies,
        x: Math.random() * 800,
        y: Math.random() * 600,
      });
    });

    // Create links based on dependencies
    entities.forEach((entity) => {
      entity.dependencies.forEach((dep) => {
        if (nodeMap.has(dep)) {
          const linkId = `${entity.name}-${dep}`;
          if (!linkSet.has(linkId)) {
            linkSet.add(linkId);
            generatedLinks.push({
              source: entity.name,
              target: dep,
              type: 'dependency',
            });
          }
        }
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: generatedLinks,
    };
  }, [entities]);

  // Apply layout algorithms
  const applyLayout = (layoutType: string, nodes: Node[]) => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    switch (layoutType) {
      case 'circular':
        nodes.forEach((node, index) => {
          const angle = (2 * Math.PI * index) / nodes.length;
          const radius = Math.min(width, height) * 0.3;
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        });
        break;
      
      case 'hierarchical':
        // Group by entity type
        const typeGroups = nodes.reduce((acc, node) => {
          if (!acc[node.type]) acc[node.type] = [];
          acc[node.type].push(node);
          return acc;
        }, {} as Record<string, Node[]>);

        const types = Object.keys(typeGroups);
        const layerHeight = height / (types.length + 1);

        types.forEach((type, typeIndex) => {
          const typeNodes = typeGroups[type];
          const nodeWidth = width / (typeNodes.length + 1);
          
          typeNodes.forEach((node, nodeIndex) => {
            node.x = nodeWidth * (nodeIndex + 1);
            node.y = layerHeight * (typeIndex + 1);
          });
        });
        break;
      
      default: // force layout - simple simulation
        // Apply simple force-directed layout
        for (let i = 0; i < 100; i++) {
          // Repulsion between nodes
          nodes.forEach((nodeA, indexA) => {
            nodes.forEach((nodeB, indexB) => {
              if (indexA !== indexB) {
                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = 50 / (distance * distance);
                nodeA.x += (dx / distance) * force;
                nodeA.y += (dy / distance) * force;
              }
            });
          });

          // Attraction along links
          links.forEach((link) => {
            const source = nodes.find(n => n.id === link.source);
            const target = nodes.find(n => n.id === link.target);
            if (source && target) {
              const dx = target.x - source.x;
              const dy = target.y - source.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = distance * 0.01;
              source.x += (dx / distance) * force;
              source.y += (dy / distance) * force;
              target.x -= (dx / distance) * force;
              target.y -= (dy / distance) * force;
            }
          });

          // Center attraction
          nodes.forEach((node) => {
            node.x += (centerX - node.x) * 0.01;
            node.y += (centerY - node.y) * 0.01;
          });
        }
        break;
    }
  };

  // Drawing function
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mounted) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Apply zoom and pan
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw links
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    links.forEach((link) => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Draw arrow
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const arrowLength = 10;
        const arrowAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(
          target.x - arrowLength * Math.cos(angle - arrowAngle),
          target.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(
          target.x - arrowLength * Math.cos(angle + arrowAngle),
          target.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      const radius = Math.max(8, Math.min(20, 8 + node.complexity));
      
      // Node color based on type and complexity
      const getNodeColor = (type: string, complexity: number) => {
        const colors = {
          class: isDark ? '#3D6A91' : '#5584A9',
          interface: isDark ? '#7A9FBC' : '#9EBACF',
          function: isDark ? '#2D5078' : '#3D6A91',
          type: isDark ? '#C3D5E2' : '#7A9FBC',
          service: isDark ? '#1F3A5A' : '#2D5078',
        };
        
        let baseColor = colors[type as keyof typeof colors] || (isDark ? '#5584A9' : '#3D6A91');
        
        // Adjust for complexity
        if (complexity > 15) {
          baseColor = isDark ? '#EF4444' : '#DC2626';
        } else if (complexity > 10) {
          baseColor = isDark ? '#F97316' : '#EA580C';
        }
        
        return baseColor;
      };

      ctx.fillStyle = getNodeColor(node.type, node.complexity);
      
      // Highlight selected node
      if (selectedNode?.id === node.id) {
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.lineWidth = selectedNode?.id === node.id ? 2 : 1;
      ctx.stroke();
      
      ctx.shadowBlur = 0;

      // Labels
      if (showLabels) {
        ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y + radius + 15);
      }
    });

    ctx.restore();
  }, [nodes, links, zoom, pan, selectedNode, showLabels, isDark, mounted]);

  // Handle canvas interactions
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;

    // Find clicked node
    const clickedNode = nodes.find((node) => {
      const radius = Math.max(8, Math.min(20, 8 + node.complexity));
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= radius;
    });

    setSelectedNode(clickedNode || null);
  };

  const handleLayoutChange = (newLayout: string) => {
    setLayoutType(newLayout as 'force' | 'circular' | 'hierarchical');
    setIsAnimating(true);
    applyLayout(newLayout, nodes);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  // Apply layout when layoutType changes
  useEffect(() => {
    if (nodes.length > 0) {
      applyLayout(layoutType, nodes);
    }
  }, [layoutType, nodes.length]);

  // Draw loop
  useEffect(() => {
    if (mounted) {
      const animate = () => {
        draw();
        if (isAnimating) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }, [draw, isAnimating, mounted]);

  if (!mounted) {
    return (
      <div className="h-[600px] bg-muted animate-pulse rounded" />
    );
  }

  if (entities.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center text-muted-foreground">
        No entities to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={layoutType} onValueChange={handleLayoutChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="force">Force</SelectItem>
              <SelectItem value="circular">Circular</SelectItem>
              <SelectItem value="hierarchical">Hierarchical</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLabels(!showLabels)}
          >
            {showLabels ? 'Hide Labels' : 'Show Labels'}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(3, zoom + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Graph */}
      <div className="relative border rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="cursor-pointer"
          onClick={handleCanvasClick}
          style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}
        />
        
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm border rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium">Legend</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Entity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>High Complexity (&gt;15)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-500" />
              <span>Dependency</span>
            </div>
          </div>
        </div>

        {/* Node details */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm border rounded-lg p-4 min-w-48">
            <div className="space-y-2">
              <div className="font-medium">{selectedNode.name}</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Type: <Badge variant="secondary">{selectedNode.type}</Badge></div>
                <div>Complexity: {selectedNode.complexity}</div>
                <div>Dependencies: {selectedNode.dependencies.length}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="text-lg font-semibold">{nodes.length}</div>
          <div className="text-muted-foreground">Nodes</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{links.length}</div>
          <div className="text-muted-foreground">Dependencies</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">
            {new Set(nodes.map(n => n.type)).size}
          </div>
          <div className="text-muted-foreground">Types</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">
            {zoom.toFixed(1)}x
          </div>
          <div className="text-muted-foreground">Zoom</div>
        </div>
      </div>
    </div>
  );
}