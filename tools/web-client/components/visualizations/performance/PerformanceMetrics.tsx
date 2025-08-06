"use client"

import React, { useMemo, useState } from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from "chart.js"
import { Line, Bar, Radar } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChartTheme } from "@/hooks/chart/useChartTheme"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PerformanceData {
  timestamp: string
  buildTime: number
  bundleSize: number
  memoryUsage: number
  cpuUsage: number
  loadTime: number
}

interface PerformanceMetricsProps {
  data: PerformanceData[]
  realtime?: boolean
}

export function PerformanceMetrics({ data, realtime = false }: PerformanceMetricsProps) {
  const chartTheme = useChartTheme()
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h")

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const now = new Date()
    const ranges = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    }
    
    const cutoff = new Date(now.getTime() - ranges[timeRange])
    return data.filter(d => new Date(d.timestamp) >= cutoff)
  }, [data, timeRange])

  // Calculate trends
  const calculateTrend = (metric: keyof PerformanceData) => {
    if (filteredData.length < 2) return { value: 0, trend: "neutral" as const }
    
    const recent = filteredData.slice(-10)
    const previous = filteredData.slice(-20, -10)
    
    const recentAvg = recent.reduce((sum, d) => sum + (d[metric] as number), 0) / recent.length
    const previousAvg = previous.reduce((sum, d) => sum + (d[metric] as number), 0) / previous.length
    
    const change = ((recentAvg - previousAvg) / previousAvg) * 100
    
    return {
      value: change,
      trend: change > 5 ? "up" : change < -5 ? "down" : "neutral"
    }
  }

  // Build time chart data
  const buildTimeData = {
    labels: filteredData.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: "Build Time (ms)",
        data: filteredData.map(d => d.buildTime),
        borderColor: chartTheme.colors.primary,
        backgroundColor: `${chartTheme.colors.primary}20`,
        fill: true,
        tension: 0.4,
      },
    ],
  }

  // Bundle size chart data
  const bundleSizeData = {
    labels: filteredData.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: "Bundle Size (KB)",
        data: filteredData.map(d => d.bundleSize / 1024),
        backgroundColor: chartTheme.colors.secondary,
        borderColor: chartTheme.colors.secondary,
        borderWidth: 2,
      },
    ],
  }

  // Resource usage radar chart
  const latestData = filteredData[filteredData.length - 1] || {
    cpuUsage: 0,
    memoryUsage: 0,
    loadTime: 0,
    buildTime: 0,
    bundleSize: 0,
  }

  const resourceData = {
    labels: ["CPU Usage", "Memory Usage", "Load Time", "Build Time", "Bundle Size"],
    datasets: [
      {
        label: "Current",
        data: [
          latestData.cpuUsage,
          latestData.memoryUsage / 100,
          100 - (latestData.loadTime / 50),
          100 - (latestData.buildTime / 10000),
          100 - (latestData.bundleSize / 1000000),
        ],
        backgroundColor: `${chartTheme.colors.accent}40`,
        borderColor: chartTheme.colors.accent,
        borderWidth: 2,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        ...chartTheme.tooltip,
      },
    },
    scales: {
      x: {
        grid: chartTheme.grid,
        ticks: chartTheme.ticks,
      },
      y: {
        grid: chartTheme.grid,
        ticks: chartTheme.ticks,
      },
    },
  }

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: chartTheme.grid,
        ticks: {
          ...chartTheme.ticks,
          display: false,
        },
      },
    },
  }

  const TrendIcon = ({ trend }: { trend: "up" | "down" | "neutral" }) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-destructive" />
      case "down":
        return <TrendingDown className="w-4 h-4 text-green-500" />
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Performance Metrics</h2>
          {realtime && (
            <Badge variant="outline" className="animate-pulse">
              Live
            </Badge>
          )}
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="1h">1H</TabsTrigger>
            <TabsTrigger value="24h">24H</TabsTrigger>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Build Time", metric: "buildTime" as const, unit: "ms" },
          { label: "Bundle Size", metric: "bundleSize" as const, unit: "KB", divisor: 1024 },
          { label: "Memory Usage", metric: "memoryUsage" as const, unit: "MB" },
          { label: "Load Time", metric: "loadTime" as const, unit: "ms" },
        ].map(({ label, metric, unit, divisor = 1 }) => {
          const trend = calculateTrend(metric)
          const current = latestData[metric] / divisor
          
          return (
            <Card key={metric}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <TrendIcon trend={trend.trend} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {current.toFixed(1)} {unit}
                </div>
                <p className="text-xs text-muted-foreground">
                  {trend.trend !== "neutral" && (
                    <span className={trend.trend === "up" ? "text-destructive" : "text-green-500"}>
                      {trend.trend === "up" ? "+" : ""}{trend.value.toFixed(1)}%
                    </span>
                  )}
                  {trend.trend === "neutral" && "No change"}
                  {" from previous period"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Build Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={buildTimeData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bundle Size History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Bar data={bundleSizeData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] max-w-md mx-auto">
            <Radar data={resourceData} options={radarOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}