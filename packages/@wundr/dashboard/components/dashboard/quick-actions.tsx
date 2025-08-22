'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  FileText,
  Package,
  TestTube,
  Zap,
  Terminal
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAction {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  disabled?: boolean
  badge?: string
}

export function QuickActions() {
  const [isRunning, setIsRunning] = React.useState<{ [key: string]: boolean }>({})

  const handleAction = async (key: string, action: () => void) => {
    setIsRunning(prev => ({ ...prev, [key]: true }))
    
    try {
      await action()
      // Simulate async action
      setTimeout(() => {
        setIsRunning(prev => ({ ...prev, [key]: false }))
      }, 2000)
    } catch (error) {
      console.error('Action failed:', error)
      setIsRunning(prev => ({ ...prev, [key]: false }))
    }
  }

  const actions: QuickAction[] = [
    {
      title: 'Run Tests',
      description: 'Execute all test suites',
      icon: TestTube,
      action: () => console.log('Running tests...'),
      badge: '1,247 tests'
    },
    {
      title: 'Build Project',
      description: 'Build all packages',
      icon: Package,
      action: () => console.log('Building project...'),
      badge: '12 packages'
    },
    {
      title: 'Update Dependencies',
      description: 'Check for package updates',
      icon: RefreshCw,
      action: () => console.log('Updating dependencies...'),
      badge: '3 updates available'
    },
    {
      title: 'Generate Report',
      description: 'Create analytics report',
      icon: FileText,
      action: () => console.log('Generating report...'),
      variant: 'outline' as const
    },
    {
      title: 'Deploy Preview',
      description: 'Deploy to staging environment',
      icon: Zap,
      action: () => console.log('Deploying preview...'),
      variant: 'secondary' as const
    },
    {
      title: 'Open Terminal',
      description: 'Launch integrated terminal',
      icon: Terminal,
      action: () => console.log('Opening terminal...'),
      variant: 'outline' as const
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common development tasks and shortcuts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((actionItem, index) => {
            const key = `action-${index}`
            const running = isRunning[key]
            const IconComponent = actionItem.icon

            return (
              <Button
                key={key}
                variant={actionItem.variant || 'default'}
                className={cn(
                  'h-auto p-4 flex flex-col items-start text-left space-y-2',
                  running && 'opacity-50 cursor-not-allowed'
                )}
                disabled={actionItem.disabled || running}
                onClick={() => handleAction(key, actionItem.action)}
              >
                <div className="flex items-center justify-between w-full">
                  <IconComponent className={cn(
                    'h-5 w-5 flex-shrink-0',
                    running && 'animate-spin'
                  )} />
                  {actionItem.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {actionItem.badge}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-sm">
                    {actionItem.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {actionItem.description}
                  </div>
                </div>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}