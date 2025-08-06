"use client"

import { Suspense, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardSkeleton } from "@/components/ui/loading/visualization-skeleton"
import { 
  usePerformanceData, 
  useQualityMetrics, 
  useGitActivity 
} from "@/hooks"

// Use lazy loaded components for better performance
import {
  LazyPerformanceMetrics,
  LazyCodeQualityRadar,
  LazyGitActivityHeatmap,
  LazyDependencyNetwork,
  LazyMetricsTrend,
} from "@/components/visualizations/lazy"

// Mock data for demonstration
import { 
  mockNetworkNodes, 
  mockNetworkLinks,
  mockMetricsSeries 
} from "@/__tests__/utils/mock-data"

export default function VisualizationsPage() {
  const [activeTab, setActiveTab] = useState("performance")

  // Fetch real data using hooks
  const { data: perfData, loading: perfLoading } = usePerformanceData({ 
    timeRange: '24h',
    refreshInterval: 30000 // 30 seconds
  })
  
  const { data: qualityData, loading: qualityLoading } = useQualityMetrics()
  
  const { data: gitData, loading: gitLoading } = useGitActivity({ 
    days: 365 
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Visualizations</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive analytics and insights for your codebase
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="repository">Repository</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Monitoring</CardTitle>
              <CardDescription>
                Real-time performance metrics and resource utilization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<DashboardSkeleton />}>
                <LazyPerformanceMetrics 
                  data={perfData || []} 
                  realtime={true}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code Quality Analysis</CardTitle>
              <CardDescription>
                Multi-dimensional quality metrics and technical debt tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<DashboardSkeleton />}>
                <LazyCodeQualityRadar 
                  metrics={qualityData || {
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repository" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Repository Activity</CardTitle>
              <CardDescription>
                Git activity patterns and contribution insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<DashboardSkeleton />}>
                <LazyGitActivityHeatmap 
                  activities={gitData || []}
                  days={365}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Network</CardTitle>
              <CardDescription>
                Interactive visualization of module dependencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<DashboardSkeleton />}>
                <LazyDependencyNetwork 
                  nodes={mockNetworkNodes}
                  links={mockNetworkLinks}
                  interactive={true}
                  showLegend={true}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Metrics Trends</CardTitle>
              <CardDescription>
                Historical trends and anomaly detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<DashboardSkeleton />}>
                <LazyMetricsTrend 
                  series={mockMetricsSeries}
                  enableComparison={true}
                  showAnomalies={true}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}