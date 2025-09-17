"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Package, 
  AlertTriangle, 
  FileText, 
  Download,
  RefreshCw,
  GitBranch,
  Clock,
  HardDrive
} from "lucide-react"
import { DependencyGraph } from "@/components/analysis/dependency-graph"
import { PackageVersionChart } from "@/components/analysis/package-version-chart"
import { SecurityVulnerabilityReport } from "@/components/analysis/security-vulnerability-report"
import { DependencySizeAnalyzer } from "@/components/analysis/dependency-size-analyzer"
import { OutdatedPackagesTable } from "@/components/analysis/outdated-packages-table"

import type { 
  DependencyData, 
  SecurityVulnerability, 
  DependencyStats,
  DependencyAnalysisResponse 
} from '@/app/api/analysis/dependencies/route'
import type { ApiResponse } from '@/types/data'

export default function DependenciesAnalysisPage() {
  const [dependencies, setDependencies] = useState<DependencyData[]>([])
  const [vulnerabilities, setVulnerabilities] = useState<SecurityVulnerability[]>([])
  const [stats, setStats] = useState<DependencyStats>({
    total: 0,
    outdated: 0,
    vulnerable: 0,
    totalSize: 0,
    directDependencies: 0,
    devDependencies: 0,
    peerDependencies: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [error, setError] = useState<string | null>(null)

  const loadDependencyData = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/analysis/dependencies', window.location.origin)
      if (refresh) {
        url.searchParams.set('refresh', 'true')
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<DependencyAnalysisResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load dependency data')
      }

      setDependencies(result.data.dependencies)
      setVulnerabilities(result.data.vulnerabilities)
      setStats(result.data.stats)
    } catch (_error) {
      // Error logged - details available in network tab
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to load dependency data'
      setError(errorMessage)
      // Set empty data on error to avoid undefined state
      setDependencies([])
      setVulnerabilities([])
      setStats({
        total: 0,
        outdated: 0,
        vulnerable: 0,
        totalSize: 0,
        directDependencies: 0,
        devDependencies: 0,
        peerDependencies: 0
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDependencyData()
  }, [loadDependencyData])

  const refreshAnalysis = useCallback(() => {
    loadDependencyData(true)
  }, [loadDependencyData])

  const exportData = useCallback(() => {
    const data = {
      dependencies,
      vulnerabilities,
      stats,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dependency-analysis.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [dependencies, vulnerabilities, stats])

  const filteredDependencies = dependencies.filter(dep => {
    const matchesSearch = dep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dep.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || dep.type === filterType
    const matchesSeverity = severityFilter === "all" || 
                           (severityFilter === "vulnerable" && dep.vulnerabilities > 0) ||
                           (severityFilter === "outdated" && dep.version !== dep.latestVersion)
    
    return matchesSearch && matchesType && matchesSeverity
  })

  const sortedDependencies = [...filteredDependencies].sort((a, b) => {
    let aVal: string | number = a[sortBy as keyof DependencyData] as string | number
    let bVal: string | number = b[sortBy as keyof DependencyData] as string | number
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortOrder === "asc" ? comparison : -comparison
  })

  // Function to get severity color (currently unused but may be needed for future features)
  // const getSeverityColor = (severity: string) => {
  //   switch (severity) {
  //     case 'critical': return 'bg-red-500'
  //     case 'high': return 'bg-orange-500'
  //     case 'moderate': return 'bg-yellow-500'
  //     case 'low': return 'bg-blue-500'
  //     default: return 'bg-gray-500'
  //   }
  // }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Analyzing dependencies...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Analysis Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadDependencyData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dependencies Analysis</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis of project dependencies, versions, and security vulnerabilities
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAnalysis} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dependencies</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.directDependencies} direct, {stats.devDependencies} dev
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outdated Packages</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.outdated}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.outdated / stats.total) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vulnerabilities</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.vulnerable}</div>
            <p className="text-xs text-muted-foreground">
              {vulnerabilities.length} security issues found
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
            <p className="text-xs text-muted-foreground">
              Bundle impact analysis
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="graph">Dependency Graph</TabsTrigger>
          <TabsTrigger value="versions">Version Analysis</TabsTrigger>
          <TabsTrigger value="security">Security Report</TabsTrigger>
          <TabsTrigger value="size">Size Analysis</TabsTrigger>
          <TabsTrigger value="outdated">Outdated Packages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Search and Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Filter & Search Dependencies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search dependencies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="dependency">Dependencies</SelectItem>
                    <SelectItem value="devDependency">Dev Dependencies</SelectItem>
                    <SelectItem value="peerDependency">Peer Dependencies</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="vulnerable">Vulnerable</SelectItem>
                    <SelectItem value="outdated">Outdated</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="version">Version</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="vulnerabilities">Vulnerabilities</SelectItem>
                    <SelectItem value="weeklyDownloads">Popularity</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Dependencies List */}
          <Card>
            <CardHeader>
              <CardTitle>Dependencies ({filteredDependencies.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedDependencies.map((dep) => (
                  <div key={dep.name} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{dep.name}</h3>
                          <Badge variant="outline">{dep.type}</Badge>
                          {dep.vulnerabilities > 0 && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {dep.vulnerabilities} vulnerabilities
                            </Badge>
                          )}
                          {dep.version !== dep.latestVersion && (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Update available
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{dep.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Current: {dep.version}</span>
                          {dep.version !== dep.latestVersion && (
                            <span className="text-blue-600">Latest: {dep.latestVersion}</span>
                          )}
                          <span>Size: {formatBytes(dep.size)}</span>
                          <span>Downloads: {formatNumber(dep.weeklyDownloads)}/week</span>
                          <span>License: {dep.license}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {dep.repositoryUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={dep.repositoryUrl} target="_blank" rel="noopener noreferrer">
                              <GitBranch className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {dep.homepageUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={dep.homepageUrl} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph">
          <DependencyGraph dependencies={dependencies} />
        </TabsContent>

        <TabsContent value="versions">
          <PackageVersionChart dependencies={dependencies} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityVulnerabilityReport 
            vulnerabilities={vulnerabilities} 
            dependencies={dependencies}
          />
        </TabsContent>

        <TabsContent value="size">
          <DependencySizeAnalyzer dependencies={dependencies} />
        </TabsContent>

        <TabsContent value="outdated">
          <OutdatedPackagesTable dependencies={dependencies} />
        </TabsContent>
      </Tabs>
    </div>
  )
}