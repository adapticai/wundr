'use client';

import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DMSummaryPanelProps {
  conversationId: string;
  className?: string;
}

type TimePeriod = '1h' | '24h' | '7d' | '30d' | 'all';

const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

/**
 * DM Summary Panel Component
 *
 * Displays an AI-generated summary of the DM conversation with:
 * - Collapsible panel at top of conversation
 * - Time period selector
 * - Streaming summary generation
 * - Markdown rendering
 */
export function DMSummaryPanel({
  conversationId,
  className,
}: DMSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('24h');
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSummary('');
    setHasGenerated(true);

    try {
      const response = await fetch(`/api/dm/${conversationId}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          period,
          maxMessages: 200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || 'Failed to generate summary',
        );
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });

        // Handle streaming data format (newline-delimited JSON)
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          // Skip empty lines and comments
          if (!line.trim() || line.startsWith(':')) {
            continue;
          }

          // Parse data: prefix format
          const dataMatch = line.match(/^data: (.+)$/);
          if (dataMatch) {
            try {
              const data = JSON.parse(dataMatch[1]);

              // Handle different data types from AI SDK
              if (data.type === 'text-delta' && data.textDelta) {
                accumulatedText += data.textDelta;
                setSummary(accumulatedText);
              } else if (data.type === 'text' && data.text) {
                // Some providers send full text
                accumulatedText = data.text;
                setSummary(accumulatedText);
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError);
            }
          }
        }
      }

      if (!accumulatedText) {
        throw new Error('No summary content received');
      }

      toast.success('Summary generated successfully');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate summary';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('[DMSummaryPanel] Error generating summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, period]);

  const handleSummarize = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
    }
    generateSummary();
  }, [isOpen, generateSummary]);

  const handlePeriodChange = useCallback((newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
    // Auto-regenerate if summary was already generated
    if (hasGenerated && !isLoading) {
      setTimeout(() => {
        generateSummary();
      }, 100);
    }
  }, [hasGenerated, isLoading, generateSummary]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('border-b bg-muted/30', className)}
    >
      <div className='flex items-center justify-between px-4 py-2'>
        <div className='flex items-center gap-2'>
          <CollapsibleTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 gap-2'>
              {isOpen ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
              <Sparkles className='h-4 w-4 text-primary' />
              <span className='text-sm font-medium'>AI Summary</span>
            </Button>
          </CollapsibleTrigger>

          {isOpen && (
            <div className='flex items-center gap-2'>
              <Select
                value={period}
                onValueChange={value => handlePeriodChange(value as TimePeriod)}
                disabled={isLoading}
              >
                <SelectTrigger className='h-7 w-[140px] text-xs'>
                  <Clock className='mr-1 h-3 w-3' />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]).map(
                    key => (
                      <SelectItem key={key} value={key} className='text-xs'>
                        {TIME_PERIOD_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              <Button
                variant='outline'
                size='sm'
                className='h-7 text-xs'
                onClick={generateSummary}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-1 h-3 w-3 animate-spin' />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className='mr-1 h-3 w-3' />
                    {hasGenerated ? 'Regenerate' : 'Generate'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {!isOpen && (
          <Button
            variant='ghost'
            size='sm'
            className='h-7 gap-1 text-xs'
            onClick={handleSummarize}
            disabled={isLoading}
          >
            <Sparkles className='h-3 w-3' />
            Summarize
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className='border-t px-4 py-3'>
          {isLoading && !summary && (
            <div className='flex items-center justify-center py-8 text-sm text-muted-foreground'>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Analyzing conversation and generating summary...
            </div>
          )}

          {error && (
            <div className='flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive'>
              <XCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <div>
                <p className='font-medium'>Error generating summary</p>
                <p className='text-xs opacity-90'>{error}</p>
              </div>
            </div>
          )}

          {summary && (
            <div className='prose prose-sm dark:prose-invert max-w-none'>
              <Markdown
                components={{
                  // Customize markdown rendering
                  h1: ({ children }) => (
                    <h3 className='text-lg font-semibold mb-2'>{children}</h3>
                  ),
                  h2: ({ children }) => (
                    <h4 className='text-base font-semibold mb-1.5'>
                      {children}
                    </h4>
                  ),
                  h3: ({ children }) => (
                    <h5 className='text-sm font-semibold mb-1'>{children}</h5>
                  ),
                  ul: ({ children }) => (
                    <ul className='list-disc list-inside space-y-1 my-2'>
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className='list-decimal list-inside space-y-1 my-2'>
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className='text-sm text-foreground'>{children}</li>
                  ),
                  p: ({ children }) => (
                    <p className='text-sm text-muted-foreground mb-2'>
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong className='font-semibold text-foreground'>
                      {children}
                    </strong>
                  ),
                }}
              >
                {summary}
              </Markdown>
              {isLoading && (
                <div className='flex items-center gap-2 text-xs text-muted-foreground mt-2'>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  <span>Generating...</span>
                </div>
              )}
            </div>
          )}

          {!isLoading && !summary && !error && (
            <div className='py-6 text-center text-sm text-muted-foreground'>
              <Sparkles className='mx-auto mb-2 h-8 w-8 opacity-50' />
              <p>Click "Generate" to create an AI summary of this conversation</p>
              <p className='text-xs mt-1'>
                Select a time period to focus the summary
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
