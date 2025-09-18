"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { 
  Play,
  Pause,
  Square,
  AlertTriangle,
  Bug,
  Shield,
  Code,
  FileText,
  Download,
  RefreshCw,
  Clock,
  Filter,
  Search,
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Eye,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Info
} from "lucide-react"
import type { ApiResponse } from '@/types/data'

// Scan-specific types
interface ScanConfiguration {
  paths: string[]
  includePatterns: string[]
  excludePatterns: string[]
  scanTypes: {
    codeSmells: boolean
    bugs: boolean
    vulnerabilities: boolean
    duplications: boolean
    complexity: boolean
    coverage: boolean
  }
  severity: ('low' | 'medium' | 'high' | 'critical')[]
  fileTypes: string[]
  maxDepth: number
  timeout: number
}

interface ScanResult {
  id: string
  timestamp: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  configuration: ScanConfiguration
  results: ScanAnalysisResults
  duration: number
  error?: string
}

interface ScanAnalysisResults {
  summary: ScanSummary
  issues: ScanIssue[]
  metrics: ScanMetrics
  files: FileAnalysis[]
  duplications: CodeDuplication[]
}

interface ScanSummary {
  totalFiles: number
  analyzedFiles: number
  linesOfCode: number
  totalIssues: number
  issuesByType: Record<string, number>
  issuesBySeverity: Record<string, number>
  technicalDebt: {
    hours: number
    cost: number
  }
  reliability: number
  maintainability: number
  security: number
}

interface ScanIssue {
  id: string
  type: 'bug' | 'vulnerability' | 'code_smell' | 'duplication' | 'complexity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  description: string
  file: string
  line: number
  column: number
  endLine: number
  endColumn: number
  rule: string
  category: string
  effort: number
  debt: number
  tags: string[]
  quickFix?: {
    available: boolean
    description: string
    action: string
  }
}

interface ScanMetrics {
  complexity: {
    cyclomatic: number
    cognitive: number
    average: number
    distribution: Record<string, number>
  }
  duplication: {
    percentage: number
    lines: number
    blocks: number
    files: number
  }
  coverage: {
    lines: number
    branches: number
    functions: number
    statements: number
  }
  maintainability: {
    index: number
    debt: number
    ratio: number
  }
}

interface FileAnalysis {
  path: string
  name: string
  size: number
  linesOfCode: number
  complexity: number
  issues: number
  coverage: number
  duplications: number
  maintainabilityIndex: number
  lastModified: string
  language: string
}

interface CodeDuplication {
  id: string
  type: 'exact' | 'similar' | 'structural'
  lines: number
  tokens: number
  occurrences: Array<{
    file: string
    startLine: number
    endLine: number
  }>
  similarity: number
}

interface ScanHistory {
  id: string
  timestamp: string
  status: string
  duration: number
  issuesFound: number
  filesScanned: number
}

export default function CodeScanAnalysisPage() {
  // State management
  const [scans, setScans] = useState<ScanResult[]>([])
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Configuration state
  const [config, setConfig] = useState<ScanConfiguration>({
    paths: ['./src', './components', './lib'],
    includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
    scanTypes: {
      codeSmells: true,
      bugs: true,
      vulnerabilities: true,
      duplications: true,
      complexity: true,
      coverage: false
    },
    severity: ['low', 'medium', 'high', 'critical'],
    fileTypes: ['typescript', 'javascript', 'react'],
    maxDepth: 10,
    timeout: 300000
  })

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedFile, setSelectedFile] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("severity")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [showFixable, setShowFixable] = useState(false)

  // Poll scan progress
  const pollScanProgress = useCallback(async (scanId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/analysis/scan/${scanId}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: ApiResponse<ScanResult> = await response.json()

        if (result.success) {
          setCurrentScan(result.data)
          setScans(prev => prev.map(scan =>
            scan.id === scanId ? result.data : scan
          ))

          // Stop polling if scan is complete
          if (result.data.status !== 'running') {
            clearInterval(pollInterval)
          }
        }
      } catch (_error) {
        // Error polling scan progress
        clearInterval(pollInterval)
      }
    }, 2000)

    // Cleanup after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 600000)
  }, [])

  // Load scan data
  const loadScanData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/analysis/scan')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<{ scans: ScanResult[], history: ScanHistory[] }> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load scan data')
      }

      setScans(result.data.scans)
      setScanHistory(result.data.history)

      // Set current scan to the latest running or most recent completed scan
      const runningScans = result.data.scans.filter(s => s.status === 'running')
      if (runningScans.length > 0) {
        setCurrentScan(runningScans[0])
      } else if (result.data.scans.length > 0) {
        setCurrentScan(result.data.scans[0])
      }
    } catch (_error) {
      // Error loading scan data - using fallback
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to load scan data'
      setError(errorMessage)
      setScans([])
      setScanHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Start a new scan
  const startScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start', configuration: config })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<ScanResult> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to start scan')
      }

      setCurrentScan(result.data)
      setScans(prev => [result.data, ...prev])

      // Poll for updates while scan is running
      if (result.data.status === 'running') {
        pollScanProgress(result.data.id)
      }
    } catch (_error) {
      // Error starting scan
      const errorMessage = _error instanceof Error ? _error.message : 'Failed to start scan'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [config, pollScanProgress])

  // Cancel current scan
  const cancelScan = useCallback(async () => {
    if (!currentScan || currentScan.status !== 'running') return

    try {
      const response = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel', scanId: currentScan.id })
      })

      if (response.ok) {
        setCurrentScan(prev => prev ? { ...prev, status: 'cancelled' } : null)
      }
    } catch (_error) {
      // Error cancelling scan
    }
  }, [currentScan])

  // Export scan results
  const exportResults = useCallback(() => {
    if (!currentScan || !currentScan.results) return

    const data = {
      scan: currentScan,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code-scan-${currentScan.id}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentScan])

  // Filter issues
  const filteredIssues = currentScan?.results?.issues?.filter(issue => {
    const matchesSearch = issue.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.file.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.rule.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = selectedSeverity === "all" || issue.severity === selectedSeverity
    const matchesType = selectedType === "all" || issue.type === selectedType
    const matchesFile = selectedFile === "all" || issue.file.includes(selectedFile)
    const matchesFixable = !showFixable || issue.quickFix?.available
    
    return matchesSearch && matchesSeverity && matchesType && matchesFile && matchesFixable
  }) || []

  // Sort issues
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    let aVal: any = a[sortBy as keyof ScanIssue]
    let bVal: any = b[sortBy as keyof ScanIssue]

    if (sortBy === 'severity') {
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
      aVal = severityOrder[a.severity]
      bVal = severityOrder[b.severity]
    }

    if (aVal === undefined || bVal === undefined) return 0
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortOrder === "asc" ? comparison : -comparison
  })

  useEffect(() => {
    loadScanData()
  }, [loadScanData])

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-black'
      case 'low': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4" />
      case 'vulnerability': return <Shield className="h-4 w-4" />
      case 'code_smell': return <Code className="h-4 w-4" />
      case 'duplication': return <FileText className="h-4 w-4" />
      case 'complexity': return <BarChart3 className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled': return <X className="h-4 w-4 text-gray-500" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  if (loading && !currentScan) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading scan data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to Load</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadScanData()}>
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
          <h1 className="text-3xl font-bold">Code Scanning & Analysis</h1>
          <p className="text-muted-foreground">
            Comprehensive static code analysis with issue detection and quality metrics
          </p>
        </div>
        <div className="flex gap-2">
          {currentScan?.status === 'running' ? (
            <Button variant="destructive" onClick={cancelScan}>
              <Square className="h-4 w-4 mr-2" />
              Cancel Scan
            </Button>
          ) : (
            <Button onClick={startScan} disabled={loading}>
              <Play className="h-4 w-4 mr-2" />
              Start New Scan
            </Button>
          )}
          {currentScan && (
            <Button variant="outline" onClick={exportResults}>
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          )}
          <Button variant="outline" onClick={loadScanData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Scan Status */}
      {currentScan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(currentScan.status)}
              Current Scan Status
              {currentScan.status === 'running' && (
                <Badge variant="secondary" className="ml-2">
                  {currentScan.progress}% Complete
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentScan.status === 'running' && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{currentScan.progress}%</span>
                  </div>
                  <Progress value={currentScan.progress} className="w-full" />
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">{currentScan.status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Started</div>
                  <div className="font-medium">
                    {new Date(currentScan.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="font-medium">{formatDuration(currentScan.duration)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Files Analyzed</div>
                  <div className="font-medium">
                    {currentScan.results?.summary?.analyzedFiles || 0}
                  </div>
                </div>
              </div>

              {currentScan.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm mt-1">{currentScan.error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={currentScan?.results ? "results" : "configure"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="results" disabled={!currentScan?.results}>Results</TabsTrigger>
          <TabsTrigger value="issues" disabled={!currentScan?.results}>Issues</TabsTrigger>
          <TabsTrigger value="metrics" disabled={!currentScan?.results}>Metrics</TabsTrigger>
          <TabsTrigger value="files" disabled={!currentScan?.results}>Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure the paths, file types, and analysis options for your scan
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="paths">Scan Paths</Label>
                <Textarea
                  id="paths"
                  placeholder="Enter paths to scan (one per line)"
                  value={config.paths.join('\n')}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    paths: e.target.value.split('\n').filter(p => p.trim())
                  }))}
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="include">Include Patterns</Label>
                  <Textarea
                    id="include"
                    placeholder="**/*.ts, **/*.tsx"
                    value={config.includePatterns.join(', ')}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      includePatterns: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                    }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="exclude">Exclude Patterns</Label>
                  <Textarea
                    id="exclude"
                    placeholder="**/node_modules/**, **/dist/**"
                    value={config.excludePatterns.join(', ')}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      excludePatterns: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                    }))}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>Analysis Types</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  {Object.entries(config.scanTypes).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({
                            ...prev,
                            scanTypes: { ...prev.scanTypes, [key]: checked as boolean }
                          }))
                        }
                      />
                      <Label htmlFor={key} className="capitalize">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxDepth">Max Directory Depth</Label>
                  <Input
                    id="maxDepth"
                    type="number"
                    value={config.maxDepth}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      maxDepth: parseInt(e.target.value) || 10
                    }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={config.timeout / 1000}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      timeout: (parseInt(e.target.value) || 300) * 1000
                    }))}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Overview */}
        <TabsContent value="results" className="space-y-4">
          {currentScan?.results && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{currentScan.results.summary.totalIssues}</div>
                    <p className="text-xs text-muted-foreground">
                      Across {currentScan.results.summary.analyzedFiles} files
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Technical Debt</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{currentScan.results.summary.technicalDebt.hours}h</div>
                    <p className="text-xs text-muted-foreground">
                      ${currentScan.results.summary.technicalDebt.cost.toLocaleString()} estimated cost
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Maintainability</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(currentScan.results.summary.maintainability * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Code maintainability index
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(currentScan.results.summary.security * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Security vulnerability assessment
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Issue Distribution Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Issues by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(currentScan.results.summary.issuesByType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(type)}
                            <span className="capitalize">{type.replace('_', ' ')}</span>
                          </div>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Issues by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(currentScan.results.summary.issuesBySeverity).map(([severity, count]) => (
                        <div key={severity} className="flex items-center justify-between">
                          <Badge className={getSeverityColor(severity)} variant="secondary">
                            {severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          {currentScan?.results && (
            <>
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filter Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-64">
                      <Input
                        placeholder="Search issues..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="bug">Bugs</SelectItem>
                        <SelectItem value="vulnerability">Vulnerabilities</SelectItem>
                        <SelectItem value="code_smell">Code Smells</SelectItem>
                        <SelectItem value="duplication">Duplications</SelectItem>
                        <SelectItem value="complexity">Complexity</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="fixable"
                        checked={showFixable}
                        onCheckedChange={(checked) => setShowFixable(checked as boolean)}
                      />
                      <Label htmlFor="fixable">Quick Fix Available</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issues List */}
              <Card>
                <CardHeader>
                  <CardTitle>Issues ({filteredIssues.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sortedIssues.map((issue) => (
                      <div key={issue.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getTypeIcon(issue.type)}
                              <Badge className={getSeverityColor(issue.severity)} variant="secondary">
                                {issue.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">{issue.rule}</Badge>
                              {issue.quickFix?.available && (
                                <Badge variant="secondary">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Quick Fix
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold mb-1">{issue.message}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{issue.file}:{issue.line}</span>
                              <span>Effort: {issue.effort}min</span>
                              <span>Debt: {issue.debt}min</span>
                            </div>
                            {issue.tags.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {issue.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {issue.quickFix?.available && (
                              <Button variant="outline" size="sm">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          {currentScan?.results?.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Complexity Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between">
                        <span>Cyclomatic Complexity</span>
                        <span className="font-medium">{currentScan.results.metrics.complexity.cyclomatic}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Cognitive Complexity</span>
                        <span className="font-medium">{currentScan.results.metrics.complexity.cognitive}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Average Complexity</span>
                        <span className="font-medium">{currentScan.results.metrics.complexity.average.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Duplication Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between">
                        <span>Duplication Percentage</span>
                        <span className="font-medium">{currentScan.results.metrics.duplication.percentage}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Duplicated Lines</span>
                        <span className="font-medium">{currentScan.results.metrics.duplication.lines}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Duplicate Blocks</span>
                        <span className="font-medium">{currentScan.results.metrics.duplication.blocks}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Coverage Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between">
                        <span>Line Coverage</span>
                        <span className="font-medium">{currentScan.results.metrics.coverage.lines}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Branch Coverage</span>
                        <span className="font-medium">{currentScan.results.metrics.coverage.branches}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Function Coverage</span>
                        <span className="font-medium">{currentScan.results.metrics.coverage.functions}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Maintainability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between">
                        <span>Maintainability Index</span>
                        <span className="font-medium">{currentScan.results.metrics.maintainability.index}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Technical Debt</span>
                        <span className="font-medium">{currentScan.results.metrics.maintainability.debt}h</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>Debt Ratio</span>
                        <span className="font-medium">{(currentScan.results.metrics.maintainability.ratio * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          {currentScan?.results?.files && (
            <Card>
              <CardHeader>
                <CardTitle>File Analysis ({currentScan.results.files.length} files)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentScan.results.files.map((file) => (
                    <div key={file.path} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{file.name}</h3>
                        <Badge variant="outline">{file.language}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{file.path}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Lines:</span> {file.linesOfCode}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Complexity:</span> {file.complexity}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Issues:</span> {file.issues}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Coverage:</span> {file.coverage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scanHistory.map((scan) => (
                  <div key={scan.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(scan.status)}
                          <span className="font-medium capitalize">{scan.status}</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(scan.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Duration: {formatDuration(scan.duration)}</span>
                          <span>Files: {scan.filesScanned}</span>
                          <span>Issues: {scan.issuesFound}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}