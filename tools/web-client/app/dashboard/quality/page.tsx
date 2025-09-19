"use client"

import React, { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
} from "chart.js"
import { Bar, Doughnut, Line, Radar } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Target,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Shield,
  Bug,
  Code2,
  TestTube,
  FileText,
  Gauge
} from "lucide-react"
import { useQualityMetrics } from "@/hooks/use-quality-metrics"
import { TimeRange } from "@/types/data"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface QualityGate {
  metric: string
  current: number
  threshold: number
  status: 'pass' | 'warning' | 'fail'
  trend: 'improving' | 'declining' | 'stable'
}

interface MetricCardProps {
  title: string
  value: number
  unit?: string
  trend?: 'improving' | 'declining' | 'stable'
  threshold?: number
  icon: React.ElementType
  description?: string
}

function MetricCard({ title, value, unit = '%', trend, threshold, icon: Icon, description }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />
      default:
        return <Minus className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    if (!threshold) return 'text-foreground'
    return value >= threshold ? 'text-green-600' : value >= threshold * 0.8 ? 'text-yellow-600' : 'text-red-600'
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-bold ${getStatusColor()}`}>
                {typeof value === 'number' ? value.toFixed(1) : value}{unit}
              </p>
              {trend && getTrendIcon()}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {threshold && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-sm font-mono">{threshold}{unit}</p>
            </div>
          )}
        </div>
        {threshold && (
          <div className="mt-4">
            <Progress value={Math.min((value / threshold) * 100, 100)} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function QualityGatePanel({ gates }: { gates: QualityGate[] }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-3 h-3 text-green-500" />
      case 'declining':
        return <TrendingDown className="w-3 h-3 text-red-500" />
      default:
        return <Minus className="w-3 h-3 text-gray-500" />
    }
  }

  const passedGates = gates.filter(g => g.status === 'pass').length
  const totalGates = gates.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Quality Gates
          </CardTitle>
          <Badge variant={passedGates === totalGates ? "default" : passedGates > totalGates * 0.7 ? "secondary" : "destructive"}>
            {passedGates}/{totalGates} Passed
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {gates.map((gate) => (
            <div key={gate.metric} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(gate.status)}
                <div>
                  <p className="font-medium capitalize">
                    {gate.metric.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Threshold: {gate.threshold}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                {getTrendIcon(gate.trend)}
                <div>
                  <p className="font-mono font-semibold">{gate.current.toFixed(1)}%</p>
                  <p className={`text-xs ${
                    gate.status === 'pass' ? 'text-green-600' : 
                    gate.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {gate.status === 'pass' ? 'Passed' : gate.status === 'warning' ? 'Warning' : 'Failed'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function QualityDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [mounted, setMounted] = useState(false)
  const { theme, resolvedTheme } = useTheme()
  
  const { data, loading, error, refresh, latest, trends } = useQualityMetrics({
    timeRange,
    autoRefresh: true,
    refreshInterval: 60000,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark')

  // Chart colors with theme-aware values
  const chartColors = {
    primary: isDark ? "#5584A9" : "#3D6A91",
    secondary: isDark ? "#7A9FBC" : "#5584A9", 
    success: isDark ? "#10B981" : "#059669",
    warning: isDark ? "#F59E0B" : "#D97706",
    danger: isDark ? "#EF4444" : "#DC2626",
    muted: isDark ? "#6B7280" : "#9CA3AF",
  }

  if (!mounted) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message}
            {error.retry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={error.retry} 
                className="ml-2"
              >
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Calculate overall quality score
  const overallScore = latest ? (
    latest.testCoverage + 
    latest.maintainabilityIndex + 
    (100 - Math.min(latest.codeComplexity * 5, 100)) + 
    (100 - Math.min(latest.technicalDebt / 10, 100)) +
    (100 - Math.min(latest.duplicateLines / 100, 100)) +
    Math.min(100 - latest.vulnerabilityCount * 5, 100)
  ) / 6 : 0

  // Define quality gates
  const qualityGates: QualityGate[] = latest ? [
    {
      metric: 'testCoverage',
      current: latest.testCoverage,
      threshold: 80,
      status: latest.testCoverage >= 80 ? 'pass' : latest.testCoverage >= 64 ? 'warning' : 'fail',
      trend: trends.coverage
    },
    {
      metric: 'maintainability',
      current: latest.maintainabilityIndex,
      threshold: 75,
      status: latest.maintainabilityIndex >= 75 ? 'pass' : latest.maintainabilityIndex >= 60 ? 'warning' : 'fail',
      trend: 'stable'
    },
    {
      metric: 'codeComplexity',
      current: Math.max(0, 100 - latest.codeComplexity * 5),
      threshold: 70,
      status: latest.codeComplexity <= 6 ? 'pass' : latest.codeComplexity <= 8 ? 'warning' : 'fail',
      trend: trends.complexity === 'improving' ? 'declining' : trends.complexity === 'declining' ? 'improving' : 'stable'
    },
    {
      metric: 'technicalDebt',
      current: Math.max(0, 100 - latest.technicalDebt / 10),
      threshold: 80,
      status: latest.technicalDebt <= 20 ? 'pass' : latest.technicalDebt <= 40 ? 'warning' : 'fail',
      trend: trends.debt === 'improving' ? 'improving' : trends.debt === 'declining' ? 'declining' : 'stable'
    },
    {
      metric: 'duplication',
      current: Math.max(0, 100 - latest.duplicateLines / 100),
      threshold: 95,
      status: latest.duplicateLines <= 50 ? 'pass' : latest.duplicateLines <= 100 ? 'warning' : 'fail',
      trend: 'stable'
    },
    {
      metric: 'security',
      current: Math.max(0, 100 - latest.vulnerabilityCount * 5),
      threshold: 90,
      status: latest.vulnerabilityCount === 0 ? 'pass' : latest.vulnerabilityCount <= 2 ? 'warning' : 'fail',
      trend: 'stable'
    }
  ] : []

  // Prepare chart data
  const trendData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Overall Quality Score',
        data: data.map(d => (
          d.testCoverage + 
          d.maintainabilityIndex + 
          (100 - Math.min(d.codeComplexity * 5, 100)) + 
          (100 - Math.min(d.technicalDebt / 10, 100)) +
          (100 - Math.min(d.duplicateLines / 100, 100)) +
          Math.min(100 - d.vulnerabilityCount * 5, 100)
        ) / 6),
        borderColor: chartColors.primary,
        backgroundColor: `${chartColors.primary}20`,
        fill: true,
        tension: 0.4,
      }
    ]
  }

  const coverageData = {
    labels: ['Covered', 'Uncovered'],
    datasets: [{
      data: latest ? [latest.testCoverage, 100 - latest.testCoverage] : [0, 100],
      backgroundColor: [chartColors.success, chartColors.danger],
      borderWidth: 0,
    }]
  }

  const complexityDistribution = {
    labels: ['Low (1-5)', 'Medium (6-10)', 'High (11-20)', 'Very High (20+)'],
    datasets: [{
      label: 'Files',
      data: latest ? [
        Math.floor(latest.linesOfCode * 0.6),
        Math.floor(latest.linesOfCode * 0.25),
        Math.floor(latest.linesOfCode * 0.1),
        Math.floor(latest.linesOfCode * 0.05)
      ] : [0, 0, 0, 0],
      backgroundColor: [chartColors.success, chartColors.warning, chartColors.danger, '#8B5CF6'],
      borderRadius: 4,
    }]
  }

  const issuesData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Bugs',
        data: data.map(d => d.bugs),
        backgroundColor: chartColors.danger,
        stack: 'issues',
      },
      {
        label: 'Code Smells',
        data: data.map(d => d.codeSmells),
        backgroundColor: chartColors.warning,
        stack: 'issues',
      },
      {
        label: 'Vulnerabilities',
        data: data.map(d => d.vulnerabilityCount),
        backgroundColor: '#8B5CF6',
        stack: 'issues',
      }
    ]
  }

  const radarData = {
    labels: [
      'Coverage',
      'Maintainability', 
      'Low Complexity',
      'Low Duplication',
      'Low Tech Debt',
      'Security'
    ],
    datasets: [{
      label: 'Current',
      data: latest ? [
        latest.testCoverage,
        latest.maintainabilityIndex,
        Math.max(0, 100 - latest.codeComplexity * 5),
        Math.max(0, 100 - latest.duplicateLines / 100),
        Math.max(0, 100 - latest.technicalDebt / 10),
        Math.max(0, 100 - latest.vulnerabilityCount * 5)
      ] : [0, 0, 0, 0, 0, 0],
      borderColor: chartColors.primary,
      backgroundColor: `${chartColors.primary}20`,
      borderWidth: 2,
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { animation: { duration: 200 } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: { usePointStyle: true, padding: 20 }
      }
    }
  }

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20 }
      }
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Metrics</h1>
          <p className="text-muted-foreground">
            Monitor code quality, coverage, and technical debt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refresh} 
            disabled={loading.isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${loading.isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-primary/20 bg-primary/10 mb-4">
                <Gauge className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-1">
                {overallScore.toFixed(1)}%
              </h3>
              <p className="text-sm text-muted-foreground">Overall Quality Score</p>
            </div>
            <Separator orientation="vertical" className="h-20" />
            <div className="grid grid-cols-3 gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{qualityGates.filter(g => g.status === 'pass').length}</p>
                <p className="text-sm text-muted-foreground">Gates Passed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{qualityGates.filter(g => g.status === 'warning').length}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{qualityGates.filter(g => g.status === 'fail').length}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Test Coverage"
          value={latest?.testCoverage || 0}
          threshold={80}
          trend={trends.coverage}
          icon={TestTube}
          description="Percentage of code covered by tests"
        />
        <MetricCard
          title="Maintainability"
          value={latest?.maintainabilityIndex || 0}
          threshold={75}
          icon={Code2}
          description="How easy it is to maintain the code"
        />
        <MetricCard
          title="Technical Debt"
          value={latest?.technicalDebt || 0}
          unit=" hrs"
          trend={trends.debt === 'improving' ? 'improving' : trends.debt === 'declining' ? 'declining' : 'stable'}
          icon={AlertCircle}
          description="Estimated effort to fix all issues"
        />
        <MetricCard
          title="Vulnerabilities"
          value={latest?.vulnerabilityCount || 0}
          unit=""
          threshold={0}
          icon={Shield}
          description="Security vulnerabilities found"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="gates">Quality Gates</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Quality Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Quality Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <Radar data={radarData} options={radarOptions} />
                </div>
              </CardContent>
            </Card>

            {/* Test Coverage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Test Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <Doughnut data={coverageData} options={doughnutOptions} />
                </div>
              </CardContent>
            </Card>

            {/* Complexity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Complexity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <Bar data={complexityDistribution} options={chartOptions} />
                </div>
              </CardContent>
            </Card>

            {/* Quality Gates */}
            <QualityGatePanel gates={qualityGates} />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6">
            {/* Quality Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Quality Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <Line data={trendData} options={chartOptions} />
                </div>
              </CardContent>
            </Card>

            {/* Issues Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="w-5 h-5" />
                  Issues Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <Bar data={issuesData} options={{...chartOptions, scales: {...chartOptions.scales, x: {...chartOptions.scales?.x}, y: {...chartOptions.scales?.y, stacked: true}}}} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gates" className="space-y-6">
          <QualityGatePanel gates={qualityGates} />
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {qualityGates.map((gate) => (
              <Card key={gate.metric}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg capitalize">
                    {gate.metric.replace(/([A-Z])/g, ' $1').trim()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current</span>
                      <span className="font-mono font-semibold">{gate.current.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Threshold</span>
                      <span className="font-mono">{gate.threshold}%</span>
                    </div>
                    <Progress value={Math.min((gate.current / gate.threshold) * 100, 100)} className="h-2" />
                    <div className="flex justify-between items-center">
                      <Badge variant={gate.status === 'pass' ? 'default' : gate.status === 'warning' ? 'secondary' : 'destructive'}>
                        {gate.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {gate.trend === 'improving' && <TrendingUp className="w-3 h-3 text-green-500" />}
                        {gate.trend === 'declining' && <TrendingDown className="w-3 h-3 text-red-500" />}
                        {gate.trend === 'stable' && <Minus className="w-3 h-3 text-gray-500" />}
                        {gate.trend}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Lines of Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{latest?.linesOfCode?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Total lines</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Code Smells
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">{latest?.codeSmells || 0}</p>
                <p className="text-sm text-muted-foreground">Issues to review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Bugs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{latest?.bugs || 0}</p>
                <p className="text-sm text-muted-foreground">Critical issues</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  Complexity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{latest?.codeComplexity?.toFixed(1) || 0}</p>
                <p className="text-sm text-muted-foreground">Average per file</p>
              </CardContent>
            </Card>
          </div>

          {latest && (
            <Card>
              <CardHeader>
                <CardTitle>Quality Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex justify-between">
                    <span>Test Coverage:</span>
                    <span className="font-mono">{latest.testCoverage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maintainability Index:</span>
                    <span className="font-mono">{latest.maintainabilityIndex.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duplicate Lines:</span>
                    <span className="font-mono">{latest.duplicateLines}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Technical Debt:</span>
                    <span className="font-mono">{latest.technicalDebt.toFixed(1)} hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Code Complexity:</span>
                    <span className="font-mono">{latest.codeComplexity.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Security Issues:</span>
                    <span className="font-mono">{latest.vulnerabilityCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}