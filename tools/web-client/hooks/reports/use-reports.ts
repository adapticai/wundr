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
} from '@/types/reports';

// Mock data for development
const mockReports: Report[] = [
  {
    id: '1',
    name: 'Weekly Migration Analysis',
    type: 'migration-analysis',
    status: 'completed',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
    completedAt: new Date('2024-01-15T10:30:00Z'),
    createdBy: 'admin@wundr.io',
    description: 'Comprehensive analysis of migration readiness',
    tags: ['migration', 'analysis', 'weekly'],
    size: 2560000,
    duration: 1800,
    metadata: {
      parameters: { includeTests: true, depthLevel: 3 },
      outputFormat: ['pdf', 'excel'],
    },
  },
  {
    id: '2',
    name: 'Dependency Security Audit',
    type: 'security-audit',
    status: 'running',
    createdAt: new Date('2024-01-15T11:00:00Z'),
    updatedAt: new Date('2024-01-15T11:15:00Z'),
    createdBy: 'security@wundr.io',
    description: 'Security vulnerability assessment of dependencies',
    tags: ['security', 'dependencies', 'audit'],
    metadata: {
      parameters: { scanDepth: 'deep', includeDevDependencies: true },
      outputFormat: ['pdf', 'json'],
    },
  },
];

const mockTemplates: ReportTemplate[] = [
  {
    id: 'migration-basic',
    name: 'Basic Migration Analysis',
    description: 'Standard migration readiness assessment',
    type: 'migration-analysis',
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
        key: 'depthLevel',
        label: 'Analysis Depth',
        type: 'select',
        required: true,
        defaultValue: 2,
        options: [
          { value: 1, label: 'Surface (Fast)' },
          { value: 2, label: 'Standard' },
          { value: 3, label: 'Deep (Slow)' },
        ],
      },
    ],
    estimatedDuration: 900,
  },
  {
    id: 'security-audit',
    name: 'Security Audit Report',
    description: 'Comprehensive security vulnerability assessment',
    type: 'security-audit',
    category: 'standard',
    parameters: [
      {
        key: 'scanDepth',
        label: 'Scan Depth',
        type: 'select',
        required: true,
        defaultValue: 'standard',
        options: [
          { value: 'quick', label: 'Quick Scan' },
          { value: 'standard', label: 'Standard Scan' },
          { value: 'deep', label: 'Deep Scan' },
        ],
      },
      {
        key: 'includeDevDependencies',
        label: 'Include Dev Dependencies',
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    ],
    estimatedDuration: 1200,
  },
];

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [stats, setStats] = useState<ReportDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with mock data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setReports(mockReports);
        setTemplates(mockTemplates);
        setStats({
          totalReports: mockReports.length,
          runningReports: mockReports.filter(r => r.status === 'running').length,
          scheduledReports: 3,
          recentActivity: [
            {
              id: '1',
              action: 'completed',
              reportName: 'Weekly Migration Analysis',
              timestamp: new Date('2024-01-15T10:30:00Z'),
              user: 'admin@wundr.io',
            },
            {
              id: '2',
              action: 'created',
              reportName: 'Dependency Security Audit',
              timestamp: new Date('2024-01-15T11:00:00Z'),
              user: 'security@wundr.io',
            },
          ],
          popularTemplates: [
            { template: mockTemplates[0], usageCount: 25 },
            { template: mockTemplates[1], usageCount: 18 },
          ],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const generateReport = useCallback(async (request: GenerateReportRequest): Promise<string> => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newReport: Report = {
        id: Math.random().toString(36).substr(2, 9),
        name: request.name,
        type: mockTemplates.find(t => t.id === request.templateId)?.type || 'custom',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin@wundr.io',
        description: request.description,
        tags: request.tags || [],
        metadata: {
          parameters: request.parameters,
          filters: request.filters,
          outputFormat: request.outputFormats,
        },
        schedule: request.schedule,
      };

      setReports(prev => [newReport, ...prev]);
      
      // Simulate report processing
      setTimeout(() => {
        setReports(prev => prev.map(r => 
          r.id === newReport.id 
            ? { ...r, status: 'running' as const }
            : r
        ));
      }, 2000);

      setTimeout(() => {
        setReports(prev => prev.map(r => 
          r.id === newReport.id 
            ? { 
                ...r, 
                status: 'completed' as const, 
                completedAt: new Date(),
                size: Math.floor(Math.random() * 5000000) + 1000000,
                duration: Math.floor(Math.random() * 1800) + 300,
              }
            : r
        ));
      }, 8000);

      return newReport.id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate report');
    }
  }, []);

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
      };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get historical reports');
    }
  }, [reports]);

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
  };
}