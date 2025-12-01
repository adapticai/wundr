'use client';

import { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { WorkflowVariable } from '@/types/workflow';

export interface VariableInserterProps {
  variables: WorkflowVariable[];
  onInsert: (variableName: string) => void;
  onClose: () => void;
  className?: string;
}

export function VariableInserter({
  variables,
  onInsert,
  onClose,
  className,
}: VariableInserterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  // Group variables by source
  const groupedVariables = useMemo(() => {
    const groups: Record<string, WorkflowVariable[]> = {
      trigger: [],
      action: [],
      custom: [],
    };

    variables.forEach(variable => {
      if (groups[variable.source]) {
        groups[variable.source].push(variable);
      } else {
        groups.custom.push(variable);
      }
    });

    return groups;
  }, [variables]);

  // Filter variables
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedVariables;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, WorkflowVariable[]> = {};

    Object.entries(groupedVariables).forEach(([source, vars]) => {
      const matchingVars = vars.filter(
        v =>
          v.name.toLowerCase().includes(query) ||
          v.description?.toLowerCase().includes(query)
      );
      if (matchingVars.length > 0) {
        filtered[source] = matchingVars;
      }
    });

    return filtered;
  }, [groupedVariables, searchQuery]);

  const handleInsert = (variableName: string) => {
    const variableText = `{{${variableName}}}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variableName);
    setTimeout(() => setCopiedVariable(null), 2000);
    onInsert(variableName);
  };

  const totalVariables = Object.values(filteredGroups).reduce(
    (sum, vars) => sum + vars.length,
    0
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-sm font-semibold text-foreground'>Variables</h3>
          <p className='text-xs text-muted-foreground'>
            Click to copy, then paste where needed
          </p>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
          aria-label='Close variable inserter'
        >
          <XIcon className='h-5 w-5' />
        </button>
      </div>

      {/* Search */}
      <div className='relative'>
        <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
        <input
          type='text'
          placeholder='Search variables...'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className='w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          aria-label='Search variables'
        />
      </div>

      {/* Variable Groups */}
      {totalVariables === 0 ? (
        <div className='flex flex-col items-center justify-center py-8 text-center'>
          <VariableEmptyIcon className='h-10 w-10 text-muted-foreground' />
          <p className='mt-3 text-sm text-muted-foreground'>
            {searchQuery.trim()
              ? 'No variables match your search.'
              : 'No variables available.'}
          </p>
        </div>
      ) : (
        <div className='space-y-4 max-h-[60vh] overflow-auto'>
          {/* Trigger Variables */}
          {filteredGroups.trigger && filteredGroups.trigger.length > 0 && (
            <VariableGroup
              title='Trigger Variables'
              description='Data from the trigger event'
              variables={filteredGroups.trigger}
              onInsert={handleInsert}
              copiedVariable={copiedVariable}
            />
          )}

          {/* Action Variables */}
          {filteredGroups.action && filteredGroups.action.length > 0 && (
            <VariableGroup
              title='Action Variables'
              description='Output from previous actions'
              variables={filteredGroups.action}
              onInsert={handleInsert}
              copiedVariable={copiedVariable}
            />
          )}

          {/* Custom Variables */}
          {filteredGroups.custom && filteredGroups.custom.length > 0 && (
            <VariableGroup
              title='Custom Variables'
              description='User-defined variables'
              variables={filteredGroups.custom}
              onInsert={handleInsert}
              copiedVariable={copiedVariable}
            />
          )}
        </div>
      )}

      {/* Help Text */}
      <div className='rounded-md bg-muted/50 p-3 text-xs text-muted-foreground'>
        <p className='font-medium text-foreground'>How to use variables:</p>
        <ul className='mt-1.5 space-y-1'>
          <li>Click on a variable to copy it</li>
          <li>
            Paste it in any text field using{' '}
            <code className='rounded bg-muted px-1'>{'{{variable.name}}'}</code>
          </li>
          <li>Variables are replaced with actual values at runtime</li>
        </ul>
      </div>
    </div>
  );
}

interface VariableGroupProps {
  title: string;
  description: string;
  variables: WorkflowVariable[];
  onInsert: (variableName: string) => void;
  copiedVariable: string | null;
}

function VariableGroup({
  title,
  description,
  variables,
  onInsert,
  copiedVariable,
}: VariableGroupProps) {
  return (
    <div>
      <div className='mb-2'>
        <h4 className='text-sm font-medium text-foreground'>{title}</h4>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </div>
      <div className='space-y-1'>
        {variables.map(variable => (
          <VariableItem
            key={variable.name}
            variable={variable}
            onInsert={() => onInsert(variable.name)}
            isCopied={copiedVariable === variable.name}
          />
        ))}
      </div>
    </div>
  );
}

interface VariableItemProps {
  variable: WorkflowVariable;
  onInsert: () => void;
  isCopied: boolean;
}

function VariableItem({ variable, onInsert, isCopied }: VariableItemProps) {
  return (
    <button
      type='button'
      onClick={onInsert}
      className={cn(
        'group flex w-full items-center justify-between rounded-md border p-2 text-left transition-colors',
        isCopied
          ? 'border-green-500 bg-green-500/10'
          : 'border-border hover:border-primary/50 hover:bg-accent'
      )}
    >
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <code className='truncate text-xs font-medium text-foreground'>
            {`{{${variable.name}}}`}
          </code>
          <TypeBadge type={variable.type} />
        </div>
        {variable.description && (
          <p className='mt-0.5 truncate text-xs text-muted-foreground'>
            {variable.description}
          </p>
        )}
      </div>
      <div className='ml-2 shrink-0'>
        {isCopied ? (
          <span className='flex items-center gap-1 text-xs text-green-600 dark:text-green-400'>
            <CheckIcon className='h-4 w-4' />
            Copied
          </span>
        ) : (
          <CopyIcon className='h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
        )}
      </div>
    </button>
  );
}

interface TypeBadgeProps {
  type: WorkflowVariable['type'];
}

function TypeBadge({ type }: TypeBadgeProps) {
  const colorClasses: Record<WorkflowVariable['type'], string> = {
    string:
      'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400',
    number:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    boolean:
      'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400',
    array:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    object:
      'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400',
  };

  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium',
        colorClasses[type]
      )}
    >
      {type}
    </span>
  );
}

// Standalone Variable Inserter (for use in popovers/modals)
export interface VariableInserterPopoverProps {
  variables: WorkflowVariable[];
  onInsert: (variableName: string) => void;
  trigger: React.ReactNode;
  className?: string;
}

export function VariableInserterInline({
  variables,
  onInsert,
  className,
}: Omit<VariableInserterProps, 'onClose'>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  // Filter variables
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) {
      return variables;
    }

    const query = searchQuery.toLowerCase();
    return variables.filter(
      v =>
        v.name.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query)
    );
  }, [variables, searchQuery]);

  const handleInsert = (variableName: string) => {
    const variableText = `{{${variableName}}}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variableName);
    setTimeout(() => setCopiedVariable(null), 2000);
    onInsert(variableName);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search */}
      <div className='relative'>
        <SearchIcon className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
        <input
          type='text'
          placeholder='Search...'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className='w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          aria-label='Search variables'
        />
      </div>

      {/* Variable List */}
      <div className='max-h-48 overflow-auto space-y-0.5'>
        {filteredVariables.length === 0 ? (
          <p className='py-4 text-center text-xs text-muted-foreground'>
            {searchQuery.trim() ? 'No matches' : 'No variables'}
          </p>
        ) : (
          filteredVariables.map(variable => (
            <button
              key={variable.name}
              type='button'
              onClick={() => handleInsert(variable.name)}
              className={cn(
                'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors',
                copiedVariable === variable.name
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'hover:bg-accent'
              )}
            >
              <span className='font-mono'>{`{{${variable.name}}}`}</span>
              {copiedVariable === variable.name ? (
                <CheckIcon className='h-3.5 w-3.5' />
              ) : (
                <span className='text-[10px] text-muted-foreground'>
                  {variable.type}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  );
}

function VariableEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3' />
      <path d='M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3' />
      <path d='M12 20v-8a2 2 0 0 1 2-2h0' />
      <path d='m6 10 6 6' />
      <path d='m12 10-6 6' />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
      <path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}
