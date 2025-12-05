'use client';

/**
 * Tool Result Display Component
 *
 * Renders tool execution results with type-specific formatting and visualization.
 */

import * as React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Database,
  FileText,
  Users,
  Search,
  BarChart3,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ToolResultProps {
  toolName: string;
  category: 'workflow' | 'search' | 'data' | 'system' | 'integration';
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
    requiresApproval?: boolean;
    approvalId?: string;
  };
  defaultExpanded?: boolean;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}

/**
 * Main tool result component
 */
export function ToolResult({
  toolName,
  category,
  success,
  data,
  error,
  metadata,
  defaultExpanded = true,
  onApprove,
  onReject,
}: ToolResultProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const content = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = () => {
    if (metadata?.approvalId && onApprove) {
      onApprove(metadata.approvalId);
    }
  };

  const handleReject = () => {
    if (metadata?.approvalId && onReject) {
      onReject(metadata.approvalId);
    }
  };

  return (
    <div className='rounded-lg border bg-card'>
      {/* Header */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className='flex items-center justify-between p-3 border-b'>
          <div className='flex items-center gap-2 flex-1'>
            <CategoryIcon category={category} />
            <span className='font-medium text-sm'>
              {formatToolName(toolName)}
            </span>
            <StatusBadge success={success} error={error} metadata={metadata} />
          </div>
          <div className='flex items-center gap-2'>
            {metadata?.executionTime && (
              <Badge variant='outline' className='text-xs gap-1'>
                <Clock className='h-3 w-3' />
                {metadata.executionTime}ms
              </Badge>
            )}
            {metadata?.cached && (
              <Badge variant='secondary' className='text-xs'>
                Cached
              </Badge>
            )}
            <CollapsibleTrigger asChild>
              <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                {isExpanded ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRight className='h-4 w-4' />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className='p-3 space-y-3'>
            {(
              <>
                {/* Approval Required */}
                {metadata?.requiresApproval && metadata.approvalId && (
              <div className='rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3'>
                <div className='flex items-center gap-2 mb-2'>
                  <AlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                  <span className='font-medium text-sm text-amber-900 dark:text-amber-100'>
                    Approval Required
                  </span>
                </div>
                <p className='text-xs text-amber-700 dark:text-amber-300 mb-3'>
                  This tool requires approval before execution. Please review
                  the operation and approve or reject.
                </p>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='default'
                    onClick={handleApprove}
                    className='bg-amber-600 hover:bg-amber-700'
                  >
                    Approve & Execute
                  </Button>
                  <Button size='sm' variant='outline' onClick={handleReject}>
                    Reject
                  </Button>
                </div>
              </div>
            )}

                <ErrorSection success={success} error={error} />

                {/* Success Data Display */}
                {success && data && (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs font-medium text-muted-foreground'>
                        Result
                      </span>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 px-2 text-xs'
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <>
                            <Check className='h-3 w-3 mr-1' />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className='h-3 w-3 mr-1' />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <ResultRenderer category={category} data={data} />
                  </div>
                )}
              </>
            ) as React.ReactNode}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Error display wrapper
 */
function ErrorSection({
  success,
  error,
}: {
  success: boolean;
  error?: string;
}): React.ReactElement | null {
  if (!success && typeof error === 'string') {
    return <ErrorDisplay error={error} />;
  }
  return null;
}

/**
 * Error display component
 */
function ErrorDisplay({ error }: { error: string }): React.ReactElement {
  return (
    <div className='rounded-lg bg-destructive/10 border border-destructive/20 p-3'>
      <div className='flex items-center gap-2 mb-1'>
        <XCircle className='h-4 w-4 text-destructive' />
        <span className='font-medium text-sm text-destructive'>Error</span>
      </div>
      <p className='text-xs text-destructive/90'>{error}</p>
    </div>
  );
}

/**
 * Category icon selector
 */
function CategoryIcon({ category }: { category: ToolResultProps['category'] }) {
  const icons = {
    workflow: BarChart3,
    search: Search,
    data: Database,
    system: FileText,
    integration: ExternalLink,
  };

  const Icon = icons[category];
  return <Icon className='h-4 w-4 text-muted-foreground' />;
}

/**
 * Status badge
 */
function StatusBadge({
  success,
  error,
  metadata,
}: Pick<ToolResultProps, 'success' | 'error' | 'metadata'>) {
  if (metadata?.requiresApproval) {
    return (
      <Badge variant='secondary' className='gap-1'>
        <AlertCircle className='h-3 w-3' />
        Pending Approval
      </Badge>
    );
  }

  if (success) {
    return (
      <Badge
        variant='outline'
        className='gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400'
      >
        <CheckCircle2 className='h-3 w-3' />
        Success
      </Badge>
    );
  }

  return (
    <Badge variant='destructive' className='gap-1'>
      <XCircle className='h-3 w-3' />
      Failed
    </Badge>
  );
}

/**
 * Result renderer with category-specific formatting
 */
function ResultRenderer({
  category,
  data,
}: {
  category: ToolResultProps['category'];
  data: unknown;
}): React.ReactNode {
  // Workflow results
  if (category === 'workflow') {
    return <WorkflowResult data={data} />;
  }

  // Search results
  if (category === 'search') {
    return <SearchResult data={data} />;
  }

  // Data/Analytics results
  if (category === 'data') {
    return <DataResult data={data} />;
  }

  // Default JSON display
  return <JsonResult data={data} />;
}

/**
 * Workflow-specific result display
 */
function WorkflowResult({ data }: { data: unknown }): React.ReactNode {
  const workflowData = data as {
    workflowId?: string;
    executionId?: string;
    status?: string;
    result?: unknown;
    stats?: Record<string, number>;
  };

  return (
    <div className='space-y-2'>
      {workflowData.workflowId && (
        <ResultField
          label='Workflow ID'
          value={workflowData.workflowId}
          copyable
        />
      )}
      {workflowData.executionId && (
        <ResultField
          label='Execution ID'
          value={workflowData.executionId}
          copyable
        />
      )}
      {workflowData.status && (
        <ResultField
          label='Status'
          value={
            <Badge
              variant={
                workflowData.status === 'completed' ? 'default' : 'secondary'
              }
            >
              {workflowData.status}
            </Badge>
          }
        />
      )}
      {workflowData.stats && (
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground'>
            Statistics
          </div>
          <div className='grid grid-cols-2 gap-2 text-xs'>
            {Object.entries(workflowData.stats).map(([key, value]) => (
              <div
                key={key}
                className='flex justify-between p-2 rounded bg-muted/50'
              >
                <span className='text-muted-foreground'>
                  {formatFieldName(key)}
                </span>
                <span className='font-medium'>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {workflowData.result ? (
        <JsonResult data={workflowData.result} label='Execution Result' />
      ) : null}
    </div>
  );
}

/**
 * Search-specific result display
 */
function SearchResult({ data }: { data: unknown }): React.ReactNode {
  const searchData = data as
    | Array<Record<string, unknown>>
    | { data?: Array<Record<string, unknown>> };
  const results = Array.isArray(searchData)
    ? searchData
    : searchData.data || [];

  if (results.length === 0) {
    return (
      <div className='text-xs text-muted-foreground text-center py-4'>
        No results found
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='text-xs text-muted-foreground'>
        Found {results.length} result{results.length !== 1 ? 's' : ''}
      </div>
      <div className='space-y-2 max-h-64 overflow-y-auto'>
        {results.slice(0, 10).map((item, index) => (
          <div
            key={index}
            className='p-2 rounded border bg-muted/30 text-xs space-y-1'
          >
            {Object.entries(item).map(([key, value]) => (
              <div key={key} className='flex gap-2'>
                <span className='font-medium text-muted-foreground min-w-20'>
                  {formatFieldName(key)}:
                </span>
                <span className='break-all'>{String(formatValue(value))}</span>
              </div>
            ))}
          </div>
        ))}
        {results.length > 10 && (
          <div className='text-xs text-muted-foreground text-center py-2'>
            And {results.length - 10} more...
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Data/Analytics result display
 */
function DataResult({ data }: { data: unknown }): React.ReactNode {
  const dataResult = data as {
    data?: Array<Record<string, unknown>>;
    count?: number;
    summary?: Record<string, unknown>;
    aggregations?: Record<string, number>;
    exportId?: string;
    downloadUrl?: string;
  };

  return (
    <div className='space-y-3'>
      {dataResult.count !== undefined && (
        <ResultField
          label='Total Records'
          value={dataResult.count.toLocaleString()}
        />
      )}

      {dataResult.aggregations && (
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground'>
            Aggregations
          </div>
          <div className='grid grid-cols-2 gap-2'>
            {Object.entries(dataResult.aggregations).map(([key, value]) => (
              <div key={key} className='flex flex-col p-2 rounded bg-muted/50'>
                <span className='text-xs text-muted-foreground'>
                  {formatFieldName(key)}
                </span>
                <span className='text-sm font-medium'>
                  {String(formatValue(value))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dataResult.summary && (
        <JsonResult data={dataResult.summary} label='Summary' />
      )}

      {dataResult.downloadUrl && (
        <Button variant='outline' size='sm' asChild className='w-full'>
          <a
            href={dataResult.downloadUrl}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Download className='h-4 w-4 mr-2' />
            Download Export
          </a>
        </Button>
      )}

      {dataResult.data &&
        Array.isArray(dataResult.data) &&
        dataResult.data.length > 0 && <SearchResult data={dataResult.data} />}
    </div>
  );
}

/**
 * Generic JSON result display
 */
function JsonResult({
  data,
  label,
}: {
  data: unknown;
  label?: string;
}): React.ReactNode {
  return (
    <div className='space-y-1'>
      {label && (
        <div className='text-xs font-medium text-muted-foreground'>{label}</div>
      )}
      <pre className='text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-64 overflow-y-auto'>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Result field component
 */
function ResultField({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (typeof value === 'string') {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className='flex items-center justify-between p-2 rounded bg-muted/30'>
      <div className='flex flex-col gap-0.5'>
        <span className='text-xs text-muted-foreground'>{label}</span>
        <div className='text-sm font-medium'>{value}</div>
      </div>
      {copyable && (
        <Button
          variant='ghost'
          size='sm'
          className='h-6 w-6 p-0'
          onClick={handleCopy}
        >
          {copied ? (
            <Check className='h-3 w-3' />
          ) : (
            <Copy className='h-3 w-3' />
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * Utility: Format tool name
 */
function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Utility: Format field name
 */
function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Utility: Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return '{...}';
  return String(value);
}
