'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { ConfigField } from './config-field';

interface ConfigInputProps {
  label: string;
  description?: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'number' | 'email' | 'url' | 'password';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export function ConfigInput({
  label,
  description,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  min,
  max,
  step,
}: ConfigInputProps) {
  return (
    <ConfigField 
      label={label} 
      description={description} 
      error={error}
      required={required}
    >
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={error ? 'border-destructive' : ''}
      />
    </ConfigField>
  );
}