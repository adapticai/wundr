'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  AnalysisData,
  LoadingState,
  ErrorState,
  ApiResponse,
} from '@/types/data';
import { CompleteAnalysisData } from '@/types/reports';

// Re-export types from analysis-types for backward compatibility
export interface Entity {
  name: string;
  type: string;
  file: string;
  line: number;
  column: number;
  exportType: string;
  complexity?: number;
  dependencies: string[];
  jsDoc?: string;
  signature?: string;
  members?: {
    properties?: Array<{ name: string; type: string; optional?: boolean }>;
    methods?: Array<{ name: string; signature: string }>;
  };
}

export interface DuplicateCluster {
  hash: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  structuralMatch: boolean;
  semanticMatch: boolean;
  entities: Entity[];
}

export interface CircularDependency {
  id: string;
  chain: string[];
  severity: 'critical' | 'high' | 'medium';
  type: 'import' | 'require' | 'dynamic';
}

export interface UnusedExport {
  name: string;
  file: string;
  type: string;
  line: number;
  exportType: 'default' | 'named';
}

export interface WrapperPattern {
  id: string;
  pattern: string;
  files: string[];
  complexity: number;
  suggestions: string[];
}

export interface Recommendation {
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  impact: string;
  estimatedEffort: string;
  suggestion?: string;
  entities?: string[];
}

// Legacy analysis data interface for backward compatibility
export interface LegacyAnalysisData {
  timestamp: string;
  summary: {
    totalFiles: number;
    totalEntities: number;
    duplicateClusters: number;
    circularDependencies: number;
    unusedExports: number;
    codeSmells: number;
  };
  entities: Entity[];
  duplicates: DuplicateCluster[];
  circularDeps: CircularDependency[];
  unusedExports: UnusedExport[];
  wrapperPatterns: WrapperPattern[];
  recommendations: Recommendation[];
}

// Export Duplicate type alias for backward compatibility
export type Duplicate = DuplicateCluster;

// Utility function to convert CompleteAnalysisData (from reports) to AnalysisData
function convertCompleteAnalysisData(
  completeData: CompleteAnalysisData
): AnalysisData {
  return {
    id: `analysis_${Date.now()}`,
    timestamp: completeData.metadata.timestamp.toISOString(),
    version: completeData.metadata.version,
    summary: {
      totalFiles: completeData.metrics.overview.totalFiles,
      totalEntities: completeData.metrics.overview.totalEntities,
      totalLines: completeData.metrics.overview.totalLines,
      duplicateClusters: completeData.duplicates.length,
      circularDependencies: completeData.circularDependencies.length,
      unusedExports: 0, // Will be calculated from entities if needed
      codeSmells: completeData.metrics.issues.total,
      bugs:
        completeData.metrics.issues.bySeverity.critical +
        completeData.metrics.issues.bySeverity.high,
      vulnerabilities: completeData.securityIssues.length,
      technicalDebtHours: Math.round(
        completeData.metrics.quality.technicalDebt.minutes / 60
      ),
      maintainabilityIndex: completeData.metrics.quality.maintainabilityIndex,
      testCoverage: completeData.metrics.quality.testCoverage?.lines || 0,
      lastAnalysis: completeData.metadata.timestamp.toISOString(),
    },
    entities: completeData.entities.map(entity => ({
      id: entity.id,
      name: entity.name,
      path: entity.path,
      type: entity.type as
        | 'class'
        | 'function'
        | 'module'
        | 'component'
        | 'interface',
      dependencies: entity.dependencies,
      complexity: entity.complexity?.cyclomatic || 0,
      size: entity.metrics?.linesOfCode || 0,
      lastModified: entity.lastModified.toISOString(),
      issues: entity.issues.map(issue => ({
        id: issue.id,
        type: issue.type as
          | 'bug'
          | 'vulnerability'
          | 'code_smell'
          | 'duplication'
          | 'complexity',
        severity: issue.severity,
        message: issue.message,
        file: entity.path,
        line: issue.startLine || 0,
        category: issue.type,
        effort: 'medium' as const,
        impact: 'medium' as const,
        tags: [],
      })),
      metrics: {
        maintainability: entity.metrics?.maintainabilityIndex || 0,
        testability: 0,
        reusability: 0,
      },
    })),
    duplicates: completeData.duplicates.map(dup => ({
      id: dup.id,
      type: dup.type as 'structural' | 'exact' | 'similar',
      severity: (dup.severity === 'critical' ? 'high' : dup.severity) as
        | 'low'
        | 'medium'
        | 'high',
      occurrences: dup.occurrences.map(occ => ({
        path: occ.path,
        startLine: occ.startLine,
        endLine: occ.endLine,
      })),
      linesCount: dup.linesCount,
      similarity: dup.similarity,
    })),
    recommendations: completeData.recommendations.map(rec => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      type: rec.category,
      priority: rec.priority,
      category: (rec.category.charAt(0).toUpperCase() +
        rec.category.slice(1)) as
        | 'Security'
        | 'Performance'
        | 'Maintainability'
        | 'Reliability'
        | 'Architecture',
      impact: rec.impact.description,
      estimatedEffort: rec.effort.description,
      suggestion: rec.implementation?.steps.join(' '),
      entities: rec.affectedFiles,
      status: 'pending' as const,
      assignedTo: undefined,
      dueDate: undefined,
      dependencies: [],
      autoFixAvailable: rec.implementation?.automatable || false,
      quickFix: rec.implementation?.automatable
        ? {
            available: true,
            action: 'apply_fix',
            description: 'Automated fix available',
            estimatedTime: '< 1 minute',
          }
        : undefined,
    })),
    dependencies: {
      nodes: [],
      edges: [],
      cycles: [],
      orphans: [],
    },
    metrics: {
      complexity: {
        average: completeData.metrics.complexity.average,
        median: completeData.metrics.complexity.average, // Use average as fallback
        max: completeData.metrics.complexity.highest,
        distribution: {
          low: completeData.metrics.complexity.distribution.low,
          medium: completeData.metrics.complexity.distribution.medium,
          high: completeData.metrics.complexity.distribution.high,
          veryHigh: completeData.metrics.complexity.distribution.veryHigh,
        },
      },
      size: {
        totalLines: completeData.metrics.overview.totalLines,
        codeLines: completeData.metrics.overview.totalLines,
        commentLines: 0,
        blankLines: 0,
      },
      quality: {
        maintainabilityIndex: completeData.metrics.quality.maintainabilityIndex,
        testability: 0,
        reusability: 0,
        reliability: 0,
      },
      debt: {
        totalHours: Math.round(
          completeData.metrics.quality.technicalDebt.minutes / 60
        ),
        breakdown: {},
        trend: 'stable' as const,
      },
    },
    issues: completeData.securityIssues.map(issue => ({
      id: issue.id,
      type: issue.type as
        | 'bug'
        | 'vulnerability'
        | 'code_smell'
        | 'duplication'
        | 'complexity',
      severity: issue.severity,
      message: issue.description,
      file: issue.path,
      line: issue.line || 0,
      category: issue.type,
      effort: 'medium' as const,
      impact: 'high' as const,
      tags: [],
    })),
  };
}

interface AnalysisContextValue {
  // Data state
  data: AnalysisData | LegacyAnalysisData | null;
  loading: boolean;
  error: string | null;

  // Loading states for different operations
  loadingStates: {
    fileUpload: boolean;
    sampleData: boolean;
    apiData: boolean;
    analysis: boolean;
  };

  // Methods for data management
  loadFromFile: (file: File) => Promise<void>;
  loadSampleData: () => Promise<void>;
  loadFromApi: (projectId?: string) => Promise<void>;
  triggerAnalysis: (projectId?: string) => Promise<void>;
  clearData: () => void;
  updateAnalysisData: (
    data: Partial<AnalysisData | LegacyAnalysisData>
  ) => void;

  // State management helpers
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshData: () => Promise<void>;

  // Analysis specific methods
  updateRecommendation: (recommendationId: string, status: string) => void;
  addEntity: (entity: Entity) => void;
  removeEntity: (entityId: string) => void;
  updateEntity: (entityId: string, updates: Partial<Entity>) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

interface AnalysisProviderProps {
  children: React.ReactNode;
  initialData?: AnalysisData | LegacyAnalysisData | null;
  autoLoad?: boolean;
  projectId?: string;
}

export function AnalysisProvider({
  children,
  initialData = null,
  autoLoad = false,
  projectId,
}: AnalysisProviderProps) {
  // Core state
  const [data, setData] = useState<AnalysisData | LegacyAnalysisData | null>(
    initialData
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detailed loading states
  const [loadingStates, setLoadingStates] = useState({
    fileUpload: false,
    sampleData: false,
    apiData: false,
    analysis: false,
  });

  // Refs for cleanup and state management
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to update specific loading state
  const updateLoadingState = useCallback(
    (key: keyof typeof loadingStates, value: boolean) => {
      setLoadingStates(prev => ({ ...prev, [key]: value }));
      setLoading(
        Object.values({ ...loadingStates, [key]: value }).some(Boolean)
      );
    },
    [loadingStates]
  );

  // Load data from uploaded file
  const loadFromFile = useCallback(
    async (file: File) => {
      if (!mountedRef.current) return;

      updateLoadingState('fileUpload', true);
      setError(null);

      try {
        const text = await file.text();
        if (!text.trim()) {
          throw new Error('File is empty');
        }

        const jsonData = JSON.parse(text);

        // Validate basic structure
        if (typeof jsonData !== 'object' || jsonData === null) {
          throw new Error('Invalid JSON structure');
        }

        if (mountedRef.current) {
          setData(jsonData);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load file';
        if (mountedRef.current) {
          setError(`Failed to parse file: ${errorMessage}`);
        }
      } finally {
        if (mountedRef.current) {
          updateLoadingState('fileUpload', false);
        }
      }
    },
    [updateLoadingState]
  );

  // Load sample/test data
  const loadSampleData = useCallback(async () => {
    if (!mountedRef.current) return;

    updateLoadingState('sampleData', true);
    setError(null);

    try {
      // Dynamic import to avoid circular dependencies
      const { createTestFixtures } = await import(
        '../../__tests__/fixtures/real-test-data'
      );
      const fixtures = await createTestFixtures();

      if (mountedRef.current) {
        // Convert CompleteAnalysisData to AnalysisData format
        const convertedData = convertCompleteAnalysisData(
          fixtures.analysisData
        );
        setData(convertedData);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load sample data';
      if (mountedRef.current) {
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        updateLoadingState('sampleData', false);
      }
    }
  }, [updateLoadingState]);

  // Load data from API
  const loadFromApi = useCallback(
    async (apiProjectId?: string) => {
      if (!mountedRef.current) return;

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      updateLoadingState('apiData', true);
      setError(null);

      try {
        const url = apiProjectId
          ? `/api/analysis?projectId=${encodeURIComponent(apiProjectId)}`
          : '/api/analysis';

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: ApiResponse<AnalysisData> = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch analysis data');
        }

        if (mountedRef.current && !controller.signal.aborted) {
          setData(result.data as AnalysisData | LegacyAnalysisData);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Request was cancelled, don't set error
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        if (mountedRef.current) {
          setError(errorMessage);
        }
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          updateLoadingState('apiData', false);
        }

        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [updateLoadingState]
  );

  // Trigger new analysis
  const triggerAnalysis = useCallback(
    async (analysisProjectId?: string) => {
      if (!mountedRef.current) return;

      updateLoadingState('analysis', true);
      setError(null);

      try {
        const response = await fetch('/api/analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'trigger_analysis',
            data: { projectId: analysisProjectId || projectId },
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to trigger analysis: ${response.status}`);
        }

        // Auto-refresh data after analysis
        setTimeout(() => {
          if (mountedRef.current) {
            loadFromApi(analysisProjectId || projectId);
          }
        }, 2000);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to trigger analysis';
        if (mountedRef.current) {
          setError(errorMessage);
        }
      } finally {
        if (mountedRef.current) {
          updateLoadingState('analysis', false);
        }
      }
    },
    [projectId, loadFromApi, updateLoadingState]
  );

  // Clear all data
  const clearData = useCallback(() => {
    setData(null);
    setError(null);
    setLoadingStates({
      fileUpload: false,
      sampleData: false,
      apiData: false,
      analysis: false,
    });
    setLoading(false);
  }, []);

  // Update analysis data (merge with existing)
  const updateAnalysisData = useCallback(
    (updates: Partial<AnalysisData | LegacyAnalysisData>) => {
      setData(prev => {
        if (!prev) return updates as AnalysisData | LegacyAnalysisData;
        return { ...prev, ...updates } as AnalysisData | LegacyAnalysisData;
      });
    },
    []
  );

  // Refresh current data source
  const refreshData = useCallback(async () => {
    if (!data) return;

    // Determine data source and refresh accordingly
    if ('id' in data) {
      // Modern AnalysisData format - use API
      await loadFromApi(projectId);
    } else {
      // Legacy format - reload sample data
      await loadSampleData();
    }
  }, [data, loadFromApi, loadSampleData, projectId]);

  // Update recommendation status
  const updateRecommendation = useCallback(
    (recommendationId: string, status: string) => {
      setData(prev => {
        if (!prev || !('recommendations' in prev)) return prev;

        const updatedRecommendations = prev.recommendations.map((rec: any) =>
          rec.id === recommendationId || rec.description === recommendationId
            ? { ...rec, status }
            : rec
        );

        return {
          ...prev,
          recommendations: updatedRecommendations,
        };
      });
    },
    []
  );

  // Entity management methods
  const addEntity = useCallback((entity: Entity) => {
    setData(prev => {
      if (!prev) return prev;

      const entities = 'entities' in prev ? prev.entities : [];
      return {
        ...prev,
        entities: [...entities, entity],
      } as AnalysisData | LegacyAnalysisData;
    });
  }, []);

  const removeEntity = useCallback((entityId: string) => {
    setData(prev => {
      if (!prev || !('entities' in prev)) return prev;

      const entities = prev.entities.filter(
        (entity: any) => entity.id !== entityId && entity.name !== entityId
      );

      return {
        ...prev,
        entities,
      } as AnalysisData | LegacyAnalysisData;
    });
  }, []);

  const updateEntity = useCallback(
    (entityId: string, updates: Partial<Entity>) => {
      setData(prev => {
        if (!prev || !('entities' in prev)) return prev;

        const entities = prev.entities.map((entity: any) =>
          entity.id === entityId || entity.name === entityId
            ? { ...entity, ...updates }
            : entity
        );

        return {
          ...prev,
          entities,
        } as AnalysisData | LegacyAnalysisData;
      });
    },
    []
  );

  // Auto-load data on mount
  useEffect(() => {
    if (autoLoad && !initialData) {
      loadFromApi(projectId);
    }
  }, [autoLoad, initialData, projectId, loadFromApi]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const contextValue: AnalysisContextValue = {
    // Data state
    data,
    loading,
    error,
    loadingStates,

    // Methods
    loadFromFile,
    loadSampleData,
    loadFromApi,
    triggerAnalysis,
    clearData,
    updateAnalysisData,

    // State management
    setLoading,
    setError,
    refreshData,

    // Analysis specific
    updateRecommendation,
    addEntity,
    removeEntity,
    updateEntity,
  };

  return (
    <AnalysisContext.Provider value={contextValue}>
      {children}
    </AnalysisContext.Provider>
  );
}

// Hook to use the analysis context
export function useAnalysis(): AnalysisContextValue {
  const context = useContext(AnalysisContext);

  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }

  return context;
}

// Additional utility hooks
export function useAnalysisData() {
  const { data, loading, error, loadFromApi, refreshData } = useAnalysis();
  return { data, loading, error, loadFromApi, refreshData };
}

export function useAnalysisActions() {
  const {
    loadFromFile,
    loadSampleData,
    triggerAnalysis,
    clearData,
    updateRecommendation,
  } = useAnalysis();

  return {
    loadFromFile,
    loadSampleData,
    triggerAnalysis,
    clearData,
    updateRecommendation,
  };
}

export function useAnalysisEntities() {
  const { data, addEntity, removeEntity, updateEntity } = useAnalysis();

  const entities = data && 'entities' in data ? data.entities : [];

  return {
    entities,
    addEntity,
    removeEntity,
    updateEntity,
  };
}

// Export the context for advanced usage
export { AnalysisContext };
