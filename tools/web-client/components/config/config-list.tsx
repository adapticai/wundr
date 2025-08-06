'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { ConfigField } from './config-field';

interface ConfigListProps {
  label: string;
  description?: string;
  items: string[];
  onChange: (items: string[]) => void;
  error?: string;
  placeholder?: string;
  maxItems?: number;
  allowDuplicates?: boolean;
}

export function ConfigList({
  label,
  description,
  items,
  onChange,
  error,
  placeholder = 'Add item...',
  maxItems,
  allowDuplicates = false,
}: ConfigListProps) {
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;
    
    if (!allowDuplicates && items.includes(trimmedValue)) return;
    if (maxItems && items.length >= maxItems) return;

    onChange([...items, trimmedValue]);
    setInputValue('');
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const canAddMore = !maxItems || items.length < maxItems;

  return (
    <ConfigField label={label} description={description} error={error}>
      <div className="space-y-3">
        {/* Input for adding new items */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={!canAddMore}
            className={error ? 'border-destructive' : ''}
          />
          <Button
            type="button"
            onClick={addItem}
            disabled={!inputValue.trim() || !canAddMore}
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Display current items */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <Badge key={index} variant="secondary" className="px-2 py-1">
                <span className="mr-1">{item}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Info text */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
          {maxItems && (
            <span>{items.length}/{maxItems} items</span>
          )}
        </div>
      </div>
    </ConfigField>
  );
}