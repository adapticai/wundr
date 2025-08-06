import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertTriangle, GitBranch, Zap, Filter } from 'lucide-react';
import { CircularDependency } from '@/types/report';
import { useChartTheme } from '@/hooks/useChartTheme';

interface CircularDependencyDiagramProps {
  dependencies: CircularDependency[];
  onDependencySelect?: (dependency: CircularDependency) => void;
}

type SeverityFilter = 'all' | 'low' | 'medium' | 'high';
type ViewMode = 'network' | 'list' | 'impact';

interface CircleNode {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  severity: 'low' | 'medium' | 'high';
  impactScore: number;
}

interface Connection {
  from: string;
  to: string;
  severity: 'low' | 'medium' | 'high';
}

export const CircularDependencyDiagram: React.FC<CircularDependencyDiagramProps> = ({
  dependencies,
  onDependencySelect
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('network');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [selectedDependency, setSelectedDependency] = useState<CircularDependency | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { colors, isDark } = useChartTheme();

  const filteredDependencies = useMemo(() => {
    return dependencies.filter(dep => 
      severityFilter === 'all' || dep.severity === severityFilter
    );
  }, [dependencies, severityFilter]);

  const severityCounts = useMemo(() => {
    return dependencies.reduce((acc, dep) => {
      acc[dep.severity] = (acc[dep.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [dependencies]);

  const { nodes, connections } = useMemo(() => {
    const nodeMap = new Map<string, CircleNode>();
    const connectionList: Connection[] = [];

    filteredDependencies.forEach((dep, index) => {
      const centerX = 300;
      const centerY = 200;
      const radius = 150;
      const angle = (index / filteredDependencies.length) * 2 * Math.PI;

      // Create nodes for each file in the cycle
      dep.cycle.forEach((file, fileIndex) => {
        const fileAngle = angle + (fileIndex / dep.cycle.length) * 0.5;
        const x = centerX + Math.cos(fileAngle) * (radius - fileIndex * 20);
        const y = centerY + Math.sin(fileAngle) * (radius - fileIndex * 20);

        if (!nodeMap.has(file)) {
          nodeMap.set(file, {
            id: file,
            name: file.split('/').pop() || file,
            x,
            y,
            radius: Math.max(8, Math.min(20, dep.impactScore * 2)),
            severity: dep.severity,
            impactScore: dep.impactScore
          });
        }
      });

      // Create connections between consecutive files in the cycle
      for (let i = 0; i < dep.cycle.length; i++) {
        const from = dep.cycle[i];
        const to = dep.cycle[(i + 1) % dep.cycle.length];
        connectionList.push({
          from,
          to,
          severity: dep.severity
        });
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      connections: connectionList
    };
  }, [filteredDependencies]);

  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw connections first (so they appear behind nodes)
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);

      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        
        // Set color based on severity
        switch (conn.severity) {
          case 'high':
            ctx.strokeStyle = colors.error;
            ctx.lineWidth = 3;
            break;
          case 'medium':
            ctx.strokeStyle = colors.warning;
            ctx.lineWidth = 2;
            break;
          default:
            ctx.strokeStyle = colors.info;
            ctx.lineWidth = 1;
        }

        ctx.stroke();

        // Draw arrow
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const arrowLength = 10;
        const arrowWidth = 5;

        ctx.beginPath();
        ctx.moveTo(
          toNode.x - arrowLength * Math.cos(angle - arrowWidth),
          toNode.y - arrowLength * Math.sin(angle - arrowWidth)
        );
        ctx.lineTo(toNode.x, toNode.y);
        ctx.lineTo(
          toNode.x - arrowLength * Math.cos(angle + arrowWidth),
          toNode.y - arrowLength * Math.sin(angle + arrowWidth)
        );
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

      // Set color based on severity
      switch (node.severity) {
        case 'high':
          ctx.fillStyle = colors.error;
          break;
        case 'medium':
          ctx.fillStyle = colors.warning;
          break;
        default:
          ctx.fillStyle = colors.info;
      }

      ctx.fill();
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw node label
      ctx.fillStyle = colors.text;
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.x, node.y + node.radius + 15);
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked node
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
      return distance <= node.radius;
    });

    if (clickedNode) {
      // Find the dependency that contains this node
      const dependency = filteredDependencies.find(dep => 
        dep.cycle.includes(clickedNode.id)
      );
      
      if (dependency) {
        setSelectedDependency(dependency);
        onDependencySelect?.(dependency);
      }
    }
  };

  const exportDiagram = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'circular-dependencies.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (viewMode === 'network') {
      drawDiagram();
    }
  }, [viewMode, filteredDependencies, nodes, connections, colors]);

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Circular Dependencies
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="network">Network</SelectItem>
                <SelectItem value="list">List View</SelectItem>
                <SelectItem value="impact">Impact</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={(value: SeverityFilter) => setSeverityFilter(value)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={exportDiagram}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {dependencies.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No circular dependencies detected in this project. Great job maintaining a clean dependency structure!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{dependencies.length}</div>
              <div className="text-sm text-muted-foreground">Total Cycles</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-error">{severityCounts.high || 0}</div>
              <div className="text-sm text-muted-foreground">High Severity</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-warning">{severityCounts.medium || 0}</div>
              <div className="text-sm text-muted-foreground">Medium Severity</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-info">{filteredDependencies.length}</div>
              <div className="text-sm text-muted-foreground">Filtered</div>
            </div>
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'network' && dependencies.length > 0 && (
          <div className="space-y-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="w-full h-96 border rounded cursor-pointer"
                onClick={handleCanvasClick}
                style={{ background: colors.surface }}
              />
              <div className="absolute top-2 left-2 space-y-2">
                <div className="flex items-center gap-2 bg-background/80 px-2 py-1 rounded text-xs">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>High Severity</span>
                </div>
                <div className="flex items-center gap-2 bg-background/80 px-2 py-1 rounded text-xs">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Medium Severity</span>
                </div>
                <div className="flex items-center gap-2 bg-background/80 px-2 py-1 rounded text-xs">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Low Severity</span>
                </div>
              </div>
            </div>
            {selectedDependency && (
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  <strong>Selected Cycle:</strong> {selectedDependency.cycle.join(' → ')} → {selectedDependency.cycle[0]}
                  <br />
                  <strong>Impact Score:</strong> {selectedDependency.impactScore}
                  <br />
                  <strong>Affected Files:</strong> {selectedDependency.affectedFiles.length}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Circular Dependencies ({filteredDependencies.length})</span>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {filteredDependencies.map((dep, index) => (
                <div
                  key={dep.id}
                  className="p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => {
                    setSelectedDependency(dep);
                    onDependencySelect?.(dep);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityBadgeVariant(dep.severity)}>
                        {dep.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium">Impact: {dep.impactScore}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dep.affectedFiles.length} affected files
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Dependency Cycle:</div>
                    <div className="text-sm font-mono bg-background p-2 rounded">
                      {dep.cycle.map((file, i) => (
                        <span key={i}>
                          {file.split('/').pop()}
                          {i < dep.cycle.length - 1 && ' → '}
                        </span>
                      ))}
                      {' → '}
                      <span className="text-primary">{dep.cycle[0].split('/').pop()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'impact' && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {filteredDependencies
                .sort((a, b) => b.impactScore - a.impactScore)
                .slice(0, 10)
                .map((dep, index) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">
                          Cycle of {dep.cycle.length} files
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {dep.affectedFiles.length} total affected files
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getSeverityBadgeVariant(dep.severity)}>
                        {dep.severity}
                      </Badge>
                      <div className="text-right">
                        <div className="text-lg font-bold">{dep.impactScore}</div>
                        <div className="text-xs text-muted-foreground">Impact Score</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};