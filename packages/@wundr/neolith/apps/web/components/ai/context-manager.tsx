/**
 * Context Manager Component
 *
 * Complete UI for managing AI context injection.
 * Combines source selection, preview, and context building.
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContextSources } from './context-sources';
import { ContextPreview } from './context-preview';
import { Brain, Code, Eye, Settings } from 'lucide-react';
import type { ContextSource } from '@/lib/ai/context-builder';

interface ContextManagerProps {
  workspaceId: string;
  onContextReady?: (context: string) => void;
  maxTokens?: number;
  initialSources?: ContextSource[];
}

export function ContextManager({
  workspaceId,
  onContextReady,
  maxTokens = 4000,
  initialSources = [],
}: ContextManagerProps) {
  const [selectedSources, setSelectedSources] =
    useState<ContextSource[]>(initialSources);
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [activeTab, setActiveTab] = useState<'select' | 'preview'>('select');

  async function handleBuildContext() {
    try {
      const response = await fetch('/api/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: selectedSources,
          maxTokens,
          workspaceId,
          format: 'prompt',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onContextReady) {
          onContextReady(data.prompt);
        }
      }
    } catch (error) {
      console.error('Failed to build context:', error);
    }
  }

  function handleRemoveSource(source: ContextSource) {
    setSelectedSources(prev =>
      prev.filter(s => !(s.type === source.type && s.id === source.id))
    );
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Brain className='h-5 w-5 text-primary' />
            <CardTitle>AI Context Manager</CardTitle>
          </div>
          <CardDescription>
            Select and manage information to inject into AI conversations
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='select' className='flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            Select Sources
          </TabsTrigger>
          <TabsTrigger value='preview' className='flex items-center gap-2'>
            <Eye className='h-4 w-4' />
            Preview Context
          </TabsTrigger>
        </TabsList>

        <TabsContent value='select' className='space-y-4'>
          <ContextSources
            workspaceId={workspaceId}
            selectedSources={selectedSources}
            onSourcesChange={setSelectedSources}
            maxTokens={maxTokens}
            estimatedTokens={estimatedTokens}
          />
        </TabsContent>

        <TabsContent value='preview' className='space-y-4'>
          <ContextPreview
            sources={selectedSources}
            workspaceId={workspaceId}
            maxTokens={maxTokens}
            onRemoveSource={handleRemoveSource}
          />

          {selectedSources.length > 0 && (
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setSelectedSources([])}>
                Clear All
              </Button>
              <Button onClick={handleBuildContext}>
                <Code className='h-4 w-4 mr-2' />
                Build Context
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
