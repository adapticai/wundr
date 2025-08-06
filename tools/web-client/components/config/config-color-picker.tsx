'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfigField } from './config-field';

interface ConfigColorPickerProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  presetColors?: string[];
}

const defaultPresetColors = [
  '#000000', '#ffffff', '#f3f4f6', '#374151',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

export function ConfigColorPicker({
  label,
  description,
  value,
  onChange,
  error,
  presetColors = defaultPresetColors,
}: ConfigColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorChange = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  const isValidHex = (color: string) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  return (
    <ConfigField label={label} description={description} error={error}>
      <div className="flex gap-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={`font-mono ${error ? 'border-destructive' : ''}`}
        />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-12 h-10 p-0 border-2"
              style={{ backgroundColor: isValidHex(value) ? value : '#ffffff' }}
            >
              <span className="sr-only">Pick color</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Custom Color
                </label>
                <Input
                  type="color"
                  value={isValidHex(value) ? value : '#000000'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-full h-10"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Preset Colors
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorChange(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </ConfigField>
  );
}