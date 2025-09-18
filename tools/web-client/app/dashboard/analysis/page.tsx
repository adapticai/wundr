'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Code,
  Copy,
  GitBranch,
  Network,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileCode,
  Database,
  Activity,
  Target,
} from 'lucide-react';
import { SummaryCard } from '@/components/dashboard/summary-card';
import type { ApiResponse } from '@/types/data';

interface AnalysisSummary {
  entities: {
    total: number;
    averageComplexity: number;
    highComplexityCount: number;
  };
  duplicates: {
    totalClusters: number;
    totalDuplicates: number;
    criticalClusters: number;
  };
  dependencies: {
    total: number;
    outdated: number;
    vulnerable: number;
    circularCount: number;
  };
  circular: {
    totalDependencies: number;
    circularDependencies: number;
    criticalIssues: number;
    healthScore: number;
  };
}

export default function AnalysisOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);

  const loadAnalysisSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load data from all analysis endpoints concurrently
      const [entitiesRes, duplicatesRes, dependenciesRes, circularRes] = await Promise.all([
        fetch('/api/analysis/entities').catch(() => null),
        fetch('/api/analysis/duplicates').catch(() => null),
        fetch('/api/analysis/dependencies').catch(() => null),
        fetch('/api/analysis/circular').catch(() => null),
      ]);

      const summaryData: AnalysisSummary = {
        entities: { total: 0, averageComplexity: 0, highComplexityCount: 0 },
        duplicates: { totalClusters: 0, totalDuplicates: 0, criticalClusters: 0 },
        dependencies: { total: 0, outdated: 0, vulnerable: 0, circularCount: 0 },
        circular: { totalDependencies: 0, circularDependencies: 0, criticalIssues: 0, healthScore: 100 },
      };

      // Process entities data
      if (entitiesRes?.ok) {
        try {
          const entitiesData = await entitiesRes.json();
          if (entitiesData.success && entitiesData.data?.stats) {
            summaryData.entities = {
              total: entitiesData.data.stats.total || 0,
              averageComplexity: entitiesData.data.stats.averages?.complexity || 0,
              highComplexityCount: entitiesData.data.stats.byComplexity?.high || 0,
            };
          }
        } catch (_e) {
          // Failed to parse entities data - using fallback
        }
      }

      // Process duplicates data
      if (duplicatesRes?.ok) {
        try {
          const duplicatesData = await duplicatesRes.json();
          if (duplicatesData.success && duplicatesData.data?.stats) {
            summaryData.duplicates = {
              totalClusters: duplicatesData.data.stats.totalClusters || 0,
              totalDuplicates: duplicatesData.data.stats.totalDuplicates || 0,
              criticalClusters: duplicatesData.data.clusters?.filter((c: any) => 'severity' in c && c.severity === 'critical').length || 0,
            };
          }
        } catch (_e) {
          // Failed to parse duplicates data - using fallback
        }
      }

      // Process dependencies data
      if (dependenciesRes?.ok) {
        try {
          const dependenciesData = await dependenciesRes.json();
          if (dependenciesData.success && dependenciesData.data?.stats) {
            summaryData.dependencies = {
              total: dependenciesData.data.stats.total || 0,
              outdated: dependenciesData.data.stats.outdated || 0,
              vulnerable: dependenciesData.data.stats.vulnerable || 0,
              circularCount: 0, // This will be filled from circular analysis
            };
          }
        } catch (_e) {
          // Failed to parse dependencies data - using fallback
        }
      }

      // Process circular dependencies data
      if (circularRes?.ok) {
        try {
          const circularData = await circularRes.json();
          if (circularData.success && circularData.data) {
            const circularDeps = circularData.data.circularDependencies || [];
            summaryData.circular = {
              totalDependencies: circularData.data.nodes?.length || 0,
              circularDependencies: circularDeps.length,
              criticalIssues: circularDeps.filter((dep: any) => dep.severity === 'critical').length,
              healthScore: Math.max(0, 100 - (circularDeps.length * 10)),
            };
            // Update circular count in dependencies
            summaryData.dependencies.circularCount = circularDeps.length;
          }
        } catch (_e) {
          // Failed to parse circular dependencies data - using fallback
        }
      }

      setSummary(summaryData);
    } catch (_error) {
      // Error loading analysis summary
      setError('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalysisSummary();
  }, [loadAnalysisSummary]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
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
          <Button onClick={loadAnalysisSummary}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Database className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Analysis Data Available</h2>
          <p className="text-muted-foreground max-w-md">
            Run the analysis first to see detailed insights about your codebase
          </p>
          <Button onClick={loadAnalysisSummary}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Load Analysis Data
          </Button>
        </div>
      </div>
    );
  }

  const analysisModules = [
    {
      title: 'Entity Analysis',
      description: 'Analyze code entities, their complexity, and relationships',
      href: '/dashboard/analysis/entities',
      icon: Code,
      stats: [
        { label: 'Total Entities', value: summary.entities.total },
        { label: 'Avg Complexity', value: summary.entities.averageComplexity.toFixed(1) },
        { label: 'High Complexity', value: summary.entities.highComplexityCount },
      ],
      color: 'blue',
      status: summary.entities.highComplexityCount > 0 ? 'warning' : 'success',
    },
    {
      title: 'Duplicate Detection',
      description: 'Find and analyze duplicate code patterns across your codebase',
      href: '/dashboard/analysis/duplicates',
      icon: Copy,
      stats: [
        { label: 'Total Clusters', value: summary.duplicates.totalClusters },
        { label: 'Duplicates Found', value: summary.duplicates.totalDuplicates },
        { label: 'Critical Issues', value: summary.duplicates.criticalClusters },
      ],
      color: 'orange',
      status: summary.duplicates.criticalClusters > 0 ? 'critical' : 
              summary.duplicates.totalClusters > 0 ? 'warning' : 'success',
    },
    {
      title: 'Dependencies',
      description: 'Comprehensive analysis of project dependencies and versions',
      href: '/dashboard/analysis/dependencies',
      icon: Network,
      stats: [
        { label: 'Total Dependencies', value: summary.dependencies.total },
        { label: 'Outdated', value: summary.dependencies.outdated },
        { label: 'Vulnerabilities', value: summary.dependencies.vulnerable },
      ],
      color: 'green',
      status: summary.dependencies.vulnerable > 0 ? 'critical' :
              summary.dependencies.outdated > 0 ? 'warning' : 'success',
    },
    {
      title: 'Circular Dependencies',
      description: 'Detect and resolve circular dependencies in your codebase',
      href: '/dashboard/analysis/circular',
      icon: GitBranch,
      stats: [
        { label: 'Total Modules', value: summary.circular.totalDependencies },
        { label: 'Circular Issues', value: summary.circular.circularDependencies },
        { label: 'Health Score', value: `${summary.circular.healthScore}%` },
      ],
      color: 'purple',
      status: summary.circular.criticalIssues > 0 ? 'critical' :
              summary.circular.circularDependencies > 0 ? 'warning' : 'success',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical': return <Badge variant="destructive">Issues Found</Badge>;
      case 'warning': return <Badge variant="secondary">Needs Attention</Badge>;
      case 'success': return <Badge variant="outline" className="text-green-600 border-green-200">Healthy</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Code Analysis Overview</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis of your codebase including entities, duplicates, dependencies, and architecture
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAnalysisSummary} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Entities"
          value={summary.entities.total}
          icon={FileCode}
          description="Code entities analyzed"
        />
        <SummaryCard
          title="Duplicate Clusters"
          value={summary.duplicates.totalClusters}
          icon={Copy}
          variant={summary.duplicates.criticalClusters > 0 ? "critical" : "default"}
          description="Duplicate code patterns"
        />
        <SummaryCard
          title="Dependencies"
          value={summary.dependencies.total}
          icon={Network}
          variant={summary.dependencies.vulnerable > 0 ? "critical" : 
                   summary.dependencies.outdated > 0 ? "warning" : "default"}
          description="Project dependencies"
        />
        <SummaryCard
          title="Circular Issues"
          value={summary.circular.circularDependencies}
          icon={Target}
          variant={summary.circular.criticalIssues > 0 ? "critical" : "default"}
          description="Circular dependencies"
        />
      </div>

      {/* Analysis Modules */}
      <div className="grid gap-6 md:grid-cols-2">
        {analysisModules.map((module) => (
          <Card key={module.href} className="group hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${module.color}-100`}>
                    <module.icon className={`h-5 w-5 text-${module.color}-600`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {module.description}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(module.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Module Stats */}
              <div className="grid grid-cols-3 gap-4">
                {module.stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className={`text-lg font-bold ${getStatusColor(module.status)}`}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Action Button */}
              <div className="pt-2">
                <Button asChild className="w-full group-hover:bg-primary/90 transition-colors">
                  <Link href={module.href}>
                    <Activity className="mr-2 h-4 w-4" />
                    View Analysis
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            System Health Overview
          </CardTitle>
          <CardDescription>
            Overall health metrics across all analysis categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summary.entities.total > 0 ? 
                  Math.round((1 - summary.entities.highComplexityCount / summary.entities.total) * 100) : 100}%
              </div>
              <div className="text-sm text-muted-foreground">Code Quality</div>
              <div className="text-xs text-muted-foreground mt-1">
                Based on complexity metrics
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {summary.duplicates.totalClusters > 0 ? 
                  Math.max(0, 100 - (summary.duplicates.totalClusters * 5)) : 100}%
              </div>
              <div className="text-sm text-muted-foreground">Maintainability</div>
              <div className="text-xs text-muted-foreground mt-1">
                Based on duplicate analysis
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {summary.dependencies.total > 0 ?
                  Math.round((1 - (summary.dependencies.vulnerable + summary.dependencies.outdated) / summary.dependencies.total) * 100) : 100}%
              </div>
              <div className="text-sm text-muted-foreground">Security</div>
              <div className="text-xs text-muted-foreground mt-1">
                Based on dependency analysis
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {summary.circular.healthScore}%
              </div>
              <div className="text-sm text-muted-foreground">Architecture</div>
              <div className="text-xs text-muted-foreground mt-1">
                Based on circular dependencies
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Recommendations:</strong>
              </p>
              <ul className="space-y-1 list-disc list-inside">
                {summary.entities.highComplexityCount > 0 && (
                  <li>Consider refactoring {summary.entities.highComplexityCount} high-complexity entities</li>
                )}
                {summary.duplicates.criticalClusters > 0 && (
                  <li>Address {summary.duplicates.criticalClusters} critical duplicate code clusters</li>
                )}
                {summary.dependencies.vulnerable > 0 && (
                  <li>Update {summary.dependencies.vulnerable} vulnerable dependencies</li>
                )}
                {summary.circular.circularDependencies > 0 && (
                  <li>Resolve {summary.circular.circularDependencies} circular dependency issues</li>
                )}
                {summary.entities.highComplexityCount === 0 && 
                 summary.duplicates.criticalClusters === 0 && 
                 summary.dependencies.vulnerable === 0 && 
                 summary.circular.circularDependencies === 0 && (
                  <li>Your codebase is in excellent health! Consider running regular analysis to maintain quality.</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}