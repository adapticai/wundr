'use client';

import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ReportFilters } from '@/types/reports';
import { format } from 'date-fns';

interface ReportFiltersPanelProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
}

const severityOptions = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
];

const categoryOptions = [
  'Migration',
  'Dependencies',
  'Security',
  'Performance',
  'Code Quality',
  'Compliance',
  'Architecture',
  'Testing',
];

const fileTypeOptions = [
  '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
  '.py', '.java', '.cs', '.go', '.rb', '.php',
  '.json', '.yaml', '.xml', '.md',
];

const authorOptions = [
  'admin@wundr.io',
  'developer@wundr.io',
  'security@wundr.io',
  'qa@wundr.io',
  'devops@wundr.io',
];

export function ReportFiltersPanel({ filters, onChange }: ReportFiltersPanelProps) {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: filters.dateRange?.start,
    to: filters.dateRange?.end,
  });

  const updateFilters = (updates: Partial<ReportFilters>) => {
    onChange({ ...filters, ...updates });
  };

  const toggleSeverity = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    const currentSeverities = filters.severity || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [...currentSeverities, severity];
    
    updateFilters({ severity: newSeverities.length > 0 ? newSeverities : undefined });
  };

  const toggleCategory = (category: string) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    updateFilters({ categories: newCategories.length > 0 ? newCategories : undefined });
  };

  const toggleAuthor = (author: string) => {
    const currentAuthors = filters.authors || [];
    const newAuthors = currentAuthors.includes(author)
      ? currentAuthors.filter(a => a !== author)
      : [...currentAuthors, author];
    
    updateFilters({ authors: newAuthors.length > 0 ? newAuthors : undefined });
  };

  const toggleFileType = (fileType: string) => {
    const currentFileTypes = filters.fileTypes || [];
    const newFileTypes = currentFileTypes.includes(fileType)
      ? currentFileTypes.filter(ft => ft !== fileType)
      : [...currentFileTypes, fileType];
    
    updateFilters({ fileTypes: newFileTypes.length > 0 ? newFileTypes : undefined });
  };

  const applyDateRange = () => {
    if (dateRange.from && dateRange.to) {
      updateFilters({
        dateRange: {
          start: dateRange.from,
          end: dateRange.to,
        },
      });
    } else {
      updateFilters({ dateRange: undefined });
    }
  };

  const clearAllFilters = () => {
    onChange({});
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof ReportFilters];
    return value !== undefined && (Array.isArray(value) ? value.length > 0 : true);
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Advanced Filters</h4>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => {
                    setDateRange({ from: range?.from, to: range?.to });
                    if (range?.from && range?.to) {
                      updateFilters({
                        dateRange: {
                          start: range.from,
                          end: range.to,
                        },
                      });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label>Severity</Label>
            <div className="grid grid-cols-2 gap-2">
              {severityOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`severity-${option.value}`}
                    checked={filters.severity?.includes(option.value as any) || false}
                    onCheckedChange={() => toggleSeverity(option.value as any)}
                  />
                  <Label htmlFor={`severity-${option.value}`} className="text-sm">
                    <Badge className={option.color} variant="secondary">
                      {option.label}
                    </Badge>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {categoryOptions.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={filters.categories?.includes(category) || false}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  <Label htmlFor={`category-${category}`} className="text-sm">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Authors */}
          <div className="space-y-2">
            <Label>Authors</Label>
            <div className="space-y-2">
              {authorOptions.map((author) => (
                <div key={author} className="flex items-center space-x-2">
                  <Checkbox
                    id={`author-${author}`}
                    checked={filters.authors?.includes(author) || false}
                    onCheckedChange={() => toggleAuthor(author)}
                  />
                  <Label htmlFor={`author-${author}`} className="text-sm">
                    {author}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* File Types */}
          <div className="space-y-2">
            <Label>File Types</Label>
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {fileTypeOptions.map((fileType) => (
                <div key={fileType} className="flex items-center space-x-2">
                  <Checkbox
                    id={`filetype-${fileType}`}
                    checked={filters.fileTypes?.includes(fileType) || false}
                    onCheckedChange={() => toggleFileType(fileType)}
                  />
                  <Label htmlFor={`filetype-${fileType}`} className="text-xs">
                    {fileType}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t">
            <Label className="text-sm font-medium">Active Filters:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {filters.dateRange && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Date Range
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => updateFilters({ dateRange: undefined })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {filters.severity?.map((severity) => (
                <Badge key={severity} variant="secondary" className="flex items-center gap-1">
                  {severity}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => toggleSeverity(severity)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {filters.categories?.map((category) => (
                <Badge key={category} variant="secondary" className="flex items-center gap-1">
                  {category}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => toggleCategory(category)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {filters.authors?.map((author) => (
                <Badge key={author} variant="secondary" className="flex items-center gap-1">
                  {author}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => toggleAuthor(author)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {filters.fileTypes?.map((fileType) => (
                <Badge key={fileType} variant="secondary" className="flex items-center gap-1">
                  {fileType}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => toggleFileType(fileType)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}