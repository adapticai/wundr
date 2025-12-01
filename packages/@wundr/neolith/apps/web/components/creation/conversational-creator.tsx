/**
 * Conversational Creator Component
 * LLM-powered conversational interface for creating entities
 * @module components/creation/conversational-creator
 */
'use client';

import * as React from 'react';
import { Send, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessage } from './chat-message';
import { useConversationalCreation } from './hooks/useConversationalCreation';
import type { EntityType, EntitySpec } from './types';

export interface ConversationalCreatorProps {
  /** Type of entity being created */
  entityType: EntityType;
  /** Workspace ID context */
  workspaceId?: string;
  /** Callback when spec is generated */
  onSpecGenerated: (spec: EntitySpec) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Existing spec for modifications */
  existingSpec?: EntitySpec;
  /** Whether dialog is open */
  open?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * ConversationalCreator - Chat-based interface for creating entities
 *
 * Features:
 * - Streaming LLM responses
 * - Context-aware conversation
 * - Automatic spec generation
 * - Switch to form view
 * - Keyboard shortcuts
 */
export function ConversationalCreator({
  entityType,
  workspaceId,
  onSpecGenerated,
  onCancel,
  existingSpec,
  open = true,
}: ConversationalCreatorProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { sendMessage, isLoading, error, generatedSpec, hasGeneratedSpec } =
    useConversationalCreation({
      entityType,
      workspaceId,
      existingSpec,
      onSpecGenerated,
    });

  // Initialize with greeting
  React.useEffect(() => {
    if (messages.length === 0 && open) {
      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          content: getGreetingMessage(entityType),
          timestamp: new Date(),
        },
      ]);
    }
  }, [entityType, messages.length, open]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea
  React.useEffect(() => {
    if (open) {
      textareaRef.current?.focus();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await sendMessage(input, messages);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSwitchToForm = () => {
    if (hasGeneratedSpec && generatedSpec) {
      onSpecGenerated(generatedSpec);
    } else {
      // Generate basic spec from conversation
      const basicSpec: EntitySpec = {
        entityType,
        name: '',
        description: messages
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' ')
          .slice(0, 200),
        confidence: 0.5,
        missingFields: ['name', 'description'],
        suggestions: ['Continue the conversation to provide more details'],
      };
      onSpecGenerated(basicSpec);
    }
  };

  return (
    <div className='flex h-[70vh] flex-col'>
      {/* Header */}
      <div className='border-b px-6 py-4'>
        <h2 className='text-lg font-semibold'>
          Create {getEntityDisplayName(entityType)}
        </h2>
        <p className='text-sm text-muted-foreground'>
          Chat with AI to generate your {entityType} specification
        </p>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        <div className='space-y-4'>
          {messages.map(message => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              isStreaming={false}
            />
          ))}

          {isLoading && (
            <ChatMessage
              role='assistant'
              content='Thinking...'
              isStreaming={true}
            />
          )}

          {error && (
            <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className='border-t px-6 py-4'>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='flex gap-2'>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Type your message... (Enter to send, Shift+Enter for new line)'
              className='min-h-[60px] resize-none'
              disabled={isLoading}
              aria-label='Message input'
            />
            <Button
              type='submit'
              size='icon'
              className='h-[60px] w-[60px] shrink-0'
              disabled={!input.trim() || isLoading}
            >
              <Send className='h-5 w-5' />
              <span className='sr-only'>Send message</span>
            </Button>
          </div>

          <div className='flex items-center justify-between'>
            <Button
              type='button'
              variant='outline'
              onClick={handleSwitchToForm}
              disabled={isLoading}
            >
              Switch to Form View
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
            <Button type='button' variant='ghost' onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Get entity display name
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

/**
 * Get greeting message for entity type
 */
function getGreetingMessage(entityType: EntityType): string {
  const greetings: Record<EntityType, string> = {
    workspace:
      "Hi! I'll help you create a new Workspace. Let's start with the basics - what kind of organization are you setting up?",
    orchestrator:
      "Hi! I'll help you create a new Orchestrator. What role should this agent serve? For example: Customer Support Lead, Research Analyst, or Project Manager.",
    'session-manager':
      "Hi! I'll help you create a new Session Manager. Session Managers monitor channels and orchestrate conversations. What channel or context should this manage?",
    subagent:
      "Hi! I'll help you create a new Subagent. Subagents handle specific tasks. What capability should this subagent provide?",
    workflow:
      "Hi! I'll help you create a new Workflow. Workflows automate tasks and processes. What would you like to automate?",
    channel:
      "Hi! I'll help you create a new Channel. What kind of channel do you need? (e.g., public, private, direct message)",
  };
  return (
    greetings[entityType] || `Hi! I'll help you create a new ${entityType}.`
  );
}
