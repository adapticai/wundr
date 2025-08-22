'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Activity, Zap, Database, Globe, Clock, TestTube } from 'lucide-react'
import { useWebSocket, realtimeStore } from '@/lib/websocket'
import { RealtimeData, RealtimeEvent, RealtimeMetric } from '@/types'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  name: string
  value: number
  unit: string
  change?: number
  icon: React.ComponentType<{ className?: string }>
  color?: string
}

function MetricCard({ name, value, unit, change, icon: Icon, color = 'blue' }: MetricCardProps) {
  const displayValue = name === 'buildTime' 
    ? `${(value / 1000).toFixed(1)}s`
    : value.toFixed(1)
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2">
          <Icon className={cn("h-4 w-4", {
            'text-blue-500': color === 'blue',
            'text-green-500': color === 'green',
            'text-orange-500': color === 'orange',
            'text-purple-500': color === 'purple',
            'text-red-500': color === 'red',
            'text-indigo-500': color === 'indigo'
          })} />
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-bold">{displayValue}</p>
              <span className="text-xs text-muted-foreground">{unit}</span>
              {change !== undefined && (
                <Badge variant={change >= 0 ? 'default' : 'destructive'} className="text-xs">
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EventList({ events }: { events: RealtimeEvent[] }) {
  const getEventIcon = (type: RealtimeEvent['type']) => {
    switch (type) {
      case 'build': return Activity
      case 'test': return TestTube
      case 'analysis': return Database
      case 'error': return Zap
      default: return Globe
    }
  }

  const getEventColor = (status: RealtimeEvent['status']) => {
    switch (status) {
      case 'completed': return 'text-green-500'
      case 'failed': return 'text-red-500'
      case 'progress': return 'text-orange-500'
      case 'started': return 'text-blue-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <ScrollArea className="h-[400px] w-full">
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent events</p>
            <p className="text-xs">Real-time events will appear here</p>
          </div>
        ) : (
          events.map((event) => {
            const Icon = getEventIcon(event.type)
            return (
              <div key={event.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                <Icon className={cn("h-4 w-4 mt-1 flex-shrink-0", getEventColor(event.status))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{event.message}</p>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {event.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{event.status}</span>
                    <span>•</span>
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    {event.progress !== undefined && (
                      <>
                        <span>•</span>
                        <span>{event.progress}%</span>
                      </>
                    )}
                  </div>
                  {event.progress !== undefined && event.status === 'progress' && (
                    <Progress value={event.progress} className="mt-2 h-1" />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </ScrollArea>
  )
}

export function RealtimeMetrics() {
  const { connect, isConnected } = useWebSocket()
  const [data, setData] = React.useState<RealtimeData>({
    connected: false,
    lastUpdate: new Date(),
    events: [],
    metrics: []
  })

  React.useEffect(() => {
    // Connect to WebSocket
    connect()

    // Subscribe to real-time data updates
    const unsubscribe = realtimeStore.subscribe(setData)

    return unsubscribe
  }, [connect])

  const metricCards = [
    { name: 'CPU Usage', key: 'cpu', icon: Activity, color: 'blue' },
    { name: 'Memory', key: 'memory', icon: Database, color: 'green' },
    { name: 'Disk Usage', key: 'disk', icon: Database, color: 'orange' },
    { name: 'Network', key: 'network', icon: Globe, color: 'purple' },
    { name: 'Build Time', key: 'buildTime', icon: Clock, color: 'indigo' },
    { name: 'Test Coverage', key: 'testCoverage', icon: TestTube, color: 'red' }
  ]

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Real-time Monitoring
                <Badge variant={isConnected ? 'default' : 'destructive'} className="ml-2">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Live metrics and events from your development environment
              </CardDescription>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Last updated</p>
              <p>{data.lastUpdate.toLocaleTimeString()}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map(({ name, key, icon, color }) => {
          const metric = data.metrics.find(m => m.name === key)
          return (
            <MetricCard
              key={key}
              name={name}
              value={metric?.value || 0}
              unit={metric?.unit || ''}
              change={metric?.change}
              icon={icon}
              color={color}
            />
          )
        })}
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            Real-time development events and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <EventList events={data.events} />
        </CardContent>
      </Card>
    </div>
  )
}