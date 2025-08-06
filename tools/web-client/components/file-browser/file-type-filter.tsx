'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileTypeFilterProps {
  availableTypes: string[];
  selectedTypes: string[];
  onSelectionChange: (types: string[]) => void;
  className?: string;
}

export function FileTypeFilter({
  availableTypes,
  selectedTypes,
  onSelectionChange,
  className,
}: FileTypeFilterProps) {
  const handleToggleType = (type: string) => {
    const newSelection = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    onSelectionChange(newSelection);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  if (availableTypes.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Filter by type:
      </span>
      
      <div className="flex flex-wrap gap-1">
        {availableTypes.map(type => {
          const isSelected = selectedTypes.includes(type);
          return (
            <Badge
              key={type}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer text-xs transition-colors',
                isSelected && 'bg-primary text-primary-foreground',
                !isSelected && 'hover:bg-accent hover:text-accent-foreground'
              )}
              onClick={() => handleToggleType(type)}
            >
              .{type}
              {isSelected && (
                <X 
                  className="ml-1 h-2 w-2" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleType(type);
                  }}
                />
              )}
            </Badge>
          );
        })}
        
        {selectedTypes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-6 px-2 text-xs"
          >
            Clear All
          </Button>
        )}
      </div>
      
      {selectedTypes.length > 0 && (
        <span className="text-xs text-muted-foreground">
          ({selectedTypes.length} selected)
        </span>
      )}
    </div>
  );
}

export default FileTypeFilter;