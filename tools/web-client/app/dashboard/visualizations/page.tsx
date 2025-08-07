"use client"

import { Suspense, useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Activity,
  TrendingUp,
  Database,
  RefreshCw,
  Download,
  Share,
  Fullscreen,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"

// Use real hooks for production data
import { 
  usePerformanceData, 
  useQualityMetrics, 
  useGitActivity
} from "@/hooks"
import { useAnalysisData } from "@/hooks/use-analysis-data"
import { useWebSocket } from "@/hooks/use-websocket"

// Production visualization components
import {
  LazyPerformanceMetrics,
  LazyCodeQualityRadar,
  LazyGitActivityHeatmap,
  LazyDependencyNetwork,
  LazyMetricsTrend,
} from "@/components/visualizations/lazy"

interface VisualizationError {
  component: string
  error: string
  timestamp: string
}

export default function VisualizationsPage() {
  const [activeTab, setActiveTab] = useState("performance")
  const [errors, setErrors] = useState<VisualizationError[]>([])
  const [realtimeUpdates, setRealtimeUpdates] = useState<any>(null)

  // Fetch real production data
  const { data: perfData, loading: perfLoading, error: perfError } = usePerformanceData({ 
    timeRange: '24h',
    refreshInterval: 30000, // 30 seconds
    realtime: true
  })
  
  const { data: qualityData, loading: qualityLoading, error: qualityError } = useQualityMetrics()
  
  const { data: gitData, loading: gitLoading, error: gitError } = useGitActivity({ 
    days: 365
  })

  const { data: analysisData, loading: analysisLoading } = useAnalysisData({
    realtime: true
  })

  // WebSocket for real-time updates
  const { isConnected, subscribe } = useWebSocket({
    enabled: true,
    onMessage: (message) => {
      if (message.type === 'data') {
        setRealtimeUpdates(message.payload)
      }
    },
    onError: (error) => {
      setErrors(prev => [...prev, {
        component: 'WebSocket',
        error: 'Connection error',
        timestamp: new Date().toISOString()
      }])
    }
  })

  useEffect(() => {
    if (isConnected) {
      subscribe('performance')
      subscribe('quality')
      subscribe('dashboard')
    }
  }, [isConnected, subscribe])

  // Collect all errors
  useEffect(() => {
    const newErrors: VisualizationError[] = []
    
    if (perfError) {
      newErrors.push({
        component: 'Performance Metrics',
        error: perfError.message,
        timestamp: new Date().toISOString()
      })
    }
    
    if (qualityError) {
      newErrors.push({
        component: 'Quality Metrics',
        error: qualityError.message,
        timestamp: new Date().toISOString()
      })
    }
    
    if (gitError) {
      newErrors.push({
        component: 'Git Activity',
        error: gitError.message,
        timestamp: new Date().toISOString()
      })
    }
    
    setErrors(newErrors)
  }, [perfError, qualityError, gitError])

  const refreshAll = async () => {
    // Trigger refresh for all data sources
    // Refresh logic would go here
    window.location.reload()
  }

  const exportData = (tabName: string) => {
    let dataToExport: any = null
    
    switch (tabName) {
      case 'performance':
        dataToExport = perfData
        break
      case 'quality':
        dataToExport = qualityData
        break
      case 'repository':
        dataToExport = gitData
        break
      case 'dependencies':
        dataToExport = analysisData?.dependencies
        break
      default:
        return
    }
    
    if (dataToExport) {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tabName}-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Real-time Analytics & Visualizations</h1>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              <Activity className="mr-1 h-3 w-3" />
              {isConnected ? 'Live' : 'Cached'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2">
            Comprehensive analytics and insights for your codebase with real-time updates
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh All
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData(activeTab)}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button variant="outline" size="sm">
            <Share className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {errors.length} visualization error{errors.length > 1 ? 's' : ''} detected. Some charts may not display correctly.
            <Button variant="link" className="p-0 h-auto ml-2" onClick={refreshAll}>
              Retry All
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Status Banner */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {4 - errors.length}/4
            </div>
            <p className="text-xs text-muted-foreground">
              Sources connected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Real-time Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isConnected ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-orange-600">Polling</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Update mechanism
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((perfData?.length || 0) + (qualityData?.length || 0) + (gitData?.length || 0)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total metrics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realtimeUpdates ? 'Live' : 'Cached'}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">
            Performance
            {perfLoading && <span className="ml-1 animate-pulse">•</span>}
          </TabsTrigger>
          <TabsTrigger value="quality">
            Quality
            {qualityLoading && <span className="ml-1 animate-pulse">•</span>}
          </TabsTrigger>
          <TabsTrigger value="repository">
            Repository
            {gitLoading && <span className="ml-1 animate-pulse">•</span>}
          </TabsTrigger>
          <TabsTrigger value="dependencies">
            Dependencies
            {analysisLoading && <span className="ml-1 animate-pulse">•</span>}
          </TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Performance Monitoring
                  {perfLoading && <Skeleton className="h-4 w-4 rounded-full" />}
                </CardTitle>
                <CardDescription>
                  Real-time performance metrics and resource utilization
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={perfError ? 'destructive' : 'default'}>
                  {perfError ? 'Error' : perfData?.length || 0} data points
                </Badge>
                <Button variant="outline" size="sm">
                  <Fullscreen className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {perfError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Failed to Load Performance Data</h3>
                  <p className="text-muted-foreground mb-4">{perfError.message}</p>
                  <Button onClick={refreshAll}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : (
                <Suspense fallback={<PerformanceMetricsSkeleton />}>
                  <LazyPerformanceMetrics 
                    data={perfData || []}
                  />
                </Suspense>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Code Quality Analysis
                  {qualityLoading && <Skeleton className="h-4 w-4 rounded-full" />}
                </CardTitle>
                <CardDescription>
                  Multi-dimensional quality metrics and technical debt tracking
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={qualityError ? 'destructive' : 'default'}>
                  {qualityError ? 'Error' : 'Real-time'}
                </Badge>
                <Button variant="outline" size="sm">
                  <Fullscreen className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {qualityError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Failed to Load Quality Data</h3>
                  <p className="text-muted-foreground mb-4">{qualityError.message}</p>
                  <Button onClick={refreshAll}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : (
                <Suspense fallback={<QualityMetricsSkeleton />}>
                  <LazyCodeQualityRadar 
                    metrics={qualityData?.[qualityData.length - 1] || {
                      maintainability: 0,
                      reliability: 0,
                      security: 0,
                      coverage: 0,
                      duplication: 0,
                      complexity: 0,
                      technicalDebt: 0,
                      documentation: 0
                    }}
                  />
                </Suspense>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repository" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Repository Activity
                  {gitLoading && <Skeleton className="h-4 w-4 rounded-full" />}
                </CardTitle>
                <CardDescription>
                  Git activity patterns and contribution insights
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={gitError ? 'destructive' : 'default'}>
                  {gitError ? 'Error' : gitData?.length || 0} commits
                </Badge>
                <Button variant="outline" size="sm">
                  <Fullscreen className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {gitError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Failed to Load Repository Data</h3>
                  <p className="text-muted-foreground mb-4">{gitError.message}</p>
                  <Button onClick={refreshAll}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : (
                <Suspense fallback={<GitActivitySkeleton />}>
                  <LazyGitActivityHeatmap 
                    activities={gitData || []}
                    days={365}
                  />
                </Suspense>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Dependency Network
                  {analysisLoading && <Skeleton className="h-4 w-4 rounded-full" />}
                </CardTitle>
                <CardDescription>
                  Interactive visualization of module dependencies and relationships
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">
                  {analysisData?.dependencies?.nodes?.length || 0} modules
                </Badge>
                <Button variant="outline" size="sm">
                  <Fullscreen className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {analysisData?.dependencies ? (
                <Suspense fallback={<DependencyNetworkSkeleton />}>
                  <LazyDependencyNetwork 
                    nodes={(analysisData.dependencies.nodes || []).map((node: any) => ({
                      ...node,
                      label: node.name || node.id,
                      dependencies: node.dependencies || []
                    }))}
                    links={(analysisData.dependencies.edges || []).map((edge: any) => ({
                      ...edge,
                      type: edge.type === 'require' ? 'import' : edge.type
                    }))}
                    interactive={true}
                    showLegend={true}
                  />
                </Suspense>
              ) : (
                <div className="text-center py-12">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Dependency Data</h3>
                  <p className="text-muted-foreground mb-4">Run an analysis to view dependency relationships</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Metrics Trends & Patterns</CardTitle>
                <CardDescription>
                  Historical trends, anomaly detection, and predictive insights
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">Multi-source</Badge>
                <Button variant="outline" size="sm">
                  <Fullscreen className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Trend Analysis</h3>
                <p className="text-muted-foreground">Historical trends and pattern analysis across all metrics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Loading skeletons for different visualizations
function PerformanceMetricsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

function QualityMetricsSkeleton() {
  return (
    <div className="flex items-center justify-center">
      <Skeleton className="h-80 w-80 rounded-full" />
    </div>
  )
}

function GitActivitySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(53, 1fr)' }}>
        {[...Array(371)].map((_, i) => (
          <Skeleton key={i} className="h-3 w-3" />
        ))}
      </div>
    </div>
  )
}

function DependencyNetworkSkeleton() {
  return (
    <div className="relative">
      <Skeleton className="h-96 w-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-muted-foreground">Loading network visualization...</div>
      </div>
    </div>
  )
}

function TrendAnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}