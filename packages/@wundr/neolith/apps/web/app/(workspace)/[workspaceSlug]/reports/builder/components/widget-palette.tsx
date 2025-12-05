'use client';

/**
 * Widget Palette Component
 * Draggable widget library for report builder
 */

import { useDraggable } from '@dnd-kit/core';
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Table2,
  Type,
  Minus,
  Activity,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import type { WidgetType, WidgetPalette as PaletteType } from '../types';

const WIDGET_PALETTES: PaletteType[] = [
  {
    category: 'Charts',
    items: [
      {
        type: 'line-chart',
        label: 'Line Chart',
        icon: 'LineChart',
        description: 'Display trends over time',
        defaultSize: { width: 500, height: 300 },
      },
      {
        type: 'bar-chart',
        label: 'Bar Chart',
        icon: 'BarChart3',
        description: 'Compare values across categories',
        defaultSize: { width: 500, height: 300 },
      },
      {
        type: 'area-chart',
        label: 'Area Chart',
        icon: 'Activity',
        description: 'Show cumulative trends',
        defaultSize: { width: 500, height: 300 },
      },
      {
        type: 'pie-chart',
        label: 'Pie Chart',
        icon: 'PieChart',
        description: 'Show proportional data',
        defaultSize: { width: 400, height: 300 },
      },
    ],
  },
  {
    category: 'Data',
    items: [
      {
        type: 'table',
        label: 'Table',
        icon: 'Table2',
        description: 'Display data in rows and columns',
        defaultSize: { width: 600, height: 400 },
      },
      {
        type: 'metric-card',
        label: 'Metric Card',
        icon: 'TrendingUp',
        description: 'Show key metrics',
        defaultSize: { width: 300, height: 150 },
      },
    ],
  },
  {
    category: 'Content',
    items: [
      {
        type: 'text',
        label: 'Text',
        icon: 'Type',
        description: 'Add formatted text',
        defaultSize: { width: 400, height: 100 },
      },
      {
        type: 'divider',
        label: 'Divider',
        icon: 'Minus',
        description: 'Separate sections',
        defaultSize: { width: 600, height: 2 },
      },
    ],
  },
];

const ICON_MAP = {
  LineChart,
  BarChart3,
  Activity,
  PieChart,
  Table2,
  TrendingUp,
  Type,
  Minus,
};

interface DraggableWidgetProps {
  type: WidgetType;
  label: string;
  icon: string;
  description: string;
  defaultSize: { width: number; height: number };
}

function DraggableWidget({
  type,
  label,
  icon,
  description,
  defaultSize,
}: DraggableWidgetProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: {
      widgetType: type,
      defaultSize,
    },
  });

  const Icon = ICON_MAP[icon as keyof typeof ICON_MAP];

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all hover:shadow-md',
        isDragging && 'opacity-50'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">{label}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WidgetPalette() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Widget Palette</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Drag widgets onto the canvas
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {WIDGET_PALETTES.map((palette) => (
            <div key={palette.category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {palette.category}
              </h3>
              <div className="space-y-2">
                {palette.items.map((item) => (
                  <DraggableWidget key={item.type} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
