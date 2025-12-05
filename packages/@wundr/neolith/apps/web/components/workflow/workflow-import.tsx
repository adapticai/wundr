'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Workflow, CreateWorkflowInput, TriggerConfig, ActionConfig } from '@/types/workflow';

/**
 * Import result for a single workflow
 */
export interface ImportResult {
  success: boolean;
  workflowName: string;
  workflowId?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Parsed workflow data from import
 */
export interface ParsedWorkflow {
  name: string;
  description?: string;
  trigger: TriggerConfig;
  actions: Omit<ActionConfig, 'id'>[];
  variables?: unknown[];
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Import conflict resolution strategy
 */
export type ConflictResolution = 'skip' | 'overwrite' | 'rename';

interface WorkflowImportProps {
  workspaceSlug: string;
  existingWorkflows?: Workflow[];
  onImportComplete?: (results: ImportResult[]) => void;
  onImportError?: (error: Error) => void;
  trigger?: React.ReactNode;
}

/**
 * Workflow Import Component
 *
 * Provides functionality to import workflows from JSON files with validation,
 * conflict resolution, and error handling.
 */
export function WorkflowImport({
  workspaceSlug,
  existingWorkflows = [],
  onImportComplete,
  onImportError,
  trigger,
}: WorkflowImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedWorkflows, setParsedWorkflows] = useState<ParsedWorkflow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('rename');
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<number>>(new Set());
  const [showDetails, setShowDetails] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateWorkflow = useCallback(
    (workflow: unknown): ParsedWorkflow => {
      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      if (!workflow || typeof workflow !== 'object') {
        errors.push({
          field: 'root',
          message: 'Invalid workflow object',
          severity: 'error',
        });
        return {
          name: 'Invalid Workflow',
          trigger: { type: 'webhook', webhook: {} },
          actions: [],
          isValid: false,
          errors,
          warnings,
        };
      }

      const data = workflow as Record<string, unknown>;

      // Handle exported workflow format (wrapped in version/metadata)
      const workflowData =
        'workflow' in data && typeof data.workflow === 'object'
          ? (data.workflow as Record<string, unknown>)
          : data;

      // Validate name
      if (!workflowData.name || typeof workflowData.name !== 'string') {
        errors.push({
          field: 'name',
          message: 'Workflow name is required',
          severity: 'error',
        });
      } else if (existingWorkflows.some((w) => w.name === workflowData.name)) {
        warnings.push({
          field: 'name',
          message: `A workflow named "${workflowData.name}" already exists`,
          severity: 'warning',
        });
      }

      // Validate trigger
      if (!workflowData.trigger || typeof workflowData.trigger !== 'object') {
        errors.push({
          field: 'trigger',
          message: 'Valid trigger configuration is required',
          severity: 'error',
        });
      } else {
        const trigger = workflowData.trigger as Record<string, unknown>;
        if (!trigger.type || typeof trigger.type !== 'string') {
          errors.push({
            field: 'trigger.type',
            message: 'Trigger type is required',
            severity: 'error',
          });
        }
      }

      // Validate actions
      if (!Array.isArray(workflowData.actions)) {
        errors.push({
          field: 'actions',
          message: 'Actions must be an array',
          severity: 'error',
        });
      } else if (workflowData.actions.length === 0) {
        warnings.push({
          field: 'actions',
          message: 'Workflow has no actions',
          severity: 'warning',
        });
      } else {
        workflowData.actions.forEach((action: unknown, index: number) => {
          if (!action || typeof action !== 'object') {
            errors.push({
              field: `actions[${index}]`,
              message: `Action ${index + 1} is invalid`,
              severity: 'error',
            });
          } else {
            const act = action as Record<string, unknown>;
            if (!act.type || typeof act.type !== 'string') {
              errors.push({
                field: `actions[${index}].type`,
                message: `Action ${index + 1} is missing type`,
                severity: 'error',
              });
            }
            if (!act.config || typeof act.config !== 'object') {
              errors.push({
                field: `actions[${index}].config`,
                message: `Action ${index + 1} is missing config`,
                severity: 'error',
              });
            }
          }
        });
      }

      return {
        name: (workflowData.name as string) || 'Unnamed Workflow',
        description: workflowData.description as string | undefined,
        trigger: workflowData.trigger as TriggerConfig,
        actions: (workflowData.actions as Omit<ActionConfig, 'id'>[]) || [],
        variables: workflowData.variables as unknown[] | undefined,
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    },
    [existingWorkflows]
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text);

        // Handle both single workflow and array of workflows
        const workflows = Array.isArray(json) ? json : [json];
        const parsed = workflows.map(validateWorkflow);

        setParsedWorkflows(parsed);
        // Select all valid workflows by default
        setSelectedWorkflows(new Set(parsed.map((_, i) => i).filter((i) => parsed[i].isValid)));
        setImportResults([]);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to parse JSON file');
        onImportError?.(err);
        setParsedWorkflows([
          {
            name: file.name,
            trigger: { type: 'webhook', webhook: {} },
            actions: [],
            isValid: false,
            errors: [
              {
                field: 'file',
                message: err.message,
                severity: 'error',
              },
            ],
            warnings: [],
          },
        ]);
      }
    },
    [validateWorkflow, onImportError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/json') {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const toggleWorkflowSelection = useCallback((index: number) => {
    setSelectedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleDetails = useCallback((index: number) => {
    setShowDetails((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const importWorkflows = useCallback(async () => {
    setIsImporting(true);
    const results: ImportResult[] = [];

    try {
      for (const index of selectedWorkflows) {
        const workflow = parsedWorkflows[index];

        if (!workflow.isValid) {
          results.push({
            success: false,
            workflowName: workflow.name,
            error: 'Workflow validation failed',
          });
          continue;
        }

        try {
          // Check for name conflicts
          let finalName = workflow.name;
          if (existingWorkflows.some((w) => w.name === finalName)) {
            if (conflictResolution === 'skip') {
              results.push({
                success: false,
                workflowName: workflow.name,
                error: 'Workflow already exists (skipped)',
              });
              continue;
            } else if (conflictResolution === 'rename') {
              let counter = 1;
              while (existingWorkflows.some((w) => w.name === `${finalName} (${counter})`)) {
                counter++;
              }
              finalName = `${finalName} (${counter})`;
            }
            // For 'overwrite', we would need additional logic to delete/update existing workflow
          }

          // Create workflow via API
          const requestBody = {
            name: finalName,
            description: workflow.description,
            trigger: workflow.trigger,
            actions: workflow.actions,
            status: 'DRAFT',
          };

          const response = await fetch(`/api/workspaces/${workspaceSlug}/workflows`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const error = await response.json();
            results.push({
              success: false,
              workflowName: workflow.name,
              error: error.message || 'Failed to create workflow',
            });
            continue;
          }

          const { workflow: createdWorkflow } = await response.json();
          results.push({
            success: true,
            workflowName: workflow.name,
            workflowId: createdWorkflow.id,
            warnings: workflow.warnings.map((w) => w.message),
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Unknown error');
          results.push({
            success: false,
            workflowName: workflow.name,
            error: err.message,
          });
        }
      }

      setImportResults(results);
      onImportComplete?.(results);

      // Close dialog after successful import if all succeeded
      if (results.every((r) => r.success)) {
        setTimeout(() => {
          setIsOpen(false);
          setParsedWorkflows([]);
          setSelectedWorkflows(new Set());
        }, 2000);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Import failed');
      onImportError?.(err);
    } finally {
      setIsImporting(false);
    }
  }, [
    selectedWorkflows,
    parsedWorkflows,
    existingWorkflows,
    conflictResolution,
    workspaceSlug,
    onImportComplete,
    onImportError,
  ]);

  const stats = useMemo(() => {
    const total = parsedWorkflows.length;
    const valid = parsedWorkflows.filter((w) => w.isValid).length;
    const invalid = total - valid;
    const warnings = parsedWorkflows.reduce((sum, w) => sum + w.warnings.length, 0);

    return { total, valid, invalid, warnings };
  }, [parsedWorkflows]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import Workflows
          </DialogTitle>
          <DialogDescription>
            Import workflows from JSON file. Existing workflows will be handled according to your
            conflict resolution strategy.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-6 py-4">
            {/* File Upload Area */}
            {parsedWorkflows.length === 0 && (
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Drop JSON file here</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse your files
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
            )}

            {/* Parsed Workflows */}
            {parsedWorkflows.length > 0 && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <div className="text-xs text-green-600 dark:text-green-400">Valid</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.valid}
                    </div>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <div className="text-xs text-red-600 dark:text-red-400">Invalid</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {stats.invalid}
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">Warnings</div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {stats.warnings}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Conflict Resolution */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="conflict-resolution" className="text-base font-medium">
                    If workflow exists:
                  </Label>
                  <Select
                    value={conflictResolution}
                    onValueChange={(value) => setConflictResolution(value as ConflictResolution)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip (don't import)</SelectItem>
                      <SelectItem value="rename">Rename (add counter)</SelectItem>
                      <SelectItem value="overwrite">Overwrite existing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Workflows List */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Workflows ({selectedWorkflows.size} selected)
                  </Label>
                  <div className="space-y-2">
                    {parsedWorkflows.map((workflow, index) => (
                      <div
                        key={index}
                        className={cn(
                          'border rounded-lg p-4 transition-colors',
                          workflow.isValid
                            ? 'bg-background hover:bg-muted/50'
                            : 'bg-destructive/5 border-destructive/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedWorkflows.has(index)}
                            onCheckedChange={() => toggleWorkflowSelection(index)}
                            disabled={!workflow.isValid}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold truncate">{workflow.name}</h4>
                              {workflow.isValid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                              )}
                              {workflow.warnings.length > 0 && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                  {workflow.warnings.length} warning{workflow.warnings.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            {workflow.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {workflow.description}
                              </p>
                            )}
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>{workflow.actions.length} actions</span>
                              <span>·</span>
                              <span>{workflow.trigger.type} trigger</span>
                            </div>

                            {/* Errors and Warnings */}
                            {(workflow.errors.length > 0 || workflow.warnings.length > 0) && (
                              <div className="mt-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleDetails(index)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {showDetails.has(index) ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Hide details
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show details
                                    </>
                                  )}
                                </Button>

                                {showDetails.has(index) && (
                                  <div className="mt-2 space-y-2">
                                    {workflow.errors.map((error, i) => (
                                      <Alert key={`error-${i}`} variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle className="text-sm">{error.field}</AlertTitle>
                                        <AlertDescription className="text-xs">
                                          {error.message}
                                        </AlertDescription>
                                      </Alert>
                                    ))}
                                    {workflow.warnings.map((warning, i) => (
                                      <Alert key={`warning-${i}`}>
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                        <AlertTitle className="text-sm">{warning.field}</AlertTitle>
                                        <AlertDescription className="text-xs">
                                          {warning.message}
                                        </AlertDescription>
                                      </Alert>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Import Results */}
                {importResults.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Import Results</Label>
                      <div className="space-y-2">
                        {importResults.map((result, index) => (
                          <Alert
                            key={index}
                            variant={result.success ? 'default' : 'destructive'}
                          >
                            {result.success ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            <AlertTitle>{result.workflowName}</AlertTitle>
                            <AlertDescription>
                              {result.success
                                ? `Successfully imported${result.warnings && result.warnings.length > 0 ? ` with ${result.warnings.length} warning(s)` : ''}`
                                : result.error}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {parsedWorkflows.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setParsedWorkflows([]);
                  setSelectedWorkflows(new Set());
                  setImportResults([]);
                }}
                disabled={isImporting}
              >
                Clear
              </Button>
              <Button
                onClick={importWorkflows}
                disabled={isImporting || selectedWorkflows.size === 0}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import {selectedWorkflows.size} Workflow{selectedWorkflows.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
