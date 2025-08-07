"use client"

import React from "react"
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  TooltipItem,
} from "chart.js"
import { Radar } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useChartTheme } from "@/hooks/chart/useChartTheme"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface QualityMetrics {
  maintainability: number
  reliability: number
  security: number
  coverage: number
  duplication: number
  complexity: number
  technicalDebt: number
  documentation: number
}

interface CodeQualityRadarProps {
  metrics: QualityMetrics
  thresholds?: Partial<QualityMetrics>
  showBenchmark?: boolean
}

export function CodeQualityRadar({ 
  metrics, 
  thresholds = {
    maintainability: 80,
    reliability: 90,
    security: 85,
    coverage: 80,
    duplication: 95,
    complexity: 75,
    technicalDebt: 80,
    documentation: 70,
  },
  showBenchmark = true 
}: CodeQualityRadarProps) {
  const chartTheme = useChartTheme()

  const labels = [
    "Maintainability",
    "Reliability", 
    "Security",
    "Coverage",
    "Low Duplication",
    "Low Complexity",
    "Low Tech Debt",
    "Documentation",
  ]

  const data = {
    labels,
    datasets: [
      {
        label: "Current",
        data: [
          metrics.maintainability,
          metrics.reliability,
          metrics.security,
          metrics.coverage,
          metrics.duplication,
          metrics.complexity,
          metrics.technicalDebt,
          metrics.documentation,
        ],
        borderColor: chartTheme.colors.primary,
        backgroundColor: `${chartTheme.colors.primary}40`,
        borderWidth: 2,
      },
      ...(showBenchmark ? [{
        label: "Threshold",
        data: [
          thresholds.maintainability || 80,
          thresholds.reliability || 90,
          thresholds.security || 85,
          thresholds.coverage || 80,
          thresholds.duplication || 95,
          thresholds.complexity || 75,
          thresholds.technicalDebt || 80,
          thresholds.documentation || 70,
        ],
        borderColor: chartTheme.colors.text,
        backgroundColor: `${chartTheme.colors.text}20`,
        borderWidth: 1,
        borderDash: [5, 5],
      }] : []),
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: chartTheme.colors.text,
        },
      },
      tooltip: {
        ...chartTheme.tooltip,
        callbacks: {
          label: (context: TooltipItem<"radar">) => {
            return `${context.dataset.label}: ${context.parsed.r}%`
          },
        },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          ...chartTheme.ticks,
        },
        grid: chartTheme.grid,
        pointLabels: {
          ...chartTheme.ticks,
          font: {
            size: 11,
          },
        },
      },
    },
  }

  // Calculate overall score
  const overallScore = Object.values(metrics).reduce((sum, val) => sum + val, 0) / Object.values(metrics).length

  // Determine quality gates
  const qualityGates = Object.entries(metrics).map(([key, value]) => {
    const threshold = thresholds[key as keyof QualityMetrics] || 75
    return {
      metric: key,
      value,
      threshold,
      status: value >= threshold ? "pass" : value >= threshold * 0.8 ? "warning" : "fail",
    }
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case "fail":
        return <XCircle className="w-4 h-4 text-destructive" />
      default:
        return null
    }
  }

  const getStatusBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Excellent</Badge>
    if (score >= 75) return <Badge className="bg-blue-500">Good</Badge>
    if (score >= 60) return <Badge className="bg-yellow-500">Fair</Badge>
    return <Badge variant="destructive">Poor</Badge>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Code Quality Radar</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{overallScore.toFixed(1)}%</span>
              {getStatusBadge(overallScore)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <Radar data={data} options={options} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality Gates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {qualityGates.map(({ metric, value, threshold, status }) => (
              <div key={metric} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <span className="capitalize">{metric.replace(/([A-Z])/g, " $1").trim()}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Threshold: {threshold}%
                  </div>
                  <div className="font-mono font-semibold">
                    {value.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}