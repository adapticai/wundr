"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, RefreshCw, TrendingUp, Clock, Package } from "lucide-react"

interface DependencyData {
  name: string
  version: string
  latestVersion: string
  type: 'dependency' | 'devDependency' | 'peerDependency'
  size: number
  vulnerabilities: number
  lastUpdated: string
  weeklyDownloads: number
}

interface PackageVersionChartProps {
  dependencies: DependencyData[]
}

interface VersionAnalysis {
  package: string
  currentVersion: string
  latestVersion: string
  versionsBehind: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  updateType: 'patch' | 'minor' | 'major'
  daysSinceUpdate: number
  changelogUrl?: string
  migrationGuide?: string
}

interface VersionDistribution {
  range: string
  count: number
  percentage: number
}

export function PackageVersionChart({ dependencies }: PackageVersionChartProps) {
  const [versionAnalysis, setVersionAnalysis] = useState<VersionAnalysis[]>([])
  const [versionDistribution, setVersionDistribution] = useState<VersionDistribution[]>([])
  const [filterType, setFilterType] = useState("all")
  const [sortBy, setSortBy] = useState("risk")
  const [riskFilter, setRiskFilter] = useState("all")

  useEffect(() => {
    analyzeVersions()
  }, [dependencies, analyzeVersions])

  const analyzeVersions = useCallback(() => {
    const analysis: VersionAnalysis[] = dependencies.map(dep => {
      const current = parseVersion(dep.version)
      const latest = parseVersion(dep.latestVersion)
      
      const versionsBehind = calculateVersionsBehind(current, latest)
      const updateType = getUpdateType(current, latest)
      const riskLevel = calculateRiskLevel(versionsBehind, updateType, dep.lastUpdated)
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(dep.lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        package: dep.name,
        currentVersion: dep.version,
        latestVersion: dep.latestVersion,
        versionsBehind,
        riskLevel,
        updateType,
        daysSinceUpdate,
        changelogUrl: `https://github.com/search?q=${dep.name}+changelog&type=repositories`,
        migrationGuide: updateType === 'major' ? `https://github.com/search?q=${dep.name}+migration+guide&type=repositories` : undefined
      }
    })

    setVersionAnalysis(analysis)
    calculateVersionDistribution(analysis)
  }, [dependencies])

  const parseVersion = (version: string) => {
    const clean = version.replace(/[^0-9.]/g, '')
    const parts = clean.split('.').map(Number)
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    }
  }

  const calculateVersionsBehind = (current: any, latest: any) => {
    if (latest.major > current.major) return latest.major - current.major
    if (latest.minor > current.minor) return latest.minor - current.minor
    if (latest.patch > current.patch) return latest.patch - current.patch
    return 0
  }

  const getUpdateType = (current: any, latest: any): 'patch' | 'minor' | 'major' => {
    if (latest.major > current.major) return 'major'
    if (latest.minor > current.minor) return 'minor'
    return 'patch'
  }

  const calculateRiskLevel = (versionsBehind: number, updateType: string, lastUpdated: string): 'low' | 'medium' | 'high' | 'critical' => {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
    
    if (versionsBehind === 0) return 'low'
    if (updateType === 'major' && versionsBehind > 2) return 'critical'
    if (daysSinceUpdate > 365) return 'critical'
    if (updateType === 'major' || daysSinceUpdate > 180) return 'high'
    if (versionsBehind > 5 || daysSinceUpdate > 90) return 'medium'
    return 'low'
  }

  const calculateVersionDistribution = (analysis: VersionAnalysis[]) => {
    const distribution = {
      'Up to date': 0,
      '1-3 versions behind': 0,
      '4-10 versions behind': 0,
      '10+ versions behind': 0
    }

    analysis.forEach(item => {
      if (item.versionsBehind === 0) distribution['Up to date']++
      else if (item.versionsBehind <= 3) distribution['1-3 versions behind']++
      else if (item.versionsBehind <= 10) distribution['4-10 versions behind']++
      else distribution['10+ versions behind']++
    })

    const total = analysis.length
    const dist: VersionDistribution[] = Object.entries(distribution).map(([range, count]) => ({
      range,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))

    setVersionDistribution(dist)
  }

  const filteredAnalysis = versionAnalysis.filter(item => {
    const matchesType = filterType === "all" || 
      dependencies.find(d => d.name === item.package)?.type === filterType
    const matchesRisk = riskFilter === "all" || item.riskLevel === riskFilter
    return matchesType && matchesRisk
  })

  const sortedAnalysis = [...filteredAnalysis].sort((a, b) => {
    switch (sortBy) {
      case 'risk':
        const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
      case 'versions':
        return b.versionsBehind - a.versionsBehind
      case 'age':
        return b.daysSinceUpdate - a.daysSinceUpdate
      case 'name':
        return a.package.localeCompare(b.package)
      default:
        return 0
    }
  })

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-black'
      case 'low': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case 'major': return 'bg-purple-500 text-white'
      case 'minor': return 'bg-blue-500 text-white'
      case 'patch': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Package Version Analysis</CardTitle>
              <CardDescription>
                Analyze package versions, update requirements, and identify outdated dependencies
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" onClick={analyzeVersions}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Analysis
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Version Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
          <TabsTrigger value="trends">Update Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Version Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Version Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {versionDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-40 text-sm">{item.range}</div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                      <div 
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${item.percentage}%` }}
                      >
                        <span className="text-white text-xs font-medium">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="w-12 text-sm text-right">{item.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['critical', 'high', 'medium', 'low'] as const).map(risk => {
              const count = versionAnalysis.filter(item => item.riskLevel === risk).length
              return (
                <Card key={risk}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{risk} Risk</CardTitle>
                    <div className={`w-3 h-3 rounded-full ${getRiskColor(risk).split(' ')[0]}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{count}</div>
                    <p className="text-xs text-muted-foreground">
                      {versionAnalysis.length > 0 ? Math.round((count / versionAnalysis.length) * 100) : 0}% of packages
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter & Sort</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
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

                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Risk Level</SelectItem>
                    <SelectItem value="versions">Versions Behind</SelectItem>
                    <SelectItem value="age">Days Since Update</SelectItem>
                    <SelectItem value="name">Package Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Package List */}
          <Card>
            <CardHeader>
              <CardTitle>Package Version Details ({sortedAnalysis.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedAnalysis.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{item.package}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getRiskColor(item.riskLevel)}>
                            {item.riskLevel} risk
                          </Badge>
                          <Badge className={getUpdateTypeColor(item.updateType)}>
                            {item.updateType} update
                          </Badge>
                          {item.versionsBehind > 0 && (
                            <Badge variant="outline">
                              {item.versionsBehind} versions behind
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>Current: {item.currentVersion}</div>
                        <div>Latest: {item.latestVersion}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Last Updated
                        </div>
                        <div>{item.daysSinceUpdate} days ago</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          Update Type
                        </div>
                        <div className="capitalize">{item.updateType}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          Versions Behind
                        </div>
                        <div>{item.versionsBehind}</div>
                      </div>
                    </div>

                    {(item.changelogUrl || item.migrationGuide) && (
                      <div className="flex gap-2 mt-3">
                        {item.changelogUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={item.changelogUrl} target="_blank" rel="noopener noreferrer">
                              View Changelog
                            </a>
                          </Button>
                        )}
                        {item.migrationGuide && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={item.migrationGuide} target="_blank" rel="noopener noreferrer">
                              Migration Guide
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Update Trends & Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Update Priority Matrix */}
                <div>
                  <h3 className="font-semibold mb-4">Update Priority Matrix</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-red-600 mb-2">High Priority Updates</h4>
                      <div className="space-y-2">
                        {sortedAnalysis
                          .filter(item => item.riskLevel === 'critical' || item.riskLevel === 'high')
                          .slice(0, 5)
                          .map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span>{item.package}</span>
                              <Badge className={getRiskColor(item.riskLevel)}>
                                {item.riskLevel}
                              </Badge>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-blue-600 mb-2">Safe to Update</h4>
                      <div className="space-y-2">
                        {sortedAnalysis
                          .filter(item => item.updateType === 'patch' && item.versionsBehind > 0)
                          .slice(0, 5)
                          .map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span>{item.package}</span>
                              <Badge variant="outline">
                                {item.versionsBehind} patches
                              </Badge>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Update Commands */}
                <div>
                  <h3 className="font-semibold mb-4">Suggested Update Commands</h3>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm">
                    <div className="space-y-1">
                      <div># Update all patch versions (safe)</div>
                      <div className="text-blue-600">npm update</div>
                      <div className="mt-3"># Update specific packages</div>
                      {sortedAnalysis
                        .filter(item => item.riskLevel !== 'low')
                        .slice(0, 3)
                        .map((item, index) => (
                          <div key={index} className="text-blue-600">
                            npm install {item.package}@{item.latestVersion}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}