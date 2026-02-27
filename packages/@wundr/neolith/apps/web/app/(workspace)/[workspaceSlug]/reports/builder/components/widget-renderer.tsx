'use client';

/**
 * Widget Renderer Component
 * Renders individual widgets with drag, resize, and edit capabilities
 */

import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Trash2, Copy } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  BarChart,
  LineChart,
  PieChart,
} from '@/components/reporting/charts';

import type { ReportWidget } from '../types';

interface WidgetRendererProps {
  widget: ReportWidget;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (widgetId: string, updates: Partial<ReportWidget>) => void;
  onDelete: (widgetId: string) => void;
  onResize: (widgetId: string, size: { width: number; height: number }) => void;
  onDuplicate?: (widgetId: string) => void;
}

export function WidgetRenderer({
  widget,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onResize,
  onDuplicate,
}: WidgetRendererProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: widget.id,
  });

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(widget.id);
    },
    [widget.id, onDelete]
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDuplicate?.(widget.id);
    },
    [widget.id, onDuplicate]
  );

  const renderWidgetContent = () => {
    const { type, config, dataSource } = widget;

    // Mock data for demonstration
    const mockData = [
      { date: '2024-01', value: 4000, target: 3500 },
      { date: '2024-02', value: 3000, target: 3800 },
      { date: '2024-03', value: 5000, target: 4200 },
      { date: '2024-04', value: 4500, target: 4500 },
      { date: '2024-05', value: 6000, target: 5000 },
      { date: '2024-06', value: 5500, target: 5200 },
    ];

    const mockPieData = [
      { name: 'Completed', value: 400 },
      { name: 'In Progress', value: 300 },
      { name: 'Pending', value: 200 },
      { name: 'Cancelled', value: 100 },
    ];

    switch (type) {
      case 'line-chart':
        return (
          <LineChart
            data={mockData}
            dataKeys={config.dataKeys || ['value', 'target']}
            xAxisKey={config.xAxisKey || 'date'}
            title={config.title}
            description={config.description}
            height={widget.size.height - 80}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            curved={config.curved}
          />
        );

      case 'bar-chart':
        return (
          <BarChart
            data={mockData}
            dataKeys={config.dataKeys || ['value']}
            xAxisKey={config.xAxisKey || 'date'}
            title={config.title}
            description={config.description}
            height={widget.size.height - 80}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            stacked={config.stacked}
          />
        );

      case 'area-chart':
        return (
          <AreaChart
            data={mockData}
            dataKeys={config.dataKeys || ['value']}
            xAxisKey={config.xAxisKey || 'date'}
            title={config.title}
            description={config.description}
            height={widget.size.height - 80}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            stacked={config.stacked}
          />
        );

      case 'pie-chart':
        return (
          <PieChart
            data={mockPieData}
            title={config.title}
            description={config.description}
            height={widget.size.height - 80}
            showLegend={config.showLegend}
          />
        );

      case 'table':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{config.title || 'Data Table'}</CardTitle>
              {config.description && (
                <CardDescription>{config.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className='rounded-md border'>
                <table className='w-full'>
                  <thead className='bg-muted/50'>
                    <tr>
                      {(config.columns || []).map(col => (
                        <th
                          key={col.accessorKey}
                          className='px-4 py-2 text-left text-sm font-medium'
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        colSpan={config.columns?.length || 1}
                        className='px-4 py-8 text-center text-sm text-muted-foreground'
                      >
                        Configure data source to display data
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );

      case 'metric-card':
        return (
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                {config.title || 'Metric'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold'>{config.value || '0'}</div>
              {config.change !== undefined && (
                <p
                  className={cn(
                    'text-xs mt-2',
                    config.trend === 'up' && 'text-green-600',
                    config.trend === 'down' && 'text-red-600',
                    config.trend === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {config.change > 0 ? '+' : ''}
                  {config.change}% from last period
                </p>
              )}
            </CardContent>
          </Card>
        );

      case 'text':
        return (
          <div
            className={cn(
              'p-4',
              config.fontSize === 'sm' && 'text-sm',
              config.fontSize === 'base' && 'text-base',
              config.fontSize === 'lg' && 'text-lg',
              config.fontSize === 'xl' && 'text-xl',
              config.fontSize === '2xl' && 'text-2xl',
              config.align === 'center' && 'text-center',
              config.align === 'right' && 'text-right'
            )}
          >
            {config.content || 'Enter your text here'}
          </div>
        );

      case 'divider':
        return <div className='border-t my-4' />;

      default:
        return (
          <div className='flex items-center justify-center h-full text-muted-foreground'>
            Unknown widget type: {type}
          </div>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute transition-shadow',
        isSelected && 'ring-2 ring-primary shadow-lg',
        isDragging && 'opacity-50'
      )}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.size.width,
        minHeight: widget.size.height,
      }}
      onClick={onSelect}
    >
      {/* Drag Handle and Actions */}
      {isSelected && (
        <div className='absolute -top-10 left-0 right-0 flex items-center justify-between bg-primary text-primary-foreground rounded-t-md px-2 py-1'>
          <div className='flex items-center gap-1'>
            <div
              {...listeners}
              {...attributes}
              className='cursor-grab active:cursor-grabbing p-1 hover:bg-primary-foreground/20 rounded'
            >
              <GripVertical className='h-4 w-4' />
            </div>
            <span className='text-xs font-medium'>{widget.type}</span>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6 hover:bg-primary-foreground/20'
              onClick={handleDuplicate}
            >
              <Copy className='h-3 w-3' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6 hover:bg-primary-foreground/20'
              onClick={handleDelete}
            >
              <Trash2 className='h-3 w-3' />
            </Button>
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className='h-full'>{renderWidgetContent()}</div>

      {/* Resize Handle */}
      {isSelected && (
        <div
          className='absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-primary rounded-tl'
          onMouseDown={e => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = widget.size.width;
            const startHeight = widget.size.height;

            const handleMouseMove = (e: MouseEvent) => {
              const deltaX = e.clientX - startX;
              const deltaY = e.clientY - startY;
              onResize(widget.id, {
                width: Math.max(200, startWidth + deltaX),
                height: Math.max(100, startHeight + deltaY),
              });
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      )}
    </div>
  );
}
