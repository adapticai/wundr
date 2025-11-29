'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { realtimeStore, WebSocketMessage } from '@/lib/websocket'
import { RealtimeData } from '@/types'
import { AlertCircle, GitBranch, GitCommit, GitMerge, Package } from 'lucide-react'
import * as React from 'react'

interface ActivityItem {
  id: string
  type: 'commit' | 'merge' | 'branch' | 'package' | 'error'
  user: string
  action: string
  timestamp: Date
  description?: string
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'commit',
    user: 'Sarah Chen',
    action: 'committed changes to',
    timestamp: new Date(Date.now() - 5 * 60000),
    description: 'feature/dashboard-components'
  },
  {
    id: '2', 
    type: 'merge',
    user: 'Mike Johnson',
    action: 'merged pull request',
    timestamp: new Date(Date.now() - 15 * 60000),
    description: '#234: Add WebSocket integration'
  },
  {
    id: '3',
    type: 'package',
    user: 'System',
    action: 'updated dependencies',
    timestamp: new Date(Date.now() - 30 * 60000),
    description: '3 packages updated'
  },
  {
    id: '4',
    type: 'branch',
    user: 'Alex Kim',
    action: 'created branch',
    timestamp: new Date(Date.now() - 45 * 60000),
    description: 'hotfix/memory-leak-fix'
  },
  {
    id: '5',
    type: 'error',
    user: 'Build System',
    action: 'reported error in',
    timestamp: new Date(Date.now() - 60 * 60000),
    description: 'TypeScript compilation failed'
  }
]

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'commit': return GitCommit
    case 'merge': return GitMerge
    case 'branch': return GitBranch
    case 'package': return Package
    case 'error': return AlertCircle
    default: return GitCommit
  }
}

function getActivityColor(type: ActivityItem['type']) {
  switch (type) {
    case 'commit': return 'text-blue-500'
    case 'merge': return 'text-green-500'
    case 'branch': return 'text-purple-500'
    case 'package': return 'text-orange-500'
    case 'error': return 'text-red-500'
    default: return 'text-gray-500'
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

export function RecentActivity() {
  const [activities, setActivities] = React.useState<ActivityItem[]>(mockActivities)
  const [realtimeData, setRealtimeData] = React.useState<RealtimeData>({
    connected: false,
    lastUpdate: new Date(),
    events: [],
    metrics: []
  })

  React.useEffect(() => {
    // Create message handler that transforms WebSocketMessage to RealtimeData
    const messageHandler = (message: WebSocketMessage) => {
      try {
        const msgData = message.data ?? message.payload
        if (message.type === 'realtime-data') {
          setRealtimeData({
            connected: true,
            lastUpdate: new Date(message.timestamp ?? Date.now()),
            events: (msgData as Record<string, unknown>).events as RealtimeData['events'] || [],
            metrics: (msgData as Record<string, unknown>).metrics as RealtimeData['metrics'] || []
          })
        } else if (message.type === 'events-update') {
          setRealtimeData(prev => ({
            ...prev,
            connected: true,
            lastUpdate: new Date(message.timestamp ?? Date.now()),
            events: Array.isArray(msgData) ? msgData as RealtimeData['events'] : []
          }))
        }
      } catch (error) {
        console.error('Error processing WebSocket message in RecentActivity:', error)
      }
    }

    // Subscribe to real-time data updates
    const unsubscribe = realtimeStore.subscribeToMessages(messageHandler)

    return unsubscribe
  }, [])

  // Convert real-time events to activity items
  React.useEffect(() => {
    const realtimeActivities = realtimeData.events.slice(0, 5).map(event => ({
      id: event.id,
      type: event.type === 'build' ? 'commit' as const : 
            event.type === 'analysis' ? 'package' as const :
            event.type === 'error' ? 'error' as const : 'commit' as const,
      user: event.metadata?.author || 'System',
      action: event.type === 'build' ? 'triggered build' :
              event.type === 'analysis' ? 'ran analysis' :
              event.type === 'error' ? 'reported error' : 'performed action',
      timestamp: event.timestamp,
      description: event.message
    }))

    if (realtimeActivities.length > 0) {
      // Merge with mock data, prioritizing real-time data
      const combined = [...realtimeActivities, ...mockActivities]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 8)
      
      setActivities(combined)
    }
  }, [realtimeData.events])

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type)
          return (
            <div key={activity.id} className="flex items-center space-x-3">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={`/avatars/${activity.user.toLowerCase().replace(' ', '')}.jpg`} />
                <AvatarFallback className="text-xs">
                  {getInitials(activity.user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none mb-1">
                  <span className="font-semibold">{activity.user}</span>{' '}
                  <span className="text-muted-foreground">{activity.action}</span>
                </p>
                {activity.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(activity.timestamp)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Icon className={`h-4 w-4 ${getActivityColor(activity.type)}`} />
                <Badge variant="outline" className="text-xs capitalize">
                  {activity.type}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}