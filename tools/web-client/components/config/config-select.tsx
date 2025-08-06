'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigField } from './config-field';

interface ConfigSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface ConfigSelectProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: ConfigSelectOption[];
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function ConfigSelect({
  label,
  description,
  value,
  onChange,
  options,
  error,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
}: ConfigSelectProps) {
  return (
    <ConfigField 
      label={label} 
      description={description} 
      error={error}
      required={required}
    >
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={error ? 'border-destructive' : ''}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ConfigField>
  );
}