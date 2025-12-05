/**
 * Conversational Wizard Component
 * Reusable LLM-powered conversational interface for entity creation
 * @module components/wizard/conversational-wizard
 */
'use client';

import * as React from 'react';

import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ChatInput } from './chat-input';
import { ChatMessage } from './chat-message';
import { EntityReviewForm } from './entity-review-form';

import type { EntityType } from '@/components/creation/types';

/**
 * Message in the conversation
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Extracted data structure from conversation
 * This should be extended based on your entity requirements
 */
export interface EntityData {
  name: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Props for ConversationalWizard
 */
export interface ConversationalWizardProps {
  /** Type of entity being created */
  entityType: EntityType;
  /** Callback when entity creation is complete */
  onComplete: (data: EntityData) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional starting prompt to seed the conversation */
  initialContext?: string;
  /** Optional function to send message to LLM API */
  onSendMessage?: (
    message: string,
    history: Message[]
  ) => Promise<{ response: string; extractedData?: EntityData }>;
  /** Optional initial data for editing mode */
  initialData?: EntityData;
}

/**
 * ConversationalWizard - Reusable chat-based entity creation wizard
 *
 * Features:
 * - Chat-style interface with message bubbles
 * - Text input with send button
 * - Loading state while AI is responding
 * - Extract structured data from conversation
 * - "Review Details" button that shows form
 * - Toggle between chat and form views
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 */
export function ConversationalWizard({
  entityType,
  onComplete,
  onCancel,
  initialContext,
  onSendMessage,
  initialData,
}: ConversationalWizardProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [extractedData, setExtractedData] = React.useState<
    EntityData | undefined
  >(initialData);
  const [activeTab, setActiveTab] = React.useState<'chat' | 'form'>('chat');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Initialize with greeting message
  React.useEffect(() => {
    if (messages.length === 0) {
      const greeting: Message = {
        id: 'greeting',
        role: 'assistant',
        content: getGreetingMessage(entityType, initialContext),
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [entityType, initialContext, messages.length]);

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
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call LLM API or use provided handler
      const result = onSendMessage
        ? await onSendMessage(content, [...messages, userMessage])
        : await defaultMessageHandler(
            content,
            [...messages, userMessage],
            entityType,
          );

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update extracted data if provided
      if (result.extractedData) {
        setExtractedData(result.extractedData);
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message
      const errorMessage: Message = {
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
   * Handle switching to form view
   */
  const handleReviewDetails = () => {
    setActiveTab('form');
  };

  /**
   * Handle form submission
   */
  const handleFormSubmit = (data: EntityData) => {
    onComplete(data);
  };

  return (
    <Card className='flex h-[70vh] flex-col overflow-hidden'>
      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as 'chat' | 'form')}
      >
        <div className='border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>
                Create {getEntityDisplayName(entityType)}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {activeTab === 'chat'
                  ? 'Chat with AI to define your requirements'
                  : 'Review and edit the details'}
              </p>
            </div>
            <TabsList className='grid w-[300px] grid-cols-2'>
              <TabsTrigger value='chat'>Conversation</TabsTrigger>
              <TabsTrigger value='form' disabled={!extractedData}>
                Review Details
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value='chat' className='m-0 flex h-full flex-col'>
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
                  content='Thinking...'
                  isStreaming={true}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Chat Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
            onCancel={onCancel}
            onReviewDetails={extractedData ? handleReviewDetails : undefined}
          />
        </TabsContent>

        <TabsContent value='form' className='m-0 h-full'>
          {extractedData && (
            <EntityReviewForm
              entityType={entityType}
              extractedData={
                extractedData as Parameters<
                  typeof EntityReviewForm
                >[0]['extractedData']
              }
              onSubmit={handleFormSubmit}
              onCancel={onCancel}
            />
          )}
        </TabsContent>
      </Tabs>
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

/**
 * Get greeting message based on entity type
 */
function getGreetingMessage(
  entityType: EntityType,
  initialContext?: string,
): string {
  if (initialContext) {
    return initialContext;
  }

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

/**
 * Default message handler (mock implementation)
 * Replace this with your actual LLM API call
 */
async function defaultMessageHandler(
  message: string,
  history: Message[],
  entityType: EntityType,
): Promise<{ response: string; extractedData?: EntityData }> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simple mock response
  const userMessages = history.filter(m => m.role === 'user');
  const messageCount = userMessages.length;

  if (messageCount === 1) {
    return {
      response: `Great! I understand you want to create a ${entityType} for "${message}". Can you tell me more about its specific purpose and key features?`,
    };
  } else if (messageCount === 2) {
    return {
      response:
        "Excellent! I've gathered enough information to generate a draft. Click 'Review Details' to see what I've prepared for you.",
      extractedData: {
        name: message.slice(0, 50),
        description: userMessages.map(m => m.content).join('. '),
      },
    };
  }

  return {
    response:
      "Thanks for the additional information. I've updated the details accordingly.",
    extractedData: {
      name: userMessages[0].content.slice(0, 50),
      description: userMessages.map(m => m.content).join('. '),
    },
  };
}
