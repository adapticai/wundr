'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Alert components not used in current implementation
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Search,
  GitBranch,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import * as d3 from 'd3';

// Types for circular dependency analysis
interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'module' | 'package';
  size: number;
  dependencies: string[];
  dependents: string[];
}

interface CircularDependency {
  id: string;
  cycle: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number;
  description: string;
  suggestions: ResolutionSuggestion[];
}

interface ResolutionSuggestion {
  type: 'extract' | 'invert' | 'merge' | 'interface';
  description: string;
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  steps: string[];
}

interface GraphData {
  nodes: DependencyNode[];
  links: { source: string; target: string; type: 'dependency' | 'circular' }[];
}

// D3 specific interfaces for simulation
interface D3SimulationNode extends DependencyNode {
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
  vx?: number;
  vy?: number;
}

interface D3SimulationLink {
  source: D3SimulationNode;
  target: D3SimulationNode;
  type: 'dependency' | 'circular';
}

// Circular dependency detection algorithm
class CircularDependencyDetector {
  private graph: Map<string, Set<string>> = new Map();
  private nodes: Map<string, DependencyNode> = new Map();

  constructor(dependencies: DependencyNode[]) {
    this.buildGraph(dependencies);
  }

  private buildGraph(dependencies: DependencyNode[]) {
    // Build adjacency list
    dependencies.forEach(node => {
      this.nodes.set(node.id, node);
      this.graph.set(node.id, new Set(node.dependencies));
    });
  }

  detectCircularDependencies(): CircularDependency[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId]);
        }
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = this.graph.get(nodeId) || new Set();
      dependencies.forEach(depId => {
        dfs(depId, [...path, nodeId]);
      });

      recursionStack.delete(nodeId);
    };

    // Check all nodes for cycles
    this.graph.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    });

    // Convert cycles to CircularDependency objects
    return cycles.map((cycle, index) => this.analyzeCycle(cycle, index));
  }

  private analyzeCycle(cycle: string[], index: number): CircularDependency {
    const impact = this.calculateImpact(cycle);
    const severity = this.determineSeverity(cycle, impact);
    const suggestions = this.generateSuggestions(cycle);

    return {
      id: `cycle-${index}`,
      cycle,
      severity,
      impact,
      description: this.generateDescription(cycle),
      suggestions
    };
  }

  private calculateImpact(cycle: string[]): number {
    // Calculate impact based on node sizes and dependency counts
    let totalImpact = 0;
    cycle.forEach(nodeId => {
      const node = this.nodes.get(nodeId);
      if (node) {
        totalImpact += node.size + node.dependencies.length + node.dependents.length;
      }
    });
    return totalImpact;
  }

  private determineSeverity(cycle: string[], impact: number): 'low' | 'medium' | 'high' | 'critical' {
    const cycleLength = cycle.length;
    
    if (cycleLength <= 2 && impact < 100) return 'low';
    if (cycleLength <= 3 && impact < 500) return 'medium';
    if (cycleLength <= 5 && impact < 1000) return 'high';
    return 'critical';
  }

  private generateDescription(cycle: string[]): string {
    const nodeNames = cycle.map(id => this.nodes.get(id)?.name || id);
    return `Circular dependency between: ${nodeNames.join(' → ')} → ${nodeNames[0]}`;
  }

  private generateSuggestions(cycle: string[]): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];

    // Extract common functionality
    suggestions.push({
      type: 'extract',
      description: 'Extract common functionality into a separate module',
      effort: 'medium',
      risk: 'low',
      steps: [
        'Identify shared functionality between modules',
        'Create a new utility module',
        'Move shared code to the utility module',
        'Update imports in both modules'
      ]
    });

    // Dependency inversion
    suggestions.push({
      type: 'invert',
      description: 'Use dependency injection or interfaces to break the cycle',
      effort: 'high',
      risk: 'medium',
      steps: [
        'Define interfaces for dependencies',
        'Implement dependency injection',
        'Update module imports',
        'Test the refactored code'
      ]
    });

    // Module merging (for small cycles)
    if (cycle.length <= 2) {
      suggestions.push({
        type: 'merge',
        description: 'Merge closely related modules',
        effort: 'low',
        risk: 'high',
        steps: [
          'Analyze module responsibilities',
          'Merge related functionality',
          'Update all imports',
          'Ensure no functionality is lost'
        ]
      });
    }

    return suggestions;
  }
}

// Sample data generator
const generateSampleData = (): DependencyNode[] => {
  return [
    {
      id: 'auth',
      name: 'AuthService',
      path: '/src/services/auth.ts',
      type: 'module',
      size: 250,
      dependencies: ['user', 'token'],
      dependents: ['app', 'dashboard']
    },
    {
      id: 'user',
      name: 'UserService',
      path: '/src/services/user.ts',
      type: 'module',
      size: 180,
      dependencies: ['auth', 'profile'],
      dependents: ['dashboard', 'settings']
    },
    {
      id: 'profile',
      name: 'ProfileService',
      path: '/src/services/profile.ts',
      type: 'module',
      size: 120,
      dependencies: ['user', 'validation'],
      dependents: ['settings', 'admin']
    },
    {
      id: 'token',
      name: 'TokenService',
      path: '/src/services/token.ts',
      type: 'module',
      size: 90,
      dependencies: ['validation'],
      dependents: ['auth']
    },
    {
      id: 'validation',
      name: 'ValidationService',
      path: '/src/utils/validation.ts',
      type: 'module',
      size: 150,
      dependencies: [],
      dependents: ['profile', 'token', 'forms']
    },
    {
      id: 'app',
      name: 'App',
      path: '/src/app.ts',
      type: 'module',
      size: 300,
      dependencies: ['auth', 'dashboard'],
      dependents: []
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/src/components/dashboard.ts',
      type: 'module',
      size: 400,
      dependencies: ['user', 'auth'],
      dependents: ['app']
    },
    {
      id: 'settings',
      name: 'Settings',
      path: '/src/components/settings.ts',
      type: 'module',
      size: 200,
      dependencies: ['user', 'profile'],
      dependents: []
    },
    {
      id: 'admin',
      name: 'AdminPanel',
      path: '/src/components/admin.ts',
      type: 'module',
      size: 350,
      dependencies: ['profile', 'user'],
      dependents: []
    },
    {
      id: 'forms',
      name: 'FormUtils',
      path: '/src/utils/forms.ts',
      type: 'module',
      size: 100,
      dependencies: ['validation'],
      dependents: []
    }
  ];
};

export default function CircularDependencyAnalysis() {
  const [dependencies, setDependencies] = useState<DependencyNode[]>([]);
  const [circularDeps, setCircularDeps] = useState<CircularDependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<CircularDependency | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const svgRef = useRef<SVGSVGElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // In a real app, this would fetch from an API
      const data = generateSampleData();
      setDependencies(data);
      
      const detector = new CircularDependencyDetector(data);
      const cycles = detector.detectCircularDependencies();
      setCircularDeps(cycles);
    } catch (error) {
      console.error('Error loading dependency data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderGraph = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const graphData: GraphData = {
      nodes: dependencies,
      links: []
    };

    // Create links from dependencies
    dependencies.forEach(node => {
      node.dependencies.forEach(depId => {
        graphData.links.push({
          source: node.id,
          target: depId,
          type: 'dependency'
        });
      });
    });

    // Mark circular dependency links
    circularDeps.forEach(cycle => {
      for (let i = 0; i < cycle.cycle.length; i++) {
        const source = cycle.cycle[i];
        const target = cycle.cycle[(i + 1) % cycle.cycle.length];
        const link = graphData.links.find(l => 
          (l.source === source && l.target === target) ||
          (l.source === target && l.target === source)
        );
        if (link) {
          link.type = 'circular';
        }
      }
    });

    const simulation = d3.forceSimulation(graphData.nodes as D3SimulationNode[])
      .force('link', d3.forceLink(graphData.links).id((d: D3SimulationNode) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as d3.ZoomBehavior<SVGSVGElement, unknown>);

    // Add links
    const link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter().append('line')
      .attr('stroke', (d: { type: string }) => d.type === 'circular' ? '#ef4444' : '#64748b')
      .attr('stroke-width', (d: { type: string }) => d.type === 'circular' ? 3 : 1)
      .attr('stroke-dasharray', (d: { type: string }) => d.type === 'circular' ? '5,5' : 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 13)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 13)
      .attr('markerHeight', 13)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#64748b')
      .style('stroke', 'none');

    // Add nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter().append('circle')
      .attr('r', (d: DependencyNode) => Math.max(8, Math.sqrt(d.size) * 0.5))
      .attr('fill', (d: DependencyNode) => {
        const isInCycle = circularDeps.some(cycle => cycle.cycle.includes(d.id));
        return isInCycle ? '#ef4444' : '#3b82f6';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: DependencyNode) => {
        const cycle = circularDeps.find(cycle => cycle.cycle.includes(d.id));
        if (cycle) {
          setSelectedCycle(cycle);
        }
      })
      .call(d3.drag<SVGCircleElement, DependencyNode>()
        .on('start', (event: d3.D3DragEvent<SVGCircleElement, DependencyNode, DependencyNode>, d: D3SimulationNode) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: d3.D3DragEvent<SVGCircleElement, DependencyNode, DependencyNode>, d: D3SimulationNode) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: d3.D3DragEvent<SVGCircleElement, DependencyNode, DependencyNode>, d: D3SimulationNode) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Add node labels
    const label = g.append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .enter().append('text')
      .text((d: DependencyNode) => d.name)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#1f2937')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: D3SimulationLink) => d.source.x)
        .attr('y1', (d: D3SimulationLink) => d.source.y)
        .attr('x2', (d: D3SimulationLink) => d.target.x)
        .attr('y2', (d: D3SimulationLink) => d.target.y);

      node
        .attr('cx', (d: D3SimulationNode) => d.x)
        .attr('cy', (d: D3SimulationNode) => d.y);

      label
        .attr('x', (d: D3SimulationNode) => d.x)
        .attr('y', (d: D3SimulationNode) => d.y + 4);
    });
  }, [dependencies, circularDeps]);

  useEffect(() => {
    if (dependencies.length > 0) {
      renderGraph();
    }
  }, [dependencies, renderGraph]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low': return <Info className="w-4 h-4" />;
      case 'medium': return <AlertCircle className="w-4 h-4" />;
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': return <XCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const filteredCircularDeps = circularDeps.filter(dep => {
    const matchesSearch = dep.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dep.cycle.some(nodeId => 
                           dependencies.find(node => node.id === nodeId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    const matchesSeverity = severityFilter === 'all' || dep.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const exportData = () => {
    const data = {
      dependencies,
      circularDependencies: circularDeps,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circular-dependencies.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Circular Dependency Analysis</h1>
          <p className="text-muted-foreground">
            Detect and resolve circular dependencies in your codebase
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dependencies</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dependencies.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circular Dependencies</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{circularDeps.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {circularDeps.filter(dep => dep.severity === 'critical').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.max(0, 100 - (circularDeps.length * 10))}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="visualization" className="w-full">
        <TabsList>
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="resolution">Resolution</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Graph</CardTitle>
              <CardDescription>
                Interactive visualization of your dependency graph. Red nodes and dashed lines indicate circular dependencies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-hidden border rounded-lg">
                <svg
                  ref={svgRef}
                  width="100%"
                  height="600"
                  viewBox="0 0 800 600"
                  className="border-0"
                />
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span>Normal Dependencies</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span>Circular Dependencies</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-gray-400" />
                  <span>Dependency Link</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-red-500 border-dashed border-red-500" style={{borderTopWidth: '1px', borderTopStyle: 'dashed'}} />
                  <span>Circular Link</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Issues</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by module name or description..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="severity">Filter by Severity</Label>
              <select
                id="severity"
                value={severityFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSeverityFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">All Severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredCircularDeps.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">No Circular Dependencies Found</h3>
                    <p className="text-muted-foreground">Your codebase is free of circular dependencies!</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredCircularDeps.map((dep: CircularDependency) => (
                <Card key={dep.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCycle(dep)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {getSeverityIcon(dep.severity)}
                        {dep.description}
                      </CardTitle>
                      <Badge className={getSeverityColor(dep.severity)}>
                        {dep.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Cycle Length: {dep.cycle.length}</span>
                        <span>•</span>
                        <span>Impact Score: {dep.impact}</span>
                        <span>•</span>
                        <span>{dep.suggestions.length} Suggestions</span>
                      </div>
                      <div className="text-sm">
                        <strong>Cycle:</strong> {dep.cycle.map((nodeId: string) => 
                          dependencies.find((node: DependencyNode) => node.id === nodeId)?.name || nodeId
                        ).join(' → ')} → {dependencies.find((node: DependencyNode) => node.id === dep.cycle[0])?.name || dep.cycle[0]}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="resolution" className="space-y-4">
          {selectedCycle ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getSeverityIcon(selectedCycle.severity)}
                    Resolution Suggestions
                  </CardTitle>
                  <CardDescription>{selectedCycle.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedCycle.suggestions.map((suggestion, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-lg">{suggestion.description}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              Effort: {suggestion.effort}
                            </Badge>
                            <Badge variant="outline">
                              Risk: {suggestion.risk}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <h4 className="font-semibold">Implementation Steps:</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm">
                              {suggestion.steps.map((step, stepIndex) => (
                                <li key={stepIndex}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">Select a Circular Dependency</h3>
                  <p className="text-muted-foreground">Choose an issue from the Issues tab to see resolution suggestions</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Impact Distribution</CardTitle>
                <CardDescription>Impact scores across all circular dependencies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {circularDeps.map((dep) => (
                    <div key={dep.id} className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1">{dep.description.slice(0, 40)}...</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (dep.impact / 1000) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono w-12">{dep.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Severity Breakdown</CardTitle>
                <CardDescription>Distribution of issues by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(['critical', 'high', 'medium', 'low'] as const).map((severity: 'critical' | 'high' | 'medium' | 'low') => {
                    const count = circularDeps.filter((dep: CircularDependency) => dep.severity === severity).length;
                    const percentage = circularDeps.length > 0 ? (count / circularDeps.length) * 100 : 0;
                    
                    return (
                      <div key={severity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(severity)}
                          <span className="capitalize">{severity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                severity === 'critical' ? 'bg-red-500' :
                                severity === 'high' ? 'bg-orange-500' :
                                severity === 'medium' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-mono w-8">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Most Problematic Modules</CardTitle>
              <CardDescription>Modules that appear in the most circular dependencies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const moduleCount = new Map<string, number>();
                  circularDeps.forEach((dep: CircularDependency) => {
                    dep.cycle.forEach((nodeId: string) => {
                      moduleCount.set(nodeId, (moduleCount.get(nodeId) || 0) + 1);
                    });
                  });
                  
                  return Array.from(moduleCount.entries())
                    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([nodeId, count]: [string, number]) => {
                      const node = dependencies.find((n: DependencyNode) => n.id === nodeId);
                      return (
                        <div key={nodeId} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{node?.name || nodeId}</div>
                            <div className="text-sm text-muted-foreground">{node?.path}</div>
                          </div>
                          <Badge variant="destructive">{count} cycles</Badge>
                        </div>
                      );
                    });
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}