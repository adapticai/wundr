'use client';

import * as React from 'react';
import { Trash2, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Performance objectives for charter configuration
 */
export interface CharterObjectives {
  responseTimeTarget: number;  // milliseconds (1000-120000)
  taskCompletionRate: number;  // percentage (50-100)
  qualityScore: number;        // 0-100 (50-100)
  customMetrics?: Record<string, number>;
}

/**
 * Objective configuration ranges
 */
const OBJECTIVES_LIMITS = {
  responseTimeTarget: { min: 1000, max: 120000, step: 1000 },  // 1s to 2min
  taskCompletionRate: { min: 50, max: 100, step: 1 },
  qualityScore: { min: 50, max: 100, step: 1 },
} as const;

/**
 * Default values
 */
export const DEFAULT_OBJECTIVES: CharterObjectives = {
  responseTimeTarget: 30000,  // 30 seconds
  taskCompletionRate: 95,
  qualityScore: 85,
};

export interface CharterObjectivesProps {
  value: CharterObjectives;
  onChange: (objectives: CharterObjectives) => void;
  className?: string;
}

/**
 * Format milliseconds to seconds for display
 */
function formatResponseTime(ms: number): string {
  return `${(ms / 1000).toFixed(0)}s`;
}

/**
 * Get color based on percentage value for visual indicators
 */
function getPercentageColor(value: number, max: number = 100): string {
  const percent = (value / max) * 100;
  if (percent >= 90) return 'bg-green-500';
  if (percent >= 70) return 'bg-yellow-500';
  if (percent >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Get badge variant based on metric value
 */
function getMetricBadgeVariant(value: number, type: 'completion' | 'quality'): 'default' | 'secondary' | 'outline' {
  if (type === 'completion') {
    if (value >= 95) return 'default';
    if (value >= 80) return 'secondary';
    return 'outline';
  }
  // quality
  if (value >= 90) return 'default';
  if (value >= 75) return 'secondary';
  return 'outline';
}

export function CharterObjectives({ value, onChange, className }: CharterObjectivesProps) {
  const [localValues, setLocalValues] = React.useState(value);
  const [newMetricName, setNewMetricName] = React.useState('');
  const [newMetricValue, setNewMetricValue] = React.useState('');

  // Sync local values with prop changes
  React.useEffect(() => {
    setLocalValues(value);
  }, [value]);

  const handleSliderChange = (field: keyof CharterObjectives, newValue: number[]) => {
    const updatedValues = { ...localValues, [field]: newValue[0] };
    setLocalValues(updatedValues);
    onChange(updatedValues);
  };

  const handleInputChange = (field: keyof CharterObjectives, inputValue: string) => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue)) return;

    const { min, max } = OBJECTIVES_LIMITS[field as keyof typeof OBJECTIVES_LIMITS];
    const clampedValue = Math.max(min, Math.min(max, numValue));
    const updatedValues = { ...localValues, [field]: clampedValue };
    setLocalValues(updatedValues);
    onChange(updatedValues);
  };

  const handleAddCustomMetric = () => {
    if (!newMetricName.trim()) return;

    const numValue = parseFloat(newMetricValue);
    if (isNaN(numValue)) return;

    const updatedValues = {
      ...localValues,
      customMetrics: {
        ...localValues.customMetrics,
        [newMetricName.trim()]: numValue,
      },
    };
    setLocalValues(updatedValues);
    onChange(updatedValues);
    setNewMetricName('');
    setNewMetricValue('');
  };

  const handleRemoveCustomMetric = (metricName: string) => {
    const { [metricName]: removed, ...remainingMetrics } = localValues.customMetrics || {};
    const updatedValues = {
      ...localValues,
      customMetrics: Object.keys(remainingMetrics).length > 0 ? remainingMetrics : undefined,
    };
    setLocalValues(updatedValues);
    onChange(updatedValues);
  };

  const handleCustomMetricChange = (metricName: string, inputValue: string) => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return;

    const updatedValues = {
      ...localValues,
      customMetrics: {
        ...localValues.customMetrics,
        [metricName]: numValue,
      },
    };
    setLocalValues(updatedValues);
    onChange(updatedValues);
  };

  return (
    <TooltipProvider>
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>Performance Objectives</CardTitle>
          <CardDescription>
            Define target metrics and performance goals for charter execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Response Time Target */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="responseTimeTarget" className="text-sm font-medium">
                  Response Time Target
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Target maximum time for the orchestrator to respond to requests.
                      Lower values indicate faster response expectations.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="responseTimeTarget"
                  type="number"
                  value={localValues.responseTimeTarget}
                  onChange={(e) => handleInputChange('responseTimeTarget', e.target.value)}
                  min={OBJECTIVES_LIMITS.responseTimeTarget.min}
                  max={OBJECTIVES_LIMITS.responseTimeTarget.max}
                  className="w-28 h-8 text-right"
                />
                <span className="text-sm text-muted-foreground w-8">
                  ({formatResponseTime(localValues.responseTimeTarget)})
                </span>
              </div>
            </div>
            <Slider
              value={[localValues.responseTimeTarget]}
              onValueChange={(val) => handleSliderChange('responseTimeTarget', val)}
              min={OBJECTIVES_LIMITS.responseTimeTarget.min}
              max={OBJECTIVES_LIMITS.responseTimeTarget.max}
              step={OBJECTIVES_LIMITS.responseTimeTarget.step}
              className="w-full"
            />
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  localValues.responseTimeTarget <= 30000 ? 'bg-green-500/30' :
                  localValues.responseTimeTarget <= 60000 ? 'bg-yellow-500/30' :
                  'bg-orange-500/30'
                )}
                style={{
                  width: `${(localValues.responseTimeTarget / OBJECTIVES_LIMITS.responseTimeTarget.max) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Task Completion Rate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="taskCompletionRate" className="text-sm font-medium">
                  Task Completion Rate
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Target percentage of tasks successfully completed.
                      Higher values indicate stricter success requirements.
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Badge variant={getMetricBadgeVariant(localValues.taskCompletionRate, 'completion')}>
                  {localValues.taskCompletionRate >= 95 ? 'Excellent' :
                   localValues.taskCompletionRate >= 80 ? 'Good' : 'Acceptable'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="taskCompletionRate"
                  type="number"
                  value={localValues.taskCompletionRate}
                  onChange={(e) => handleInputChange('taskCompletionRate', e.target.value)}
                  min={OBJECTIVES_LIMITS.taskCompletionRate.min}
                  max={OBJECTIVES_LIMITS.taskCompletionRate.max}
                  className="w-20 h-8 text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[localValues.taskCompletionRate]}
              onValueChange={(val) => handleSliderChange('taskCompletionRate', val)}
              min={OBJECTIVES_LIMITS.taskCompletionRate.min}
              max={OBJECTIVES_LIMITS.taskCompletionRate.max}
              step={OBJECTIVES_LIMITS.taskCompletionRate.step}
              className="w-full"
            />
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  getPercentageColor(localValues.taskCompletionRate)
                )}
                style={{
                  width: `${localValues.taskCompletionRate}%`,
                }}
              />
            </div>
          </div>

          {/* Quality Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="qualityScore" className="text-sm font-medium">
                  Quality Score
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Target quality score for task outputs based on code review,
                      test coverage, and adherence to standards.
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Badge variant={getMetricBadgeVariant(localValues.qualityScore, 'quality')}>
                  {localValues.qualityScore >= 90 ? 'High' :
                   localValues.qualityScore >= 75 ? 'Medium' : 'Standard'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="qualityScore"
                  type="number"
                  value={localValues.qualityScore}
                  onChange={(e) => handleInputChange('qualityScore', e.target.value)}
                  min={OBJECTIVES_LIMITS.qualityScore.min}
                  max={OBJECTIVES_LIMITS.qualityScore.max}
                  className="w-20 h-8 text-right"
                />
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
            <Slider
              value={[localValues.qualityScore]}
              onValueChange={(val) => handleSliderChange('qualityScore', val)}
              min={OBJECTIVES_LIMITS.qualityScore.min}
              max={OBJECTIVES_LIMITS.qualityScore.max}
              step={OBJECTIVES_LIMITS.qualityScore.step}
              className="w-full"
            />
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  getPercentageColor(localValues.qualityScore)
                )}
                style={{
                  width: `${localValues.qualityScore}%`,
                }}
              />
            </div>
          </div>

          {/* Custom Metrics */}
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Custom Metrics</h4>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Add custom performance metrics specific to your use case.
                      Examples: API latency (ms), cache hit rate (%), error rate (%).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant="outline" className="text-xs">
                {Object.keys(localValues.customMetrics || {}).length} defined
              </Badge>
            </div>

            {/* Existing Custom Metrics */}
            {localValues.customMetrics && Object.keys(localValues.customMetrics).length > 0 && (
              <div className="space-y-2">
                {Object.entries(localValues.customMetrics).map(([name, value]) => (
                  <div key={name} className="flex items-center gap-2">
                    <Input
                      value={name}
                      disabled
                      className="flex-1 h-9 bg-muted"
                    />
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) => handleCustomMetricChange(name, e.target.value)}
                      className="w-32 h-9 text-right"
                      step="0.01"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCustomMetric(name)}
                      className="h-9 w-9 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Custom Metric */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Metric name"
                value={newMetricName}
                onChange={(e) => setNewMetricName(e.target.value)}
                className="flex-1 h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomMetric();
                  }
                }}
              />
              <Input
                type="number"
                placeholder="Target value"
                value={newMetricValue}
                onChange={(e) => setNewMetricValue(e.target.value)}
                className="w-32 h-9 text-right"
                step="0.01"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomMetric();
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddCustomMetric}
                disabled={!newMetricName.trim() || !newMetricValue.trim()}
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {formatResponseTime(localValues.responseTimeTarget)}
                </div>
                <div className="text-xs text-muted-foreground">Response Time</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{localValues.taskCompletionRate}%</div>
                <div className="text-xs text-muted-foreground">Completion Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{localValues.qualityScore}</div>
                <div className="text-xs text-muted-foreground">Quality Score</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
