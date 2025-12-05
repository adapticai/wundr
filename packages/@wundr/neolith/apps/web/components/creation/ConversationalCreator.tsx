'use client';

import { Send, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { useConversationalCreation } from './hooks/useConversationalCreation';

import type { EntitySpec, EntityType } from './types';

/**
 * Props for the ConversationalCreator component
 */
export interface ConversationalCreatorProps {
  /** Type of entity being created */
  entityType: EntityType;
  /** Callback when spec is generated and ready for form view */
  onSpecGenerated: (spec: EntitySpec) => void;
  /** Callback when user cancels creation */
  onCancel: () => void;
  /** Optional existing spec for modifications */
  existingSpec?: EntitySpec;
  /** Optional workspace context */
  workspaceId?: string;
  /** Whether dialog is open */
  open?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * ConversationalCreator - Chat-based component for creating entities via LLM conversation
 *
 * Features:
 * - Chat message list (user and AI messages)
 * - Text input with send button
 * - Streaming response display
 * - "Switch to Form View" button
 * - Loading states
 * - Error handling
 */
export function ConversationalCreator({
  entityType,
  onSpecGenerated,
  onCancel,
  existingSpec,
  workspaceId,
  open = true,
}: ConversationalCreatorProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { sendMessage, isLoading, error, generatedSpec, hasGeneratedSpec } =
    useConversationalCreation({
      entityType,
      workspaceId,
      existingSpec,
      onSpecGenerated: spec => {
        // When spec is generated, show it in the messages
        const specMessage: ChatMessage = {
          id: `spec-${Date.now()}`,
          role: 'assistant',
          content: `I've generated a ${entityType} specification based on our conversation. You can review and edit it by switching to Form View, or continue the conversation to make changes.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, specMessage]);
        onSpecGenerated(spec);
      },
    });

  // Add initial greeting message
  React.useEffect(() => {
    if (messages.length === 0) {
      const greeting = getGreetingMessage(entityType);
      setMessages([
        {
          id: 'initial',
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [entityType, messages.length]);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  React.useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);

    try {
      const response = await sendMessage(inputValue, messages);

      // Add AI response
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      // Error is handled by the hook
      console.error('Error sending message:', err);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSwitchToForm = () => {
    if (hasGeneratedSpec && generatedSpec) {
      onSpecGenerated(generatedSpec);
    } else {
      // Generate a basic spec from current conversation
      const basicSpec: EntitySpec = {
        entityType,
        name: '',
        description: messages
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' '),
        confidence: 0.5,
        missingFields: ['name', 'role', 'charter'],
        suggestions: [
          'Please provide more details about the role and responsibilities',
        ],
      };
      onSpecGenerated(basicSpec);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onCancel()}>
      <DialogContent className='flex max-h-[80vh] max-w-2xl flex-col gap-0 p-0'>
        <DialogHeader className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <DialogTitle>
              Create New {getEntityDisplayName(entityType)}
            </DialogTitle>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6'
              onClick={onCancel}
            >
              <X className='h-4 w-4' />
              <span className='sr-only'>Close</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <div className='flex-1 overflow-y-auto px-6 py-4'>
          <div className='space-y-4'>
            {messages.map(message => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <TypingDots />
                <span>Thinking...</span>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className='border-t px-6 py-4'>
          <div className='flex gap-2'>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder='Type your response...'
              disabled={isLoading}
              className='flex-1'
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size='icon'
            >
              <Send className='h-4 w-4' />
              <span className='sr-only'>Send</span>
            </Button>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className='border-t px-6 py-3'>
          <div className='flex w-full items-center justify-between'>
            <Button
              variant='outline'
              onClick={handleSwitchToForm}
              disabled={isLoading}
            >
              Switch to Form View
            </Button>
            <Button variant='ghost' onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ChatMessageBubble - Individual message display component
 */
function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {!isUser && (
          <div className='mb-1 text-xs font-semibold'>AI Assistant</div>
        )}
        <div className='whitespace-pre-wrap text-sm'>{message.content}</div>
        <div
          className={cn(
            'mt-1 text-xs',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground/70',
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * TypingDots - Animated typing indicator
 */
function TypingDots() {
  return (
    <div className='flex items-center gap-1'>
      <span className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]' />
      <span className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]' />
      <span className='h-2 w-2 animate-bounce rounded-full bg-muted-foreground' />
    </div>
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

/**
 * Get initial greeting message based on entity type
 */
function getGreetingMessage(entityType: EntityType): string {
  const greetings: Record<EntityType, string> = {
    workspace:
      "I'll help you create a new Workspace. Let's start with the basics - what kind of organization are you setting up? This could be a team, project, or company.",
    orchestrator:
      "I'll help you create a new Orchestrator. What role should this agent serve? For example: Customer Support Lead, Research Analyst, or Project Manager.",
    'session-manager':
      "I'll help you create a new Session Manager. Session Managers monitor channels and orchestrate conversations. What channel or context should this Session Manager focus on?",
    subagent:
      "I'll help you create a new Subagent. Subagents are specialized workers that handle specific tasks. What specific capability should this subagent provide?",
    workflow:
      "I'll help you create a new Workflow. Workflows automate tasks and connect different actions. What process would you like to automate?",
    channel:
      "I'll help you create a new Channel. Channels are communication spaces for teams and agents. What kind of channel do you need? (e.g., public, private, direct message)",
  };
  return greetings[entityType] || `I'll help you create a new ${entityType}.`;
}
