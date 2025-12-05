'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/**
 * Resource limits for charter configuration
 */
export interface CharterResourceLimits {
  maxConcurrentSessions: number;
  tokenBudgetPerHour: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
}

/**
 * Preset configurations for resource limits
 */
const PRESETS = {
  low: {
    maxConcurrentSessions: 3,
    tokenBudgetPerHour: 50000,
    maxMemoryMB: 1024,
    maxCpuPercent: 40,
  },
  medium: {
    maxConcurrentSessions: 10,
    tokenBudgetPerHour: 100000,
    maxMemoryMB: 4096,
    maxCpuPercent: 80,
  },
  high: {
    maxConcurrentSessions: 20,
    tokenBudgetPerHour: 500000,
    maxMemoryMB: 16384,
    maxCpuPercent: 100,
  },
} as const;

/**
 * Resource limits configuration ranges
 */
const LIMITS = {
  maxConcurrentSessions: { min: 1, max: 20, step: 1 },
  tokenBudgetPerHour: { min: 10000, max: 1000000, step: 10000 },
  maxMemoryMB: { min: 512, max: 16384, step: 512 },
  maxCpuPercent: { min: 10, max: 100, step: 5 },
} as const;

export interface CharterLimitsProps {
  value: CharterResourceLimits;
  onChange: (limits: CharterResourceLimits) => void;
  className?: string;
}

/**
 * Format token budget for display (in K)
 */
function formatTokens(tokens: number): string {
  return `${(tokens / 1000).toFixed(0)}K`;
}

/**
 * Format memory for display (in GB)
 */
function formatMemory(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * Calculate estimated cost based on resource limits
 * This is a simplified estimation - adjust based on actual pricing
 */
function calculateEstimatedCost(limits: CharterResourceLimits): number {
  const tokenCost = (limits.tokenBudgetPerHour / 1000000) * 0.01; // $0.01 per 1M tokens
  const memoryCost = (limits.maxMemoryMB / 1024) * 0.0001; // $0.0001 per GB/hour
  const cpuCost = (limits.maxCpuPercent / 100) * 0.0002; // $0.0002 per core/hour
  const sessionCost = limits.maxConcurrentSessions * 0.0005; // $0.0005 per session/hour

  return tokenCost + memoryCost + cpuCost + sessionCost;
}

export function CharterLimits({
  value,
  onChange,
  className,
}: CharterLimitsProps) {
  const [localValues, setLocalValues] = React.useState(value);

  // Sync local values with prop changes
  React.useEffect(() => {
    setLocalValues(value);
  }, [value]);

  const handleSliderChange = (
    field: keyof CharterResourceLimits,
    newValue: number[],
  ) => {
    const updatedValues = { ...localValues, [field]: newValue[0] };
    setLocalValues(updatedValues);
    onChange(updatedValues);
  };

  const handleInputChange = (
    field: keyof CharterResourceLimits,
    inputValue: string,
  ) => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue)) {
      return;
    }

    const { min, max } = LIMITS[field];
    const clampedValue = Math.max(min, Math.min(max, numValue));
    const updatedValues = { ...localValues, [field]: clampedValue };
    setLocalValues(updatedValues);
    onChange(updatedValues);
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const presetValues = PRESETS[preset];
    setLocalValues(presetValues);
    onChange(presetValues);
  };

  const estimatedCost = calculateEstimatedCost(localValues);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Resource Limits</CardTitle>
        <CardDescription>
          Configure resource constraints for charter execution
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Preset Buttons */}
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => applyPreset('low')}
            className='flex-1'
          >
            Low
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => applyPreset('medium')}
            className='flex-1'
          >
            Medium
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => applyPreset('high')}
            className='flex-1'
          >
            High
          </Button>
        </div>

        {/* Max Concurrent Sessions */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Label
              htmlFor='maxConcurrentSessions'
              className='text-sm font-medium'
            >
              Max Concurrent Sessions
            </Label>
            <Input
              id='maxConcurrentSessions'
              type='number'
              value={localValues.maxConcurrentSessions}
              onChange={e =>
                handleInputChange('maxConcurrentSessions', e.target.value)
              }
              min={LIMITS.maxConcurrentSessions.min}
              max={LIMITS.maxConcurrentSessions.max}
              className='w-20 h-8 text-right'
            />
          </div>
          <Slider
            value={[localValues.maxConcurrentSessions]}
            onValueChange={val =>
              handleSliderChange('maxConcurrentSessions', val)
            }
            min={LIMITS.maxConcurrentSessions.min}
            max={LIMITS.maxConcurrentSessions.max}
            step={LIMITS.maxConcurrentSessions.step}
            className='w-full'
          />
          <div className='h-2 bg-secondary rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary/30 transition-all'
              style={{
                width: `${(localValues.maxConcurrentSessions / LIMITS.maxConcurrentSessions.max) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Token Budget Per Hour */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='tokenBudgetPerHour' className='text-sm font-medium'>
              Token Budget Per Hour
            </Label>
            <div className='flex items-center gap-2'>
              <Input
                id='tokenBudgetPerHour'
                type='number'
                value={localValues.tokenBudgetPerHour}
                onChange={e =>
                  handleInputChange('tokenBudgetPerHour', e.target.value)
                }
                min={LIMITS.tokenBudgetPerHour.min}
                max={LIMITS.tokenBudgetPerHour.max}
                className='w-28 h-8 text-right'
              />
              <span className='text-sm text-muted-foreground'>
                ({formatTokens(localValues.tokenBudgetPerHour)})
              </span>
            </div>
          </div>
          <Slider
            value={[localValues.tokenBudgetPerHour]}
            onValueChange={val => handleSliderChange('tokenBudgetPerHour', val)}
            min={LIMITS.tokenBudgetPerHour.min}
            max={LIMITS.tokenBudgetPerHour.max}
            step={LIMITS.tokenBudgetPerHour.step}
            className='w-full'
          />
          <div className='h-2 bg-secondary rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary/30 transition-all'
              style={{
                width: `${(localValues.tokenBudgetPerHour / LIMITS.tokenBudgetPerHour.max) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Max Memory */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='maxMemoryMB' className='text-sm font-medium'>
              Max Memory
            </Label>
            <div className='flex items-center gap-2'>
              <Input
                id='maxMemoryMB'
                type='number'
                value={localValues.maxMemoryMB}
                onChange={e => handleInputChange('maxMemoryMB', e.target.value)}
                min={LIMITS.maxMemoryMB.min}
                max={LIMITS.maxMemoryMB.max}
                className='w-28 h-8 text-right'
              />
              <span className='text-sm text-muted-foreground'>
                ({formatMemory(localValues.maxMemoryMB)})
              </span>
            </div>
          </div>
          <Slider
            value={[localValues.maxMemoryMB]}
            onValueChange={val => handleSliderChange('maxMemoryMB', val)}
            min={LIMITS.maxMemoryMB.min}
            max={LIMITS.maxMemoryMB.max}
            step={LIMITS.maxMemoryMB.step}
            className='w-full'
          />
          <div className='h-2 bg-secondary rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary/30 transition-all'
              style={{
                width: `${(localValues.maxMemoryMB / LIMITS.maxMemoryMB.max) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Max CPU Percent */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='maxCpuPercent' className='text-sm font-medium'>
              Max CPU Usage
            </Label>
            <div className='flex items-center gap-2'>
              <Input
                id='maxCpuPercent'
                type='number'
                value={localValues.maxCpuPercent}
                onChange={e =>
                  handleInputChange('maxCpuPercent', e.target.value)
                }
                min={LIMITS.maxCpuPercent.min}
                max={LIMITS.maxCpuPercent.max}
                className='w-20 h-8 text-right'
              />
              <span className='text-sm text-muted-foreground'>%</span>
            </div>
          </div>
          <Slider
            value={[localValues.maxCpuPercent]}
            onValueChange={val => handleSliderChange('maxCpuPercent', val)}
            min={LIMITS.maxCpuPercent.min}
            max={LIMITS.maxCpuPercent.max}
            step={LIMITS.maxCpuPercent.step}
            className='w-full'
          />
          <div className='h-2 bg-secondary rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary/30 transition-all'
              style={{
                width: `${(localValues.maxCpuPercent / LIMITS.maxCpuPercent.max) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Cost Estimation */}
        <div className='pt-4 border-t'>
          <div className='flex items-center justify-between'>
            <span className='text-sm text-muted-foreground'>
              Estimated Cost (per hour)
            </span>
            <span className='text-lg font-semibold'>
              ${estimatedCost.toFixed(4)}
            </span>
          </div>
          <p className='text-xs text-muted-foreground mt-1'>
            Based on current resource configuration
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
