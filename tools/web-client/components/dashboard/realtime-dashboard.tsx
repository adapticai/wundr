"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePerformanceData, useQualityMetrics, useGitActivity } from '@/hooks'
import { PerformanceMetrics } from '@/components/visualizations/performance/PerformanceMetrics'
import { CodeQualityRadar } from '@/components/visualizations/quality/CodeQualityRadar'
import { GitActivityHeatmap } from '@/components/visualizations/repository/GitActivityHeatmap'
import { AlertCircle, Activity, GitBranch, Code, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { TimeRange } from '@/types/data'

interface RealtimeDashboardProps {
  defaultRealtime?: boolean
  defaultTimeRange?: TimeRange
}

export function RealtimeDashboard({ 
  defaultRealtime = false, 
  defaultTimeRange = '24h' 
}: RealtimeDashboardProps) {
  const [realtime, setRealtime] = useState(defaultRealtime)
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)

  // Data hooks with real-time capabilities
  const {
    data: performanceData,
    loading: performanceLoading,
    error: performanceError,
    refresh: refreshPerformance,
    latest: latestPerformance
  } = usePerformanceData({
    timeRange,
    realtime,
    autoRefresh: !realtime,
    refreshInterval: 30000
  })

  const {
    data: qualityData,
    loading: qualityLoading,
    error: qualityError,
    refresh: refreshQuality,
    latest: latestQuality,
    trends: qualityTrends
  } = useQualityMetrics({
    timeRange,
    realtime,
    autoRefresh: !realtime,
    refreshInterval: 60000
  })

  const {
    data: gitData,
    loading: gitLoading, 
    error: gitError,
    refresh: refreshGit,
    latest: latestGit,
    stats: gitStats,
    heatmapData
  } = useGitActivity({
    timeRange,
    realtime,
    autoRefresh: !realtime,
    refreshInterval: 300000
  })

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshPerformance(),
      refreshQuality(),
      refreshGit()
    ])
  }

  const isLoading = performanceLoading.isLoading || qualityLoading.isLoading || gitLoading.isLoading
  const isRefreshing = performanceLoading.isRefreshing || qualityLoading.isRefreshing || gitLoading.isRefreshing
  const hasError = performanceError || qualityError || gitError

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and analytics for your development workflow
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant={realtime ? "default" : "outline"}
            size="sm"
            onClick={() => setRealtime(!realtime)}
            className="gap-2"
          >
            {realtime ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {realtime ? 'Live' : 'Static'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <TabsList>
              <TabsTrigger value="1h">1H</TabsTrigger>
              <TabsTrigger value="6h">6H</TabsTrigger>
              <TabsTrigger value="24h">24H</TabsTrigger>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Error display */}
      {hasError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Data Loading Error</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {performanceError?.message || qualityError?.message || gitError?.message}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status indicators */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
            {realtime && (
              <Badge variant="outline" className="animate-pulse ml-2">
                Live
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestPerformance ? `${latestPerformance.buildTime}ms` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Latest build time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Code Quality</CardTitle>
            <Code className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestQuality ? `${latestQuality.testCoverage.toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Test coverage
              {qualityTrends.coverage !== 'stable' && (
                <span className={`ml-1 ${
                  qualityTrends.coverage === 'improving' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {qualityTrends.coverage === 'improving' ? '↑' : '↓'}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Git Activity</CardTitle>
            <GitBranch className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gitStats.totalCommits || '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Total commits ({timeRange})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visualization tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="git">Git Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-4">
          <PerformanceMetrics 
            data={performanceData} 
            realtime={realtime}
          />
        </TabsContent>
        
        <TabsContent value="quality" className="space-y-4">
          <CodeQualityRadar 
            data={qualityData}
            trends={qualityTrends}
          />
        </TabsContent>
        
        <TabsContent value="git" className="space-y-4">
          <GitActivityHeatmap 
            data={gitData}
            heatmapData={heatmapData}
            stats={gitStats}
          />
        </TabsContent>
      </Tabs>

      {/* Loading state */}
      {isLoading && (
        <div className="fixed bottom-4 right-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading data...
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
