'use client';

import { Check, Code2, Search, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { ScopedWorkflowVariable } from './variable-manager';

/**
 * Props for VariablePicker component
 */
export interface VariablePickerProps {
  variables: ScopedWorkflowVariable[];
  currentStepId?: string;
  value?: string;
  onSelect: (variableReference: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Variable type configuration for display
 */
const VARIABLE_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  string: { icon: 'Aa', color: 'text-blue-600' },
  number: { icon: '123', color: 'text-green-600' },
  boolean: { icon: 'T/F', color: 'text-purple-600' },
  array: { icon: '[]', color: 'text-orange-600' },
  object: { icon: '{}', color: 'text-pink-600' },
};

/**
 * Extract variable name from reference string
 */
function extractVariableName(reference: string): string | null {
  const match = reference.match(/\$\{variable\.([a-zA-Z_][a-zA-Z0-9_]*)\}/);
  return match ? match[1] : null;
}

/**
 * Create variable reference string
 */
function createVariableReference(variableName: string): string {
  return `\${variable.${variableName}}`;
}

/**
 * Variable picker component for selecting variables in step configurations
 */
export function VariablePicker({
  variables,
  currentStepId,
  value,
  onSelect,
  placeholder = 'Select a variable',
  className,
}: VariablePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Filter variables based on scope and search
  const availableVariables = React.useMemo(() => {
    return variables.filter((variable) => {
      // Include global variables
      if (variable.scope === 'global') {
        return true;
      }
      // Include step variables if they match current step
      if (variable.scope === 'step' && variable.stepId === currentStepId) {
        return true;
      }
      return false;
    });
  }, [variables, currentStepId]);

  // Filter by search term
  const filteredVariables = React.useMemo(() => {
    if (!search) {
return availableVariables;
}
    const searchLower = search.toLowerCase();
    return availableVariables.filter(
      (variable) =>
        variable.name.toLowerCase().includes(searchLower) ||
        variable.description?.toLowerCase().includes(searchLower),
    );
  }, [availableVariables, search]);

  // Group by scope
  const groupedVariables = React.useMemo(() => {
    const global = filteredVariables.filter((v) => v.scope === 'global');
    const step = filteredVariables.filter((v) => v.scope === 'step');
    return { global, step };
  }, [filteredVariables]);

  const selectedVariable = React.useMemo(() => {
    if (!value) {
return null;
}
    const varName = extractVariableName(value);
    if (!varName) {
return null;
}
    return variables.find((v) => v.name === varName);
  }, [value, variables]);

  const handleSelect = (variable: ScopedWorkflowVariable) => {
    onSelect(createVariableReference(variable.name));
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {selectedVariable ? (
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <span className="font-mono text-sm">{selectedVariable.name}</span>
              <Badge variant="secondary" className="text-xs">
                {selectedVariable.type}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search variables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {filteredVariables.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? (
                <>No variables found matching "{search}"</>
              ) : availableVariables.length === 0 ? (
                <>No variables available</>
              ) : (
                <>No variables found</>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {/* Global Variables */}
              {groupedVariables.global.length > 0 && (
                <div>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Global Variables
                  </div>
                  <div className="space-y-1">
                    {groupedVariables.global.map((variable) => (
                      <button
                        key={variable.id}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-2 text-sm rounded-md hover:bg-accent transition-colors',
                          selectedVariable?.id === variable.id && 'bg-accent',
                        )}
                        onClick={() => handleSelect(variable)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={cn(
                              'font-mono text-xs',
                              VARIABLE_TYPE_CONFIG[variable.type]?.color,
                            )}
                          >
                            {VARIABLE_TYPE_CONFIG[variable.type]?.icon}
                          </span>
                          <div className="flex flex-col items-start min-w-0 flex-1">
                            <span className="font-mono text-sm font-medium">
                              {variable.name}
                            </span>
                            {variable.description && (
                              <span className="text-xs text-muted-foreground truncate max-w-full">
                                {variable.description}
                              </span>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {variable.type}
                          </Badge>
                        </div>
                        {selectedVariable?.id === variable.id && (
                          <Check className="h-4 w-4 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step Variables */}
              {groupedVariables.step.length > 0 && (
                <div>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Step Variables
                  </div>
                  <div className="space-y-1">
                    {groupedVariables.step.map((variable) => (
                      <button
                        key={variable.id}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-2 text-sm rounded-md hover:bg-accent transition-colors',
                          selectedVariable?.id === variable.id && 'bg-accent',
                        )}
                        onClick={() => handleSelect(variable)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={cn(
                              'font-mono text-xs',
                              VARIABLE_TYPE_CONFIG[variable.type]?.color,
                            )}
                          >
                            {VARIABLE_TYPE_CONFIG[variable.type]?.icon}
                          </span>
                          <div className="flex flex-col items-start min-w-0 flex-1">
                            <span className="font-mono text-sm font-medium">
                              {variable.name}
                            </span>
                            {variable.description && (
                              <span className="text-xs text-muted-foreground truncate max-w-full">
                                {variable.description}
                              </span>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {variable.type}
                          </Badge>
                        </div>
                        {selectedVariable?.id === variable.id && (
                          <Check className="h-4 w-4 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with tips */}
        <div className="border-t p-2 bg-muted/30">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Code2 className="h-3 w-3" />
              <span>
                Variables are referenced as:{' '}
                <code className="bg-background px-1 py-0.5 rounded">
                  ${'{'}variable.name{'}'}
                </code>
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
