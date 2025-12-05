/**
 * Context Preview Component
 *
 * Displays a preview of the context that will be injected into AI conversations.
 */

'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Hash,
  Loader2,
  Workflow,
  X,
} from 'lucide-react';
import type { ContextSource } from '@/lib/ai/context-builder';

interface BuiltContextPreview {
  items: Array<{
    source: ContextSource;
    content: string;
    metadata: {
      title?: string;
      timestamp?: string;
      author?: string;
      relevanceScore: number;
    };
    tokens: number;
  }>;
  totalTokens: number;
  truncated: boolean;
}

interface ContextPreviewProps {
  sources: ContextSource[];
  workspaceId: string;
  maxTokens?: number;
  query?: string;
  onRemoveSource?: (source: ContextSource) => void;
}

function getSourceIcon(type: string) {
  switch (type) {
    case 'workflow':
      return <Workflow className='h-4 w-4' />;
    case 'channel':
      return <Hash className='h-4 w-4' />;
    case 'document':
      return <FileText className='h-4 w-4' />;
    default:
      return <FileText className='h-4 w-4' />;
  }
}

export function ContextPreview({
  sources,
  workspaceId,
  maxTokens = 4000,
  query,
  onRemoveSource,
}: ContextPreviewProps) {
  const [context, setContext] = useState<BuiltContextPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Build context preview
  useEffect(() => {
    async function buildPreview() {
      if (sources.length === 0) {
        setContext(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/context/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources,
            maxTokens,
            workspaceId,
            query,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to build context');
        }

        const data = await response.json();
        setContext(data);
      } catch (err) {
        console.error('Failed to build context:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    buildPreview();
  }, [sources, workspaceId, maxTokens, query]);

  function toggleItemExpanded(index: number) {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-8 text-center'>
          <FileText className='h-12 w-12 text-muted-foreground mb-4' />
          <p className='text-sm text-muted-foreground'>
            No context sources selected
          </p>
          <p className='text-xs text-muted-foreground mt-1'>
            Select sources to preview what will be sent to the AI
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-8'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          <span className='ml-2 text-sm text-muted-foreground'>
            Building context...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className='border-destructive'>
        <CardContent className='flex items-start gap-2 py-4 text-sm text-destructive'>
          <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
          <div>
            <p className='font-medium'>Failed to build context</p>
            <p className='text-xs mt-1'>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!context) return null;

  const tokenUsagePercent =
    maxTokens > 0 ? (context.totalTokens / maxTokens) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Context Preview</CardTitle>
            <CardDescription>
              This information will be included in your AI conversation
            </CardDescription>
          </div>
          <div className='text-right'>
            <div className='text-sm font-medium'>
              {context.totalTokens.toLocaleString()} tokens
            </div>
            <div className='text-xs text-muted-foreground'>
              {context.items.length} item{context.items.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Token usage */}
        <div className='mt-2'>
          <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
            <div
              className={`h-full transition-all ${
                tokenUsagePercent > 80 ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(tokenUsagePercent, 100)}%` }}
            />
          </div>
        </div>

        {context.truncated && (
          <div className='mt-2 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400'>
            <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
            <span>
              Some context was truncated to fit within the token limit. Consider
              reducing the number of sources.
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className='h-[400px]'>
          <div className='space-y-3'>
            {context.items.map((item, index) => {
              const isExpanded = expandedItems.has(index);
              const preview = item.content.substring(0, 200);
              const hasMore = item.content.length > 200;

              return (
                <Card key={index} className='border-muted'>
                  <CardHeader className='pb-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex items-start gap-2 flex-1 min-w-0'>
                        {getSourceIcon(item.source.type)}
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <CardTitle className='text-sm truncate'>
                              {item.metadata.title || 'Untitled'}
                            </CardTitle>
                            <Badge variant='secondary' className='text-xs'>
                              {item.source.type}
                            </Badge>
                          </div>
                          <CardDescription className='text-xs mt-1 flex items-center gap-2 flex-wrap'>
                            {item.metadata.author && (
                              <span>By {item.metadata.author}</span>
                            )}
                            {item.metadata.timestamp && (
                              <span>
                                {new Date(
                                  item.metadata.timestamp
                                ).toLocaleDateString()}
                              </span>
                            )}
                            <span className='font-medium'>
                              {item.tokens} tokens
                            </span>
                            <span className='text-primary'>
                              {Math.round(item.metadata.relevanceScore * 100)}%
                              relevant
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                      {onRemoveSource && (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-6 w-6 p-0 shrink-0'
                          onClick={() => onRemoveSource(item.source)}
                        >
                          <X className='h-3 w-3' />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-md'>
                      {isExpanded ? item.content : preview}
                      {hasMore && !isExpanded && '...'}
                    </div>
                    {hasMore && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='mt-2 h-8 text-xs'
                        onClick={() => toggleItemExpanded(index)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className='h-3 w-3 mr-1' />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className='h-3 w-3 mr-1' />
                            Show more
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <Separator className='my-4' />

        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            Total context size: {context.totalTokens.toLocaleString()} tokens
          </span>
          <span>
            {Math.round(tokenUsagePercent)}% of {maxTokens.toLocaleString()}{' '}
            token budget
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
