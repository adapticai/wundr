// Chart-specific types extending Chart.js types

import type { ChartOptions as ChartJSOptions, ChartData as ChartJSData } from 'chart.js'

export interface CustomChartOptions extends ChartJSOptions {
  theme?: 'light' | 'dark'
  exportable?: boolean
  realtime?: boolean
}

export interface TimeSeriesPoint {
  timestamp: Date
  value: number
  label?: string
  metadata?: Record<string, any>
}

export interface MetricSeries {
  name: string
  data: TimeSeriesPoint[]
  color?: string
  unit?: string
}

export interface ChartThemeColors {
  primary: string
  secondary: string
  accent: string
  success: string
  warning: string
  error: string
  neutral: string[]
}

export interface ChartTooltipData {
  label: string
  value: string | number
  color: string
  unit?: string
}

export interface ChartExportOptions {
  format: 'png' | 'jpg' | 'pdf' | 'svg'
  filename?: string
  quality?: number
  width?: number
  height?: number
}