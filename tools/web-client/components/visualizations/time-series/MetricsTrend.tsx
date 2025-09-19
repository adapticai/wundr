"use client"

import React, { useState, useMemo } from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from "chart.js"
import { Line } from "react-chartjs-2"
import "chartjs-adapter-date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useChartTheme } from "@/hooks/chart/useChartTheme"
import { TrendingUp, TrendingDown, AlertCircle, Download } from "lucide-react"
import { format, subDays } from "date-fns"

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface MetricDataPoint {
  timestamp: string
  value: number
  label?: string
  isAnomaly?: boolean
}

interface ProcessedDataPoint {
  timestamp: string
  value: number
  isAnomaly?: boolean
}

interface TooltipContext {
  dataIndex: number
  dataset: {
    data: ProcessedDataPoint[]
    label: string
  }
  parsed: {
    y: number
  }
  raw: ProcessedDataPoint
}

interface ChartSelectEvent {
  target: {
    value: string
  }
}

interface MetricSeries {
  name: string
  data: MetricDataPoint[]
  color?: string
  unit?: string
  threshold?: number
}

interface MetricsTrendProps {
  series: MetricSeries[]
  title?: string
  height?: number
  enableComparison?: boolean
  showAnomalies?: boolean
}

export function MetricsTrend({ 
  series, 
  title = "Metrics Trend",
  height = 400,
  enableComparison = true,
  showAnomalies = true
}: MetricsTrendProps) {
  const chartTheme = useChartTheme()
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(series.map(s => s.name))
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d")
  const [comparisonMode, setComparisonMode] = useState<"absolute" | "percentage">("absolute")

  // Filter data based on time range
  const filteredSeries = useMemo(() => {
    const now = new Date()
    const ranges = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    }
    
    const cutoff = subDays(now, ranges[timeRange])
    
    return series
      .filter(s => selectedMetrics.includes(s.name))
      .map(s => ({
        ...s,
        data: s.data.filter(d => new Date(d.timestamp) >= cutoff)
      }))
  }, [series, selectedMetrics, timeRange])

  // Detect anomalies using simple statistical method
  const detectAnomalies = (data: MetricDataPoint[], threshold: number = 2) => {
    const values = data.map(d => d.value)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    return data.map(d => ({
      ...d,
      isAnomaly: Math.abs(d.value - mean) > threshold * stdDev
    }))
  }

  // Calculate trends
  const calculateTrend = (data: MetricDataPoint[]) => {
    if (data.length < 2) return { trend: "neutral" as const, change: 0 }
    
    const recentValue = data[data.length - 1].value
    const previousValue = data[Math.max(0, data.length - 8)].value
    const change = ((recentValue - previousValue) / previousValue) * 100
    
    return {
      trend: change > 5 ? "up" : change < -5 ? "down" : "neutral" as const,
      change
    }
  }

  // Prepare chart data
  const chartData = {
    datasets: filteredSeries.map((s, index) => {
      const processedData = showAnomalies ? detectAnomalies(s.data) : s.data
      const trend = calculateTrend(s.data)
      
      return {
        label: s.name,
        data: processedData.map(d => ({
          x: d.timestamp,
          y: comparisonMode === "percentage" && s.data[0]
            ? ((d.value - s.data[0].value) / s.data[0].value) * 100
            : d.value,
          isAnomaly: (d as any).isAnomaly
        })),
        borderColor: s.color || Object.values(chartTheme.colors)[index % Object.values(chartTheme.colors).length],
        backgroundColor: `${s.color || Object.values(chartTheme.colors)[index % Object.values(chartTheme.colors).length]}20`,
        fill: true,
        tension: 0.4,
        pointRadius: processedData.map((d: ProcessedDataPoint) => d.isAnomaly ? 6 : 3),
        pointBackgroundColor: processedData.map((d: ProcessedDataPoint) =>
          d.isAnomaly ? "#ef4444" : s.color || Object.values(chartTheme.colors)[index % Object.values(chartTheme.colors).length]
        ),
        pointBorderColor: processedData.map((d: ProcessedDataPoint) =>
          d.isAnomaly ? "#ef4444" : s.color || Object.values(chartTheme.colors)[index % Object.values(chartTheme.colors).length]
        ),
      }
    })
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: chartTheme.colors.text,
        },
      },
      tooltip: {
        ...chartTheme.tooltip,
        callbacks: {
          label: (context: TooltipContext) => {
            const label = context.dataset.label || ""
            const value = context.parsed.y
            const unit = comparisonMode === "percentage" ? "%" : 
              filteredSeries.find(s => s.name === label)?.unit || ""
            
            const point = context.raw
            const anomalyText = point.isAnomaly ? " (Anomaly!)" : ""
            
            return `${label}: ${value.toFixed(2)}${unit}${anomalyText}`
          }
        }
      },
    },
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: (timeRange === "7d" ? "day" : timeRange === "30d" ? "day" : "week") as "day" | "week",
          displayFormats: {
            day: "MMM d",
            week: "MMM d",
          },
        },
        grid: chartTheme.grid,
        ticks: chartTheme.ticks,
      },
      y: {
        grid: chartTheme.grid,
        ticks: {
          ...chartTheme.ticks,
          callback: (value: number) => {
            return comparisonMode === "percentage" ? `${value}%` : value
          }
        },
      },
    },
  }

  const handleExport = () => {
    const csvContent = [
      ["Timestamp", ...selectedMetrics].join(","),
      ...filteredSeries[0].data.map((_, i) => 
        [
          filteredSeries[0].data[i].timestamp,
          ...filteredSeries.map(s => s.data[i]?.value || "")
        ].join(",")
      )
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `metrics-trend-${format(new Date(), "yyyy-MM-dd")}.csv`
    link.click()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            {enableComparison && (
              <Select value={comparisonMode} onValueChange={(v: string) => setComparisonMode(v as 'absolute' | 'percentage')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Absolute</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={timeRange} onValueChange={(v: string) => setTimeRange(v as '7d' | '30d' | '90d' | '1y')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {series.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {series.map(s => {
                const isSelected = selectedMetrics.includes(s.name)
                const trend = calculateTrend(s.data)
                
                return (
                  <Badge
                    key={s.name}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (isSelected && selectedMetrics.length > 1) {
                        setSelectedMetrics(selectedMetrics.filter(m => m !== s.name))
                      } else if (!isSelected) {
                        setSelectedMetrics([...selectedMetrics, s.name])
                      }
                    }}
                  >
                    <span className="mr-1">{s.name}</span>
                    {isSelected && trend.trend === "up" && <TrendingUp className="w-3 h-3 text-destructive" />}
                    {isSelected && trend.trend === "down" && <TrendingDown className="w-3 h-3 text-green-500" />}
                  </Badge>
                )
              })}
            </div>
          )}
          
          <div style={{ height: `${height}px` }}>
            <Line data={chartData} options={chartOptions as any} />
          </div>

          {showAnomalies && filteredSeries.some(s => detectAnomalies(s.data).some((d: ProcessedDataPoint) => d.isAnomaly)) && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm">Anomalies detected in the data</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}