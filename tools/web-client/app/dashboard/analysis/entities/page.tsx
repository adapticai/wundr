'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Filter,
  Download,
  FileCode,
  BarChart3,
  Network,
  TrendingUp,
  RefreshCw,
  Database,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import type { 
  EntityData, 
  EntityStats,
  EntitiesAnalysisResponse 
} from '@/app/api/analysis/entities/route'
import type { ApiResponse } from '@/types/data'
import { EntityTypeChart } from '@/components/analysis/entity-type-chart';
import { ComplexityMetrics } from '@/components/analysis/complexity-metrics';
import { EntityRelationshipGraph } from '@/components/analysis/entity-relationship-graph';
import { EntityDetailsTable } from '@/components/analysis/entity-details-table';
import { EntityExportModal } from '@/components/analysis/entity-export-modal';
// Entity type imported but used via data?.entities
// import type { Entity } from '@/lib/contexts';

interface EntityFilters {
  search: string;
  type: string;
  complexity: string;
  file: string;
  exportType: string;
}

export default function EntitiesAnalysisPage() {
  const [entities, setEntities] = useState<EntityData[]>([])
  const [stats, setStats] = useState<EntityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<EntityFilters>({
    search: '',
    type: '',
    complexity: '',
    file: '',
    exportType: '',
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedView, setSelectedView] = useState<'table' | 'graph'>('table');

  const loadEntitiesData = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/analysis/entities', window.location.origin)
      if (refresh) {
        url.searchParams.set('refresh', 'true')
      }
      
      // Apply server-side filters for better performance
      if (filters.type && filters.type !== 'all') {
        url.searchParams.set('type', filters.type)
      }
      if (filters.complexity && filters.complexity !== 'all') {
        url.searchParams.set('complexity', filters.complexity)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<EntitiesAnalysisResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load entities data')
      }

      setEntities(result.data.entities)
      setStats(result.data.stats)
    } catch (error) {
      console.error('Error loading entities data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data'
      setError(errorMessage)
      setEntities([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [filters.type, filters.complexity])

  const refreshAnalysis = useCallback(() => {
    loadEntitiesData(true)
  }, [loadEntitiesData])

  useEffect(() => {
    loadEntitiesData()
  }, [loadEntitiesData])

  // Filter and search entities (client-side filtering for search and file filters)
  const filteredEntities = useMemo(() => {
    if (!entities) return [];

    return entities.filter((entity) => {
      const matchesSearch = 
        entity.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        entity.file.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesFile = !filters.file || entity.file.includes(filters.file);
      const matchesExportType = !filters.exportType || entity.exportType === filters.exportType;

      return matchesSearch && matchesFile && matchesExportType;
    });
  }, [entities, filters.search, filters.file, filters.exportType]);

  // Use server-provided stats
  const entityStats = stats;

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!entities) return { types: [], files: [], exportTypes: [] };

    const types = [...new Set(entities.map((e: EntityData) => e.type))];
    const files = [...new Set(entities.map((e: EntityData) => e.file.split('/').pop() || e.file))];
    const exportTypes = [...new Set(entities.map((e: EntityData) => e.exportType))];

    return { types, files, exportTypes };
  }, [entities]);

  const handleFilterChange = (key: keyof EntityFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      type: '',
      complexity: '',
      file: '',
      exportType: '',
    });
  };

  const exportData = useCallback(() => {
    const data = {
      entities: filteredEntities,
      stats: entityStats,
      filters,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'entities-analysis.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredEntities, entityStats, filters]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Analyzing code entities...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Analysis Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadEntitiesData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!entityStats) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Database className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Analysis Data Available</h2>
          <p className="text-muted-foreground max-w-md">
            No entity analysis data found. Please run the analysis first.
          </p>
          <Button onClick={() => loadEntitiesData(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Analysis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entity Analysis</h1>
          <p className="text-muted-foreground">
            Analyze code entities, their complexity, and relationships
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAnalysis} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {entityStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
              <FileCode className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entityStats.total}</div>
              <p className="text-xs text-muted-foreground">
                {filteredEntities.length} filtered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Complexity</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entityStats.averages?.complexity?.toFixed(1) || '0.0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Cyclomatic complexity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entities.reduce((sum, e) => sum + e.dependencies.length, 0)}</div>
              <p className="text-xs text-muted-foreground">
                {entityStats.averages?.dependencies?.toFixed(1) || '0.0'} avg per entity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Complexity</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entityStats.byComplexity.high}</div>
              <p className="text-xs text-muted-foreground">
                Entities with complexity 16-25
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entities..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {filterOptions.types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.complexity} onValueChange={(value) => handleFilterChange('complexity', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All levels</SelectItem>
                <SelectItem value="low">Low (≤5)</SelectItem>
                <SelectItem value="medium">Medium (6-15)</SelectItem>
                <SelectItem value="high">{"High (>15)"}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.file} onValueChange={(value) => handleFilterChange('file', value)}>
              <SelectTrigger>
                <SelectValue placeholder="File" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All files</SelectItem>
                {filterOptions.files.map((file) => (
                  <SelectItem key={file} value={file}>
                    {file}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.exportType} onValueChange={(value) => handleFilterChange('exportType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Export type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All exports</SelectItem>
                {filterOptions.exportTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <EntityTypeChart entities={filteredEntities} />
        <ComplexityMetrics entities={filteredEntities} />
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entity Details</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {filteredEntities.length} entities
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant={selectedView === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedView('table')}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Table
                </Button>
                <Button
                  variant={selectedView === 'graph' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedView('graph')}
                >
                  <Network className="mr-2 h-4 w-4" />
                  Graph
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedView === 'table' ? (
            <EntityDetailsTable entities={filteredEntities} />
          ) : (
            <EntityRelationshipGraph entities={filteredEntities} />
          )}
        </CardContent>
      </Card>

      {/* Export Modal */}
      {showExportModal && (
        <EntityExportModal
          entities={filteredEntities}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}