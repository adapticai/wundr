'use client';

/**
 * Report Filters Component
 * Dynamic filter builder for reports with multiple filter types
 */

import { Filter, X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { DateRangePicker } from './date-range-picker';

import type { ReportFilter } from '../types';

interface ReportFiltersProps {
  filters: ReportFilter[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onApply?: () => void;
  onReset?: () => void;
  className?: string;
  collapsible?: boolean;
}

export function ReportFilters({
  filters,
  values,
  onChange,
  onApply,
  onReset,
  className,
  collapsible = false,
}: ReportFiltersProps) {
  const [isExpanded, setIsExpanded] = React.useState(!collapsible);

  const handleValueChange = (filterId: string, value: unknown) => {
    onChange({
      ...values,
      [filterId]: value,
    });
  };

  const handleReset = () => {
    const resetValues: Record<string, unknown> = {};
    filters.forEach(filter => {
      resetValues[filter.id] = undefined;
    });
    onChange(resetValues);
    onReset?.();
  };

  const activeFilterCount = React.useMemo(() => {
    return Object.values(values).filter(v => v !== undefined && v !== '')
      .length;
  }, [values]);

  const renderFilter = (filter: ReportFilter) => {
    const value = values[filter.id];

    switch (filter.type) {
      case 'text':
        return (
          <Input
            id={filter.id}
            placeholder={`Enter ${filter.label.toLowerCase()}`}
            value={(value as string) || ''}
            onChange={e => handleValueChange(filter.id, e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            id={filter.id}
            type='number'
            placeholder={`Enter ${filter.label.toLowerCase()}`}
            value={(value as number) || ''}
            onChange={e => handleValueChange(filter.id, Number(e.target.value))}
          />
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={v => handleValueChange(filter.id, v)}
          >
            <SelectTrigger id={filter.id}>
              <SelectValue
                placeholder={`Select ${filter.label.toLowerCase()}`}
              />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'daterange':
        return (
          <DateRangePicker
            value={value as any}
            onChange={range => handleValueChange(filter.id, range)}
            className='w-full'
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Filter className='h-4 w-4' />
            <CardTitle className='text-lg'>Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant='secondary'>{activeFilterCount}</Badge>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {activeFilterCount > 0 && (
              <Button
                variant='ghost'
                size='sm'
                onClick={handleReset}
                className='h-8'
              >
                <X className='h-3 w-3 mr-1' />
                Clear
              </Button>
            )}
            {collapsible && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsExpanded(!isExpanded)}
                className='h-8'
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Filter your report data using the options below
        </CardDescription>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {filters.map(filter => (
              <div key={filter.id} className='space-y-2'>
                <Label htmlFor={filter.id}>
                  {filter.label}
                  {filter.required && (
                    <span className='text-destructive ml-1'>*</span>
                  )}
                </Label>
                {renderFilter(filter)}
              </div>
            ))}
          </div>
          {onApply && (
            <div className='flex justify-end gap-2 mt-4'>
              <Button onClick={onApply}>Apply Filters</Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
