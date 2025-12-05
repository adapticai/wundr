'use client';

import { useCallback, useState } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';

// =============================================================================
// Types
// =============================================================================

/**
 * Report type options
 */
export type ReportType =
  | 'summary'
  | 'detailed'
  | 'insights'
  | 'trends'
  | 'comparison'
  | 'performance';

/**
 * Report format options
 */
export type ReportFormat = 'json' | 'csv' | 'pdf' | 'xlsx';

/**
 * Report period options
 */
export type ReportPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

/**
 * Insight type
 */
export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'achievement';
  severity: 'info' | 'warning' | 'success' | 'error';
  title: string;
  description: string;
  value?: number;
  change?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

/**
 * Trend analysis
 */
export interface TrendAnalysis {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  significance: 'high' | 'medium' | 'low';
  data: TrendDataPoint[];
  forecast?: TrendDataPoint[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  averageResponseTime: number;
  taskCompletionRate: number;
  workflowSuccessRate: number;
  orchestratorUtilization: number;
  channelActivity: number;
  userEngagement: number;
  scores: {
    overall: number;
    efficiency: number;
    collaboration: number;
    productivity: number;
  };
}

/**
 * Insight report structure
 */
export interface InsightReport {
  workspace: {
    id: string;
    name: string;
  };
  period: {
    start: string;
    end: string;
    type: ReportPeriod;
  };
  insights: Insight[];
  trends: TrendAnalysis[];
  performance: PerformanceMetrics;
  recommendations: string[];
  generatedAt: string;
}

/**
 * Summary report structure
 */
export interface SummaryReport {
  workspace: {
    id: string;
    name: string;
  };
  period: {
    start: string;
    end: string;
    type: ReportPeriod;
  };
  overview: {
    totalMessages: number;
    totalChannels: number;
    totalMembers: number;
    totalOrchestrators: number;
    totalTasks: number;
    totalWorkflows: number;
  };
  highlights: {
    mostActiveChannel: {
      id: string;
      name: string;
      messageCount: number;
    };
    topContributor: {
      id: string;
      name: string;
      contributionCount: number;
    };
    topOrchestrator: {
      id: string;
      name: string;
      taskCount: number;
    };
  };
  changes: {
    messages: { value: number; percent: number };
    tasks: { value: number; percent: number };
    workflows: { value: number; percent: number };
  };
  generatedAt: string;
}

/**
 * Detailed report structure
 */
export interface DetailedReport extends SummaryReport {
  channelBreakdown: {
    channelId: string;
    channelName: string;
    messageCount: number;
    memberCount: number;
    engagementScore: number;
  }[];
  orchestratorBreakdown: {
    orchestratorId: string;
    orchestratorName: string;
    taskCount: number;
    completionRate: number;
    averageResponseTime: number;
  }[];
  taskBreakdown: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    completionRate: number;
  };
  workflowBreakdown: {
    byStatus: Record<string, number>;
    successRate: number;
    averageDuration: number;
  };
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  type: ReportType;
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  format?: ReportFormat;
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  sections?: string[];
}

/**
 * Report export options
 */
export interface ReportExportOptions {
  format: ReportFormat;
  filename?: string;
  sections?: string[];
  includeCharts?: boolean;
}

/**
 * Report generation status
 */
export interface ReportGenerationStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Return type for useInsightReport hook
 */
export interface UseInsightReportReturn {
  /** Insight report data */
  report: InsightReport | null;
  /** Loading state */
  isLoading: boolean;
  /** Validation state */
  isValidating: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch report */
  refetch: () => Promise<void>;
}

/**
 * Return type for useSummaryReport hook
 */
export interface UseSummaryReportReturn {
  /** Summary report data */
  report: SummaryReport | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch report */
  refetch: () => Promise<void>;
}

/**
 * Return type for useDetailedReport hook
 */
export interface UseDetailedReportReturn {
  /** Detailed report data */
  report: DetailedReport | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch report */
  refetch: () => Promise<void>;
}

/**
 * Return type for useReportGeneration hook
 */
export interface UseReportGenerationReturn {
  /** Generate a report */
  generate: (options: ReportGenerationOptions) => Promise<string>;
  /** Export a report */
  exportReport: (
    reportId: string,
    options: ReportExportOptions
  ) => Promise<void>;
  /** Get generation status */
  getStatus: (reportId: string) => Promise<ReportGenerationStatus>;
  /** Is generating */
  isGenerating: boolean;
  /** Is exporting */
  isExporting: boolean;
  /** Error if any */
  error: Error | null;
}

// =============================================================================
// Fetchers
// =============================================================================

/**
 * Fetcher for insight reports
 */
async function fetchInsightReport(url: string): Promise<InsightReport> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Failed to fetch insight report: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetcher for summary reports
 */
async function fetchSummaryReport(url: string): Promise<SummaryReport> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Failed to fetch summary report: ${response.statusText}`
    );
  }

  return response.json();
}

// =============================================================================
// useInsightReport Hook
// =============================================================================

/**
 * Hook for fetching AI-powered insight reports
 *
 * Provides automated insights, trends, anomalies, and recommendations
 * based on analytics data.
 *
 * @param workspaceId - The workspace ID
 * @param period - Report period
 * @param options - SWR configuration options
 * @returns Insight report data and loading state
 *
 * @example
 * ```tsx
 * function InsightsDashboard({ workspaceId }: { workspaceId: string }) {
 *   const { report, isLoading, error } = useInsightReport(
 *     workspaceId,
 *     'month'
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!report) return null;
 *
 *   return (
 *     <div>
 *       <h2>Insights for {report.workspace.name}</h2>
 *       <div className="insights">
 *         {report.insights.map(insight => (
 *           <InsightCard key={insight.id} insight={insight} />
 *         ))}
 *       </div>
 *       <div className="trends">
 *         {report.trends.map(trend => (
 *           <TrendChart key={trend.metric} trend={trend} />
 *         ))}
 *       </div>
 *       <PerformanceScore metrics={report.performance} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useInsightReport(
  workspaceId: string,
  period: ReportPeriod = 'month',
  options: SWRConfiguration = {}
): UseInsightReportReturn {
  const url = `/api/workspaces/${workspaceId}/analytics/insights?period=${period}`;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<InsightReport>(url, fetchInsightReport, {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      ...options,
    });

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    report: data ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// useSummaryReport Hook
// =============================================================================

/**
 * Hook for fetching summary reports
 *
 * Provides a high-level overview of workspace analytics for a specific period.
 *
 * @param workspaceId - The workspace ID
 * @param period - Report period
 * @param options - SWR configuration options
 * @returns Summary report data and loading state
 *
 * @example
 * ```tsx
 * function SummaryDashboard({ workspaceId }: { workspaceId: string }) {
 *   const { report, isLoading, error, refetch } = useSummaryReport(
 *     workspaceId,
 *     'week'
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!report) return null;
 *
 *   return (
 *     <div>
 *       <h2>Weekly Summary</h2>
 *       <div className="overview">
 *         <Stat label="Messages" value={report.overview.totalMessages} />
 *         <Stat label="Tasks" value={report.overview.totalTasks} />
 *         <Stat label="Workflows" value={report.overview.totalWorkflows} />
 *       </div>
 *       <div className="highlights">
 *         <HighlightCard
 *           title="Most Active Channel"
 *           data={report.highlights.mostActiveChannel}
 *         />
 *         <HighlightCard
 *           title="Top Contributor"
 *           data={report.highlights.topContributor}
 *         />
 *       </div>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSummaryReport(
  workspaceId: string,
  period: ReportPeriod = 'month',
  options: SWRConfiguration = {}
): UseSummaryReportReturn {
  const url = `/api/workspaces/${workspaceId}/analytics?period=${period}`;

  const { data, error, isLoading, mutate } = useSWR<SummaryReport>(
    url,
    fetchSummaryReport,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
      ...options,
    }
  );

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    report: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// useDetailedReport Hook
// =============================================================================

/**
 * Hook for fetching detailed reports
 *
 * Provides comprehensive analytics with detailed breakdowns by channel,
 * orchestrator, tasks, and workflows.
 *
 * @param workspaceId - The workspace ID
 * @param period - Report period
 * @param startDate - Optional start date
 * @param endDate - Optional end date
 * @returns Detailed report data and loading state
 *
 * @example
 * ```tsx
 * function DetailedReportView({ workspaceId }: { workspaceId: string }) {
 *   const { report, isLoading, error } = useDetailedReport(
 *     workspaceId,
 *     'custom',
 *     '2024-01-01',
 *     '2024-01-31'
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!report) return null;
 *
 *   return (
 *     <div>
 *       <ReportHeader report={report} />
 *       <ChannelBreakdown channels={report.channelBreakdown} />
 *       <OrchestratorBreakdown orchestrators={report.orchestratorBreakdown} />
 *       <TaskMetrics breakdown={report.taskBreakdown} />
 *       <WorkflowMetrics breakdown={report.workflowBreakdown} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useDetailedReport(
  workspaceId: string,
  period: ReportPeriod = 'month',
  startDate?: string,
  endDate?: string
): UseDetailedReportReturn {
  const queryParams = new URLSearchParams({ period });
  if (startDate) {
    queryParams.set('startDate', startDate);
  }
  if (endDate) {
    queryParams.set('endDate', endDate);
  }
  queryParams.set('detailed', 'true');

  const url = `/api/workspaces/${workspaceId}/analytics?${queryParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<DetailedReport>(
    url,
    fetchSummaryReport as (url: string) => Promise<DetailedReport>,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    report: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// useReportGeneration Hook
// =============================================================================

/**
 * Hook for generating and exporting custom reports
 *
 * Provides functions to generate reports with custom options and export
 * them in various formats.
 *
 * @param workspaceId - The workspace ID
 * @returns Report generation functions and state
 *
 * @example
 * ```tsx
 * function ReportGenerator({ workspaceId }: { workspaceId: string }) {
 *   const {
 *     generate,
 *     exportReport,
 *     getStatus,
 *     isGenerating,
 *     isExporting,
 *     error
 *   } = useReportGeneration(workspaceId);
 *
 *   const handleGenerate = async () => {
 *     const reportId = await generate({
 *       type: 'detailed',
 *       period: 'month',
 *       format: 'pdf',
 *       includeCharts: true
 *     });
 *
 *     // Poll for completion
 *     const status = await getStatus(reportId);
 *     if (status.status === 'completed' && status.downloadUrl) {
 *       window.open(status.downloadUrl);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleGenerate} disabled={isGenerating}>
 *         {isGenerating ? 'Generating...' : 'Generate Report'}
 *       </button>
 *       {error && <ErrorMessage error={error} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useReportGeneration(
  workspaceId: string
): UseReportGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(
    async (options: ReportGenerationOptions): Promise<string> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/reports/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Report generation failed: ${response.statusText}`
          );
        }

        const result = await response.json();
        return result.reportId;
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Unknown error');
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsGenerating(false);
      }
    },
    [workspaceId]
  );

  const exportReport = useCallback(
    async (reportId: string, options: ReportExportOptions): Promise<void> => {
      setIsExporting(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({ format: options.format });
        if (options.sections) {
          queryParams.set('sections', options.sections.join(','));
        }
        if (options.includeCharts !== undefined) {
          queryParams.set('includeCharts', String(options.includeCharts));
        }

        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/reports/${reportId}/export?${queryParams.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        // Download file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const filename =
          options.filename || `report-${reportId}.${options.format}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Export failed');
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsExporting(false);
      }
    },
    [workspaceId]
  );

  const getStatus = useCallback(
    async (reportId: string): Promise<ReportGenerationStatus> => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/reports/${reportId}/status`
      );

      if (!response.ok) {
        throw new Error(`Failed to get report status: ${response.statusText}`);
      }

      return response.json();
    },
    [workspaceId]
  );

  return {
    generate,
    exportReport,
    getStatus,
    isGenerating,
    isExporting,
    error,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default useInsightReport;
