'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ConfigField } from './config-field';
import { configValidator } from '@/lib/config-validation';
import { ConfigurationState } from '@/types/config';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  section?: keyof ConfigurationState;
  field?: string;
  validateOnBlur?: boolean;
  showValidationIcon?: boolean;
  autoComplete?: string;
}

export function ConfigInput({
  label,
  description,
  value,
  onChange,
  error: externalError,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  min,
  max,
  step,
  section,
  field,
  validateOnBlur = true,
  showValidationIcon = true,
  autoComplete,
}: ConfigInputProps) {
  const [localError, setLocalError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  
  const error = externalError || localError;
  
  const validateValue = useCallback((val: string | number) => {
    if (!section || !field || !validateOnBlur) return;
    
    // Convert to appropriate type
    let validationValue = val;
    if (type === 'number') {
      validationValue = typeof val === 'string' ? parseFloat(val) || 0 : val;
    }
    
    // Perform validation
    const validationResult = configValidator.validateField(field, validationValue);
    
    setLocalError(validationResult.errors.length > 0 ? validationResult.errors[0].message : '');
    setIsValid(validationResult.isValid);
  }, [section, field, type, validateOnBlur]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Real-time validation for certain fields
    if (isTouched && (type === 'url' || type === 'email')) {
      validateValue(newValue);
    }
  }, [onChange, validateValue, isTouched, type]);
  
  const handleBlur = useCallback(() => {
    setIsTouched(true);
    if (validateOnBlur) {
      validateValue(value);
    }
  }, [validateValue, value, validateOnBlur]);
  
  const handleFocus = useCallback(() => {
    if (!isTouched) {
      setLocalError('');
      setIsValid(null);
    }
  }, [isTouched]);
  
  // Validate on mount if value is already set
  useEffect(() => {
    if (value && section && field) {
      validateValue(value);
    }
  }, []);  // Only run on mount
  
  const getValidationIcon = () => {
    if (!showValidationIcon || !isTouched) return null;
    
    if (error) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    
    if (isValid && value) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    
    return null;
  };
  
  const getInputClassName = () => {
    return cn(
      error && 'border-destructive focus-visible:ring-destructive',
      isValid && isTouched && !error && 'border-green-500 focus-visible:ring-green-500',
      showValidationIcon && 'pr-10'
    );
  };
  
  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    // Auto-generate helpful placeholders
    switch (type) {
      case 'url':
        return 'https://example.com';
      case 'email':
        return 'user@example.com';
      case 'number':
        if (field === 'duplicateThreshold') return '0.8';
        if (field === 'complexityThreshold') return '10';
        if (field === 'minFileSize') return '100';
        if (field === 'maxFileSize') return '50';
        return 'Enter a number';
      case 'password':
        return '••••••••••••••••';
      default:
        return `Enter ${label.toLowerCase()}`;
    }
  };
  
  return (
    <ConfigField 
      label={label} 
      description={description} 
      error={error}
      required={required}
    >
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={getPlaceholder()}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          required={required}
          autoComplete={autoComplete}
          className={getInputClassName()}
          aria-invalid={!!error}
          aria-describedby={error ? `${field}-error` : undefined}
        />
        {showValidationIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getValidationIcon()}
          </div>
        )}
      </div>
    </ConfigField>
  );
}

// Specialized config input variants for common use cases
export function ConfigNumberInput(props: Omit<ConfigInputProps, 'type'>) {
  return <ConfigInput {...props} type="number" />;
}

export function ConfigUrlInput(props: Omit<ConfigInputProps, 'type'>) {
  return <ConfigInput {...props} type="url" autoComplete="url" />;
}

export function ConfigEmailInput(props: Omit<ConfigInputProps, 'type'>) {
  return <ConfigInput {...props} type="email" autoComplete="email" />;
}

export function ConfigPasswordInput(props: Omit<ConfigInputProps, 'type'>) {
  return <ConfigInput {...props} type="password" autoComplete="current-password" />;
}