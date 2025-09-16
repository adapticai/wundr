"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  HardDrive, 
  Package, 
  TrendingUp, 
  Download,
  AlertTriangle,
  Zap,
  BarChart3,
  PieChart,
  Target,
  Layers
} from "lucide-react"

import {
  formatBytes,
  exportToCSV,
  exportToJSON,
  type JSONExportOptions,
  type CSVExportOptions
} from '@/lib/utils'
import type { DependencyData } from '@/app/api/analysis/dependencies/route'

interface DependencySizeAnalyzerProps {
  dependencies: DependencyData[]
}

interface SizeAnalysis {
  package: string
  size: number
  type: string
  percentage: number
  sizeCategory: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
  impactScore: number
  recommendation: string
  alternatives?: string[]
}

interface BundleImpact {
  totalSize: number
  dependencies: number
  devDependencies: number
  peerDependencies: number
  largestPackages: SizeAnalysis[]
  bundleSizeEstimate: number
  gzipEstimate: number
}

interface SizeDistribution {
  range: string
  count: number
  totalSize: number
  percentage: number
}

export function DependencySizeAnalyzer({ dependencies: initialDependencies }: DependencySizeAnalyzerProps) {
  const [dependencies, setDependencies] = useState<DependencyData[]>(initialDependencies || [])
  const [sizeAnalysis, setSizeAnalysis] = useState<SizeAnalysis[]>([])
  const [bundleImpact, setBundleImpact] = useState<BundleImpact | null>(null)
  const [sizeDistribution, setSizeDistribution] = useState<SizeDistribution[]>([])
  const [filterType, setFilterType] = useState("all")
  const [sortBy, setSortBy] = useState("size")
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (dependencies.length > 0) {
      analyzeDependencySizes()
    } else {
      loadRealDependencies()
    }
  }, [])

  useEffect(() => {
    if (dependencies.length > 0) {
      analyzeDependencySizes()
    }
  }, [dependencies])

  const loadRealDependencies = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Mock data - in production this would parse package.json files
      const packages: any[] = []
      
      // Mock download statistics
      const downloadStats: any = {}
      
      const enrichedDependencies: DependencyData[] = packages.map(pkg => ({
        ...pkg,
        size: pkg.size || 0,
        weeklyDownloads: downloadStats[pkg.name] || 0
      }))
      
      setDependencies(enrichedDependencies)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dependencies')
    } finally {
      setLoading(false)
    }
  }

  const analyzeDependencySizes = () => {
    const totalSize = dependencies.reduce((sum, dep) => sum + (dep.size || 0), 0)
    
    // Analyze individual packages
    const analysis: SizeAnalysis[] = dependencies.map(dep => {
      const percentage = (dep.size / totalSize) * 100
      const sizeCategory = getSizeCategory(dep.size)
      const impactScore = calculateImpactScore(dep)
      const recommendation = getRecommendation(dep, sizeCategory, impactScore)
      const alternatives = getAlternatives(dep.name, sizeCategory)

      return {
        package: dep.name,
        size: dep.size,
        type: dep.type,
        percentage,
        sizeCategory,
        impactScore,
        recommendation,
        alternatives
      }
    })

    // Sort by size (largest first)
    analysis.sort((a, b) => b.size - a.size)
    setSizeAnalysis(analysis)

    // Calculate bundle impact
    const depSizes = dependencies.filter(d => d.type === 'dependency').reduce((sum, d) => sum + d.size, 0)
    const devDepSizes = dependencies.filter(d => d.type === 'devDependency').reduce((sum, d) => sum + d.size, 0)
    const peerDepSizes = dependencies.filter(d => d.type === 'peerDependency').reduce((sum, d) => sum + d.size, 0)

    setBundleImpact({
      totalSize,
      dependencies: depSizes,
      devDependencies: devDepSizes,
      peerDependencies: peerDepSizes,
      largestPackages: analysis.slice(0, 10),
      bundleSizeEstimate: depSizes * 0.7, // Estimate after tree shaking
      gzipEstimate: depSizes * 0.3 // Estimate after gzip compression
    })

    // Calculate size distribution
    calculateSizeDistribution(analysis)
  }

  const getSizeCategory = (size: number): 'tiny' | 'small' | 'medium' | 'large' | 'huge' => {
    if (size < 50000) return 'tiny'        // < 50KB
    if (size < 500000) return 'small'      // < 500KB
    if (size < 2000000) return 'medium'    // < 2MB
    if (size < 10000000) return 'large'    // < 10MB
    return 'huge'                          // >= 10MB
  }

  const calculateImpactScore = (dep: DependencyData): number => {
    let score = 0
    
    // Size impact (0-50 points)
    score += Math.min((dep.size / 1000000) * 10, 50) // 10 points per MB, max 50
    
    // Type impact
    if (dep.type === 'dependency') score += 30      // Production dependency
    else if (dep.type === 'devDependency') score += 5  // Dev dependency
    else score += 10                                 // Peer dependency
    
    // Popularity factor (higher downloads = more stable, lower impact)
    const popularityFactor = Math.min(dep.weeklyDownloads / 1000000, 1) // Normalize to 0-1
    score *= (1 - popularityFactor * 0.3) // Reduce score by up to 30% for popular packages
    
    return Math.round(score)
  }

  const getRecommendation = (dep: DependencyData, category: string, impactScore: number): string => {
    if (category === 'huge' && dep.type === 'dependency') {
      return 'Critical: Consider lighter alternatives or lazy loading'
    } else if (category === 'large' && impactScore > 60) {
      return 'High: Review necessity and explore alternatives'
    } else if (category === 'medium' && impactScore > 40) {
      return 'Medium: Monitor usage and consider optimization'
    } else if (category === 'small' || category === 'tiny') {
      return 'Low: Size impact acceptable'
    }
    return 'Review: Assess if package provides sufficient value'
  }

  const getAlternatives = (packageName: string, category: string): string[] | undefined => {
    // Mock alternatives data - in real implementation, this would come from a database
    const alternatives: Record<string, string[]> = {
      'lodash': ['ramda', 'date-fns', 'native JS methods'],
      'moment': ['date-fns', 'dayjs', 'luxon'],
      'axios': ['fetch API', 'node-fetch', 'got'],
      'jquery': ['vanilla JS', 'cash-dom', 'zepto'],
      'underscore': ['lodash/fp', 'ramda', 'native JS methods']
    }

    if (category === 'large' || category === 'huge') {
      return alternatives[packageName]
    }
    return undefined
  }

  const calculateSizeDistribution = (analysis: SizeAnalysis[]) => {
    const ranges = [
      { range: '< 50KB (Tiny)', min: 0, max: 50000 },
      { range: '50KB - 500KB (Small)', min: 50000, max: 500000 },
      { range: '500KB - 2MB (Medium)', min: 500000, max: 2000000 },
      { range: '2MB - 10MB (Large)', min: 2000000, max: 10000000 },
      { range: '> 10MB (Huge)', min: 10000000, max: Infinity }
    ]

    const distribution = ranges.map(range => {
      const packages = analysis.filter(pkg => pkg.size >= range.min && pkg.size < range.max)
      const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0)
      const totalProjectSize = analysis.reduce((sum, pkg) => sum + pkg.size, 0)
      
      return {
        range: range.range,
        count: packages.length,
        totalSize,
        percentage: totalProjectSize > 0 ? Math.round((totalSize / totalProjectSize) * 100) : 0
      }
    })

    setSizeDistribution(distribution)
  }

  const handleExport = () => {
    const exportData = sizeAnalysis.map(item => ({
      package: item.package,
      size: item.size,
      sizeFormatted: formatBytes(item.size),
      type: item.type,
      percentage: item.percentage,
      sizeCategory: item.sizeCategory,
      impactScore: item.impactScore,
      recommendation: item.recommendation,
      alternatives: item.alternatives?.join(', ') || ''
    }))
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    exportToJSON({
      summary: bundleImpact,
      analysis: exportData,
      distribution: sizeDistribution,
      exportedAt: new Date().toISOString()
    }, {
      filename: `dependency-size-analysis-${timestamp}.json`,
      pretty: true,
      autoDownload: true
    })
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'tiny': return 'bg-green-500'
      case 'small': return 'bg-blue-500'
      case 'medium': return 'bg-yellow-500'
      case 'large': return 'bg-orange-500'
      case 'huge': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getImpactColor = (score: number) => {
    if (score >= 70) return 'text-red-600'
    if (score >= 50) return 'text-orange-600'
    if (score >= 30) return 'text-yellow-600'
    return 'text-green-600'
  }

  const filteredAnalysis = sizeAnalysis.filter(item => 
    filterType === "all" || item.type === filterType
  )

  const sortedAnalysis = [...filteredAnalysis].sort((a, b) => {
    switch (sortBy) {
      case 'size': return b.size - a.size
      case 'impact': return b.impactScore - a.impactScore
      case 'name': return a.package.localeCompare(b.package)
      case 'percentage': return b.percentage - a.percentage
      default: return 0
    }
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2" />
              Loading dependency analysis...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-semibold mb-2">Error Loading Dependencies</p>
              <p className="text-sm">{error}</p>
              <Button onClick={loadRealDependencies} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Dependency Size Analysis</CardTitle>
              <CardDescription>
                Analyze package sizes, bundle impact, and identify optimization opportunities
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={showRecommendations ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowRecommendations(!showRecommendations)}
              >
                <Target className="h-4 w-4 mr-2" />
                {showRecommendations ? 'Hide' : 'Show'} Recommendations
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport()}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Analysis
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bundle Impact Summary */}
      {bundleImpact && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(bundleImpact.totalSize)}</div>
              <p className="text-xs text-muted-foreground">
                All dependencies combined
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bundle Estimate</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(bundleImpact.bundleSizeEstimate)}</div>
              <p className="text-xs text-muted-foreground">
                After tree shaking
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gzipped Size</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(bundleImpact.gzipEstimate)}</div>
              <p className="text-xs text-muted-foreground">
                Compressed for production
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Largest Package</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bundleImpact.largestPackages[0]?.percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {bundleImpact.largestPackages[0]?.package}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="packages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="packages">Package Analysis</TabsTrigger>
          <TabsTrigger value="distribution">Size Distribution</TabsTrigger>
          <TabsTrigger value="optimization">Optimization Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-4">
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

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="impact">Impact Score</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Package List */}
          <Card>
            <CardHeader>
              <CardTitle>Package Size Analysis ({sortedAnalysis.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedAnalysis.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{item.package}</h3>
                          <Badge className={getCategoryColor(item.sizeCategory) + ' text-white'}>
                            {item.sizeCategory}
                          </Badge>
                          <Badge variant="outline">{item.type}</Badge>
                          <Badge variant="outline" className={getImpactColor(item.impactScore)}>
                            Impact: {item.impactScore}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>Size: {formatBytes(item.size)}</span>
                          <span>Bundle %: {item.percentage.toFixed(2)}%</span>
                        </div>

                        <Progress value={item.percentage} className="h-2 mb-2" />

                        {showRecommendations && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Recommendation: {item.recommendation}
                            </p>
                            {item.alternatives && (
                              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                                Alternatives: {item.alternatives.join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Size Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {sizeDistribution.map((dist, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{dist.range}</span>
                      <span className="text-sm text-muted-foreground">
                        {dist.count} packages ({dist.percentage}%)
                      </span>
                    </div>
                    <Progress value={dist.percentage} className="h-3" />
                    <div className="text-xs text-muted-foreground">
                      Total size: {formatBytes(dist.totalSize)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Contributors */}
          <Card>
            <CardHeader>
              <CardTitle>Top Size Contributors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bundleImpact?.largestPackages.slice(0, 10).map((pkg, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pkg.package}</span>
                        <Badge className={getCategoryColor(pkg.sizeCategory) + ' text-white text-xs'}>
                          {pkg.sizeCategory}
                        </Badge>
                      </div>
                      <Progress value={pkg.percentage} className="h-2 mt-1" />
                    </div>
                    <div className="text-right text-sm ml-4">
                      <div>{formatBytes(pkg.size)}</div>
                      <div className="text-muted-foreground">{pkg.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Optimization Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* High Priority Optimizations */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    High Priority Optimizations
                  </h3>
                  <div className="space-y-3">
                    {sortedAnalysis
                      .filter(item => item.impactScore >= 70)
                      .map((item, index) => (
                        <div key={index} className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">{item.package}</span>
                            <Badge className="bg-red-500 text-white">
                              {formatBytes(item.size)}
                            </Badge>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                            {item.recommendation}
                          </p>
                          {item.alternatives && (
                            <div className="text-sm">
                              <span className="font-medium">Consider: </span>
                              {item.alternatives.join(', ')}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Medium Priority Optimizations */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-yellow-500" />
                    Medium Priority Optimizations
                  </h3>
                  <div className="space-y-3">
                    {sortedAnalysis
                      .filter(item => item.impactScore >= 40 && item.impactScore < 70)
                      .slice(0, 5)
                      .map((item, index) => (
                        <div key={index} className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">{item.package}</span>
                            <Badge className="bg-yellow-500 text-white">
                              {formatBytes(item.size)}
                            </Badge>
                          </div>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            {item.recommendation}
                          </p>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* General Optimization Strategies */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-500" />
                    General Optimization Strategies
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Tree Shaking</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Import only what you need from large libraries
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-sm">
                        import {`{ specific }`} from {`'library'`}
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Dynamic Imports</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Load heavy packages only when needed
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-sm">
                        const lib = await import({`'heavy-lib'`})
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Bundle Analysis</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Use webpack-bundle-analyzer to visualize your bundle
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-sm">
                        npm run build -- --analyze
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">CDN Externals</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Load popular libraries from CDN instead of bundling
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-sm">
                        externals: {'{ react: "React" }'}
                      </div>
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