'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Folder, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  HelpCircle
} from 'lucide-react';

interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'directory';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

interface ParameterFormProps {
  parameters: ScriptParameter[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function ParameterForm({ parameters, values, onChange, disabled = false }: ParameterFormProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateParameter = (param: ScriptParameter, value: unknown): string | null => {
    if (param.required && (value === undefined || value === '' || value === null)) {
      return `${param.name} is required`;
    }

    if (value !== undefined && value !== '' && param.validation) {
      const validation = param.validation;

      if (param.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return `${param.name} must be a valid number`;
        }
        if (validation.min !== undefined && numValue < validation.min) {
          return `${param.name} must be at least ${validation.min}`;
        }
        if (validation.max !== undefined && numValue > validation.max) {
          return `${param.name} must be at most ${validation.max}`;
        }
      }

      if (param.type === 'string' && validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(String(value))) {
          return `${param.name} format is invalid`;
        }
      }
    }

    return null;
  };

  const handleValueChange = (paramName: string, value: unknown) => {
    const newValues = { ...values, [paramName]: value };
    onChange(newValues);

    // Mark field as touched
    setTouched(prev => ({ ...prev, [paramName]: true }));

    // Validate the specific parameter
    const param = parameters.find(p => p.name === paramName);
    if (param) {
      const error = validateParameter(param, value);
      setValidationErrors(prev => ({
        ...prev,
        [paramName]: error || ''
      }));
    }
  };

  const handleBlur = (paramName: string) => {
    setTouched(prev => ({ ...prev, [paramName]: true }));
  };

  // Validate all parameters when they change
  useEffect(() => {
    const errors: Record<string, string> = {};
    parameters.forEach(param => {
      const error = validateParameter(param, values[param.name]);
      if (error) {
        errors[param.name] = error;
      }
    });
    setValidationErrors(errors);
  }, [parameters, values]);

  const renderParameterInput = (param: ScriptParameter) => {
    const value = values[param.name] ?? '';
    const error = touched[param.name] ? validationErrors[param.name] : '';
    const hasError = Boolean(error);

    switch (param.type) {
      case 'string':
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(param.name, e.target.value)}
            onBlur={() => handleBlur(param.name)}
            placeholder={param.defaultValue || `Enter ${param.name}...`}
            disabled={disabled}
            className={hasError ? 'border-red-500' : ''}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(param.name, e.target.value ? Number(e.target.value) : '')}
            onBlur={() => handleBlur(param.name)}
            placeholder={param.defaultValue?.toString() || `Enter ${param.name}...`}
            min={param.validation?.min}
            max={param.validation?.max}
            disabled={disabled}
            className={hasError ? 'border-red-500' : ''}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleValueChange(param.name, e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleValueChange(param.name, e.target.value)}
            onBlur={() => handleBlur(param.name)}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md bg-background ${
              hasError ? 'border-red-500' : 'border-input'
            }`}
          >
            <option value="">Select {param.name}...</option>
            {param.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                value={value}
                onChange={(e) => handleValueChange(param.name, e.target.value)}
                onBlur={() => handleBlur(param.name)}
                placeholder="Enter file path or select..."
                disabled={disabled}
                className={`flex-1 ${hasError ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  // In a real implementation, this would open a file picker
                  const path = prompt('Enter file path:');
                  if (path) {
                    handleValueChange(param.name, path);
                  }
                }}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 'directory':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                value={value}
                onChange={(e) => handleValueChange(param.name, e.target.value)}
                onBlur={() => handleBlur(param.name)}
                placeholder="Enter directory path or select..."
                disabled={disabled}
                className={`flex-1 ${hasError ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  // In a real implementation, this would open a directory picker
                  const path = prompt('Enter directory path:');
                  if (path) {
                    handleValueChange(param.name, path);
                  }
                }}
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getParameterIcon = (type: string) => {
    switch (type) {
      case 'file': return <FileText className="h-4 w-4" />;
      case 'directory': return <Folder className="h-4 w-4" />;
      case 'boolean': return <CheckCircle2 className="h-4 w-4" />;
      case 'select': return <Info className="h-4 w-4" />;
      default: return <HelpCircle className="h-4 w-4" />;
    }
  };

  if (parameters.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Info className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <h3 className="text-lg font-semibold">No Parameters Required</h3>
          <p className="text-muted-foreground">
            This script runs without any configuration parameters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Script Parameters</CardTitle>
        <CardDescription>
          Configure the parameters for script execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {parameters.map((param) => {
          const error = touched[param.name] ? validationErrors[param.name] : '';
          const hasError = Boolean(error);
          const hasValue = values[param.name] !== undefined && values[param.name] !== '';

          return (
            <div key={param.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getParameterIcon(param.type)}
                  <label className="text-sm font-medium">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <Badge variant="outline" className="text-xs">
                    {param.type}
                  </Badge>
                </div>
                {hasValue && !hasError && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {hasError && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {param.description}
              </p>

              {renderParameterInput(param)}

              {hasError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}

              {param.validation && (
                <div className="text-xs text-muted-foreground">
                  {param.type === 'number' && (
                    <div>
                      Range: {param.validation.min ?? 'no min'} - {param.validation.max ?? 'no max'}
                    </div>
                  )}
                  {param.validation.pattern && (
                    <div>
                      Pattern: <code className="bg-muted px-1 rounded">{param.validation.pattern}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Validation Summary */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive font-medium text-sm">
              <AlertCircle className="h-4 w-4" />
              Parameter Validation Errors
            </div>
            <ul className="mt-2 text-sm text-destructive space-y-1">
              {Object.entries(validationErrors).map(([param, error]) => 
                error && (
                  <li key={param} className="flex items-center gap-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {/* Success Summary */}
        {Object.keys(validationErrors).length === 0 && touched && Object.keys(touched).length > 0 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
              <CheckCircle2 className="h-4 w-4" />
              All parameters are valid
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}