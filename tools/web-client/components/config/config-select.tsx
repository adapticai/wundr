'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigField } from './config-field';
import { configValidator } from '@/lib/config-validation';
import { ConfigurationState } from '@/types/config';
import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ConfigSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface ConfigSelectProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: ConfigSelectOption[];
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  section?: keyof ConfigurationState;
  field?: string;
  validateOnChange?: boolean;
  showValidationIcon?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  allowCustom?: boolean;
}

export function ConfigSelect({
  label,
  description,
  value,
  onChange,
  options,
  error: externalError,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  section,
  field,
  validateOnChange = true,
  showValidationIcon = true,
  searchable = false,
  multiple = false,
  allowCustom = false,
}: ConfigSelectProps) {
  const [localError, setLocalError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const error = externalError || localError;
  
  const validateValue = useCallback((val: string) => {
    if (!section || !field || !validateOnChange) return;
    
    const validationResult = configValidator.validateField(field, val);
    setLocalError(validationResult.errors.length > 0 ? validationResult.errors[0].message : '');
    setIsValid(validationResult.isValid);
  }, [section, field, validateOnChange]);
  
  const handleValueChange = useCallback((newValue: string) => {
    onChange(newValue);
    if (validateOnChange) {
      validateValue(newValue);
    }
  }, [onChange, validateValue, validateOnChange]);
  
  // Validate on mount if value is already set
  useEffect(() => {
    if (value && section && field) {
      validateValue(value);
    }
  }, []);  // Only run on mount
  
  const getValidationIcon = () => {
    if (!showValidationIcon) return null;
    
    if (error) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    
    if (isValid && value) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    
    return null;
  };
  
  const getTriggerClassName = () => {
    return cn(
      error && 'border-destructive focus:ring-destructive',
      isValid && !error && 'border-green-500 focus:ring-green-500',
      showValidationIcon && 'pr-10'
    );
  };
  
  const getSelectedOption = () => {
    return options.find(option => option.value === value);
  };
  
  const getFilteredOptions = () => {
    if (!searchable || !searchTerm) return options;
    
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  
  const selectedOption = getSelectedOption();
  const filteredOptions = getFilteredOptions();
  
  return (
    <ConfigField 
      label={label} 
      description={description} 
      error={error}
      required={required}
    >
      <div className="relative">
        <Select 
          value={value} 
          onValueChange={handleValueChange} 
          disabled={disabled}
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <SelectTrigger className={getTriggerClassName()}>
            <div className="flex items-center gap-2 flex-1">
              {selectedOption?.icon && (
                <span className="flex-shrink-0">{selectedOption.icon}</span>
              )}
              <SelectValue placeholder={placeholder}>
                {selectedOption && (
                  <div className="flex items-center gap-2">
                    <span>{selectedOption.label}</span>
                    {selectedOption.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedOption.badge}
                      </Badge>
                    )}
                  </div>
                )}
              </SelectValue>
            </div>
            <div className="flex items-center gap-2">
              {getValidationIcon()}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </SelectTrigger>
          <SelectContent className="max-w-[400px]">
            {searchable && (
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {searchTerm ? 'No options found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  disabled={option.disabled}
                  className="py-3"
                >
                  <div className="flex items-start gap-3 w-full">
                    {option.icon && (
                      <span className="flex-shrink-0 mt-0.5">{option.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{option.label}</span>
                        {option.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {option.badge}
                          </Badge>
                        )}
                        {option.value === value && (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      {option.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))
            )}
            {allowCustom && (
              <>
                <div className="border-t my-1" />
                <div className="p-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    Can't find what you're looking for?
                  </div>
                  <input
                    type="text"
                    placeholder="Enter custom value"
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const customValue = (e.target as HTMLInputElement).value;
                        if (customValue) {
                          handleValueChange(customValue);
                          setIsOpen(false);
                        }
                      }
                    }}
                  />
                </div>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
    </ConfigField>
  );
}

// Specialized config select variants
export function ConfigThemeSelect(props: Omit<ConfigSelectProps, 'options'>) {
  const themeOptions: ConfigSelectOption[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Light theme with bright colors',
      icon: <span className="text-yellow-500">☀️</span>,
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Dark theme for low-light environments',
      icon: <span className="text-slate-400">🌙</span>,
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow system preference',
      icon: <span className="text-blue-500">💻</span>,
      badge: 'Auto',
    },
  ];
  
  return <ConfigSelect {...props} options={themeOptions} />;
}

export function ConfigAnalysisDepthSelect(props: Omit<ConfigSelectProps, 'options'>) {
  const depthOptions: ConfigSelectOption[] = [
    {
      value: 'shallow',
      label: 'Shallow',
      description: 'Fast analysis with basic detection',
      badge: 'Fast',
    },
    {
      value: 'medium',
      label: 'Medium',
      description: 'Balanced analysis with good coverage',
      badge: 'Recommended',
    },
    {
      value: 'deep',
      label: 'Deep',
      description: 'Thorough analysis with detailed insights',
      badge: 'Comprehensive',
    },
  ];
  
  return <ConfigSelect {...props} options={depthOptions} />;
}