'use client';

import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Code2,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { WorkflowVariable, VariableType } from '@/types/workflow';

/**
 * Variable scope enumeration
 */
export type VariableScope = 'global' | 'step';

/**
 * Extended variable definition with scope
 */
export interface ScopedWorkflowVariable extends Omit<WorkflowVariable, 'source'> {
  id: string;
  scope: VariableScope;
  stepId?: string; // Only for step-scoped variables
}

/**
 * Variable validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Props for VariableManager component
 */
export interface VariableManagerProps {
  variables: ScopedWorkflowVariable[];
  onVariablesChange: (variables: ScopedWorkflowVariable[]) => void;
  availableSteps?: Array<{ id: string; name: string }>;
  className?: string;
}

/**
 * Variable type configuration
 */
const VARIABLE_TYPE_CONFIG: Record<
  VariableType,
  { label: string; icon: string; defaultValue: string }
> = {
  string: { label: 'String', icon: 'Aa', defaultValue: '' },
  number: { label: 'Number', icon: '123', defaultValue: '0' },
  boolean: { label: 'Boolean', icon: 'T/F', defaultValue: 'false' },
  array: { label: 'Array', icon: '[]', defaultValue: '[]' },
  object: { label: 'Object', icon: '{}', defaultValue: '{}' },
};

/**
 * Validate variable name
 */
function validateVariableName(name: string, existingNames: string[]): string | null {
  if (!name) {
    return 'Variable name is required';
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return 'Variable name must start with a letter or underscore and contain only letters, numbers, and underscores';
  }
  if (existingNames.includes(name)) {
    return 'Variable name already exists';
  }
  return null;
}

/**
 * Validate default value based on type
 */
function validateDefaultValue(value: string, type: VariableType): string | null {
  if (!value) {
return null;
} // Empty values are allowed

  try {
    switch (type) {
      case 'number':
        if (isNaN(Number(value))) {
          return 'Invalid number value';
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          return 'Boolean value must be "true" or "false"';
        }
        break;
      case 'array':
        JSON.parse(value);
        if (!Array.isArray(JSON.parse(value))) {
          return 'Invalid array format';
        }
        break;
      case 'object':
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) || typeof parsed !== 'object') {
          return 'Invalid object format';
        }
        break;
    }
  } catch (error) {
    return `Invalid ${type} format`;
  }

  return null;
}

/**
 * Convert default value string to appropriate type
 */
function parseDefaultValue(
  value: string,
  type: VariableType,
): string | number | boolean | unknown[] | Record<string, unknown> | undefined {
  if (!value) {
return undefined;
}

  switch (type) {
    case 'string':
      return value;
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'array':
    case 'object':
      return JSON.parse(value);
    default:
      return value;
  }
}

/**
 * Convert default value to string for editing
 */
function stringifyDefaultValue(
  value: string | number | boolean | readonly unknown[] | Readonly<Record<string, unknown>> | undefined,
  type: VariableType,
): string {
  if (value === undefined) {
return '';
}

  switch (type) {
    case 'string':
      return String(value);
    case 'number':
    case 'boolean':
      return String(value);
    case 'array':
    case 'object':
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
}

/**
 * Variable edit dialog
 */
interface VariableDialogProps {
  variable?: ScopedWorkflowVariable;
  existingVariables: ScopedWorkflowVariable[];
  availableSteps?: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (variable: ScopedWorkflowVariable) => void;
}

function VariableDialog({
  variable,
  existingVariables,
  availableSteps = [],
  open,
  onOpenChange,
  onSave,
}: VariableDialogProps) {
  const [formData, setFormData] = React.useState({
    name: variable?.name || '',
    type: variable?.type || 'string' as VariableType,
    description: variable?.description || '',
    defaultValue: stringifyDefaultValue(variable?.defaultValue, variable?.type || 'string'),
    scope: variable?.scope || 'global' as VariableScope,
    stepId: variable?.stepId || '',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (variable) {
      setFormData({
        name: variable.name,
        type: variable.type,
        description: variable.description || '',
        defaultValue: stringifyDefaultValue(variable.defaultValue, variable.type),
        scope: variable.scope,
        stepId: variable.stepId || '',
      });
    } else {
      setFormData({
        name: '',
        type: 'string',
        description: '',
        defaultValue: '',
        scope: 'global',
        stepId: '',
      });
    }
    setErrors({});
  }, [variable, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    const existingNames = existingVariables
      .filter((v) => v.id !== variable?.id)
      .map((v) => v.name);
    const nameError = validateVariableName(formData.name, existingNames);
    if (nameError) {
      newErrors.name = nameError;
    }

    // Validate default value
    if (formData.defaultValue) {
      const valueError = validateDefaultValue(formData.defaultValue, formData.type);
      if (valueError) {
        newErrors.defaultValue = valueError;
      }
    }

    // Validate step for step-scoped variables
    if (formData.scope === 'step' && !formData.stepId) {
      newErrors.stepId = 'Step is required for step-scoped variables';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
return;
}

    const savedVariable: ScopedWorkflowVariable = {
      id: variable?.id || `var_${Date.now()}`,
      name: formData.name,
      type: formData.type,
      description: formData.description || undefined,
      defaultValue: parseDefaultValue(formData.defaultValue, formData.type),
      scope: formData.scope,
      stepId: formData.scope === 'step' ? formData.stepId : undefined,
    };

    onSave(savedVariable);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {variable ? 'Edit Variable' : 'Add Variable'}
          </DialogTitle>
          <DialogDescription>
            Define a variable that can be used throughout your workflow. Use ${'{'}variable.name{'}'} to reference it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Variable Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Variable Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="myVariable"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Must start with a letter or underscore, contain only letters, numbers, and underscores
            </p>
          </div>

          {/* Variable Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData({ ...formData, type: value as VariableType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VARIABLE_TYPE_CONFIG).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{config.icon}</span>
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Scope <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.scope}
              onValueChange={(value) =>
                setFormData({ ...formData, scope: value as VariableScope, stepId: '' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <div className="space-y-1">
                    <div>Global</div>
                    <div className="text-xs text-muted-foreground">
                      Available in all workflow steps
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="step">
                  <div className="space-y-1">
                    <div>Step-scoped</div>
                    <div className="text-xs text-muted-foreground">
                      Available only in specific step
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step Selection (for step-scoped variables) */}
          {formData.scope === 'step' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Step <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.stepId}
                onValueChange={(value) =>
                  setFormData({ ...formData, stepId: value })
                }
              >
                <SelectTrigger className={cn(errors.stepId && 'border-destructive')}>
                  <SelectValue placeholder="Select a step" />
                </SelectTrigger>
                <SelectContent>
                  {availableSteps.map((step) => (
                    <SelectItem key={step.id} value={step.id}>
                      {step.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stepId && (
                <p className="text-sm text-destructive">{errors.stepId}</p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Describe what this variable is used for..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
            />
          </div>

          {/* Default Value */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Value</label>
            {formData.type === 'array' || formData.type === 'object' ? (
              <Textarea
                placeholder={VARIABLE_TYPE_CONFIG[formData.type].defaultValue}
                value={formData.defaultValue}
                onChange={(e) =>
                  setFormData({ ...formData, defaultValue: e.target.value })
                }
                className={cn(
                  'font-mono text-xs',
                  errors.defaultValue && 'border-destructive',
                )}
                rows={6}
              />
            ) : (
              <Input
                placeholder={VARIABLE_TYPE_CONFIG[formData.type].defaultValue}
                value={formData.defaultValue}
                onChange={(e) =>
                  setFormData({ ...formData, defaultValue: e.target.value })
                }
                className={cn(errors.defaultValue && 'border-destructive')}
              />
            )}
            {errors.defaultValue && (
              <p className="text-sm text-destructive">{errors.defaultValue}</p>
            )}
            {formData.type === 'boolean' && (
              <p className="text-xs text-muted-foreground">
                Enter "true" or "false"
              </p>
            )}
            {(formData.type === 'array' || formData.type === 'object') && (
              <p className="text-xs text-muted-foreground">
                Enter valid JSON format
              </p>
            )}
          </div>

          {/* Variable Reference Preview */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Variable Reference</span>
            </div>
            <code className="text-sm bg-background px-2 py-1 rounded border">
              ${'{'}variable.{formData.name || 'name'}{'}'}
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Variable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main VariableManager component
 */
export function VariableManager({
  variables,
  onVariablesChange,
  availableSteps = [],
  className,
}: VariableManagerProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingVariable, setEditingVariable] = React.useState<
    ScopedWorkflowVariable | undefined
  >();
  const [expandedScopes, setExpandedScopes] = React.useState<Set<string>>(
    new Set(['global']),
  );

  const globalVariables = variables.filter((v) => v.scope === 'global');
  const stepVariables = variables.filter((v) => v.scope === 'step');

  // Group step variables by step
  const variablesByStep = React.useMemo(() => {
    const grouped = new Map<string, ScopedWorkflowVariable[]>();
    stepVariables.forEach((variable) => {
      if (variable.stepId) {
        if (!grouped.has(variable.stepId)) {
          grouped.set(variable.stepId, []);
        }
        grouped.get(variable.stepId)!.push(variable);
      }
    });
    return grouped;
  }, [stepVariables]);

  const handleAddVariable = () => {
    setEditingVariable(undefined);
    setDialogOpen(true);
  };

  const handleEditVariable = (variable: ScopedWorkflowVariable) => {
    setEditingVariable(variable);
    setDialogOpen(true);
  };

  const handleDeleteVariable = (variableId: string) => {
    onVariablesChange(variables.filter((v) => v.id !== variableId));
  };

  const handleSaveVariable = (variable: ScopedWorkflowVariable) => {
    if (editingVariable) {
      // Update existing
      onVariablesChange(
        variables.map((v) => (v.id === variable.id ? variable : v)),
      );
    } else {
      // Add new
      onVariablesChange([...variables, variable]);
    }
  };

  const toggleScope = (scope: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const renderVariableRow = (variable: ScopedWorkflowVariable) => (
    <TableRow key={variable.id}>
      <TableCell className="font-mono text-sm">{variable.name}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-mono text-xs">
          {VARIABLE_TYPE_CONFIG[variable.type].icon} {variable.type}
        </Badge>
      </TableCell>
      <TableCell className="max-w-xs">
        <div className="truncate text-sm text-muted-foreground">
          {variable.description || '-'}
        </div>
      </TableCell>
      <TableCell>
        {variable.defaultValue !== undefined ? (
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {stringifyDefaultValue(variable.defaultValue, variable.type).slice(
              0,
              50,
            )}
            {stringifyDefaultValue(variable.defaultValue, variable.type).length >
              50 && '...'}
          </code>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-2 py-1 rounded">
          ${'{'}variable.{variable.name}{'}'}
        </code>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEditVariable(variable)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteVariable(variable.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Workflow Variables</h3>
          <p className="text-sm text-muted-foreground">
            Define variables that can be referenced in workflow steps using ${'{'}
            variable.name{'}'}
          </p>
        </div>
        <Button onClick={handleAddVariable}>
          <Plus className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>

      {variables.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <Code2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h4 className="text-lg font-medium mb-2">No variables defined</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Variables help you store and reuse values throughout your workflow
          </p>
          <Button onClick={handleAddVariable}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Variable
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Global Variables */}
          <div className="border rounded-lg">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              onClick={() => toggleScope('global')}
            >
              <div className="flex items-center gap-2">
                {expandedScopes.has('global') ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium">Global Variables</span>
                <Badge variant="secondary">{globalVariables.length}</Badge>
              </div>
            </button>
            {expandedScopes.has('global') && globalVariables.length > 0 && (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Default Value</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalVariables.map(renderVariableRow)}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Step-scoped Variables */}
          {variablesByStep.size > 0 && (
            <div className="border rounded-lg">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                onClick={() => toggleScope('step')}
              >
                <div className="flex items-center gap-2">
                  {expandedScopes.has('step') ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium">Step Variables</span>
                  <Badge variant="secondary">{stepVariables.length}</Badge>
                </div>
              </button>
              {expandedScopes.has('step') && (
                <div className="border-t">
                  {Array.from(variablesByStep.entries()).map(
                    ([stepId, vars]) => {
                      const step = availableSteps.find((s) => s.id === stepId);
                      return (
                        <div key={stepId} className="border-b last:border-b-0">
                          <div className="p-3 bg-muted/30">
                            <span className="text-sm font-medium">
                              {step?.name || `Step ${stepId}`}
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Default Value</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead className="w-[100px]">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>{vars.map(renderVariableRow)}</TableBody>
                          </Table>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <VariableDialog
        variable={editingVariable}
        existingVariables={variables}
        availableSteps={availableSteps}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveVariable}
      />
    </div>
  );
}
