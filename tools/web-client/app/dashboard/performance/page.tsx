"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useTheme } from "next-themes"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { Line, Bar, Pie } from "react-chartjs-2"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ChartLoading } from "@/components/ui/loading/chart-loading"
import { usePerformanceData } from "@/hooks/use-performance-data"
import { useToast } from "@/hooks/use-toast"
import {
  Activity,
  BarChart3,
  Clock,
  Cpu,
  Database,
  Download,
  HardDrive,
  LineChart,
  PieChart,
  RefreshCw,
  Settings,
  TrendingUp,
  Zap
} from "lucide-react"
import type { PerformanceMetrics, TimeRange } from "@/types/data"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PerformanceScoreCardProps {
  title: string
  value: number
  unit: string
  trend?: number
  icon: React.ReactNode
  color?: string
}

function PerformanceScoreCard({ title, value, unit, trend, icon, color = "blue" }: PerformanceScoreCardProps) {
  const trendColor = trend && trend > 0 ? "text-green-600 dark:text-green-400" : trend && trend < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}>
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">
                {typeof value === 'number' ? value.toLocaleString() : value} {unit}
              </p>
              {trend !== undefined && (
                <p className={`text-xs ${trendColor} flex items-center`}>
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {trend > 0 ? '+' : ''}{trend.toFixed(1)}% from last period
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PerformancePage() {
  const { theme, resolvedTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>("24h")
  const [realtime, setRealtime] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const {
    data: performanceData,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe,
    latest
  } = usePerformanceData({
    timeRange,
    realtime,
    refreshInterval: 30000,
    onError: (error) => {
      toast({
        title: "Performance Data Error",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (realtime) {
      subscribe()
    } else {
      unsubscribe()
    }
    return () => unsubscribe()
  }, [realtime, subscribe, unsubscribe])

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark')

  // Chart colors with theme-aware values
  const chartColors = isDark ? {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    background: '#1f2937',
    grid: '#374151',
    text: '#f9fafb'
  } : {
    primary: '#2563eb',
    secondary: '#059669',
    accent: '#d97706',
    danger: '#dc2626',
    success: '#16a34a',
    warning: '#ca8a04',
    background: '#ffffff',
    grid: '#e5e7eb',
    text: '#111827'
  }

  // Performance score calculations
  const performanceScore = useMemo(() => {
    if (!latest) return null

    const buildTimeScore = Math.max(0, 100 - (latest.buildTime / 1000) * 2)
    const loadTimeScore = Math.max(0, 100 - (latest.loadTime / 100) * 5)
    const errorScore = Math.max(0, 100 - (latest.errorRate * 20))
    const cacheScore = (latest.cacheHitRate || 0) * 100
    
    return {
      overall: Math.round((buildTimeScore + loadTimeScore + errorScore + cacheScore) / 4),
      buildTime: Math.round(buildTimeScore),
      loadTime: Math.round(loadTimeScore),
      reliability: Math.round(errorScore),
      caching: Math.round(cacheScore)
    }
  }, [latest])

  // Prepare chart data
  const responseTimeChartData = useMemo(() => ({
    labels: performanceData.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Load Time (ms)',
        data: performanceData.map(d => d.loadTime),
        borderColor: chartColors.primary,
        backgroundColor: chartColors.primary + '20',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Build Time (ms)',
        data: performanceData.map(d => d.buildTime),
        borderColor: chartColors.secondary,
        backgroundColor: chartColors.secondary + '20',
        tension: 0.4,
        fill: true,
      }
    ]
  }), [performanceData, chartColors])

  const throughputChartData = useMemo(() => ({
    labels: performanceData.slice(-10).map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Bundle Size (MB)',
        data: performanceData.slice(-10).map(d => d.bundleSize / (1024 * 1024)),
        backgroundColor: chartColors.accent,
        borderColor: chartColors.accent,
        borderWidth: 1,
      },
      {
        label: 'Test Duration (s)',
        data: performanceData.slice(-10).map(d => (d.testDuration || 0) / 1000),
        backgroundColor: chartColors.secondary,
        borderColor: chartColors.secondary,
        borderWidth: 1,
      }
    ]
  }), [performanceData, chartColors])

  const errorRateChartData = useMemo(() => ({
    labels: ['Success Rate', 'Error Rate', 'Cache Miss'],
    datasets: [{
      data: [
        Math.max(0, 100 - (latest?.errorRate || 0)),
        latest?.errorRate || 0,
        Math.max(0, 100 - ((latest?.cacheHitRate || 0.85) * 100))
      ],
      backgroundColor: [
        chartColors.success,
        chartColors.danger,
        chartColors.warning,
      ],
      borderColor: [
        chartColors.success,
        chartColors.danger,
        chartColors.warning,
      ],
      borderWidth: 1,
    }]
  }), [latest, chartColors])

  const resourceUsageChartData = useMemo(() => ({
    labels: performanceData.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Memory Usage (MB)',
        data: performanceData.map(d => d.memoryUsage),
        borderColor: chartColors.danger,
        backgroundColor: chartColors.danger + '30',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'CPU Usage (%)',
        data: performanceData.map(d => d.cpuUsage),
        borderColor: chartColors.warning,
        backgroundColor: chartColors.warning + '30',
        fill: true,
        tension: 0.4,
      }
    ]
  }), [performanceData, chartColors])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: chartColors.text,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
        },
      },
    },
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: chartColors.text,
          padding: 20,
        },
      },
    },
  }

  const handleExport = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      timeRange,
      summary: {
        dataPoints: performanceData.length,
        averageLoadTime: performanceData.reduce((sum, d) => sum + d.loadTime, 0) / performanceData.length,
        averageBuildTime: performanceData.reduce((sum, d) => sum + d.buildTime, 0) / performanceData.length,
        averageMemoryUsage: performanceData.reduce((sum, d) => sum + d.memoryUsage, 0) / performanceData.length,
        averageCpuUsage: performanceData.reduce((sum, d) => sum + d.cpuUsage, 0) / performanceData.length,
        overallScore: performanceScore?.overall || 0
      },
      performanceScore,
      data: performanceData
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Export Complete",
      description: "Performance analytics data exported successfully",
    })
  }, [performanceData, performanceScore, timeRange, toast])

  if (!mounted) {
    return <ChartLoading message="Loading performance dashboard..." />
  }

  if (loading.isLoading && performanceData.length === 0) {
    return <ChartLoading message="Analyzing performance metrics..." />
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Monitor and analyze application performance metrics in real-time
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center space-x-2">
            <Switch
              id="realtime"
              checked={realtime}
              onCheckedChange={setRealtime}
            />
            <Label htmlFor="realtime">Real-time</Label>
            {realtime && <Badge variant="secondary" className="animate-pulse">Live</Badge>}
          </div>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-32">
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
            onClick={refresh}
            disabled={loading.isRefreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading.isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <Settings className="w-4 h-4" />
              <span className="font-medium">Error loading performance data</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            {error.retry && (
              <Button onClick={error.retry} size="sm" variant="outline" className="mt-2">
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Score Cards */}
      {performanceScore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PerformanceScoreCard
            title="Overall Score"
            value={performanceScore.overall}
            unit="%"
            icon={<Activity className="w-5 h-5 text-blue-600" />}
            color="blue"
          />
          <PerformanceScoreCard
            title="Build Performance"
            value={performanceScore.buildTime}
            unit="%"
            icon={<Zap className="w-5 h-5 text-green-600" />}
            color="green"
          />
          <PerformanceScoreCard
            title="Load Performance"
            value={performanceScore.loadTime}
            unit="%"
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
            color="yellow"
          />
          <PerformanceScoreCard
            title="Reliability Score"
            value={performanceScore.reliability}
            unit="%"
            icon={<Database className="w-5 h-5 text-purple-600" />}
            color="purple"
          />
        </div>
      )}

      {/* Current Metrics */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Load Time</p>
                  <p className="text-xl font-semibold">{latest.loadTime}ms</p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                  <p className="text-xl font-semibold">{latest.memoryUsage}MB</p>
                </div>
                <HardDrive className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="text-xl font-semibold">{latest.cpuUsage}%</p>
                </div>
                <Cpu className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
                  <p className="text-xl font-semibold">{((latest.cacheHitRate || 0) * 100).toFixed(1)}%</p>
                </div>
                <Database className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="throughput" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Throughput
          </TabsTrigger>
          <TabsTrigger value="reliability" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Reliability
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
              <CardDescription>
                Load time and build time trends over {timeRange}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Line data={responseTimeChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="throughput" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Throughput Metrics</CardTitle>
              <CardDescription>
                Bundle size and test execution performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Bar data={throughputChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reliability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reliability Metrics</CardTitle>
              <CardDescription>
                Success rates, error rates, and cache performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Pie data={errorRateChartData} options={pieChartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>
                Memory and CPU utilization over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <Line data={resourceUsageChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>
            Key metrics and insights from the current dataset ({performanceData.length} data points)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Response Times</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Avg Load Time:</span>
                  <span>{performanceData.length > 0 ? Math.round(performanceData.reduce((sum, d) => sum + d.loadTime, 0) / performanceData.length) : 0}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Build Time:</span>
                  <span>{performanceData.length > 0 ? Math.round(performanceData.reduce((sum, d) => sum + d.buildTime, 0) / performanceData.length) : 0}ms</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Resource Usage</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Avg Memory:</span>
                  <span>{performanceData.length > 0 ? Math.round(performanceData.reduce((sum, d) => sum + d.memoryUsage, 0) / performanceData.length) : 0}MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg CPU:</span>
                  <span>{performanceData.length > 0 ? Math.round(performanceData.reduce((sum, d) => sum + d.cpuUsage, 0) / performanceData.length) : 0}%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Reliability</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Error Rate:</span>
                  <span>{latest?.errorRate.toFixed(2) || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Cache Hit Rate:</span>
                  <span>{((latest?.cacheHitRate || 0) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}