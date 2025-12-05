/**
 * Context Sources Selector
 *
 * UI component for selecting and managing context sources for AI injection.
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  FileText,
  Hash,
  Loader2,
  Search,
  Workflow,
} from 'lucide-react';
import type { ContextSource } from '@/lib/ai/context-builder';

interface AvailableSources {
  workflows: Array<{ id: string; name: string; type: string }>;
  channels: Array<{ id: string; name: string; type: string }>;
  documents: Array<{ id: string; name: string; type: string }>;
}

interface ContextSourcesProps {
  workspaceId: string;
  selectedSources: ContextSource[];
  onSourcesChange: (sources: ContextSource[]) => void;
  maxTokens?: number;
  estimatedTokens?: number;
}

export function ContextSources({
  workspaceId,
  selectedSources,
  onSourcesChange,
  maxTokens = 4000,
  estimatedTokens = 0,
}: ContextSourcesProps) {
  const [availableSources, setAvailableSources] =
    useState<AvailableSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedSources, setSuggestedSources] = useState<ContextSource[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Load available sources
  useEffect(() => {
    async function loadSources() {
      try {
        const response = await fetch(
          `/api/ai/context/sources?workspaceId=${workspaceId}`
        );
        if (response.ok) {
          const data = await response.json();
          setAvailableSources(data);
        }
      } catch (error) {
        console.error('Failed to load context sources:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSources();
  }, [workspaceId]);

  // Get suggestions based on search query
  async function handleSearchSuggestions() {
    if (!searchQuery.trim()) return;

    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `/api/ai/context/suggest?workspaceId=${workspaceId}&query=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestedSources(data.sources || []);
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function isSourceSelected(type: string, id: string): boolean {
    return selectedSources.some(s => s.type === type && s.id === id);
  }

  function toggleSource(type: ContextSource['type'], id: string, weight = 1.0) {
    if (isSourceSelected(type, id)) {
      onSourcesChange(
        selectedSources.filter(s => !(s.type === type && s.id === id))
      );
    } else {
      onSourcesChange([...selectedSources, { type, id, weight }]);
    }
  }

  function clearAllSources() {
    onSourcesChange([]);
  }

  function applySuggestions() {
    const newSources = suggestedSources.filter(
      suggested =>
        !selectedSources.some(
          s => s.type === suggested.type && s.id === suggested.id
        )
    );
    onSourcesChange([...selectedSources, ...newSources]);
    setSuggestedSources([]);
  }

  const tokenUsagePercent =
    maxTokens > 0 ? (estimatedTokens / maxTokens) * 100 : 0;
  const tokenWarning = tokenUsagePercent > 80;

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-8'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          <span className='ml-2 text-sm text-muted-foreground'>
            Loading sources...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Context Sources</CardTitle>
            <CardDescription>
              Select information to include in the AI conversation
            </CardDescription>
          </div>
          <div className='text-right'>
            <div className='text-sm font-medium'>
              {estimatedTokens.toLocaleString()} / {maxTokens.toLocaleString()}{' '}
              tokens
            </div>
            <div className='text-xs text-muted-foreground'>
              {selectedSources.length} source
              {selectedSources.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        </div>

        {/* Token usage bar */}
        <div className='mt-2'>
          <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
            <div
              className={`h-full transition-all ${
                tokenWarning ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(tokenUsagePercent, 100)}%` }}
            />
          </div>
        </div>

        {tokenWarning && (
          <div className='mt-2 flex items-start gap-2 text-sm text-destructive'>
            <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
            <span>Token limit approaching. Some context may be truncated.</span>
          </div>
        )}
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Smart search */}
        <div className='space-y-2'>
          <Label>Smart Search</Label>
          <div className='flex gap-2'>
            <Input
              placeholder='Search for relevant context...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSuggestions()}
            />
            <Button
              onClick={handleSearchSuggestions}
              disabled={!searchQuery.trim() || loadingSuggestions}
              size='sm'
            >
              {loadingSuggestions ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Search className='h-4 w-4' />
              )}
            </Button>
          </div>

          {/* Suggestions */}
          {suggestedSources.length > 0 && (
            <Card className='bg-muted/50'>
              <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                  <CardTitle className='text-sm'>Suggested Sources</CardTitle>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={applySuggestions}
                  >
                    Add All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className='space-y-2'>
                {suggestedSources.map((source, idx) => (
                  <div
                    key={idx}
                    className='flex items-center justify-between text-sm'
                  >
                    <span className='flex items-center gap-2'>
                      {source.type === 'workflow' && (
                        <Workflow className='h-4 w-4' />
                      )}
                      {source.type === 'channel' && (
                        <Hash className='h-4 w-4' />
                      )}
                      {source.type === 'document' && (
                        <FileText className='h-4 w-4' />
                      )}
                      <Badge variant='secondary' className='text-xs'>
                        {source.type}
                      </Badge>
                    </span>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => toggleSource(source.type, source.id)}
                      disabled={isSourceSelected(source.type, source.id)}
                    >
                      {isSourceSelected(source.type, source.id)
                        ? 'Added'
                        : 'Add'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Source tabs */}
        <Tabs defaultValue='workflows' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='workflows'>
              Workflows ({availableSources?.workflows.length || 0})
            </TabsTrigger>
            <TabsTrigger value='channels'>
              Channels ({availableSources?.channels.length || 0})
            </TabsTrigger>
            <TabsTrigger value='documents'>
              Documents ({availableSources?.documents.length || 0})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className='h-[300px] mt-4'>
            <TabsContent value='workflows' className='space-y-2'>
              {availableSources?.workflows.map(workflow => (
                <div key={workflow.id} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`workflow-${workflow.id}`}
                    checked={isSourceSelected('workflow', workflow.id)}
                    onCheckedChange={() =>
                      toggleSource('workflow', workflow.id)
                    }
                  />
                  <Label
                    htmlFor={`workflow-${workflow.id}`}
                    className='flex-1 cursor-pointer text-sm font-normal'
                  >
                    <div className='flex items-center gap-2'>
                      <Workflow className='h-4 w-4 text-muted-foreground' />
                      {workflow.name}
                    </div>
                  </Label>
                </div>
              ))}
              {(!availableSources?.workflows ||
                availableSources.workflows.length === 0) && (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  No workflows available
                </p>
              )}
            </TabsContent>

            <TabsContent value='channels' className='space-y-2'>
              {availableSources?.channels.map(channel => (
                <div key={channel.id} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`channel-${channel.id}`}
                    checked={isSourceSelected('channel', channel.id)}
                    onCheckedChange={() => toggleSource('channel', channel.id)}
                  />
                  <Label
                    htmlFor={`channel-${channel.id}`}
                    className='flex-1 cursor-pointer text-sm font-normal'
                  >
                    <div className='flex items-center gap-2'>
                      <Hash className='h-4 w-4 text-muted-foreground' />
                      {channel.name}
                    </div>
                  </Label>
                </div>
              ))}
              {(!availableSources?.channels ||
                availableSources.channels.length === 0) && (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  No channels available
                </p>
              )}
            </TabsContent>

            <TabsContent value='documents' className='space-y-2'>
              {availableSources?.documents.map(doc => (
                <div key={doc.id} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`doc-${doc.id}`}
                    checked={isSourceSelected('document', doc.id)}
                    onCheckedChange={() => toggleSource('document', doc.id)}
                  />
                  <Label
                    htmlFor={`doc-${doc.id}`}
                    className='flex-1 cursor-pointer text-sm font-normal'
                  >
                    <div className='flex items-center gap-2'>
                      <FileText className='h-4 w-4 text-muted-foreground' />
                      {doc.name}
                    </div>
                  </Label>
                </div>
              ))}
              {(!availableSources?.documents ||
                availableSources.documents.length === 0) && (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  No documents available
                </p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions */}
        {selectedSources.length > 0 && (
          <div className='flex justify-between items-center pt-2 border-t'>
            <Button variant='ghost' size='sm' onClick={clearAllSources}>
              Clear All
            </Button>
            <span className='text-xs text-muted-foreground'>
              Context will be injected before sending
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
