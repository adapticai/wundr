import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ScatterController } from 'chart.js';
import { Scatter, Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Search, Network, BarChart3, AlertTriangle, Package } from 'lucide-react';
import { DependencyAnalysis, DependencyNode, Vulnerability } from '@/types/report';
import { useChartTheme } from '@/hooks/useChartTheme';
import { exportChart } from '@/utils/chartExport';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ScatterController);

interface DependencyGraphProps {
  data: DependencyAnalysis;
  onNodeSelect?: (node: DependencyNode) => void;
  onVulnerabilitySelect?: (vulnerability: Vulnerability) => void;
}

type ViewMode = 'overview' | 'tree' | 'vulnerabilities' | 'size-analysis';

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  data,
  onNodeSelect,
  onVulnerabilitySelect
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const chartRef = useRef<ChartJS>(null);
  const { colors, chartDefaults, getColorPalette } = useChartTheme();

  const dependencyTypes = ['all', 'direct', 'dev', 'peer', 'transitive'];

  const flattenDependencies = useCallback((nodes: DependencyNode[], depth = 0): Array<DependencyNode & { depth: number }> => {
    if (depth > maxDepth) return [];
    
    const result: Array<DependencyNode & { depth: number }> = [];
    
    nodes.forEach(node => {
      result.push({ ...node, depth });
      if (node.dependencies) {
        result.push(...flattenDependencies(node.dependencies, depth + 1));
      }
    });
    
    return result;
  }, [maxDepth]);

  const filteredDependencies = useMemo(() => {
    const flattened = flattenDependencies(data.dependencyTree);
    
    return flattened.filter(dep => {
      const matchesSearch = !searchTerm || 
        dep.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || dep.type === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [data.dependencyTree, searchTerm, selectedType, maxDepth]);

  const getOverviewData = () => {
    const typeData = {
      'Direct': data.directDependencies,
      'Dev': data.devDependencies,
      'Peer': data.peerDependencies,
      'Total': data.totalDependencies
    };

    return {
      labels: Object.keys(typeData),
      datasets: [{
        label: 'Dependencies Count',
        data: Object.values(typeData),
        backgroundColor: getColorPalette(Object.keys(typeData).length),
        borderColor: colors.border,
        borderWidth: 1
      }]
    };
  };

  const getTreeData = () => {
    const depthCounts = filteredDependencies.reduce((acc, dep) => {
      acc[dep.depth] = (acc[dep.depth] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      labels: Object.keys(depthCounts).map(depth => `Level ${depth}`),
      datasets: [{
        label: 'Dependencies per Level',
        data: Object.values(depthCounts),
        backgroundColor: colors.primary,
        borderColor: colors.border,
        borderWidth: 1
      }]
    };
  };

  const getVulnerabilitiesData = () => {
    const severityCounts = data.vulnerabilities.reduce((acc, vuln) => {
      acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const orderedLabels = severityOrder.filter(severity => severityCounts[severity] > 0);
    const orderedData = orderedLabels.map(severity => severityCounts[severity]);

    const severityColors = {
      low: colors.info,
      medium: colors.warning,
      high: colors.error,
      critical: '#dc2626'
    };

    return {
      labels: orderedLabels.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      datasets: [{
        label: 'Vulnerabilities',
        data: orderedData,
        backgroundColor: orderedLabels.map(severity => severityColors[severity as keyof typeof severityColors]),
        borderColor: colors.border,
        borderWidth: 1
      }]
    };
  };

  const getSizeAnalysisData = () => {
    const sizedDeps = filteredDependencies
      .filter(dep => dep.size && dep.size > 0)
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 15);

    return {
      datasets: [{
        label: 'Package Size vs Dependencies',
        data: sizedDeps.map(dep => ({
          x: dep.dependencies?.length || 0,
          y: dep.size || 0,
          label: dep.name
        })),
        backgroundColor: colors.primary,
        borderColor: colors.border,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    };
  };

  const getCurrentChartData = () => {
    switch (viewMode) {
      case 'overview':
        return getOverviewData();
      case 'tree':
        return getTreeData();
      case 'vulnerabilities':
        return getVulnerabilitiesData();
      case 'size-analysis':
        return getSizeAnalysisData();
      default:
        return getOverviewData();
    }
  };

  const getChartOptions = () => {
    const baseOptions = {
      ...chartDefaults,
      onClick: (event: React.MouseEvent, elements: Chart.ChartElement[]) => {
        if (elements.length > 0) {
          if (viewMode === 'vulnerabilities') {
            const index = elements[0].index;
            const vulnerability = data.vulnerabilities[index];
            if (vulnerability && onVulnerabilitySelect) {
              onVulnerabilitySelect(vulnerability);
            }
          }
        }
      }
    };

    if (viewMode === 'size-analysis') {
      return {
        ...baseOptions,
        scales: {
          x: {
            ...baseOptions.scales?.x,
            title: {
              display: true,
              text: 'Number of Dependencies',
              color: colors.text
            }
          },
          y: {
            ...baseOptions.scales?.y,
            title: {
              display: true,
              text: 'Package Size (KB)',
              color: colors.text
            }
          }
        },
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins?.tooltip,
            callbacks: {
              label: (context: any) => {
                const point = context.raw;
                return `${point.label}: ${point.x} deps, ${(point.y / 1024).toFixed(1)} KB`;
              }
            }
          }
        }
      };
    }

    return {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales?.y,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Count',
            color: colors.text
          }
        }
      }
    };
  };

  const handleExport = async (format: 'png' | 'pdf' | 'csv' | 'json') => {
    if (chartRef.current) {
      await exportChart(chartRef.current, {
        format,
        filename: `dependencies-${viewMode}`,
        includeData: format === 'csv' || format === 'json'
      });
    }
  };

  const getViewModeTitle = () => {
    switch (viewMode) {
      case 'overview':
        return 'Dependency Overview';
      case 'tree':
        return 'Dependency Tree Structure';
      case 'vulnerabilities':
        return 'Security Vulnerabilities';
      case 'size-analysis':
        return 'Size vs Dependencies Analysis';
      default:
        return 'Dependencies';
    }
  };

  const chartData = getCurrentChartData();
  const isScatter = viewMode === 'size-analysis';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            {getViewModeTitle()}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="tree">Tree Structure</SelectItem>
                <SelectItem value="vulnerabilities">Vulnerabilities</SelectItem>
                <SelectItem value="size-analysis">Size Analysis</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('png')}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{data.totalDependencies}</div>
            <div className="text-sm text-muted-foreground">Total Dependencies</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-info">{data.directDependencies}</div>
            <div className="text-sm text-muted-foreground">Direct</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-warning">{data.vulnerabilities.length}</div>
            <div className="text-sm text-muted-foreground">Vulnerabilities</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-success">{filteredDependencies.length}</div>
            <div className="text-sm text-muted-foreground">Filtered</div>
          </div>
        </div>

        {/* Filters */}
        {(viewMode === 'tree' || viewMode === 'size-analysis') && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search dependencies..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-48"
              />
            </div>
            
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dependencyTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewMode === 'tree' && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Max Depth:</span>
                <Select value={maxDepth.toString()} onValueChange={(value) => setMaxDepth(parseInt(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(depth => (
                      <SelectItem key={depth} value={depth.toString()}>
                        {depth}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="h-96 w-full">
          {isScatter ? (
            <Scatter ref={chartRef} data={chartData} options={getChartOptions()} />
          ) : (
            <Bar ref={chartRef} data={chartData} options={getChartOptions()} />
          )}
        </div>

        {/* Vulnerabilities List */}
        {viewMode === 'vulnerabilities' && data.vulnerabilities.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Security Vulnerabilities ({data.vulnerabilities.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {data.vulnerabilities.slice(0, 10).map((vuln, index) => (
                <div
                  key={vuln.id}
                  className="flex items-center justify-between p-3 bg-muted rounded cursor-pointer hover:bg-muted/80"
                  onClick={() => onVulnerabilitySelect?.(vuln)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{vuln.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Package: {vuln.package}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={vuln.severity === 'critical' ? 'destructive' : 
                              vuln.severity === 'high' ? 'destructive' :
                              vuln.severity === 'medium' ? 'default' : 'secondary'}
                    >
                      {vuln.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependency List for Tree View */}
        {viewMode === 'tree' && filteredDependencies.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Dependencies ({filteredDependencies.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredDependencies.slice(0, 20).map((dep, index) => (
                <div
                  key={`${dep.name}-${dep.depth}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                  onClick={() => onNodeSelect?.(dep)}
                  style={{ marginLeft: `${dep.depth * 16}px` }}
                >
                  <div className="flex-1">
                    <div className="font-mono text-sm">{dep.name}@{dep.version}</div>
                    <div className="text-xs text-muted-foreground">
                      Level {dep.depth} • {dep.dependencies?.length || 0} dependencies
                      {dep.size && ` • ${(dep.size / 1024).toFixed(1)} KB`}
                    </div>
                  </div>
                  <Badge variant="outline">{dep.type}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};