'use client';

/**
 * Condition Builder Component
 *
 * Visual condition builder for workflow steps with:
 * - AND/OR logical groups with unlimited nesting
 * - Rich comparison operators (equals, contains, greater than, etc.)
 * - Variable references with type-aware suggestions
 * - Nested condition groups with visual hierarchy
 * - Real-time condition preview and natural language explanation
 * - Comprehensive validation with error reporting
 * - Pre-built condition templates for common patterns
 */

import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Copy,
  FileText,
  Filter,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { ScopedWorkflowVariable } from './variable-manager';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Comparison operators for conditions
 */
export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'matches_regex'
  | 'in_array'
  | 'not_in_array';

/**
 * Logical operators for condition groups
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Individual condition
 */
export interface Condition {
  id: string;
  variable: string; // Variable reference (e.g., "trigger.payload.email")
  operator: ComparisonOperator;
  value: string; // Can be a literal value or variable reference
  type: 'literal' | 'variable';
}

/**
 * Condition group with logical operator
 */
export interface ConditionGroup {
  id: string;
  operator: LogicalOperator;
  conditions: Array<Condition | ConditionGroup>;
}

/**
 * Validation error for a condition
 */
interface ConditionError {
  id: string;
  message: string;
}

// ============================================================================
// Operator Configuration
// ============================================================================

const OPERATOR_CONFIG: Record<
  ComparisonOperator,
  {
    label: string;
    requiresValue: boolean;
    supportedTypes: string[];
    description: string;
  }
> = {
  equals: {
    label: 'equals',
    requiresValue: true,
    supportedTypes: ['string', 'number', 'boolean'],
    description: 'Exact match',
  },
  not_equals: {
    label: 'does not equal',
    requiresValue: true,
    supportedTypes: ['string', 'number', 'boolean'],
    description: 'Not equal to value',
  },
  contains: {
    label: 'contains',
    requiresValue: true,
    supportedTypes: ['string', 'array'],
    description: 'Contains substring or element',
  },
  not_contains: {
    label: 'does not contain',
    requiresValue: true,
    supportedTypes: ['string', 'array'],
    description: 'Does not contain substring or element',
  },
  starts_with: {
    label: 'starts with',
    requiresValue: true,
    supportedTypes: ['string'],
    description: 'String starts with value',
  },
  ends_with: {
    label: 'ends with',
    requiresValue: true,
    supportedTypes: ['string'],
    description: 'String ends with value',
  },
  greater_than: {
    label: 'greater than',
    requiresValue: true,
    supportedTypes: ['number'],
    description: 'Numerically greater',
  },
  greater_than_or_equal: {
    label: 'greater than or equal',
    requiresValue: true,
    supportedTypes: ['number'],
    description: 'Numerically greater or equal',
  },
  less_than: {
    label: 'less than',
    requiresValue: true,
    supportedTypes: ['number'],
    description: 'Numerically less',
  },
  less_than_or_equal: {
    label: 'less than or equal',
    requiresValue: true,
    supportedTypes: ['number'],
    description: 'Numerically less or equal',
  },
  is_empty: {
    label: 'is empty',
    requiresValue: false,
    supportedTypes: ['string', 'array', 'object'],
    description: 'Empty or null',
  },
  is_not_empty: {
    label: 'is not empty',
    requiresValue: false,
    supportedTypes: ['string', 'array', 'object'],
    description: 'Not empty or null',
  },
  matches_regex: {
    label: 'matches regex',
    requiresValue: true,
    supportedTypes: ['string'],
    description: 'Matches regular expression',
  },
  in_array: {
    label: 'in array',
    requiresValue: true,
    supportedTypes: ['string', 'number'],
    description: 'Value exists in array',
  },
  not_in_array: {
    label: 'not in array',
    requiresValue: true,
    supportedTypes: ['string', 'number'],
    description: 'Value does not exist in array',
  },
};

// ============================================================================
// Condition Templates
// ============================================================================

const CONDITION_TEMPLATES: Array<{
  name: string;
  description: string;
  group: ConditionGroup;
}> = [
  {
    name: 'Email Validation',
    description: 'Check if email is valid and from specific domain',
    group: {
      id: 'template-1',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.email',
          operator: 'is_not_empty',
          value: '',
          type: 'literal',
        },
        {
          id: 'c2',
          variable: 'trigger.payload.email',
          operator: 'matches_regex',
          value: '^[^@]+@[^@]+\\.[^@]+$',
          type: 'literal',
        },
        {
          id: 'c3',
          variable: 'trigger.payload.email',
          operator: 'ends_with',
          value: '@company.com',
          type: 'literal',
        },
      ],
    },
  },
  {
    name: 'Priority Routing',
    description: 'Route high-value or urgent items',
    group: {
      id: 'template-2',
      operator: 'OR',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.priority',
          operator: 'equals',
          value: 'high',
          type: 'literal',
        },
        {
          id: 'c2',
          variable: 'trigger.payload.value',
          operator: 'greater_than',
          value: '1000',
          type: 'literal',
        },
      ],
    },
  },
  {
    name: 'Status Check',
    description: 'Check if item is approved and not archived',
    group: {
      id: 'template-3',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.status',
          operator: 'equals',
          value: 'approved',
          type: 'literal',
        },
        {
          id: 'c2',
          variable: 'trigger.payload.archived',
          operator: 'not_equals',
          value: 'true',
          type: 'literal',
        },
      ],
    },
  },
  {
    name: 'Complex Business Logic',
    description: 'Nested conditions for advanced routing',
    group: {
      id: 'template-4',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.enabled',
          operator: 'equals',
          value: 'true',
          type: 'literal',
        },
        {
          id: 'g1',
          operator: 'OR',
          conditions: [
            {
              id: 'c2',
              variable: 'trigger.payload.tier',
              operator: 'in_array',
              value: '["premium", "enterprise"]',
              type: 'literal',
            },
            {
              id: 'c3',
              variable: 'trigger.payload.credits',
              operator: 'greater_than',
              value: '100',
              type: 'literal',
            },
          ],
        },
      ],
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a condition or group is a group
 */
function isConditionGroup(
  item: Condition | ConditionGroup,
): item is ConditionGroup {
  return 'operator' in item && 'conditions' in item;
}

/**
 * Generate unique ID for condition/group
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get available operators for a variable type
 */
function getOperatorsForType(variableType: string): ComparisonOperator[] {
  return Object.entries(OPERATOR_CONFIG)
    .filter(([_, config]) => config.supportedTypes.includes(variableType))
    .map(([operator]) => operator as ComparisonOperator);
}

/**
 * Validate a single condition
 */
function validateCondition(
  condition: Condition,
  variables: ScopedWorkflowVariable[],
): string | null {
  // Check if variable exists
  const variable = variables.find((v) => v.name === condition.variable);
  if (!variable) {
    return `Variable "${condition.variable}" not found`;
  }

  // Check if operator is valid for variable type
  const operatorConfig = OPERATOR_CONFIG[condition.operator];
  if (!operatorConfig.supportedTypes.includes(variable.type)) {
    return `Operator "${operatorConfig.label}" not supported for ${variable.type}`;
  }

  // Check if value is provided when required
  if (operatorConfig.requiresValue && !condition.value) {
    return 'Value is required for this operator';
  }

  // Validate variable reference
  if (condition.type === 'variable') {
    const refVariable = variables.find((v) => v.name === condition.value);
    if (!refVariable) {
      return `Referenced variable "${condition.value}" not found`;
    }
  }

  return null;
}

/**
 * Validate condition group recursively
 */
function validateConditionGroup(
  group: ConditionGroup,
  variables: ScopedWorkflowVariable[],
): ConditionError[] {
  const errors: ConditionError[] = [];

  group.conditions.forEach((item) => {
    if (isConditionGroup(item)) {
      errors.push(...validateConditionGroup(item, variables));
    } else {
      const error = validateCondition(item, variables);
      if (error) {
        errors.push({ id: item.id, message: error });
      }
    }
  });

  return errors;
}

/**
 * Generate natural language explanation of condition
 */
function explainCondition(
  condition: Condition,
  variables: ScopedWorkflowVariable[],
): string {
  const variable = variables.find((v) => v.name === condition.variable);
  const varName = variable?.name || condition.variable;
  const operatorConfig = OPERATOR_CONFIG[condition.operator];

  if (!operatorConfig.requiresValue) {
    return `${varName} ${operatorConfig.label}`;
  }

  const valueDisplay =
    condition.type === 'variable' ? `{${condition.value}}` : `"${condition.value}"`;

  return `${varName} ${operatorConfig.label} ${valueDisplay}`;
}

/**
 * Generate natural language explanation of condition group
 */
function explainConditionGroup(
  group: ConditionGroup,
  variables: ScopedWorkflowVariable[],
  depth = 0,
): string {
  const indent = '  '.repeat(depth);
  const parts: string[] = [];

  group.conditions.forEach((item, index) => {
    const prefix = index === 0 ? '' : `${indent}${group.operator} `;

    if (isConditionGroup(item)) {
      parts.push(
        `${prefix}(\n${explainConditionGroup(item, variables, depth + 1)}\n${indent})`,
      );
    } else {
      parts.push(`${prefix}${explainCondition(item, variables)}`);
    }
  });

  return parts.join('\n');
}

// ============================================================================
// Condition Component
// ============================================================================

interface ConditionItemProps {
  condition: Condition;
  variables: ScopedWorkflowVariable[];
  onChange: (condition: Condition) => void;
  onDelete: () => void;
  error?: string;
  readOnly?: boolean;
}

function ConditionItem({
  condition,
  variables,
  onChange,
  onDelete,
  error,
  readOnly,
}: ConditionItemProps) {
  const selectedVariable = variables.find((v) => v.name === condition.variable);
  const availableOperators = selectedVariable
    ? getOperatorsForType(selectedVariable.type)
    : Object.keys(OPERATOR_CONFIG) as ComparisonOperator[];

  const operatorConfig = OPERATOR_CONFIG[condition.operator];

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded-lg border bg-card',
        error && 'border-destructive',
      )}
    >
      <div className='flex-1 grid grid-cols-1 md:grid-cols-3 gap-2'>
        {/* Variable selector */}
        <div className='space-y-1'>
          <Label className='text-xs text-muted-foreground'>Variable</Label>
          <Select
            value={condition.variable}
            onValueChange={(value) =>
              onChange({ ...condition, variable: value })
            }
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select variable' />
            </SelectTrigger>
            <SelectContent>
              {variables.map((variable) => (
                <SelectItem key={variable.id} value={variable.name}>
                  <div className='flex items-center gap-2'>
                    <span>{variable.name}</span>
                    <Badge variant='outline' className='text-xs'>
                      {variable.type}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operator selector */}
        <div className='space-y-1'>
          <Label className='text-xs text-muted-foreground'>Operator</Label>
          <Select
            value={condition.operator}
            onValueChange={(value) =>
              onChange({ ...condition, operator: value as ComparisonOperator })
            }
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select operator' />
            </SelectTrigger>
            <SelectContent>
              {availableOperators.map((op) => (
                <SelectItem key={op} value={op}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{OPERATOR_CONFIG[op].label}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {OPERATOR_CONFIG[op].description}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Value input */}
        {operatorConfig.requiresValue && (
          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <Label className='text-xs text-muted-foreground'>Value</Label>
              <Button
                variant='ghost'
                size='sm'
                className='h-5 px-2 text-xs'
                onClick={() =>
                  onChange({
                    ...condition,
                    type: condition.type === 'literal' ? 'variable' : 'literal',
                  })
                }
                disabled={readOnly}
              >
                {condition.type === 'literal' ? 'Use variable' : 'Use literal'}
              </Button>
            </div>
            {condition.type === 'variable' ? (
              <Select
                value={condition.value}
                onValueChange={(value) =>
                  onChange({ ...condition, value })
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select variable' />
                </SelectTrigger>
                <SelectContent>
                  {variables.map((variable) => (
                    <SelectItem key={variable.id} value={variable.name}>
                      {variable.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={condition.value}
                onChange={(e) =>
                  onChange({ ...condition, value: e.target.value })
                }
                placeholder='Enter value'
                disabled={readOnly}
              />
            )}
          </div>
        )}
      </div>

      {/* Delete button */}
      {!readOnly && (
        <Button
          variant='ghost'
          size='icon'
          onClick={onDelete}
          className='shrink-0'
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      )}

      {/* Error indicator */}
      {error && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className='h-4 w-4 text-destructive shrink-0' />
            </TooltipTrigger>
            <TooltipContent>
              <p>{error}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================================================
// Condition Group Component
// ============================================================================

interface ConditionGroupItemProps {
  group: ConditionGroup;
  variables: ScopedWorkflowVariable[];
  onChange: (group: ConditionGroup) => void;
  onDelete?: () => void;
  errors: ConditionError[];
  depth?: number;
  readOnly?: boolean;
}

function ConditionGroupItem({
  group,
  variables,
  onChange,
  onDelete,
  errors,
  depth = 0,
  readOnly,
}: ConditionGroupItemProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const addCondition = () => {
    const newCondition: Condition = {
      id: generateId(),
      variable: variables[0]?.name || '',
      operator: 'equals',
      value: '',
      type: 'literal',
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addGroup = () => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      operator: 'AND',
      conditions: [],
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const updateCondition = (index: number, updated: Condition | ConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onChange({ ...group, conditions: newConditions });
  };

  const deleteCondition = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const toggleOperator = () => {
    onChange({
      ...group,
      operator: group.operator === 'AND' ? 'OR' : 'AND',
    });
  };

  return (
    <div
      className={cn(
        'rounded-lg border-2 border-dashed p-4 space-y-3',
        depth === 0 ? 'border-primary' : 'border-muted-foreground/30',
      )}
      style={{ marginLeft: depth * 16 }}
    >
      {/* Group header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setIsCollapsed(!isCollapsed)}
            className='h-6 w-6'
          >
            {isCollapsed ? (
              <ChevronRight className='h-4 w-4' />
            ) : (
              <ChevronDown className='h-4 w-4' />
            )}
          </Button>
          <Button
            variant={group.operator === 'AND' ? 'default' : 'secondary'}
            size='sm'
            onClick={toggleOperator}
            disabled={readOnly}
          >
            {group.operator}
          </Button>
          <span className='text-sm text-muted-foreground'>
            {group.conditions.length} condition(s)
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {!readOnly && (
            <>
              <Button variant='outline' size='sm' onClick={addCondition}>
                <Plus className='h-4 w-4 mr-1' />
                Condition
              </Button>
              <Button variant='outline' size='sm' onClick={addGroup}>
                <Plus className='h-4 w-4 mr-1' />
                Group
              </Button>
            </>
          )}
          {depth > 0 && onDelete && !readOnly && (
            <Button variant='ghost' size='icon' onClick={onDelete}>
              <Trash2 className='h-4 w-4' />
            </Button>
          )}
        </div>
      </div>

      {/* Conditions */}
      {!isCollapsed && (
        <div className='space-y-2'>
          {group.conditions.length === 0 ? (
            <div className='text-center py-6 text-sm text-muted-foreground'>
              No conditions yet. Add a condition or group to get started.
            </div>
          ) : (
            group.conditions.map((item, index) => (
              <div key={isConditionGroup(item) ? item.id : item.id}>
                {isConditionGroup(item) ? (
                  <ConditionGroupItem
                    group={item}
                    variables={variables}
                    onChange={(updated) => updateCondition(index, updated)}
                    onDelete={() => deleteCondition(index)}
                    errors={errors}
                    depth={depth + 1}
                    readOnly={readOnly}
                  />
                ) : (
                  <ConditionItem
                    condition={item}
                    variables={variables}
                    onChange={(updated) => updateCondition(index, updated)}
                    onDelete={() => deleteCondition(index)}
                    error={errors.find((e) => e.id === item.id)?.message}
                    readOnly={readOnly}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Condition Builder Component
// ============================================================================

export interface ConditionBuilderProps {
  value: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  variables: ScopedWorkflowVariable[];
  readOnly?: boolean;
  showPreview?: boolean;
  showTemplates?: boolean;
  className?: string;
}

export function ConditionBuilder({
  value,
  onChange,
  variables,
  readOnly = false,
  showPreview = true,
  showTemplates = true,
  className,
}: ConditionBuilderProps) {
  const [errors, setErrors] = React.useState<ConditionError[]>([]);

  // Validate conditions
  React.useEffect(() => {
    const validationErrors = validateConditionGroup(value, variables);
    setErrors(validationErrors);
  }, [value, variables]);

  const applyTemplate = (template: ConditionGroup) => {
    // Generate new IDs for all conditions/groups
    const cloneWithNewIds = (
      item: Condition | ConditionGroup,
    ): Condition | ConditionGroup => {
      if (isConditionGroup(item)) {
        return {
          ...item,
          id: generateId(),
          conditions: item.conditions.map(cloneWithNewIds),
        };
      }
      return { ...item, id: generateId() };
    };

    onChange({
      ...template,
      id: value.id, // Keep root ID
      conditions: template.conditions.map(cloneWithNewIds),
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with templates */}
      {showTemplates && !readOnly && (
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-medium'>Conditions</h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='sm'>
                <FileText className='h-4 w-4 mr-2' />
                Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80'>
              <div className='space-y-2'>
                <h4 className='font-medium text-sm'>Condition Templates</h4>
                <p className='text-xs text-muted-foreground'>
                  Start with a pre-built condition pattern
                </p>
                <div className='space-y-2 max-h-96 overflow-y-auto'>
                  {CONDITION_TEMPLATES.map((template, index) => (
                    <button
                      key={index}
                      className='w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors'
                      onClick={() => applyTemplate(template.group)}
                    >
                      <div className='font-medium text-sm'>{template.name}</div>
                      <div className='text-xs text-muted-foreground mt-1'>
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className='rounded-lg border border-destructive bg-destructive/10 p-3'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='h-4 w-4 text-destructive mt-0.5' />
            <div className='flex-1'>
              <h4 className='text-sm font-medium text-destructive'>
                Validation Errors
              </h4>
              <ul className='mt-2 space-y-1 text-xs'>
                {errors.map((error) => (
                  <li key={error.id}>• {error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Condition builder */}
      <ConditionGroupItem
        group={value}
        variables={variables}
        onChange={onChange}
        errors={errors}
        readOnly={readOnly}
      />

      {/* Preview */}
      {showPreview && value.conditions.length > 0 && (
        <div className='rounded-lg border bg-muted/50 p-3'>
          <div className='flex items-start gap-2'>
            <Filter className='h-4 w-4 mt-0.5 text-muted-foreground' />
            <div className='flex-1'>
              <h4 className='text-sm font-medium mb-2'>Condition Preview</h4>
              <pre className='text-xs text-muted-foreground font-mono whitespace-pre-wrap'>
                {explainConditionGroup(value, variables)}
              </pre>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => {
                const explanation = explainConditionGroup(value, variables);
                navigator.clipboard.writeText(explanation);
              }}
            >
              <Copy className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  OPERATOR_CONFIG,
  CONDITION_TEMPLATES,
  validateCondition,
  validateConditionGroup,
  explainCondition,
  explainConditionGroup,
  isConditionGroup,
  getOperatorsForType,
};
