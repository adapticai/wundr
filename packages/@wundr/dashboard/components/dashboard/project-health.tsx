'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  Shield,
  Zap,
  Code,
  FileText,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HealthMetric {
  name: string
  value: number
  status: 'excellent' | 'good' | 'warning' | 'critical'
  description: string
  trend: 'up' | 'down' | 'stable'
  details?: string[]
}

interface Issue {
  id: string
  type: 'security' | 'performance' | 'quality' | 'maintenance'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  file?: string
  line?: number
  suggestion?: string
}

const healthMetrics: HealthMetric[] = [
  {
    name: 'Code Quality',
    value: 87,
    status: 'good',
    description: 'Overall code quality score based on complexity, maintainability, and best practices',
    trend: 'up',
    details: [
      'Low cyclomatic complexity',
      'Good test coverage',
      'Minimal code duplication'
    ]
  },
  {
    name: 'Security Score',
    value: 92,
    status: 'excellent',
    description: 'Security assessment based on known vulnerabilities and best practices',
    trend: 'up',
    details: [
      'No critical vulnerabilities',
      'Dependencies up to date',
      'Security headers configured'
    ]
  },
  {
    name: 'Performance',
    value: 78,
    status: 'warning',
    description: 'Application performance metrics including load times and memory usage',
    trend: 'down',
    details: [
      'Build time could be improved',
      'Some heavy dependencies',
      'Memory usage within limits'
    ]
  },
  {
    name: 'Maintainability',
    value: 82,
    status: 'good',
    description: 'How easy it is to maintain and extend the codebase',
    trend: 'stable',
    details: [
      'Well-documented APIs',
      'Consistent coding style',
      'Modular architecture'
    ]
  }
]

const issues: Issue[] = [
  {
    id: '1',
    type: 'security',
    severity: 'high',
    title: 'Outdated dependency with known vulnerability',
    description: 'lodash@4.17.20 has a prototype pollution vulnerability',
    file: 'package.json',
    suggestion: 'Update to lodash@4.17.21 or higher'
  },
  {
    id: '2',
    type: 'performance',
    severity: 'medium',
    title: 'Large bundle size in dashboard package',
    description: 'Bundle size exceeds recommended threshold (>500kb)',
    file: 'packages/@wundr/dashboard/dist/bundle.js',
    suggestion: 'Consider code splitting or removing unused dependencies'
  },
  {
    id: '3',
    type: 'quality',
    severity: 'low',
    title: 'High cyclomatic complexity in utility functions',
    description: 'Function parseConfig has complexity score of 12',
    file: 'src/utils/config.ts',
    line: 45,
    suggestion: 'Break down into smaller, focused functions'
  },
  {
    id: '4',
    type: 'maintenance',
    severity: 'medium',
    title: 'Missing error handling in API calls',
    description: 'Several API endpoints lack proper error handling',
    file: 'src/api/client.ts',
    suggestion: 'Add try-catch blocks and user-friendly error messages'
  }
]

function getStatusColor(status: HealthMetric['status']) {
  switch (status) {
    case 'excellent': return 'text-green-600'
    case 'good': return 'text-blue-600'
    case 'warning': return 'text-orange-600'
    case 'critical': return 'text-red-600'
  }
}

function getStatusIcon(status: HealthMetric['status']) {
  switch (status) {
    case 'excellent': return CheckCircle
    case 'good': return CheckCircle
    case 'warning': return AlertCircle
    case 'critical': return XCircle
  }
}

function getIssueIcon(type: Issue['type']) {
  switch (type) {
    case 'security': return Shield
    case 'performance': return Zap
    case 'quality': return Code
    case 'maintenance': return FileText
  }
}

function getSeverityColor(severity: Issue['severity']) {
  switch (severity) {
    case 'low': return 'text-green-600 border-green-200'
    case 'medium': return 'text-orange-600 border-orange-200'
    case 'high': return 'text-red-600 border-red-200'
    case 'critical': return 'text-red-700 border-red-300'
  }
}

function HealthMetricCard({ metric }: { metric: HealthMetric }) {
  const StatusIcon = getStatusIcon(metric.status)
  const TrendIcon = metric.trend === 'up' ? TrendingUp : 
                    metric.trend === 'down' ? TrendingDown : Clock

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{metric.name}</CardTitle>
          <div className="flex items-center space-x-2">
            <StatusIcon className={cn('h-5 w-5', getStatusColor(metric.status))} />
            <TrendIcon className={cn('h-4 w-4', {
              'text-green-500': metric.trend === 'up',
              'text-red-500': metric.trend === 'down',
              'text-gray-500': metric.trend === 'stable'
            })} />
          </div>
        </div>
        <CardDescription>{metric.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Score</span>
            <span className="font-medium">{metric.value}/100</span>
          </div>
          <Progress value={metric.value} className="h-2" />
        </div>
        
        {metric.details && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Key Points:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {metric.details.map((detail, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground flex-shrink-0" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IssueCard({ issue }: { issue: Issue }) {
  const Icon = getIssueIcon(issue.type)
  
  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-start space-x-3">
          <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{issue.title}</h4>
              <Badge variant="outline" className={cn('text-xs', getSeverityColor(issue.severity))}>
                {issue.severity}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{issue.description}</p>
            {issue.file && (
              <p className="text-xs text-muted-foreground">
                📁 {issue.file}
                {issue.line && ` (line ${issue.line})`}
              </p>
            )}
            {issue.suggestion && (
              <div className="mt-2 p-2 bg-muted rounded-md">
                <p className="text-xs font-medium text-muted-foreground mb-1">💡 Suggestion:</p>
                <p className="text-xs text-muted-foreground">{issue.suggestion}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProjectHealth() {
  const overallHealth = Math.round(
    healthMetrics.reduce((sum, metric) => sum + metric.value, 0) / healthMetrics.length
  )

  const issuesByType = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = []
    acc[issue.type].push(issue)
    return acc
  }, {} as Record<string, Issue[]>)

  return (
    <div className="space-y-6">
      {/* Overall Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Project Health Score
            <Badge variant={overallHealth >= 90 ? 'default' : overallHealth >= 80 ? 'secondary' : 'destructive'}>
              {overallHealth}/100
            </Badge>
          </CardTitle>
          <CardDescription>
            Comprehensive health assessment of your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={overallHealth} className="h-3" />
        </CardContent>
      </Card>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Health Metrics</TabsTrigger>
          <TabsTrigger value="issues">Issues & Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {healthMetrics.map((metric) => (
              <HealthMetricCard key={metric.name} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Issues ({issues.length})</TabsTrigger>
              <TabsTrigger value="security">
                Security ({issuesByType.security?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="performance">
                Performance ({issuesByType.performance?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="quality">
                Quality ({issuesByType.quality?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="maintenance">
                Maintenance ({issuesByType.maintenance?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[500px]">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </ScrollArea>
            </TabsContent>

            {Object.entries(issuesByType).map(([type, typeIssues]) => (
              <TabsContent key={type} value={type}>
                <ScrollArea className="h-[500px]">
                  {typeIssues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}