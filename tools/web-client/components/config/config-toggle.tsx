'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { ConfigField } from './config-field';

interface ConfigToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}

export function ConfigToggle({
  label,
  description,
  checked,
  onChange,
  error,
  disabled = false,
}: ConfigToggleProps) {
  return (
    <ConfigField label={label} description={description} error={error}>
      <div className="flex items-center space-x-2">
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <span className="text-sm text-muted-foreground">
          {checked ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    </ConfigField>
  );
}