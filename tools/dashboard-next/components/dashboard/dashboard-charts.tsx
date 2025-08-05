"use client"

import React from "react"
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
        backgroundColor: [
          "#3b82f6",
          "#ef4444",
          "#22c55e",
          "#f59e0b",
          "#a855f7",
          "#6366f1",
          "#14b8a6",
          "#f97316",
        ],
        borderWidth: 2,
        borderColor: "#fff",
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
        backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6"],
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
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
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
        borderColor: "#a855f7",
        backgroundColor: "rgba(168, 85, 247, 0.1)",
        fill: true,
        tension: 0.4,
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
    },
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
      },
    },
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