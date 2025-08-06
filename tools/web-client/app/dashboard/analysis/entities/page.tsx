'use client';

import React, { useState, useMemo } from 'react';
import { useAnalysis, type Entity } from '@/lib/contexts/analysis-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
// Tabs components available for future features
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { EntityTypeChart } from '@/components/analysis/entity-type-chart';
import { ComplexityMetrics } from '@/components/analysis/complexity-metrics';
import { EntityRelationshipGraph } from '@/components/analysis/entity-relationship-graph';
import { EntityDetailsTable } from '@/components/analysis/entity-details-table';
import { EntityExportModal } from '@/components/analysis/entity-export-modal';
// Entity type imported but used via data?.entities
// import type { Entity } from '@/lib/contexts/analysis-context';

interface EntityFilters {
  search: string;
  type: string;
  complexity: string;
  file: string;
  exportType: string;
}

export default function EntitiesAnalysisPage() {
  const { data, loading, error, loadSampleData } = useAnalysis();
  const [filters, setFilters] = useState<EntityFilters>({
    search: '',
    type: '',
    complexity: '',
    file: '',
    exportType: '',
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedView, setSelectedView] = useState<'table' | 'graph'>('table');

  // Filter and search entities
  const filteredEntities = useMemo(() => {
    if (!data?.entities) return [];

    return data.entities.filter((entity) => {
      const matchesSearch = 
        entity.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        entity.file.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesType = !filters.type || entity.type === filters.type;
      
      const matchesComplexity = !filters.complexity || (() => {
        const complexity = entity.complexity || 0;
        switch (filters.complexity) {
          case 'low': return complexity <= 5;
          case 'medium': return complexity > 5 && complexity <= 15;
          case 'high': return complexity > 15;
          default: return true;
        }
      })();
      
      const matchesFile = !filters.file || entity.file.includes(filters.file);
      const matchesExportType = !filters.exportType || entity.exportType === filters.exportType;

      return matchesSearch && matchesType && matchesComplexity && matchesFile && matchesExportType;
    });
  }, [data?.entities, filters]);

  // Entity statistics
  const entityStats = useMemo(() => {
    if (!data?.entities) return null;

    const stats = {
      total: data.entities.length,
      byType: {} as Record<string, number>,
      byComplexity: { low: 0, medium: 0, high: 0, unknown: 0 },
      avgComplexity: 0,
      avgDependencies: 0,
      totalDependencies: 0,
    };

    let complexitySum = 0;
    let complexityCount = 0;
    let dependencySum = 0;

    data.entities.forEach((entity) => {
      // Count by type
      stats.byType[entity.type] = (stats.byType[entity.type] || 0) + 1;

      // Count by complexity
      const complexity = entity.complexity || 0;
      if (complexity === 0) {
        stats.byComplexity.unknown++;
      } else if (complexity <= 5) {
        stats.byComplexity.low++;
      } else if (complexity <= 15) {
        stats.byComplexity.medium++;
      } else {
        stats.byComplexity.high++;
      }

      if (entity.complexity) {
        complexitySum += entity.complexity;
        complexityCount++;
      }

      dependencySum += entity.dependencies.length;
    });

    stats.avgComplexity = complexityCount > 0 ? complexitySum / complexityCount : 0;
    stats.avgDependencies = stats.total > 0 ? dependencySum / stats.total : 0;
    stats.totalDependencies = dependencySum;

    return stats;
  }, [data?.entities]);

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!data?.entities) return { types: [], files: [], exportTypes: [] };

    const types = [...new Set(data.entities.map((e: Entity) => e.type))];
    const files = [...new Set(data.entities.map((e: Entity) => e.file.split('/').pop() || e.file))];
    const exportTypes = [...new Set(data.entities.map((e: Entity) => e.exportType))];

    return { types, files, exportTypes };
  }, [data?.entities]);

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

  const exportData = () => {
    setShowExportModal(true);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Database className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Analysis Data Available</h2>
          <p className="text-muted-foreground max-w-md">
            Upload an analysis report or load sample data to analyze code entities
          </p>
          <Button onClick={loadSampleData}>
            <Database className="mr-2 h-4 w-4" />
            Load Sample Data
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
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
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
                {entityStats.avgComplexity.toFixed(1)}
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
              <div className="text-2xl font-bold">{entityStats.totalDependencies}</div>
              <p className="text-xs text-muted-foreground">
                {entityStats.avgDependencies.toFixed(1)} avg per entity
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
                {"Entities with complexity > 15"}
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