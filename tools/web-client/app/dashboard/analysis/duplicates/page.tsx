"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
// import { Skeleton } from "@/components/ui/skeleton" // Unused import
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Code, Brain, Download, RefreshCw, AlertTriangle, Copy } from "lucide-react"
import type { 
  DuplicateCluster, 
  DuplicateStats,
  DuplicatesAnalysisResponse 
} from '@/app/api/analysis/duplicates/route'
import type { ApiResponse } from '@/types/data'

export default function DuplicatesPage() {
  const [clusters, setClusters] = useState<DuplicateCluster[]>([])
  const [stats, setStats] = useState<DuplicateStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const loadDuplicatesData = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/analysis/duplicates', window.location.origin)
      if (refresh) {
        url.searchParams.set('refresh', 'true')
      }
      if (severityFilter !== 'all') {
        url.searchParams.set('severity', severityFilter)
      }
      if (typeFilter !== 'all') {
        url.searchParams.set('type', typeFilter)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<DuplicatesAnalysisResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load duplicates data')
      }

      setClusters(result.data.clusters)
      setStats(result.data.stats)
    } catch (_error) {
      // Error logged - details available in network tab
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to load data'
      setError(errorMessage)
      setClusters([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [severityFilter, typeFilter])

  const refreshAnalysis = useCallback(() => {
    loadDuplicatesData(true)
  }, [loadDuplicatesData])

  const exportDuplicates = useCallback(() => {
    const data = {
      clusters,
      stats,
      filters: { severityFilter, typeFilter },
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'duplicates-report.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [clusters, stats, severityFilter, typeFilter])

  useEffect(() => {
    loadDuplicatesData()
  }, [loadDuplicatesData])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Analyzing code duplicates...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Analysis Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadDuplicatesData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <EmptyState
        icon={Copy}
        title='No Duplicate Analysis Data'
        description='No duplicate code analysis data available. Run the analysis to identify duplicate code patterns in your codebase.'
        action={{
          label: 'Run Analysis',
          onClick: () => loadDuplicatesData(true),
        }}
      />
    )
  }

  const filteredDuplicates = clusters


  const severityColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    critical: "destructive",
    high: "destructive",
    medium: "secondary",
    low: "outline"
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Duplicate Code Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Found {stats.totalClusters} duplicate clusters affecting {stats.totalDuplicates} code blocks
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAnalysis} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportDuplicates} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="class">Classes</SelectItem>
            <SelectItem value="interface">Interfaces</SelectItem>
            <SelectItem value="function">Functions</SelectItem>
            <SelectItem value="type">Types</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredDuplicates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No duplicates found with current filters
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDuplicates.map((cluster) => (
            <Card key={cluster.hash}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {cluster.entities.length} duplicate {cluster.type}s
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={severityColors[cluster.severity]}>
                      {cluster.severity.toUpperCase()}
                    </Badge>
                    {cluster.structuralMatch && (
                      <Badge variant="outline">
                        <Code className="mr-1 h-3 w-3" />
                        Structural
                      </Badge>
                    )}
                    {cluster.semanticMatch && (
                      <Badge variant="outline">
                        <Brain className="mr-1 h-3 w-3" />
                        Semantic
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cluster.entities.map((entity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{entity.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entity.file}:{entity.line}-{entity.endLine} ({entity.endLine - entity.line + 1} lines)
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Code
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}