/**
 * Entity Modifier Component
 * Conversational interface for modifying existing entities
 * @module components/wizard/entity-modifier
 */
'use client';

import { Sparkles, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { ChatInput } from './chat-input';
import { ChatMessage } from './chat-message';

import type { EntityType } from '@/components/creation/types';

/**
 * Message in the conversation
 */
export interface ModifierMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Entity data structure (generic)
 */
export interface EntityData {
  id: string;
  name: string;
  description: string;
  [key: string]: unknown;
}

/**
 * Suggested modification with diff
 */
export interface Modification {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

/**
 * Suggested changes from AI
 */
export interface SuggestedChanges {
  modifications: Modification[];
  summary: string;
  reasoning: string;
}

/**
 * Props for EntityModifier
 */
export interface EntityModifierProps {
  /** Type of entity being modified */
  entityType: EntityType;
  /** ID of entity being modified */
  entityId: string;
  /** Current entity data */
  currentData: EntityData;
  /** Callback when modifications are applied */
  onApply: (modifications: Modification[]) => Promise<void>;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional initial prompt */
  initialPrompt?: string;
}

/**
 * EntityModifier - Conversational interface for modifying existing entities
 *
 * Features:
 * - Chat-based modification interface
 * - Shows current state alongside chat
 * - AI suggests modifications as diffs
 * - Before/after comparison
 * - Undo capability
 * - Multi-step modification tracking
 */
export function EntityModifier({
  entityType,
  entityId,
  currentData,
  onApply,
  onCancel,
  initialPrompt,
}: EntityModifierProps) {
  const [messages, setMessages] = React.useState<ModifierMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [suggestedChanges, setSuggestedChanges] = React.useState<
    SuggestedChanges | undefined
  >();
  const [activeTab, setActiveTab] = React.useState<'chat' | 'review'>('chat');
  const [isApplying, setIsApplying] = React.useState(false);
  const [, setModificationHistory] = React.useState<SuggestedChanges[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Initialize with greeting message
  React.useEffect(() => {
    if (messages.length === 0) {
      const greeting: ModifierMessage = {
        id: 'greeting',
        role: 'assistant',
        content:
          initialPrompt ||
          `Hi! I'll help you modify this ${getEntityDisplayName(entityType)}. What changes would you like to make? You can describe them naturally, like "change the name to X" or "add Y capability".`,
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [entityType, initialPrompt, messages.length]);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handle sending a message
   */
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) {
      return;
    }

    // Add user message to history
    const userMessage: ModifierMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call modification API
      const response = await fetch('/api/wizard/modify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType,
          entityId,
          currentData,
          messages: [...messages, userMessage],
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Add assistant response
      const assistantMessage: ModifierMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update suggested changes if provided
      if (result.suggestedChanges) {
        setSuggestedChanges(result.suggestedChanges);
        setModificationHistory(prev => [...prev, result.suggestedChanges]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message
      const errorMessage: ModifierMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle reviewing changes
   */
  const handleReviewChanges = () => {
    setActiveTab('review');
  };

  /**
   * Handle applying modifications
   */
  const handleApplyChanges = async () => {
    if (!suggestedChanges) {
      return;
    }

    setIsApplying(true);
    try {
      await onApply(suggestedChanges.modifications);
    } catch (error) {
      console.error('Failed to apply changes:', error);
      // Add error message to chat
      const errorMessage: ModifierMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Failed to apply changes. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setActiveTab('chat');
    } finally {
      setIsApplying(false);
    }
  };

  /**
   * Handle undoing suggestions
   */
  const handleUndoSuggestions = () => {
    setSuggestedChanges(undefined);
    setActiveTab('chat');

    // Add system message
    const undoMessage: ModifierMessage = {
      id: `undo-${Date.now()}`,
      role: 'system',
      content: 'Suggestions cleared. You can continue describing changes.',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, undoMessage]);
  };

  /**
   * Calculate preview of modified data
   */
  const previewData = React.useMemo(() => {
    if (!suggestedChanges) {
      return currentData;
    }

    const preview = { ...currentData };
    for (const mod of suggestedChanges.modifications) {
      preview[mod.field] = mod.newValue;
    }
    return preview;
  }, [currentData, suggestedChanges]);

  return (
    <Card className='flex h-[80vh] flex-col overflow-hidden'>
      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as 'chat' | 'review')}
      >
        {/* Header */}
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>
                Modify {getEntityDisplayName(entityType)}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {currentData.name}
              </p>
            </div>
            <TabsList className='grid w-[300px] grid-cols-2'>
              <TabsTrigger value='chat'>Conversation</TabsTrigger>
              <TabsTrigger value='review' disabled={!suggestedChanges}>
                Review Changes
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Chat View */}
        <TabsContent value='chat' className='m-0 flex h-full flex-col'>
          <div className='flex flex-1 gap-4 overflow-hidden'>
            {/* Chat Messages */}
            <div className='flex-1 overflow-y-auto px-6 py-4'>
              <div className='space-y-4'>
                {messages.map(message => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                  />
                ))}

                {isLoading && (
                  <ChatMessage
                    role='assistant'
                    content='Analyzing your request...'
                    isStreaming={true}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Current State Sidebar */}
            <div className='w-80 border-l bg-muted/30 px-4 py-4 overflow-y-auto'>
              <h3 className='mb-3 text-sm font-semibold'>Current State</h3>
              <CurrentStateView data={currentData} entityType={entityType} />

              {suggestedChanges && (
                <>
                  <div className='my-4 border-t' />
                  <h3 className='mb-3 text-sm font-semibold text-primary'>
                    Suggested Changes ({suggestedChanges.modifications.length})
                  </h3>
                  <div className='space-y-2'>
                    {suggestedChanges.modifications.map((mod, idx) => (
                      <ModificationBadge key={idx} modification={mod} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chat Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading || isApplying}
            onCancel={onCancel}
            onReviewDetails={suggestedChanges ? handleReviewChanges : undefined}
          />
        </TabsContent>

        {/* Review View */}
        <TabsContent value='review' className='m-0 h-full overflow-hidden'>
          {suggestedChanges && (
            <ReviewChanges
              entityType={entityType}
              currentData={currentData}
              previewData={previewData}
              suggestedChanges={suggestedChanges}
              onApply={handleApplyChanges}
              onUndo={handleUndoSuggestions}
              onCancel={onCancel}
              isApplying={isApplying}
            />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/**
 * CurrentStateView - Display current entity state
 */
function CurrentStateView({
  data,
  entityType: _entityType,
}: {
  data: EntityData;
  entityType: EntityType;
}) {
  const displayFields = ['name', 'description', 'role', 'status', 'discipline'];

  return (
    <div className='space-y-3 text-sm'>
      {displayFields
        .filter(field => data[field] !== undefined && data[field] !== null)
        .map(field => (
          <div key={field}>
            <div className='text-xs font-medium text-muted-foreground'>
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </div>
            <div className='mt-0.5 text-foreground'>
              {typeof data[field] === 'string'
                ? data[field]
                : JSON.stringify(data[field])}
            </div>
          </div>
        ))}
    </div>
  );
}

/**
 * ModificationBadge - Small badge showing a modification
 */
function ModificationBadge({ modification }: { modification: Modification }) {
  return (
    <div className='rounded-md border bg-background p-2 text-xs'>
      <div className='font-medium text-primary'>{modification.field}</div>
      <div className='mt-1 text-muted-foreground line-through'>
        {String(modification.oldValue).slice(0, 50)}
      </div>
      <div className='mt-1 text-foreground'>
        {String(modification.newValue).slice(0, 50)}
      </div>
    </div>
  );
}

/**
 * ReviewChanges - Compare before/after and apply changes
 */
function ReviewChanges({
  entityType: _entityType,
  currentData,
  previewData,
  suggestedChanges,
  onApply,
  onUndo,
  onCancel,
  isApplying,
}: {
  entityType: EntityType;
  currentData: EntityData;
  previewData: EntityData;
  suggestedChanges: SuggestedChanges;
  onApply: () => void;
  onUndo: () => void;
  onCancel: () => void;
  isApplying: boolean;
}) {
  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Sparkles className='h-5 w-5 text-primary' />
          <div>
            <h2 className='text-lg font-semibold'>Review Suggested Changes</h2>
            <p className='text-sm text-muted-foreground'>
              {suggestedChanges.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        <div className='mx-auto max-w-5xl space-y-6'>
          {/* AI Reasoning */}
          <Alert>
            <Sparkles className='h-4 w-4' />
            <AlertDescription>{suggestedChanges.reasoning}</AlertDescription>
          </Alert>

          {/* Before/After Comparison */}
          <div className='grid gap-6 md:grid-cols-2'>
            {/* Before */}
            <div className='space-y-3'>
              <h3 className='flex items-center gap-2 text-sm font-semibold'>
                <AlertCircle className='h-4 w-4 text-muted-foreground' />
                Current State
              </h3>
              <Card className='p-4'>
                <EntityDataDisplay data={currentData} />
              </Card>
            </div>

            {/* After */}
            <div className='space-y-3'>
              <h3 className='flex items-center gap-2 text-sm font-semibold'>
                <CheckCircle2 className='h-4 w-4 text-primary' />
                After Changes
              </h3>
              <Card className='border-primary p-4'>
                <EntityDataDisplay data={previewData} highlightChanges={true} />
              </Card>
            </div>
          </div>

          {/* Detailed Modifications */}
          <div className='space-y-3'>
            <h3 className='text-sm font-semibold'>
              Changes ({suggestedChanges.modifications.length})
            </h3>
            <div className='space-y-3'>
              {suggestedChanges.modifications.map((mod, idx) => (
                <ModificationDetail key={idx} modification={mod} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className='border-t px-6 py-4'>
        <div className='flex items-center justify-between'>
          <Button
            type='button'
            variant='ghost'
            onClick={onCancel}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={onUndo}
              disabled={isApplying}
            >
              <RotateCcw className='mr-2 h-4 w-4' />
              Start Over
            </Button>
            <Button type='button' onClick={onApply} disabled={isApplying}>
              {isApplying ? (
                <>Applying...</>
              ) : (
                <>
                  <CheckCircle2 className='mr-2 h-4 w-4' />
                  Apply Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * EntityDataDisplay - Display entity data fields
 */
function EntityDataDisplay({
  data,
  highlightChanges = false,
}: {
  data: EntityData;
  highlightChanges?: boolean;
}) {
  const displayFields = Object.keys(data).filter(key => key !== 'id');

  return (
    <div className='space-y-3 text-sm'>
      {displayFields.map(field => (
        <div key={field}>
          <div className='text-xs font-medium text-muted-foreground'>
            {field.charAt(0).toUpperCase() +
              field.slice(1).replace(/([A-Z])/g, ' $1')}
          </div>
          <div
            className={cn(
              'mt-0.5',
              highlightChanges && 'font-medium text-primary'
            )}
          >
            {typeof data[field] === 'string' || typeof data[field] === 'number'
              ? String(data[field])
              : JSON.stringify(data[field], null, 2)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ModificationDetail - Detailed view of a modification
 */
function ModificationDetail({ modification }: { modification: Modification }) {
  return (
    <Card className='p-4'>
      <div className='space-y-2'>
        <div className='flex items-start justify-between'>
          <div className='font-medium'>{modification.field}</div>
          <div className='text-xs text-muted-foreground'>
            {modification.reason}
          </div>
        </div>
        <div className='grid gap-2 text-sm md:grid-cols-2'>
          <div>
            <div className='text-xs font-medium text-muted-foreground'>
              Before
            </div>
            <div className='mt-1 rounded bg-muted p-2 line-through'>
              {String(modification.oldValue)}
            </div>
          </div>
          <div>
            <div className='text-xs font-medium text-primary'>After</div>
            <div className='mt-1 rounded border border-primary bg-primary/5 p-2'>
              {String(modification.newValue)}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Get entity display name for UI
 */
function getEntityDisplayName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    workspace: 'Workspace',
    orchestrator: 'Orchestrator',
    'session-manager': 'Session Manager',
    subagent: 'Subagent',
    workflow: 'Workflow',
    channel: 'Channel',
  };
  return names[entityType] || entityType;
}
