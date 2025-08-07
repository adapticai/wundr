'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Report,
  ReportTemplate,
  ReportSchedule,
  GenerateReportRequest,
  ReportDashboardStats,
  ReportFilters,
  ExportFormat,
  HistoricalReport,
  CompleteAnalysisData,
  ReportContent,
} from '@/types/reports';
import { ReportService } from '@/lib/services/report-service';

// Enhanced report templates with real analysis capabilities
const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'comprehensive-analysis',
    name: 'Comprehensive Code Analysis',
    description: 'Complete analysis including quality metrics, dependencies, security, and recommendations',
    type: 'code-quality',
    category: 'standard',
    parameters: [
      {
        key: 'includeTests',
        label: 'Include Test Files',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Whether to include test files in the analysis',
      },
      {
        key: 'complexityThreshold',
        label: 'Complexity Threshold',
        type: 'select',
        required: true,
        defaultValue: 10,
        options: [
          { value: 5, label: 'Low (5)' },
          { value: 10, label: 'Standard (10)' },
          { value: 15, label: 'High (15)' },
        ],
        description: 'Cyclomatic complexity threshold for flagging issues',
      },
      {
        key: 'includeDependencies',
        label: 'Analyze Dependencies',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Include dependency analysis and circular dependency detection',
      },
      {
        key: 'securityScan',
        label: 'Security Scanning',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Include security vulnerability scanning',
      },
    ],
    estimatedDuration: 300,
  },
  {
    id: 'migration-analysis',
    name: 'Migration Readiness Assessment',
    description: 'Focused analysis for migration planning and risk assessment',
    type: 'migration-analysis',
    category: 'standard',
    parameters: [
      {
        key: 'targetFramework',
        label: 'Target Framework',
        type: 'select',
        required: true,
        defaultValue: 'react',
        options: [
          { value: 'react', label: 'React' },
          { value: 'vue', label: 'Vue.js' },
          { value: 'angular', label: 'Angular' },
          { value: 'nextjs', label: 'Next.js' },
        ],
      },
      {
        key: 'riskThreshold',
        label: 'Risk Assessment Level',
        type: 'select',
        required: true,
        defaultValue: 'medium',
        options: [
          { value: 'low', label: 'Conservative' },
          { value: 'medium', label: 'Balanced' },
          { value: 'high', label: 'Aggressive' },
        ],
      },
      {
        key: 'includeBreakingChanges',
        label: 'Identify Breaking Changes',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    estimatedDuration: 600,
  },
  {
    id: 'security-audit',
    name: 'Security Vulnerability Audit',
    description: 'Comprehensive security analysis with vulnerability detection',
    type: 'security-audit',
    category: 'standard',
    parameters: [
      {
        key: 'severityLevel',
        label: 'Minimum Severity',
        type: 'select',
        required: true,
        defaultValue: 'medium',
        options: [
          { value: 'low', label: 'All Issues (Low+)' },
          { value: 'medium', label: 'Medium+ Issues' },
          { value: 'high', label: 'High+ Issues' },
          { value: 'critical', label: 'Critical Only' },
        ],
      },
      {
        key: 'includeDevDependencies',
        label: 'Scan Dev Dependencies',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      {
        key: 'outputCVE',
        label: 'Include CVE Details',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    estimatedDuration: 180,
  },
  {
    id: 'performance-analysis',
    name: 'Performance Analysis',
    description: 'Code performance and optimization opportunities analysis',
    type: 'performance-analysis',
    category: 'standard',
    parameters: [
      {
        key: 'bundleAnalysis',
        label: 'Bundle Size Analysis',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
      {
        key: 'memoryleakDetection',
        label: 'Memory Leak Detection',
        type: 'boolean',
        required: false,
        defaultValue: false,
        description: 'Experimental feature - may increase analysis time',
      },
    ],
    estimatedDuration: 420,
  },
  {
    id: 'dependency-analysis',
    name: 'Dependency Health Check',
    description: 'Comprehensive dependency analysis and recommendations',
    type: 'dependency-analysis',
    category: 'standard',
    parameters: [
      {
        key: 'includeTransitive',
        label: 'Analyze Transitive Dependencies',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
      {
        key: 'licenseCheck',
        label: 'License Compatibility Check',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      {
        key: 'outdatedThreshold',
        label: 'Outdated Threshold',
        type: 'select',
        required: true,
        defaultValue: '6months',
        options: [
          { value: '1month', label: '1 Month' },
          { value: '3months', label: '3 Months' },
          { value: '6months', label: '6 Months' },
          { value: '1year', label: '1 Year' },
        ],
      },
    ],
    estimatedDuration: 240,
  },
];


export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>(REPORT_TEMPLATES);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [stats, setStats] = useState<ReportDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Map<string, CompleteAnalysisData>>(new Map());

  // Initialize with persisted data
  useEffect(() => {
    const loadPersistedData = () => {
      try {
        // Load reports from localStorage
        const savedReports = localStorage.getItem('wundr-reports');
        if (savedReports) {
          const parsedReports = JSON.parse(savedReports);
          setReports(parsedReports.map((r: any) => ({
            ...r,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
            completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
          })));
        }

        // Load schedules from localStorage
        const savedSchedules = localStorage.getItem('wundr-schedules');
        if (savedSchedules) {
          setSchedules(JSON.parse(savedSchedules));
        }

        // Calculate stats
        const currentReports = savedReports ? JSON.parse(savedReports) : [];
        setStats({
          totalReports: currentReports.length,
          runningReports: currentReports.filter((r: any) => r.status === 'running').length,
          scheduledReports: savedSchedules ? JSON.parse(savedSchedules).length : 0,
          failedReports: currentReports.filter((r: any) => r.status === 'failed').length,
          recentActivity: currentReports
            .map((r: any) => ({
              id: r.id,
              action: r.status === 'completed' ? 'completed' : 'created',
              reportName: r.name,
              timestamp: new Date(r.updatedAt || r.createdAt),
              user: r.createdBy,
            }))
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .slice(0, 10),
          popularTemplates: REPORT_TEMPLATES.slice(0, 5).map(template => ({
            template,
            usageCount: currentReports.filter((r: any) => 
              r.metadata?.templateId === template.id
            ).length,
          })),
          storageUsage: {
            total: 1000000000, // 1GB
            used: currentReports.reduce((acc: number, r: any) => acc + (r.size || 0), 0),
            available: 1000000000 - currentReports.reduce((acc: number, r: any) => acc + (r.size || 0), 0),
          },
          performanceMetrics: {
            averageGenerationTime: currentReports.reduce((acc: number, r: any) => acc + (r.duration || 0), 0) / Math.max(currentReports.length, 1),
            successRate: currentReports.length > 0 ? 
              (currentReports.filter((r: any) => r.status === 'completed').length / currentReports.length) * 100 : 0,
            errorRate: currentReports.length > 0 ?
              (currentReports.filter((r: any) => r.status === 'failed').length / currentReports.length) * 100 : 0,
          },
        });
      } catch (err) {
        console.error('Failed to load persisted data:', err);
        setError('Failed to load saved reports');
      }
    };

    loadPersistedData();
  }, []);

  const generateReport = useCallback(async (request: GenerateReportRequest): Promise<string> => {
    try {
      const template = templates.find(t => t.id === request.templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const newReport: Report = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: request.name,
        type: template.type,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'current-user@wundr.io',
        description: request.description,
        tags: request.tags || [],
        metadata: {
          parameters: request.parameters,
          filters: request.filters,
          outputFormat: request.outputFormats,
          analysisEngine: 'Wundr Analysis Engine v2.0.0',
          version: '2.0.0',
        },
        schedule: request.schedule ? {
          ...request.schedule,
          id: `schedule-${Date.now()}`,
          nextRun: new Date(),
        } : undefined,
      };

      // Add to reports immediately
      setReports(prev => {
        const updated = [newReport, ...prev];
        localStorage.setItem('wundr-reports', JSON.stringify(updated));
        return updated;
      });

      // Simulate report processing with realistic timing
      setTimeout(() => {
        setReports(prev => {
          const updated = prev.map(r => 
            r.id === newReport.id 
              ? { ...r, status: 'running' as const, updatedAt: new Date() }
              : r
          );
          localStorage.setItem('wundr-reports', JSON.stringify(updated));
          return updated;
        });
      }, 1000);

      // Complete report after estimated duration
      const duration = (template.estimatedDuration || 300) * 1000;
      setTimeout(() => {
        setReports(prev => {
          const updated = prev.map(r => 
            r.id === newReport.id 
              ? { 
                  ...r, 
                  status: 'completed' as const, 
                  completedAt: new Date(),
                  updatedAt: new Date(),
                  size: Math.floor(Math.random() * 5000000) + 1000000,
                  duration: template.estimatedDuration || 300,
                }
              : r
          );
          localStorage.setItem('wundr-reports', JSON.stringify(updated));
          return updated;
        });
      }, duration + 2000);

      return newReport.id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate report');
    }
  }, [templates]);

  const exportReport = useCallback(async (reportId: string, format: ExportFormat): Promise<void> => {
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would trigger a download
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const blob = new Blob(['Mock report data'], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.name}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to export report');
    }
  }, [reports]);

  const deleteReport = useCallback(async (reportId: string): Promise<void> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete report');
    }
  }, []);

  const scheduleReport = useCallback(async (schedule: Omit<ReportSchedule, 'id' | 'lastRun' | 'nextRun'>): Promise<string> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newSchedule: ReportSchedule = {
        ...schedule,
        id: Math.random().toString(36).substr(2, 9),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      };

      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule.id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to schedule report');
    }
  }, []);

  const getHistoricalReports = useCallback(async (reportId: string): Promise<HistoricalReport> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const report = reports.find(r => r.id === reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      return {
        report,
        versions: [
          {
            version: 1,
            createdAt: report.createdAt,
            changes: ['Initial version'],
            size: report.size || 0,
            downloadUrl: `/api/reports/${reportId}/versions/1`,
          },
        ],
        analytics: {
          totalDownloads: 0,
          lastAccessed: report.createdAt,
        },
      };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get historical reports');
    }
  }, [reports]);

  // Process analysis file and generate report
  const processAnalysisFile = useCallback(async (
    file: File, 
    templateId: string, 
    reportName?: string
  ): Promise<string> => {
    try {
      setLoading(true);
      
      // Parse analysis data using ReportService
      const analysisData = await ReportService.parseAnalysisFile(file);
      
      // Cache the analysis data
      const analysisId = `analysis_${Date.now()}`;
      setAnalysisCache(prev => new Map(prev.set(analysisId, analysisData)));
      
      // Find template
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Generate report content
      const reportContent = ReportService.generateReport(analysisData, template);
      
      // Create report record
      const newReport: Report = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: reportName || `${analysisData.metadata.projectInfo.name} - ${template.name}`,
        type: template.type,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        createdBy: 'current-user@wundr.io',
        description: `Analysis report for ${analysisData.metadata.projectInfo.name}`,
        tags: ['analysis', template.type],
        size: JSON.stringify(analysisData).length,
        duration: Math.floor(analysisData.metadata.timestamp.getTime() / 1000),
        metadata: {
          parameters: {},
          analysisEngine: analysisData.metadata.generator,
          processingTime: Date.now() - analysisData.metadata.timestamp.getTime(),
          dataSource: file.name,
          version: analysisData.metadata.version,
          outputFormat: ['html', 'json'],
        },
      };
      
      // Store report content in localStorage for retrieval
      localStorage.setItem(`report-content-${newReport.id}`, JSON.stringify(reportContent));
      localStorage.setItem(`analysis-data-${newReport.id}`, JSON.stringify(analysisData));
      
      setReports(prev => {
        const updated = [newReport, ...prev];
        localStorage.setItem('wundr-reports', JSON.stringify(updated));
        return updated;
      });
      
      return newReport.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process analysis file');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [templates]);

  // Get report content
  const getReportContent = useCallback(async (reportId: string): Promise<ReportContent | null> => {
    try {
      const contentStr = localStorage.getItem(`report-content-${reportId}`);
      if (!contentStr) return null;
      
      return JSON.parse(contentStr);
    } catch (err) {
      console.error('Failed to load report content:', err);
      return null;
    }
  }, []);

  // Get analysis data for a report
  const getAnalysisData = useCallback(async (reportId: string): Promise<CompleteAnalysisData | null> => {
    try {
      const dataStr = localStorage.getItem(`analysis-data-${reportId}`);
      if (!dataStr) return null;
      
      const data = JSON.parse(dataStr);
      // Convert date strings back to Date objects
      data.metadata.timestamp = new Date(data.metadata.timestamp);
      data.entities = data.entities.map((e: any) => ({
        ...e,
        lastModified: new Date(e.lastModified),
      }));
      data.metrics.overview.timestamp = new Date(data.metrics.overview.timestamp);
      
      return data;
    } catch (err) {
      console.error('Failed to load analysis data:', err);
      return null;
    }
  }, []);

  // Enhanced export with ReportService
  const exportReportEnhanced = useCallback(async (
    reportId: string, 
    format: ExportFormat
  ): Promise<void> => {
    try {
      const report = reports.find(r => r.id === reportId);
      const reportContent = await getReportContent(reportId);
      
      if (!report || !reportContent) {
        throw new Error('Report or content not found');
      }
      
      await ReportService.exportReport(reportContent, format, report.name);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to export report');
    }
  }, [reports, getReportContent]);

  return {
    reports,
    templates,
    schedules,
    stats,
    loading,
    error,
    generateReport,
    exportReport,
    deleteReport,
    scheduleReport,
    getHistoricalReports,
    processAnalysisFile,
    getReportContent,
    getAnalysisData,
    exportReportEnhanced,
  };
}