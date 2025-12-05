'use client';

import {
  Download,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Package,
  Calendar,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { Workflow, WorkflowId } from '@/types/workflow';

/**
 * Export format types
 */
export type ExportFormat = 'json' | 'yaml';

/**
 * Export options configuration
 */
export interface ExportOptions {
  includeExecutionHistory: boolean;
  includeMetadata: boolean;
  includeVariables: boolean;
  includePermissions: boolean;
  prettyPrint: boolean;
}

/**
 * Exported workflow data structure
 */
export interface ExportedWorkflow {
  version: string;
  exportedAt: string;
  workflow: Workflow;
  executionHistory?: unknown[];
  permissions?: unknown[];
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  fileName: string;
  size: number;
  format: ExportFormat;
  error?: string;
}

interface WorkflowExportProps {
  workflows: Workflow[];
  selectedWorkflowIds?: WorkflowId[];
  workspaceSlug: string;
  onExportComplete?: (result: ExportResult) => void;
  onExportError?: (error: Error) => void;
  trigger?: React.ReactNode;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeExecutionHistory: false,
  includeMetadata: true,
  includeVariables: true,
  includePermissions: false,
  prettyPrint: true,
};

/**
 * Workflow Export Component
 *
 * Provides functionality to export workflows to JSON format with various options.
 * Supports single and batch export operations.
 */
export function WorkflowExport({
  workflows,
  selectedWorkflowIds = [],
  workspaceSlug,
  onExportComplete,
  onExportError,
  trigger,
}: WorkflowExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Filter workflows based on selection
  const workflowsToExport = useMemo(() => {
    if (selectedWorkflowIds.length === 0) {
      return workflows;
    }
    return workflows.filter((w) => selectedWorkflowIds.includes(w.id));
  }, [workflows, selectedWorkflowIds]);

  // Calculate export size estimate
  const estimatedSize = useMemo(() => {
    const jsonString = JSON.stringify(workflowsToExport);
    const bytes = new Blob([jsonString]).size;
    if (bytes < 1024) {
return `${bytes} B`;
}
    if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [workflowsToExport]);

  const handleOptionChange = useCallback((key: keyof ExportOptions, value: boolean) => {
    setExportOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const exportWorkflows = useCallback(async () => {
    setIsExporting(true);
    setLastExportResult(null);

    try {
      // Fetch additional data based on options
      const exportData = await Promise.all(
        workflowsToExport.map(async (workflow) => {
          const data: ExportedWorkflow = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            workflow: {
              ...workflow,
              ...(exportOptions.includeMetadata
                ? {}
                : {
                    createdAt: undefined,
                    updatedAt: undefined,
                    createdBy: undefined,
                    lastRunAt: undefined,
                    runCount: 0,
                    errorCount: 0,
                  }),
              ...(exportOptions.includeVariables ? {} : { variables: [] }),
            },
          };

          // Fetch execution history if requested
          if (exportOptions.includeExecutionHistory) {
            try {
              const response = await fetch(
                `/api/workspaces/${workspaceSlug}/workflows/${workflow.id}/executions?limit=50`,
              );
              if (response.ok) {
                const { executions } = await response.json();
                data.executionHistory = executions;
              }
            } catch (error) {
              console.warn(`Failed to fetch execution history for ${workflow.id}:`, error);
            }
          }

          // Fetch permissions if requested
          if (exportOptions.includePermissions) {
            try {
              const response = await fetch(
                `/api/workspaces/${workspaceSlug}/workflows/${workflow.id}/permissions`,
              );
              if (response.ok) {
                const { permissions } = await response.json();
                data.permissions = permissions;
              }
            } catch (error) {
              console.warn(`Failed to fetch permissions for ${workflow.id}:`, error);
            }
          }

          return data;
        }),
      );

      // Create JSON string
      const jsonString = exportOptions.prettyPrint
        ? JSON.stringify(exportData.length === 1 ? exportData[0] : exportData, null, 2)
        : JSON.stringify(exportData.length === 1 ? exportData[0] : exportData);

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const fileName =
        exportData.length === 1
          ? `workflow-${exportData[0].workflow.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`
          : `workflows-batch-${new Date().toISOString().split('T')[0]}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const result: ExportResult = {
        success: true,
        fileName,
        size: blob.size,
        format: 'json',
      };

      setLastExportResult(result);
      onExportComplete?.(result);

      // Close dialog after successful export
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Export failed');
      const result: ExportResult = {
        success: false,
        fileName: '',
        size: 0,
        format: 'json',
        error: err.message,
      };
      setLastExportResult(result);
      onExportError?.(err);
    } finally {
      setIsExporting(false);
    }
  }, [workflowsToExport, exportOptions, workspaceSlug, onExportComplete, onExportError]);

  const copyToClipboard = useCallback(async () => {
    try {
      const jsonString = JSON.stringify(
        workflowsToExport.length === 1 ? workflowsToExport[0] : workflowsToExport,
        null,
        2,
      );
      await navigator.clipboard.writeText(jsonString);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [workflowsToExport]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Export Workflows
          </DialogTitle>
          <DialogDescription>
            Export {workflowsToExport.length} workflow{workflowsToExport.length !== 1 ? 's' : ''}{' '}
            to JSON format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Workflows to Export */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Workflows to Export</Label>
            <ScrollArea className="h-[120px] border rounded-lg p-3">
              <div className="space-y-2">
                {workflowsToExport.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{workflow.name}</div>
                      {workflow.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {workflow.description}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline">{workflow.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Export Options */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Export Options</Label>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeMetadata"
                  checked={exportOptions.includeMetadata}
                  onCheckedChange={(checked) =>
                    handleOptionChange('includeMetadata', checked === true)
                  }
                />
                <Label
                  htmlFor="includeMetadata"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include metadata (creation dates, run counts, etc.)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeVariables"
                  checked={exportOptions.includeVariables}
                  onCheckedChange={(checked) =>
                    handleOptionChange('includeVariables', checked === true)
                  }
                />
                <Label
                  htmlFor="includeVariables"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include workflow variables and configurations
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeExecutionHistory"
                  checked={exportOptions.includeExecutionHistory}
                  onCheckedChange={(checked) =>
                    handleOptionChange('includeExecutionHistory', checked === true)
                  }
                />
                <Label
                  htmlFor="includeExecutionHistory"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include execution history (last 50 runs)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includePermissions"
                  checked={exportOptions.includePermissions}
                  onCheckedChange={(checked) =>
                    handleOptionChange('includePermissions', checked === true)
                  }
                />
                <Label
                  htmlFor="includePermissions"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include permission settings
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prettyPrint"
                  checked={exportOptions.prettyPrint}
                  onCheckedChange={(checked) =>
                    handleOptionChange('prettyPrint', checked === true)
                  }
                />
                <Label htmlFor="prettyPrint" className="text-sm font-normal cursor-pointer">
                  Pretty print JSON (formatted with indentation)
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Export Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Workflows</div>
                <div className="text-sm font-semibold">{workflowsToExport.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Est. Size</div>
                <div className="text-sm font-semibold">{estimatedSize}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Format</div>
                <div className="text-sm font-semibold">JSON</div>
              </div>
            </div>
          </div>

          {/* Export Result */}
          {lastExportResult && (
            <Alert variant={lastExportResult.success ? 'default' : 'destructive'}>
              {lastExportResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                {lastExportResult.success ? 'Export Successful' : 'Export Failed'}
              </AlertTitle>
              <AlertDescription>
                {lastExportResult.success ? (
                  <div className="space-y-1">
                    <p>File: {lastExportResult.fileName}</p>
                    <p>
                      Size: {(lastExportResult.size / 1024).toFixed(2)} KB (
                      {lastExportResult.size} bytes)
                    </p>
                  </div>
                ) : (
                  <p>{lastExportResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copyToClipboard} disabled={isExporting}>
            {copiedJson ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </>
            )}
          </Button>
          <Button onClick={exportWorkflows} disabled={isExporting || workflowsToExport.length === 0}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to File
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
