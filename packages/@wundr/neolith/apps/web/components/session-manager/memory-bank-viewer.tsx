/**
 * Memory Bank Viewer
 *
 * Read-only viewer for session manager memory bank files.
 * Tabs for: Active Context, Progress, Product Context, Decision Log.
 */
'use client';

import {
  FileText,
  AlertCircle,
  RefreshCw,
  BookOpen,
  ListChecks,
  Package,
  GitCommit,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type MemoryTabKey =
  | 'active-context'
  | 'progress'
  | 'product-context'
  | 'decision-log';

interface MemoryFile {
  path: string;
  content: string;
  lastModified?: string;
  sizeBytes?: number;
}

interface MemoryBank {
  'active-context'?: MemoryFile;
  progress?: MemoryFile;
  'product-context'?: MemoryFile;
  'decision-log'?: MemoryFile;
}

interface MemoryBankViewerProps {
  sessionManagerId: string;
  className?: string;
}

const TABS: Array<{
  key: MemoryTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    key: 'active-context',
    label: 'Active Context',
    icon: BookOpen,
    description: 'Current working context and immediate task details',
  },
  {
    key: 'progress',
    label: 'Progress',
    icon: ListChecks,
    description: 'Task progress tracking and completion status',
  },
  {
    key: 'product-context',
    label: 'Product Context',
    icon: Package,
    description: 'Product requirements and long-term context',
  },
  {
    key: 'decision-log',
    label: 'Decision Log',
    icon: GitCommit,
    description: 'Record of architectural and implementation decisions',
  },
];

/**
 * Minimal markdown-to-HTML renderer for read-only display.
 * Handles headings, bold, italic, code blocks, inline code, and lists.
 */
function renderMarkdown(content: string): string {
  // Escape HTML first
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, lang, code) =>
      `<pre class="bg-muted rounded p-3 overflow-x-auto text-xs font-mono my-2">${lang ? `<span class="text-muted-foreground text-xs">${lang}</span>\n` : ''}${code.trim()}</pre>`
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-muted rounded px-1 py-0.5 text-xs font-mono">$1</code>'
  );

  // Headings
  html = html.replace(
    /^(#{1,6})\s+(.+)$/gm,
    (_m, hashes: string, text: string) => {
      const level = hashes.length;
      const sizes: Record<number, string> = {
        1: 'text-xl font-bold mt-4 mb-2',
        2: 'text-lg font-semibold mt-3 mb-1.5',
        3: 'text-base font-semibold mt-2 mb-1',
        4: 'text-sm font-semibold mt-2 mb-1',
        5: 'text-sm font-medium mt-1.5 mb-0.5',
        6: 'text-xs font-medium mt-1 mb-0.5',
      };
      return `<h${level} class="${sizes[level] ?? 'font-semibold'}">${text}</h${level}>`;
    }
  );

  // Bold + Italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(
    /^[\-\*]\s+(.+)$/gm,
    '<li class="ml-4 list-disc text-sm">$1</li>'
  );

  // Ordered lists
  html = html.replace(
    /^\d+\.\s+(.+)$/gm,
    '<li class="ml-4 list-decimal text-sm">$1</li>'
  );

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="my-3 border-border" />');

  // Paragraphs (blank-line separated)
  html = html
    .split(/\n\n+/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) {
        return '';
      }
      // Don't wrap pre, h1-h6, li, hr blocks in <p>
      if (
        /^<(pre|h[1-6]|li|hr|ul|ol)/.test(trimmed) ||
        /^<\/(pre|h[1-6]|li|ul|ol)>$/.test(trimmed)
      ) {
        return trimmed;
      }
      return `<p class="text-sm leading-relaxed my-1">${trimmed}</p>`;
    })
    .join('\n');

  return html;
}

function MemoryFileContent({ file }: { file: MemoryFile | undefined }) {
  if (!file) {
    return (
      <div className='flex flex-col items-center justify-center py-10 text-center'>
        <FileText className='h-10 w-10 text-muted-foreground mb-3' />
        <p className='text-sm font-medium text-muted-foreground'>
          No content available
        </p>
        <p className='text-xs text-muted-foreground mt-1'>
          This memory file has not been populated yet.
        </p>
      </div>
    );
  }

  const renderedHtml = renderMarkdown(file.content);

  return (
    <div className='space-y-2'>
      {/* File meta */}
      <div className='flex items-center gap-3 text-xs text-muted-foreground pb-2 border-b'>
        <span className='font-mono'>{file.path}</span>
        {file.lastModified && (
          <span>Modified: {new Date(file.lastModified).toLocaleString()}</span>
        )}
        {file.sizeBytes !== undefined && (
          <Badge variant='outline' className='text-xs'>
            {file.sizeBytes < 1024
              ? `${file.sizeBytes}B`
              : `${(file.sizeBytes / 1024).toFixed(1)}KB`}
          </Badge>
        )}
      </div>

      {/* Rendered markdown */}
      {file.content.trim() ? (
        <div
          className='prose prose-sm max-w-none'
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        <p className='text-sm text-muted-foreground italic py-4'>
          This file is empty.
        </p>
      )}
    </div>
  );
}

export function MemoryBankViewer({
  sessionManagerId,
  className,
}: MemoryBankViewerProps) {
  const [memoryBank, setMemoryBank] = useState<MemoryBank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MemoryTabKey>('active-context');

  const fetchMemoryBank = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/session-managers/${sessionManagerId}/memory-bank`
      );

      if (res.status === 404) {
        // Memory bank not yet set up — show empty state without an error
        setMemoryBank({});
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch memory bank');
      }

      const { data } = await res.json();
      setMemoryBank(data ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionManagerId]);

  useEffect(() => {
    fetchMemoryBank();
  }, [fetchMemoryBank]);

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-48 w-full' />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4',
          className
        )}
      >
        <AlertCircle className='h-5 w-5 text-red-500 flex-shrink-0' />
        <div className='flex-1'>
          <p className='text-sm font-medium text-red-800'>
            Failed to load memory bank
          </p>
          <p className='text-xs text-red-600 mt-0.5'>{error}</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchMemoryBank}>
          <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
          Retry
        </Button>
      </div>
    );
  }

  const hasAnyContent = memoryBank
    ? Object.values(memoryBank).some(f => f?.content?.trim())
    : false;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <FileText className='h-4 w-4 text-muted-foreground' />
          <span className='text-sm font-medium'>Memory Bank</span>
          {!hasAnyContent && (
            <Badge variant='outline' className='text-xs'>
              Empty
            </Badge>
          )}
        </div>
        <Button
          variant='ghost'
          size='sm'
          className='h-7 text-xs'
          onClick={fetchMemoryBank}
          title='Refresh memory bank'
        >
          <RefreshCw className='h-3.5 w-3.5' />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={val => setActiveTab(val as MemoryTabKey)}
      >
        <TabsList className='grid w-full grid-cols-4'>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const hasContent = Boolean(memoryBank?.[tab.key]?.content?.trim());
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className='text-xs gap-1.5'
              >
                <Icon className='h-3.5 w-3.5' />
                <span className='hidden sm:inline'>{tab.label}</span>
                {hasContent && (
                  <span className='inline-block h-1.5 w-1.5 rounded-full bg-primary' />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map(tab => {
          const tabInfo = TABS.find(t => t.key === tab.key);
          return (
            <TabsContent key={tab.key} value={tab.key} className='mt-4'>
              {tabInfo && (
                <p className='text-xs text-muted-foreground mb-3'>
                  {tabInfo.description}
                </p>
              )}
              <div className='rounded-lg border bg-card p-4 min-h-[200px]'>
                <MemoryFileContent file={memoryBank?.[tab.key]} />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default MemoryBankViewer;
