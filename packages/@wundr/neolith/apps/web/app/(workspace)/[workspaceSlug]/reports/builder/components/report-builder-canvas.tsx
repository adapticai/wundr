'use client';

/**
 * Report Builder Canvas
 * Main canvas component with drag-and-drop functionality
 */

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Save, Download, Calendar, Settings } from 'lucide-react';
import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import { DataSourcePanel } from './data-source-panel';
import { FilterPanel } from './filter-panel';
import { ScheduleDialog } from './schedule-dialog';
import { SettingsPanel } from './settings-panel';
import { WidgetPalette } from './widget-palette';
import { WidgetRenderer } from './widget-renderer';
import { generateWidgetId } from '../utils';

import type {
  ReportWidget,
  ReportTemplate,
  DataSource,
  FilterConfig,
  ReportSchedule,
  WidgetType,
} from '../types';

export function ReportBuilderCanvas() {
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activeWidget, setActiveWidget] = useState<ReportWidget | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [schedule, setSchedule] = useState<ReportSchedule | undefined>();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [reportName, setReportName] = useState('Untitled Report');
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const widgetType = active.data.current?.widgetType as WidgetType;

      if (widgetType) {
        // Dragging from palette
        const newWidget: ReportWidget = {
          id: generateWidgetId(),
          type: widgetType,
          position: { x: 0, y: 0 },
          size: active.data.current?.defaultSize || { width: 400, height: 300 },
          config: {},
        };
        setActiveWidget(newWidget);
      } else {
        // Dragging existing widget
        const widget = widgets.find(w => w.id === active.id);
        if (widget) {
          setActiveWidget(widget);
        }
      }
    },
    [widgets]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Could add visual feedback here
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta, over } = event;
      const widgetType = active.data.current?.widgetType as WidgetType;

      if (widgetType) {
        // Dropped from palette - create new widget
        const canvasRect = document
          .getElementById('report-canvas')
          ?.getBoundingClientRect();
        if (!canvasRect) return;

        const newWidget: ReportWidget = {
          id: generateWidgetId(),
          type: widgetType,
          position: {
            x: Math.max(0, delta.x),
            y: Math.max(0, delta.y),
          },
          size: active.data.current?.defaultSize || { width: 400, height: 300 },
          config: {
            title: `New ${widgetType.replace('-', ' ')}`,
          },
        };

        setWidgets(prev => [...prev, newWidget]);
        setSelectedWidgetId(newWidget.id);

        toast({
          title: 'Widget added',
          description: `${widgetType} added to canvas`,
        });
      } else {
        // Moved existing widget
        const widgetId = active.id as string;
        setWidgets(prev =>
          prev.map(w =>
            w.id === widgetId
              ? {
                  ...w,
                  position: {
                    x: Math.max(0, w.position.x + delta.x),
                    y: Math.max(0, w.position.y + delta.y),
                  },
                }
              : w
          )
        );
      }

      setActiveWidget(null);
    },
    [toast]
  );

  const handleWidgetUpdate = useCallback(
    (widgetId: string, updates: Partial<ReportWidget>) => {
      setWidgets(prev =>
        prev.map(w => (w.id === widgetId ? { ...w, ...updates } : w))
      );
    },
    []
  );

  const handleWidgetDelete = useCallback(
    (widgetId: string) => {
      setWidgets(prev => prev.filter(w => w.id !== widgetId));
      if (selectedWidgetId === widgetId) {
        setSelectedWidgetId(null);
      }
      toast({
        title: 'Widget deleted',
        description: 'Widget removed from canvas',
      });
    },
    [selectedWidgetId, toast]
  );

  const handleWidgetResize = useCallback(
    (widgetId: string, size: { width: number; height: number }) => {
      handleWidgetUpdate(widgetId, { size });
    },
    [handleWidgetUpdate]
  );

  const handleSave = useCallback(async () => {
    if (widgets.length === 0) {
      toast({
        title: 'Nothing to save',
        description: 'Add some widgets to your report first',
        variant: 'destructive',
      });
      return;
    }

    const template: Partial<ReportTemplate> = {
      name: reportName,
      widgets,
      filters,
      schedule,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // TODO: Implement API call to save template
      console.log('Saving report template:', template);

      toast({
        title: 'Report saved',
        description: `${reportName} has been saved successfully`,
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Failed to save report template',
        variant: 'destructive',
      });
    }
  }, [widgets, filters, schedule, reportName, toast]);

  const handleExport = useCallback(async () => {
    if (widgets.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Add some widgets to your report first',
        variant: 'destructive',
      });
      return;
    }

    try {
      // TODO: Implement export functionality
      console.log('Exporting report with', widgets.length, 'widgets');

      toast({
        title: 'Export started',
        description: 'Your report is being exported',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export report',
        variant: 'destructive',
      });
    }
  }, [widgets, toast]);

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className='h-full flex'>
        {/* Left Sidebar - Widget Palette */}
        <div className='w-64 border-r bg-muted/10 overflow-y-auto'>
          <WidgetPalette />
        </div>

        {/* Main Canvas Area */}
        <div className='flex-1 flex flex-col'>
          {/* Toolbar */}
          <div className='border-b bg-background px-4 py-2 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <input
                type='text'
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                className='text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 py-1'
                placeholder='Report Name'
              />
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' onClick={handleSave}>
                <Save className='h-4 w-4 mr-2' />
                Save
              </Button>
              <Button variant='outline' size='sm' onClick={handleExport}>
                <Download className='h-4 w-4 mr-2' />
                Export
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowScheduleDialog(true)}
              >
                <Calendar className='h-4 w-4 mr-2' />
                Schedule
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              >
                <Settings className='h-4 w-4 mr-2' />
                Settings
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div
            id='report-canvas'
            className='flex-1 overflow-auto bg-muted/5 p-8 relative'
          >
            <div className='min-h-full bg-background rounded-lg shadow-sm p-6 relative'>
              {widgets.length === 0 && (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <div className='text-center text-muted-foreground'>
                    <p className='text-lg font-medium'>
                      Start building your report
                    </p>
                    <p className='text-sm mt-2'>
                      Drag widgets from the palette to get started
                    </p>
                  </div>
                </div>
              )}

              {widgets.map(widget => (
                <WidgetRenderer
                  key={widget.id}
                  widget={widget}
                  isSelected={widget.id === selectedWidgetId}
                  onSelect={() => setSelectedWidgetId(widget.id)}
                  onUpdate={handleWidgetUpdate}
                  onDelete={handleWidgetDelete}
                  onResize={handleWidgetResize}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Properties Panel */}
        {selectedWidget && (
          <div className='w-80 border-l bg-muted/10 overflow-y-auto'>
            <div className='p-4 space-y-4'>
              <DataSourcePanel
                widget={selectedWidget}
                dataSources={dataSources}
                onDataSourceChange={dataSource =>
                  handleWidgetUpdate(selectedWidget.id, { dataSource })
                }
                onAddDataSource={ds => setDataSources(prev => [...prev, ds])}
              />
              <FilterPanel
                widget={selectedWidget}
                filters={selectedWidget.filters || []}
                onFiltersChange={filters =>
                  handleWidgetUpdate(selectedWidget.id, { filters })
                }
              />
              {showSettingsPanel && (
                <SettingsPanel
                  widget={selectedWidget}
                  onUpdate={config =>
                    handleWidgetUpdate(selectedWidget.id, { config })
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        schedule={schedule}
        onScheduleChange={setSchedule}
      />

      {/* Drag Overlay */}
      <DragOverlay>
        {activeWidget && (
          <div className='opacity-50'>
            <WidgetRenderer
              widget={activeWidget}
              isSelected={false}
              onSelect={() => {}}
              onUpdate={() => {}}
              onDelete={() => {}}
              onResize={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
