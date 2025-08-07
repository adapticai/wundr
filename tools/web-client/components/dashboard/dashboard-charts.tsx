"use client"

import React, { useEffect, useState } from "react"
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
import { Bar, Doughnut, Line } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalysisData } from "@/lib/contexts/analysis-context"

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

interface DashboardChartsProps {
  data: AnalysisData
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark')

  // Chart colors with theme-aware values
  const chartColors = isDark ? [
    "#E8EEF3",     // Wundr 50 (light in dark mode)
    "#C3D5E2",     // Wundr 100
    "#9EBACF",     // Wundr 200
    "#7A9FBC",     // Wundr 300
    "#5584A9",     // Wundr 400
    "#3D6A91",     // Wundr 500
    "#2D5078",     // Wundr 600
    "#1F3A5A",     // Wundr 700
  ] : [
    "#0E1A24",     // Wundr dark
    "#162940",     // Wundr 800
    "#1F3A5A",     // Wundr 700
    "#2D5078",     // Wundr 600
    "#3D6A91",     // Wundr 500
    "#5584A9",     // Wundr 400
    "#7A9FBC",     // Wundr 300
    "#9EBACF",     // Wundr 200
  ]

  // Entity distribution data
  const entityTypes = data.entities.reduce((acc, entity) => {
    acc[entity.type] = (acc[entity.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const entityChartData = {
    labels: Object.keys(entityTypes),
    datasets: [
      {
        data: Object.values(entityTypes),
        backgroundColor: chartColors,
        borderWidth: 2,
        borderColor: isDark ? "#0E1A24" : "#FFFFFF",
      },
    ],
  }

  // Duplicate severity data
  const severityCounts = data.duplicates.reduce(
    (acc, duplicate) => {
      acc[duplicate.severity] = (acc[duplicate.severity] || 0) + 1
      return acc
    },
    { critical: 0, high: 0, medium: 0 } as Record<string, number>
  )

  const severityChartData = {
    labels: ["Critical", "High", "Medium"],
    datasets: [
      {
        label: "Duplicate Clusters",
        data: [severityCounts.critical, severityCounts.high, severityCounts.medium],
        backgroundColor: [
          isDark ? "#EF4444" : "#DC2626",     // Red for critical
          isDark ? "#F97316" : "#EA580C",     // Orange for high
          isDark ? "#5584A9" : "#3D6A91"      // Wundr blue for medium
        ],
        borderWidth: 0,
      },
    ],
  }

  // Complexity distribution
  const complexityBuckets = data.entities.reduce((acc, entity) => {
    const complexity = entity.complexity || 0
    const bucket =
      complexity === 0
        ? "0"
        : complexity <= 5
        ? "1-5"
        : complexity <= 10
        ? "6-10"
        : complexity <= 20
        ? "11-20"
        : "20+"
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const complexityChartData = {
    labels: ["0", "1-5", "6-10", "11-20", "20+"],
    datasets: [
      {
        label: "Number of Entities",
        data: ["0", "1-5", "6-10", "11-20", "20+"].map(
          (bucket) => complexityBuckets[bucket] || 0
        ),
        borderColor: isDark ? "#5584A9" : "#3D6A91",
        backgroundColor: isDark ? "rgba(85, 132, 169, 0.2)" : "rgba(61, 106, 145, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  }

  // Dependency distribution
  const depCounts = data.entities.reduce((acc, entity) => {
    const depCount = entity.dependencies.length
    const bucket =
      depCount === 0
        ? "0"
        : depCount <= 2
        ? "1-2"
        : depCount <= 5
        ? "3-5"
        : depCount <= 10
        ? "6-10"
        : "10+"
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const dependencyChartData = {
    labels: ["0", "1-2", "3-5", "6-10", "10+"],
    datasets: [
      {
        label: "Number of Entities",
        data: ["0", "1-2", "3-5", "6-10", "10+"].map(
          (bucket) => depCounts[bucket] || 0
        ),
        borderColor: isDark ? "#7A9FBC" : "#5584A9",
        backgroundColor: isDark ? "rgba(122, 159, 188, 0.2)" : "rgba(85, 132, 169, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: mounted ? {
      duration: 750,
      easing: 'easeInOutQuart' as const,
    } : false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        animation: {
          duration: 200,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  }

  const doughnutOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: mounted ? {
      animateRotate: true,
      animateScale: false,
      duration: 750,
      easing: 'easeInOutQuart' as const,
    } : false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12,
          },
          color: isDark ? '#E8EEF3' : '#0E1A24',
        },
      },
    },
  }

  // Prevent rendering until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Entity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Doughnut data={entityChartData} options={doughnutOptions} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Bar data={severityChartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Complexity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Line data={complexityChartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dependency Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Line data={dependencyChartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}