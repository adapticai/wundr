'use client';

/**
 * Report Builder Hook
 * Custom hook for managing report builder state
 */

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

import type {
  ReportWidget,
  ReportTemplate,
  DataSource,
  FilterConfig,
  ReportSchedule,
} from '../types';

export function useReportBuilder(initialTemplate?: Partial<ReportTemplate>) {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const [widgets, setWidgets] = useState<ReportWidget[]>(
    initialTemplate?.widgets || []
  );
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>(
    initialTemplate?.filters || []
  );
  const [schedule, setSchedule] = useState<ReportSchedule | undefined>(
    initialTemplate?.schedule
  );
  const [reportName, setReportName] = useState(
    initialTemplate?.name || 'Untitled Report'
  );
  const [isDirty, setIsDirty] = useState(false);

  const addWidget = useCallback((widget: ReportWidget) => {
    setWidgets(prev => [...prev, widget]);
    setIsDirty(true);
  }, []);

  const updateWidget = useCallback(
    (widgetId: string, updates: Partial<ReportWidget>) => {
      setWidgets(prev =>
        prev.map(w => (w.id === widgetId ? { ...w, ...updates } : w))
      );
      setIsDirty(true);
    },
    []
  );

  const deleteWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setIsDirty(true);
  }, []);

  const duplicateWidget = useCallback((widgetId: string) => {
    setWidgets(prev => {
      const widget = prev.find(w => w.id === widgetId);
      if (!widget) return prev;

      const duplicate: ReportWidget = {
        ...widget,
        id: `${widget.id}-copy-${Date.now()}`,
        position: {
          x: widget.position.x + 20,
          y: widget.position.y + 20,
        },
      };

      return [...prev, duplicate];
    });
    setIsDirty(true);
  }, []);

  const addDataSource = useCallback((dataSource: DataSource) => {
    setDataSources(prev => [...prev, dataSource]);
    setIsDirty(true);
  }, []);

  const updateDataSource = useCallback(
    (dataSourceId: string, updates: Partial<DataSource>) => {
      setDataSources(prev =>
        prev.map(ds => (ds.id === dataSourceId ? { ...ds, ...updates } : ds))
      );
      setIsDirty(true);
    },
    []
  );

  const deleteDataSource = useCallback((dataSourceId: string) => {
    setDataSources(prev => prev.filter(ds => ds.id !== dataSourceId));
    // Remove data source from widgets
    setWidgets(prev =>
      prev.map(w =>
        w.dataSource?.id === dataSourceId ? { ...w, dataSource: undefined } : w
      )
    );
    setIsDirty(true);
  }, []);

  const saveTemplate = useCallback(async (): Promise<ReportTemplate> => {
    const template: ReportTemplate = {
      id: initialTemplate?.id || `template-${Date.now()}`,
      name: reportName,
      description: initialTemplate?.description || '',
      widgets,
      filters,
      schedule,
      createdAt: initialTemplate?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: initialTemplate?.createdBy,
      isPublic: initialTemplate?.isPublic || false,
      tags: initialTemplate?.tags || [],
    };

    const url = initialTemplate?.id
      ? `/api/workspaces/${workspaceSlug}/reports/${initialTemplate.id}`
      : `/api/workspaces/${workspaceSlug}/reports`;
    await fetch(url, {
      method: initialTemplate?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });

    setIsDirty(false);
    return template;
  }, [widgets, filters, schedule, reportName, workspaceSlug, initialTemplate]);

  const loadTemplate = useCallback((template: Partial<ReportTemplate>) => {
    setReportName(template.name || 'Untitled Report');
    setWidgets(template.widgets || []);
    setFilters(template.filters || []);
    setSchedule(template.schedule);
    setIsDirty(false);
  }, []);

  const resetBuilder = useCallback(() => {
    setReportName('Untitled Report');
    setWidgets([]);
    setDataSources([]);
    setFilters([]);
    setSchedule(undefined);
    setIsDirty(false);
  }, []);

  return {
    // State
    widgets,
    dataSources,
    filters,
    schedule,
    reportName,
    isDirty,

    // Widget operations
    addWidget,
    updateWidget,
    deleteWidget,
    duplicateWidget,

    // Data source operations
    addDataSource,
    updateDataSource,
    deleteDataSource,

    // Global operations
    setReportName,
    setSchedule,
    setFilters,
    saveTemplate,
    loadTemplate,
    resetBuilder,
  };
}
