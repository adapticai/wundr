import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Code, 
  Clock, 
  Package, 
  Shield, 
  Target,
  Gauge,
  Brain,
  Activity,
  Download
} from 'lucide-react';
import { ProjectMetrics, ReportSummary } from '@/types/report';
import { useChartTheme } from '@/hooks/useChartTheme';
import { exportTableData } from '@/utils/chartExport';

interface MetricsOverviewProps {
  metrics: ProjectMetrics;
  summary: ReportSummary;
  previousMetrics?: ProjectMetrics;
}

type MetricCategory = 'all' | 'code-quality' | 'performance' | 'maintainability' | 'complexity';

interface MetricCard {
  title: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  category: MetricCategory;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  description: string;
  severity?: 'good' | 'warning' | 'critical';
  target?: number;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  metrics,
  summary,
  previousMetrics
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MetricCategory>('all');
  const { colors } = useChartTheme();

  const calculateTrend = (current: number, previous?: number): { trend: 'up' | 'down' | 'stable', value: number } => {
    if (!previous) return { trend: 'stable', value: 0 };
    
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 1) return { trend: 'stable', value: 0 };
    
    return {
      trend: change > 0 ? 'up' : 'down',
      value: Math.abs(change)
    };
  };

  const getSeverity = (value: number, thresholds: { good: number; warning: number }): 'good' | 'warning' | 'critical' => {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'critical';
  };

  const getComplexitySeverity = (value: number): 'good' | 'warning' | 'critical' => {
    if (value <= 10) return 'good';
    if (value <= 20) return 'warning';
    return 'critical';
  };

  const metricCards: MetricCard[] = [
    // Summary Metrics
    {
      title: 'Total Files',
      value: summary.totalFiles.toLocaleString(),
      icon: <Code className="h-4 w-4" />,
      category: 'all',
      description: 'Total number of files in the codebase',
      severity: 'good'
    },
    {
      title: 'Total Packages',
      value: summary.totalPackages,
      icon: <Package className="h-4 w-4" />,
      category: 'all',
      description: 'Number of packages in the monorepo',
      severity: 'good'
    },
    {
      title: 'Codebase Size',
      value: (summary.codebaseSize / 1000).toFixed(1),
      unit: 'K lines',
      icon: <Activity className="h-4 w-4" />,
      category: 'all',
      description: 'Total lines of code',
      severity: 'good'
    },
    
    // Code Quality Metrics
    {
      title: 'Lines of Code',
      value: metrics.codeQuality.linesOfCode.toLocaleString(),
      icon: <Code className="h-4 w-4" />,
      category: 'code-quality',
      ...calculateTrend(metrics.codeQuality.linesOfCode, previousMetrics?.codeQuality.linesOfCode),
      description: 'Total lines of code excluding comments and blank lines',
      severity: 'good'
    },
    {
      title: 'Test Coverage',
      value: metrics.codeQuality.testCoverage,
      unit: '%',
      icon: <Shield className="h-4 w-4" />,
      category: 'code-quality',
      ...calculateTrend(metrics.codeQuality.testCoverage, previousMetrics?.codeQuality.testCoverage),
      description: 'Percentage of code covered by tests',
      severity: getSeverity(metrics.codeQuality.testCoverage, { good: 80, warning: 60 }),
      target: 80
    },
    {
      title: 'Technical Debt',
      value: metrics.codeQuality.technicalDebt,
      unit: 'hours',
      icon: <Clock className="h-4 w-4" />,
      category: 'code-quality',
      ...calculateTrend(metrics.codeQuality.technicalDebt, previousMetrics?.codeQuality.technicalDebt),
      description: 'Estimated time to fix technical debt',
      severity: getSeverity(100 - metrics.codeQuality.technicalDebt, { good: 90, warning: 70 })
    },
    {
      title: 'Code Smells',
      value: metrics.codeQuality.codeSmells,
      icon: <Target className="h-4 w-4" />,
      category: 'code-quality',
      ...calculateTrend(metrics.codeQuality.codeSmells, previousMetrics?.codeQuality.codeSmells),
      description: 'Number of code smell issues detected',
      severity: metrics.codeQuality.codeSmells === 0 ? 'good' : metrics.codeQuality.codeSmells < 10 ? 'warning' : 'critical'
    },
    {
      title: 'Duplicate Lines',
      value: metrics.codeQuality.duplicateLines.toLocaleString(),
      icon: <Code className="h-4 w-4" />,
      category: 'code-quality',
      ...calculateTrend(metrics.codeQuality.duplicateLines, previousMetrics?.codeQuality.duplicateLines),
      description: 'Number of duplicated lines of code',
      severity: metrics.codeQuality.duplicateLines < 500 ? 'good' : metrics.codeQuality.duplicateLines < 1500 ? 'warning' : 'critical'
    },

    // Performance Metrics
    {
      title: 'Build Time',
      value: metrics.performance.buildTime,
      unit: 'sec',
      icon: <Clock className="h-4 w-4" />,
      category: 'performance',
      ...calculateTrend(metrics.performance.buildTime, previousMetrics?.performance.buildTime),
      description: 'Average build time in seconds',
      severity: getSeverity(120 - metrics.performance.buildTime, { good: 90, warning: 60 })
    },
    {
      title: 'Bundle Size',
      value: metrics.performance.bundleSize,
      unit: 'MB',
      icon: <Package className="h-4 w-4" />,
      category: 'performance',
      ...calculateTrend(metrics.performance.bundleSize, previousMetrics?.performance.bundleSize),
      description: 'Total bundle size after compression',
      severity: getSeverity(10 - metrics.performance.bundleSize, { good: 7, warning: 5 })
    },
    {
      title: 'Load Time',
      value: metrics.performance.loadTime,
      unit: 'sec',
      icon: <Gauge className="h-4 w-4" />,
      category: 'performance',
      ...calculateTrend(metrics.performance.loadTime, previousMetrics?.performance.loadTime),
      description: 'Average application load time',
      severity: getSeverity(5 - metrics.performance.loadTime, { good: 3, warning: 2 })
    },
    {
      title: 'Memory Usage',
      value: metrics.performance.memoryUsage,
      unit: 'MB',
      icon: <Brain className="h-4 w-4" />,
      category: 'performance',
      ...calculateTrend(metrics.performance.memoryUsage, previousMetrics?.performance.memoryUsage),
      description: 'Peak memory usage during execution',
      severity: getSeverity(512 - metrics.performance.memoryUsage, { good: 384, warning: 256 })
    },

    // Maintainability Metrics
    {
      title: 'Maintainability Index',
      value: metrics.maintainability.maintainabilityIndex,
      unit: '/100',
      icon: <Target className="h-4 w-4" />,
      category: 'maintainability',
      ...calculateTrend(metrics.maintainability.maintainabilityIndex, previousMetrics?.maintainability.maintainabilityIndex),
      description: 'Overall maintainability score (0-100)',
      severity: getSeverity(metrics.maintainability.maintainabilityIndex, { good: 70, warning: 50 }),
      target: 70
    },
    {
      title: 'Cyclomatic Complexity',
      value: metrics.maintainability.cyclomaticComplexity,
      icon: <Brain className="h-4 w-4" />,
      category: 'maintainability',
      ...calculateTrend(metrics.maintainability.cyclomaticComplexity, previousMetrics?.maintainability.cyclomaticComplexity),
      description: 'Average cyclomatic complexity per function',
      severity: getComplexitySeverity(metrics.maintainability.cyclomaticComplexity)
    },
    {
      title: 'Cognitive Complexity',
      value: metrics.maintainability.cognitiveComplexity,
      icon: <Brain className="h-4 w-4" />,
      category: 'maintainability',
      ...calculateTrend(metrics.maintainability.cognitiveComplexity, previousMetrics?.maintainability.cognitiveComplexity),
      description: 'Average cognitive complexity per function',
      severity: getComplexitySeverity(metrics.maintainability.cognitiveComplexity)
    },

    // Complexity Metrics
    {
      title: 'Average Complexity',
      value: metrics.complexity.averageComplexity,
      icon: <Gauge className="h-4 w-4" />,
      category: 'complexity',
      ...calculateTrend(metrics.complexity.averageComplexity, previousMetrics?.complexity.averageComplexity),
      description: 'Average complexity across all functions',
      severity: getComplexitySeverity(metrics.complexity.averageComplexity)
    },
    {
      title: 'Max Complexity',
      value: metrics.complexity.maxComplexity,
      icon: <TrendingUp className="h-4 w-4" />,
      category: 'complexity',
      ...calculateTrend(metrics.complexity.maxComplexity, previousMetrics?.complexity.maxComplexity),
      description: 'Highest complexity score in the codebase',
      severity: getComplexitySeverity(metrics.complexity.maxComplexity)
    }
  ];

  const filteredCards = metricCards.filter(card => 
    selectedCategory === 'all' || card.category === selectedCategory
  );

  const getSeverityColor = (severity: 'good' | 'warning' | 'critical') => {
    switch (severity) {
      case 'good':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'critical':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const handleExport = () => {
    const exportData = metricCards.map(card => ({
      Metric: card.title,
      Value: typeof card.value === 'string' ? card.value : `${card.value}${card.unit || ''}`,
      Category: card.category,
      Severity: card.severity,
      Trend: card.trend || 'stable',
      'Trend Value': card.trendValue || 0,
      Description: card.description
    }));

    exportTableData(exportData, 'metrics-overview', 'csv');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold">Metrics Overview</h2>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={(value: MetricCategory) => setSelectedCategory(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metrics</SelectItem>
              <SelectItem value="code-quality">Code Quality</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="maintainability">Maintainability</SelectItem>
              <SelectItem value="complexity">Complexity</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCards.map((card, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div style={{ color: getSeverityColor(card.severity || 'good') }}>
                    {card.icon}
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                </div>
                {card.trend && card.trend !== 'stable' && (
                  <div className={`flex items-center gap-1 text-xs ${
                    card.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {getTrendIcon(card.trend)}
                    {card.trendValue?.toFixed(1)}%
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                  </span>
                  {card.unit && (
                    <span className="text-sm text-muted-foreground">{card.unit}</span>
                  )}
                </div>
                
                {card.target && typeof card.value === 'number' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Progress to target</span>
                      <span>{Math.min(100, (card.value / card.target) * 100).toFixed(0)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (card.value / card.target) * 100)} 
                      className="h-1"
                    />
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {card.description}
                </p>
                
                <Badge 
                  variant={card.severity === 'good' ? 'default' : 
                          card.severity === 'warning' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {card.severity?.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
            
            {/* Severity indicator */}
            <div 
              className="absolute top-0 right-0 w-1 h-full"
              style={{ backgroundColor: getSeverityColor(card.severity || 'good') }}
            />
          </Card>
        ))}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-success">
                {((metrics.codeQuality.testCoverage + metrics.maintainability.maintainabilityIndex) / 2).toFixed(0)}
              </div>
              <Progress value={(metrics.codeQuality.testCoverage + metrics.maintainability.maintainabilityIndex) / 2} />
              <p className="text-xs text-muted-foreground">
                Based on test coverage and maintainability
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Performance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-info">
                {Math.max(0, 100 - (metrics.performance.buildTime + metrics.performance.loadTime * 10)).toFixed(0)}
              </div>
              <Progress value={Math.max(0, 100 - (metrics.performance.buildTime + metrics.performance.loadTime * 10))} />
              <p className="text-xs text-muted-foreground">
                Based on build and load times
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Complexity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-warning">
                {Math.max(0, 100 - (metrics.complexity.averageComplexity * 5)).toFixed(0)}
              </div>
              <Progress value={Math.max(0, 100 - (metrics.complexity.averageComplexity * 5))} />
              <p className="text-xs text-muted-foreground">
                Lower complexity is better
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};