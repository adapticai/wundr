'use client';

/**
 * Settings Panel Component
 * Configure widget-specific settings
 */

import { Settings2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

import type { ReportWidget, WidgetConfig } from '../types';

interface SettingsPanelProps {
  widget: ReportWidget;
  onUpdate: (config: WidgetConfig) => void;
}

export function SettingsPanel({ widget, onUpdate }: SettingsPanelProps) {
  const { type, config } = widget;

  const handleChange = (updates: Partial<WidgetConfig>) => {
    onUpdate({ ...config, ...updates });
  };

  const renderChartSettings = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={config.title || ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Chart title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={config.description || ''}
          onChange={(e) => handleChange({ description: e.target.value })}
          placeholder="Chart description"
          rows={2}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="x-axis">X-Axis Field</Label>
        <Input
          id="x-axis"
          value={config.xAxisKey || ''}
          onChange={(e) => handleChange({ xAxisKey: e.target.value })}
          placeholder="e.g., date"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="data-keys">Data Fields (comma-separated)</Label>
        <Input
          id="data-keys"
          value={config.dataKeys?.join(', ') || ''}
          onChange={(e) =>
            handleChange({
              dataKeys: e.target.value.split(',').map((k) => k.trim()),
            })
          }
          placeholder="e.g., value, target"
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label htmlFor="show-legend">Show Legend</Label>
        <Switch
          id="show-legend"
          checked={config.showLegend ?? true}
          onCheckedChange={(checked) => handleChange({ showLegend: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="show-grid">Show Grid</Label>
        <Switch
          id="show-grid"
          checked={config.showGrid ?? true}
          onCheckedChange={(checked) => handleChange({ showGrid: checked })}
        />
      </div>

      {(type === 'line-chart' || type === 'area-chart') && (
        <>
          <div className="flex items-center justify-between">
            <Label htmlFor="curved">Curved Lines</Label>
            <Switch
              id="curved"
              checked={config.curved ?? true}
              onCheckedChange={(checked) => handleChange({ curved: checked })}
            />
          </div>
        </>
      )}

      {(type === 'bar-chart' || type === 'area-chart') && (
        <div className="flex items-center justify-between">
          <Label htmlFor="stacked">Stacked</Label>
          <Switch
            id="stacked"
            checked={config.stacked ?? false}
            onCheckedChange={(checked) => handleChange({ stacked: checked })}
          />
        </div>
      )}
    </>
  );

  const renderTableSettings = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={config.title || ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Table title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={config.description || ''}
          onChange={(e) => handleChange({ description: e.target.value })}
          placeholder="Table description"
          rows={2}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Columns</Label>
        <p className="text-xs text-muted-foreground">
          Configure columns in the data source panel
        </p>
      </div>
    </>
  );

  const renderMetricCardSettings = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={config.title || ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Metric name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">Value</Label>
        <Input
          id="value"
          value={config.value || ''}
          onChange={(e) => handleChange({ value: e.target.value })}
          placeholder="e.g., 1,234"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="change">Change (%)</Label>
        <Input
          id="change"
          type="number"
          value={config.change || ''}
          onChange={(e) => handleChange({ change: parseFloat(e.target.value) })}
          placeholder="e.g., 12.5"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trend">Trend</Label>
        <Select
          value={config.trend || 'neutral'}
          onValueChange={(v) =>
            handleChange({ trend: v as 'up' | 'down' | 'neutral' })
          }
        >
          <SelectTrigger id="trend">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="up">Up (Green)</SelectItem>
            <SelectItem value="down">Down (Red)</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const renderTextSettings = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={config.content || ''}
          onChange={(e) => handleChange({ content: e.target.value })}
          placeholder="Enter your text here"
          rows={6}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="font-size">Font Size</Label>
        <Select
          value={config.fontSize || 'base'}
          onValueChange={(v) =>
            handleChange({
              fontSize: v as 'sm' | 'base' | 'lg' | 'xl' | '2xl',
            })
          }
        >
          <SelectTrigger id="font-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
            <SelectItem value="xl">Extra Large</SelectItem>
            <SelectItem value="2xl">2X Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="align">Alignment</Label>
        <Select
          value={config.align || 'left'}
          onValueChange={(v) =>
            handleChange({ align: v as 'left' | 'center' | 'right' })
          }
        >
          <SelectTrigger id="align">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const renderSettings = () => {
    switch (type) {
      case 'line-chart':
      case 'bar-chart':
      case 'area-chart':
      case 'pie-chart':
        return renderChartSettings();
      case 'table':
        return renderTableSettings();
      case 'metric-card':
        return renderMetricCardSettings();
      case 'text':
        return renderTextSettings();
      case 'divider':
        return (
          <div className="text-sm text-muted-foreground text-center py-4">
            No settings available for divider
          </div>
        );
      default:
        return (
          <div className="text-sm text-muted-foreground text-center py-4">
            No settings available
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <CardTitle className="text-base">Widget Settings</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Configure {type.replace('-', ' ')} properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{renderSettings()}</CardContent>
    </Card>
  );
}
