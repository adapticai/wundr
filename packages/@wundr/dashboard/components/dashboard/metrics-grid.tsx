'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  TestTube, 
  Clock, 
  Shield,
  Code,
  Users
} from 'lucide-react'
import { realtimeStore } from '@/lib/websocket'
import { RealtimeData } from '@/types'
import { cn } from '@/lib/utils'

interface Metric {
  title: string
  value: string
  change: number
  changeLabel: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  progress?: number
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple'
}

const mockMetrics: Metric[] = [
  {
    title: 'Lines of Code',
    value: '45,231',
    change: 12.5,
    changeLabel: '+2,847 this month',
    icon: Code,
    description: 'Total lines across all packages',
    color: 'blue'
  },
  {
    title: 'Test Coverage',
    value: '87%',
    change: 2.1,
    changeLabel: '+1.8% this week',
    icon: TestTube,
    description: 'Unit and integration test coverage',
    progress: 87,
    color: 'green'
  },
  {
    title: 'Build Time',
    value: '2m 34s',
    change: -15.3,
    changeLabel: '-23s improvement',
    icon: Clock,
    description: 'Average build time across packages',
    color: 'orange'
  },
  {
    title: 'Security Issues',
    value: '3',
    change: -50,
    changeLabel: '3 resolved this week',
    icon: Shield,
    description: 'Known vulnerabilities in dependencies',
    color: 'red'
  },
  {
    title: 'Active Files',
    value: '1,247',
    change: 8.2,
    changeLabel: '+94 files added',
    icon: FileText,
    description: 'Files modified in last 30 days',
    color: 'purple'
  },
  {
    title: 'Contributors',
    value: '12',
    change: 0,
    changeLabel: 'No change',
    icon: Users,
    description: 'Active contributors this month',
    color: 'blue'
  }
]

function MetricCard({ metric, realtimeValue }: { 
  metric: Metric
  realtimeValue?: number
}) {
  const displayValue = realtimeValue !== undefined 
    ? `${realtimeValue.toFixed(1)}${metric.title.includes('%') ? '%' : ''}`
    : metric.value

  const IconComponent = metric.icon
  const isPositiveChange = metric.change > 0
  const changeColor = isPositiveChange ? 'text-green-600' : 'text-red-600'
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {metric.title}
        </CardTitle>
        <IconComponent className={cn('h-4 w-4', {
          'text-green-500': metric.color === 'green',
          'text-red-500': metric.color === 'red',
          'text-blue-500': metric.color === 'blue',
          'text-orange-500': metric.color === 'orange',
          'text-purple-500': metric.color === 'purple'
        })} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <div className={cn('flex items-center', changeColor)}>
            <TrendIcon className="h-3 w-3 mr-1" />
            <span>
              {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
            </span>
          </div>
          <span>{metric.changeLabel}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {metric.description}
        </p>
        {metric.progress !== undefined && (
          <Progress 
            value={realtimeValue || metric.progress} 
            className="mt-2" 
          />
        )}
      </CardContent>
    </Card>
  )
}

export function MetricsGrid() {
  const [realtimeData, setRealtimeData] = React.useState<RealtimeData>({
    connected: false,
    lastUpdate: new Date(),
    events: [],
    metrics: []
  })

  React.useEffect(() => {
    // Subscribe to real-time data updates
    const unsubscribe = realtimeStore.subscribe(setRealtimeData)
    return unsubscribe
  }, [])

  // Map real-time metrics to dashboard metrics
  const getRealtimeValue = (metricTitle: string): number | undefined => {
    if (!realtimeData.metrics.length) return undefined
    
    switch (metricTitle) {
      case 'Test Coverage':
        return realtimeData.metrics.find(m => m.name === 'testCoverage')?.value
      case 'Build Time': {
        const buildTime = realtimeData.metrics.find(m => m.name === 'buildTime')?.value
        return buildTime ? buildTime / 1000 : undefined // Convert to seconds
      }
      default:
        return undefined
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {mockMetrics.map((metric, index) => (
        <MetricCard
          key={metric.title}
          metric={metric}
          realtimeValue={getRealtimeValue(metric.title)}
        />
      ))}
    </div>
  )
}