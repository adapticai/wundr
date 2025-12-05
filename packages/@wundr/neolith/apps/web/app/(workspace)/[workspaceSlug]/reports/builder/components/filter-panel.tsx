'use client';

/**
 * Filter Panel Component
 * Configure filters for report widgets
 */

import { Plus, Trash2, Filter } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import type { ReportWidget, FilterConfig } from '../types';

interface FilterPanelProps {
  widget: ReportWidget;
  filters: FilterConfig[];
  onFiltersChange: (filters: FilterConfig[]) => void;
}

export function FilterPanel({
  widget,
  filters,
  onFiltersChange,
}: FilterPanelProps) {
  const [editingFilter, setEditingFilter] = useState<FilterConfig | null>(null);

  const handleAddFilter = () => {
    const newFilter: FilterConfig = {
      field: '',
      operator: 'equals',
      value: '',
    };
    setEditingFilter(newFilter);
  };

  const handleSaveFilter = () => {
    if (!editingFilter || !editingFilter.field) return;

    const existingIndex = filters.findIndex(
      f =>
        f.field === editingFilter.field && f.operator === editingFilter.operator
    );

    if (existingIndex >= 0) {
      const updated = [...filters];
      updated[existingIndex] = editingFilter;
      onFiltersChange(updated);
    } else {
      onFiltersChange([...filters, editingFilter]);
    }

    setEditingFilter(null);
  };

  const handleDeleteFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='text-base'>Filters</CardTitle>
            <CardDescription className='text-xs'>
              Filter data before display
            </CardDescription>
          </div>
          <Button variant='outline' size='sm' onClick={handleAddFilter}>
            <Plus className='h-3 w-3 mr-1' />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {filters.length === 0 && !editingFilter && (
            <div className='text-center py-4 text-sm text-muted-foreground'>
              No filters configured
            </div>
          )}

          {/* Existing Filters */}
          {filters.map((filter, index) => (
            <div
              key={index}
              className='flex items-center gap-2 p-2 rounded-md bg-muted/50'
            >
              <Filter className='h-3 w-3 text-muted-foreground flex-shrink-0' />
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-medium truncate'>
                  {filter.field}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {filter.operator} {String(filter.value)}
                </div>
              </div>
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6 flex-shrink-0'
                onClick={() => handleDeleteFilter(index)}
              >
                <Trash2 className='h-3 w-3' />
              </Button>
            </div>
          ))}

          {/* Filter Editor */}
          {editingFilter && (
            <div className='space-y-3 p-3 border rounded-md'>
              <div className='space-y-2'>
                <Label className='text-xs'>Field</Label>
                <Input
                  placeholder='Enter field name'
                  value={editingFilter.field}
                  onChange={e =>
                    setEditingFilter({
                      ...editingFilter,
                      field: e.target.value,
                    })
                  }
                  className='h-8 text-sm'
                />
              </div>

              <div className='space-y-2'>
                <Label className='text-xs'>Operator</Label>
                <Select
                  value={editingFilter.operator}
                  onValueChange={v =>
                    setEditingFilter({
                      ...editingFilter,
                      operator: v as FilterConfig['operator'],
                    })
                  }
                >
                  <SelectTrigger className='h-8 text-sm'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='equals'>Equals</SelectItem>
                    <SelectItem value='not_equals'>Not Equals</SelectItem>
                    <SelectItem value='contains'>Contains</SelectItem>
                    <SelectItem value='gt'>Greater Than</SelectItem>
                    <SelectItem value='lt'>Less Than</SelectItem>
                    <SelectItem value='between'>Between</SelectItem>
                    <SelectItem value='in'>In</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label className='text-xs'>Value</Label>
                <Input
                  placeholder='Enter value'
                  value={String(editingFilter.value || '')}
                  onChange={e =>
                    setEditingFilter({
                      ...editingFilter,
                      value: e.target.value,
                    })
                  }
                  className='h-8 text-sm'
                />
              </div>

              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  className='flex-1'
                  onClick={() => setEditingFilter(null)}
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  className='flex-1'
                  onClick={handleSaveFilter}
                  disabled={!editingFilter.field}
                >
                  Save Filter
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
