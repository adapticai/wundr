'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Overview } from '@/components/dashboard/overview'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ProjectHealth } from '@/components/dashboard/project-health'
import { RealtimeMetrics } from '@/components/dashboard/realtime-metrics'

export default function OverviewPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="health">Project Health</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {/* Metrics Grid */}
          <MetricsGrid />
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Main Overview Chart */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Project Overview</CardTitle>
                <CardDescription>
                  Key metrics and trends over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <Overview />
              </CardContent>
            </Card>
            
            {/* Recent Activity */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest changes and events in your monorepo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecentActivity />
              </CardContent>
            </Card>
          </div>
          
          {/* Quick Actions */}
          <QuickActions />
        </TabsContent>
        
        <TabsContent value="realtime" className="space-y-4">
          <RealtimeMetrics />
        </TabsContent>
        
        <TabsContent value="health" className="space-y-4">
          <ProjectHealth />
        </TabsContent>
      </Tabs>
    </div>
  )
}