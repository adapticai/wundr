'use client';

/**
 * Date Range Picker Component
 * Advanced date range picker with presets and custom range selection
 */

import { addDays, format, startOfDay, startOfYear, subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { DateRange, DateRangePreset } from '../types';

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
  showPresets?: boolean;
}

interface PresetOption {
  label: string;
  value: DateRangePreset;
  getRange: () => DateRange;
}

const presetOptions: PresetOption[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: () => ({
      from: startOfDay(new Date()),
      to: new Date(),
    }),
  },
  {
    label: 'Last 7 days',
    value: '7d',
    getRange: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
    }),
  },
  {
    label: 'Last 30 days',
    value: '30d',
    getRange: () => ({
      from: subDays(new Date(), 30),
      to: new Date(),
    }),
  },
  {
    label: 'Last 90 days',
    value: '90d',
    getRange: () => ({
      from: subDays(new Date(), 90),
      to: new Date(),
    }),
  },
  {
    label: 'Year to date',
    value: 'ytd',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
];

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Pick a date range',
  showPresets = true,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(value);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    setDate(value);
  }, [value]);

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range);
    onChange?.(range);
  };

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getRange();
    handleSelect(range);
    setIsOpen(false);
  };

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) {
return placeholder;
}
    if (!range.to) {
return format(range.from, 'MMM dd, yyyy');
}
    return `${format(range.from, 'MMM dd, yyyy')} - ${format(range.to, 'MMM dd, yyyy')}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange(date)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {showPresets && (
            <div className="border-r">
              <div className="flex flex-col gap-1 p-3">
                <div className="text-sm font-medium mb-2">Presets</div>
                {presetOptions.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Calendar
              mode="range"
              selected={
                date
                  ? { from: date.from, to: date.to }
                  : undefined
              }
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  handleSelect({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
              captionLayout="dropdown"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
