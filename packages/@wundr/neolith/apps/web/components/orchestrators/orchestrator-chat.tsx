/**
 * Orchestrator Chat Component
 *
 * Provides an AI-powered chat interface for orchestrator management:
 * - Interactive chat about orchestrator configuration
 * - Charter and capability recommendations
 * - Operational guidance and best practices
 *
 * @module components/orchestrators/orchestrator-chat
 */
'use client';

import { Brain, X } from 'lucide-react';
import * as React from 'react';

import { UnifiedChat } from '@/components/ai/unified-chat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Orchestrator } from '@/types/orchestrator';

export interface OrchestratorChatProps {
  orchestrator: Orchestrator;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * OrchestratorChat - AI-powered chat interface for orchestrator management
 *
 * Features:
 * - Context-aware chat about the orchestrator
 * - Configuration recommendations
 * - Charter and capability guidance
 * - Operational best practices
 */
export function OrchestratorChat({
  orchestrator,
  isOpen,
  onClose,
  className,
}: OrchestratorChatProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Card
      className={cn(
        'flex h-full w-[450px] flex-col border-l shadow-lg',
        className
      )}
    >
      {/* Header */}
      <CardHeader className='flex-shrink-0 border-b'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='rounded-full bg-primary/10 p-2'>
              <Brain className='h-5 w-5 text-primary' />
            </div>
            <div>
              <CardTitle className='text-lg'>AI Assistant</CardTitle>
              <p className='text-xs text-muted-foreground'>
                Chat about {orchestrator.title}
              </p>
            </div>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
            <span className='sr-only'>Close AI Chat</span>
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className='flex flex-1 flex-col overflow-hidden p-0'>
        <UnifiedChat
          apiEndpoint={`/api/orchestrators/${orchestrator.id}/ai`}
          variant='panel'
          persona={{
            name: orchestrator.title || 'Orchestrator Assistant',
            greeting:
              'I can help you improve this orchestrator, suggest capabilities, refine the charter, or tune operational settings.',
            suggestions: [
              'How can I improve this orchestrator?',
              'Suggest capabilities for this discipline',
              'Help me write a better charter',
            ],
          }}
          showToolCalls
          showReasoning
          enableActions
          requestBody={{ orchestratorId: orchestrator.id }}
          onClose={onClose}
          maxHeight='calc(100vh - 8rem)'
        />
      </CardContent>
    </Card>
  );
}
