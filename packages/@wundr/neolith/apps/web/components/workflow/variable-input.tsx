'use client';

import { Code2 } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { VariablePicker } from './variable-picker';

import type { ScopedWorkflowVariable } from './variable-manager';

/**
 * Props for VariableInput component
 */
export interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: ScopedWorkflowVariable[];
  currentStepId?: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Extract all variable references from a string
 */
function extractVariableReferences(text: string): string[] {
  const regex = /\$\{variable\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

/**
 * Insert variable reference at cursor position
 */
function insertVariableAtCursor(
  currentValue: string,
  variableReference: string,
  cursorPosition: number
): { newValue: string; newCursorPosition: number } {
  const before = currentValue.slice(0, cursorPosition);
  const after = currentValue.slice(cursorPosition);
  const newValue = before + variableReference + after;
  const newCursorPosition = cursorPosition + variableReference.length;
  return { newValue, newCursorPosition };
}

/**
 * Variable input component that allows mixing text and variable references
 */
export function VariableInput({
  value,
  onChange,
  variables,
  currentStepId,
  placeholder = 'Enter text or insert variables...',
  multiline = false,
  className,
  disabled = false,
}: VariableInputProps) {
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = React.useState(0);

  // Track cursor position
  const handleSelectionChange = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  };

  // Handle variable selection from picker
  const handleVariableSelect = (variableReference: string) => {
    const { newValue, newCursorPosition } = insertVariableAtCursor(
      value,
      variableReference,
      cursorPosition
    );
    onChange(newValue);

    // Set cursor position after update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(
          newCursorPosition,
          newCursorPosition
        );
        setCursorPosition(newCursorPosition);
      }
    }, 0);
  };

  // Extract used variables
  const usedVariableNames = React.useMemo(
    () => extractVariableReferences(value),
    [value]
  );

  // Find variable details
  const usedVariables = React.useMemo(() => {
    return usedVariableNames
      .map(name => variables.find(v => v.name === name))
      .filter((v): v is ScopedWorkflowVariable => v !== undefined);
  }, [usedVariableNames, variables]);

  // Check for undefined variables
  const undefinedVariables = React.useMemo(() => {
    return usedVariableNames.filter(
      name => !variables.find(v => v.name === name)
    );
  }, [usedVariableNames, variables]);

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className={cn('space-y-2', className)}>
      <div className='flex gap-2'>
        <div className='flex-1'>
          <InputComponent
            ref={inputRef as any}
            value={value}
            onChange={e => onChange(e.target.value)}
            onSelect={handleSelectionChange}
            onClick={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(multiline && 'min-h-[100px] resize-y')}
          />
        </div>
        <VariablePicker
          variables={variables}
          currentStepId={currentStepId}
          onSelect={handleVariableSelect}
          placeholder='Insert variable'
          className='w-[200px] shrink-0'
        />
      </div>

      {/* Used Variables Display */}
      {usedVariables.length > 0 && (
        <div className='flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md border'>
          <div className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Code2 className='h-3 w-3' />
            <span>Variables used:</span>
          </div>
          {usedVariables.map(variable => (
            <Badge
              key={variable.id}
              variant='secondary'
              className='text-xs font-mono'
            >
              {variable.name}
              <span className='ml-1 text-muted-foreground'>
                ({variable.type})
              </span>
            </Badge>
          ))}
        </div>
      )}

      {/* Undefined Variables Warning */}
      {undefinedVariables.length > 0 && (
        <div className='flex flex-wrap gap-2 p-2 bg-destructive/10 rounded-md border border-destructive/20'>
          <div className='flex items-center gap-1 text-xs text-destructive'>
            <Code2 className='h-3 w-3' />
            <span>Undefined variables:</span>
          </div>
          {undefinedVariables.map(name => (
            <Badge
              key={name}
              variant='destructive'
              className='text-xs font-mono'
            >
              {name}
            </Badge>
          ))}
        </div>
      )}

      {/* Help Text */}
      <p className='text-xs text-muted-foreground'>
        Use the "Insert variable" button to add variable references, or type $
        {'{'}
        variable.name{'}'} manually
      </p>
    </div>
  );
}
