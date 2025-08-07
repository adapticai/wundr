'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfigField } from './config-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Palette, Copy, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

export interface ColorPalette {
  name: string;
  description: string;
  colors: string[];
}

export interface ConfigColorPickerProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  presetColors?: string[];
  colorPalettes?: ColorPalette[];
  showPalettes?: boolean;
  showGradients?: boolean;
  allowTransparency?: boolean;
  showHistory?: boolean;
  disabled?: boolean;
  required?: boolean;
}

const defaultPresetColors = [
  '#000000', '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
  '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
  '#fef2f2', '#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c',
  '#fff7ed', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#c2410c',
  '#fefce8', '#fef3c7', '#fde047', '#eab308', '#ca8a04', '#a16207',
  '#f0fdf4', '#bbf7d0', '#4ade80', '#22c55e', '#16a34a', '#15803d',
  '#f0fdfa', '#a7f3d0', '#34d399', '#10b981', '#059669', '#047857',
  '#f0f9ff', '#bae6fd', '#0ea5e9', '#0284c7', '#0369a1', '#075985',
  '#eff6ff', '#c7d2fe', '#818cf8', '#6366f1', '#4f46e5', '#4338ca',
  '#f5f3ff', '#ddd6fe', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9',
  '#fdf4ff', '#f3e8ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea',
  '#fdf2f8', '#fce7f3', '#f9a8d4', '#ec4899', '#db2777', '#be185d',
];

const defaultColorPalettes: ColorPalette[] = [
  {
    name: 'Brand Colors',
    description: 'Primary brand and accent colors',
    colors: ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a', '#312e81'],
  },
  {
    name: 'Neutral Grays',
    description: 'Neutral colors for backgrounds and text',
    colors: ['#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1e293b'],
  },
  {
    name: 'Success States',
    description: 'Colors for success and positive states',
    colors: ['#dcfce7', '#bbf7d0', '#4ade80', '#16a34a', '#15803d'],
  },
  {
    name: 'Warning States',
    description: 'Colors for warnings and caution',
    colors: ['#fefce8', '#fde047', '#eab308', '#ca8a04', '#a16207'],
  },
  {
    name: 'Error States',
    description: 'Colors for errors and destructive actions',
    colors: ['#fef2f2', '#fecaca', '#ef4444', '#dc2626', '#b91c1c'],
  },
  {
    name: 'Info States',
    description: 'Colors for informational content',
    colors: ['#f0f9ff', '#bae6fd', '#0ea5e9', '#0284c7', '#0369a1'],
  },
];

export function ConfigColorPicker({
  label,
  description,
  value,
  onChange,
  error,
  presetColors = defaultPresetColors,
  colorPalettes = defaultColorPalettes,
  showPalettes = true,
  showGradients = false,
  allowTransparency = false,
  showHistory = true,
  disabled = false,
  required = false,
}: ConfigColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [colorHistory, setColorHistory] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState(value);
  const { theme } = useTheme();
  
  const handleColorChange = useCallback((color: string) => {
    onChange(color);
    setCustomColor(color);
    
    // Add to history
    if (showHistory && color !== value) {
      setColorHistory(prev => {
        const filtered = prev.filter(c => c !== color);
        return [color, ...filtered].slice(0, 12);
      });
    }
    
    setIsOpen(false);
  }, [onChange, value, showHistory]);
  
  const handleInputChange = useCallback((inputValue: string) => {
    setCustomColor(inputValue);
    if (isValidHex(inputValue) || isValidRgb(inputValue) || isValidHsl(inputValue)) {
      onChange(inputValue);
    }
  }, [onChange]);
  
  const isValidHex = useCallback((color: string) => {
    return /^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }, []);
  
  const isValidRgb = useCallback((color: string) => {
    return /^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/.test(color) ||
           /^rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9\.]+)\s*\)$/.test(color);
  }, []);
  
  const isValidHsl = useCallback((color: string) => {
    return /^hsl\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})%\s*,\s*([0-9]{1,3})%\s*\)$/.test(color) ||
           /^hsla\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})%\s*,\s*([0-9]{1,3})%\s*,\s*([0-9\.]+)\s*\)$/.test(color);
  }, []);
  
  const isValidColor = useCallback((color: string) => {
    return isValidHex(color) || isValidRgb(color) || isValidHsl(color);
  }, [isValidHex, isValidRgb, isValidHsl]);
  
  const copyToClipboard = useCallback(async (color: string) => {
    try {
      await navigator.clipboard.writeText(color);
      // Could show a toast here
    } catch (err) {
      console.error('Failed to copy color:', err);
    }
  }, []);
  
  const resetToDefault = useCallback(() => {
    handleColorChange('#000000');
  }, [handleColorChange]);
  
  // Load color history from localStorage on mount
  useEffect(() => {
    if (showHistory) {
      const saved = localStorage.getItem('wundr-color-history');
      if (saved) {
        try {
          setColorHistory(JSON.parse(saved));
        } catch {}
      }
    }
  }, [showHistory]);
  
  // Save color history to localStorage
  useEffect(() => {
    if (showHistory && colorHistory.length > 0) {
      localStorage.setItem('wundr-color-history', JSON.stringify(colorHistory));
    }
  }, [colorHistory, showHistory]);
  
  const displayColor = useMemo(() => {
    return isValidColor(value) ? value : '#ffffff';
  }, [value, isValidColor]);

  return (
    <ConfigField 
      label={label} 
      description={description} 
      error={error}
      required={required}
    >
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              value={customColor}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={allowTransparency ? "#000000 or rgba(0,0,0,0.5)" : "#000000"}
              className={cn(
                'font-mono pr-20',
                error && 'border-destructive',
                isValidColor(customColor) && 'border-green-500'
              )}
              disabled={disabled}
              required={required}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {isValidColor(value) ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(value)}
                title="Copy color"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-12 h-10 p-0 border-2 relative overflow-hidden"
                style={{ backgroundColor: displayColor }}
                disabled={disabled}
                title="Open color picker"
              >
                <Palette className="h-4 w-4 text-white mix-blend-difference" />
                <span className="sr-only">Pick color</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
              <Tabs defaultValue="presets" className="w-full">
                <TabsList className="w-full grid-cols-3" style={{ gridTemplateColumns: showPalettes ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                  <TabsTrigger value="presets">Presets</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                  {showPalettes && <TabsTrigger value="palettes">Palettes</TabsTrigger>}
                </TabsList>
                
                <TabsContent value="presets" className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Preset Colors</label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetToDefault}
                        className="h-6 px-2 text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-8 gap-1">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            'w-8 h-8 rounded border-2 transition-all hover:scale-110',
                            value === color
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-border hover:border-border/60'
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorChange(color)}
                          title={color}
                        />
                      ))}
                    </div>
                    
                    {showHistory && colorHistory.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Recent Colors</label>
                        <div className="grid grid-cols-8 gap-1">
                          {colorHistory.map((color, index) => (
                            <button
                              key={`${color}-${index}`}
                              type="button"
                              className={cn(
                                'w-8 h-8 rounded border transition-all hover:scale-110',
                                value === color
                                  ? 'border-primary ring-2 ring-primary/20'
                                  : 'border-border hover:border-border/60'
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => handleColorChange(color)}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="custom" className="p-4 space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Color Picker</label>
                    <Input
                      type="color"
                      value={isValidHex(value) ? value : '#000000'}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-full h-16 cursor-pointer"
                    />
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Color Values</label>
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between p-2 bg-muted rounded">
                          <span>HEX:</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {showPalettes && (
                  <TabsContent value="palettes" className="p-4 space-y-4">
                    <div className="space-y-4">
                      {colorPalettes.map((palette) => (
                        <div key={palette.name} className="space-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">{palette.name}</h4>
                              <Badge variant="secondary" className="text-xs">
                                {palette.colors.length}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{palette.description}</p>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {palette.colors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={cn(
                                  'w-full h-8 rounded border transition-all hover:scale-105',
                                  value === color
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-border hover:border-border/60'
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => handleColorChange(color)}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Color preview bar */}
        <div 
          className="h-2 rounded border"
          style={{ backgroundColor: displayColor }}
          title={`Preview: ${value}`}
        />
      </div>
    </ConfigField>
  );
}

// Specialized color picker variants
export function ConfigThemeColorPicker(props: Omit<ConfigColorPickerProps, 'colorPalettes'>) {
  const themePalettes: ColorPalette[] = [
    {
      name: 'Primary Colors',
      description: 'Main brand colors for primary actions',
      colors: ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a', '#312e81'],
    },
    {
      name: 'Secondary Colors', 
      description: 'Supporting colors for secondary elements',
      colors: ['#6b7280', '#4b5563', '#374151', '#1f2937', '#111827'],
    },
    {
      name: 'Accent Colors',
      description: 'Bright colors for highlights and accents',
      colors: ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
    },
  ];
  
  return (
    <ConfigColorPicker 
      {...props} 
      colorPalettes={themePalettes}
      showPalettes={true}
      showHistory={true}
    />
  );
}

export function ConfigBrandColorPicker(props: Omit<ConfigColorPickerProps, 'colorPalettes'>) {
  const brandPalettes: ColorPalette[] = [
    {
      name: 'Brand Primary',
      description: 'Primary brand colors',
      colors: ['#0066cc', '#0052a3', '#003d7a', '#002951', '#001428'],
    },
    {
      name: 'Brand Secondary',
      description: 'Secondary brand colors',
      colors: ['#00cc66', '#00a352', '#007a3d', '#005129', '#002814'],
    },
  ];
  
  return (
    <ConfigColorPicker 
      {...props} 
      colorPalettes={brandPalettes}
      showPalettes={true}
      showHistory={true}
      allowTransparency={false}
    />
  );
}