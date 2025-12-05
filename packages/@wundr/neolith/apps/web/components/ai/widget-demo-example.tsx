'use client';

/**
 * AI Assistant Widget - Demo Example
 *
 * This file demonstrates how to integrate the AI Assistant Widget
 * into your application. It shows a complete working example.
 *
 * Usage:
 * 1. Import this component in your root layout or app wrapper
 * 2. The widget will be available globally with Cmd+K shortcut
 * 3. Users can drag, minimize, maximize, and chat with AI
 */

import React, { useState } from 'react';
import {
  AssistantWidget,
  WidgetTrigger,
  useWidgetStore,
} from '@/components/ai';

/**
 * Example implementation with mock API
 */
export function AIAssistantDemo() {
  const { isOpen } = useWidgetStore();

  /**
   * Handle sending messages to AI
   * Replace this with your actual AI API call
   */
  const handleSendMessage = async (content: string) => {
    console.log('Sending to AI:', content);

    // Example with fetch to your AI endpoint:
    /*
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId: '...', // Optional
          model: 'gpt-4o-mini',   // Optional
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed');
      }

      const data = await response.json();
      // Widget will handle displaying the response
    } catch (error) {
      console.error('AI error:', error);
      throw error;
    }
    */

    // For demo purposes, we just log
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <>
      {/* Floating trigger button (shown when widget is closed) */}
      <WidgetTrigger
        unreadCount={0} // Set to number of unread messages
        showPulse={false} // Set true to attract attention
      />

      {/* The main widget (shown when open) */}
      <AssistantWidget onSendMessage={handleSendMessage} />
    </>
  );
}

/**
 * Example with Vercel AI SDK integration
 */
export function AIAssistantWithVercelSDK() {
  // If using Vercel AI SDK:
  /*
  import { useChat } from 'ai/react';

  const { messages, append, isLoading } = useChat({
    api: '/api/ai/chat',
  });

  const handleSendMessage = async (content: string) => {
    await append({
      role: 'user',
      content,
    });
  };

  return (
    <>
      <WidgetTrigger />
      <AssistantWidget onSendMessage={handleSendMessage} />
    </>
  );
  */

  return null; // Placeholder
}

/**
 * Example with custom quick actions
 */
export function AIAssistantWithCustomActions() {
  const { addQuickAction } = useWidgetStore();

  // Add custom quick actions on mount
  React.useEffect(() => {
    addQuickAction({
      id: 'review-pr',
      label: 'Review PR',
      icon: 'GitPullRequest',
      prompt: 'Review this pull request and provide feedback',
      category: 'development',
    });

    addQuickAction({
      id: 'write-docs',
      label: 'Write Docs',
      icon: 'BookOpen',
      prompt: 'Generate documentation for this code',
      category: 'development',
    });
  }, [addQuickAction]);

  return (
    <>
      <WidgetTrigger />
      <AssistantWidget onSendMessage={async msg => console.log(msg)} />
    </>
  );
}

/**
 * Example usage in a layout file
 */
export default function RootLayoutWithAI({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {children}

      {/* Add AI Assistant to your layout */}
      <AIAssistantDemo />
    </div>
  );
}

/**
 * Example: Programmatically control the widget
 */
export function ControlWidgetExample() {
  const {
    toggle,
    open,
    close,
    minimize,
    maximize,
    setPosition,
    updatePreferences,
  } = useWidgetStore();

  return (
    <div className='flex gap-2 p-4'>
      <button onClick={toggle}>Toggle Widget</button>
      <button onClick={open}>Open Widget</button>
      <button onClick={close}>Close Widget</button>
      <button onClick={minimize}>Minimize</button>
      <button onClick={maximize}>Maximize</button>
      <button
        onClick={() =>
          setPosition({
            x: window.innerWidth - 420,
            y: 20,
          })
        }
      >
        Move to Top-Right
      </button>
      <button
        onClick={() =>
          updatePreferences({
            autoOpen: true,
            showQuickActions: true,
          })
        }
      >
        Update Preferences
      </button>
    </div>
  );
}

/**
 * Example: Context-aware assistant
 */
export function ContextAwareAssistant({
  currentPage,
}: {
  currentPage: string;
}) {
  const { setContextData } = useWidgetStore();

  // Update context when page changes
  React.useEffect(() => {
    setContextData({
      currentPage,
      timestamp: new Date().toISOString(),
      userRole: 'developer', // Example context
    });
  }, [currentPage, setContextData]);

  return (
    <>
      <WidgetTrigger />
      <AssistantWidget
        onSendMessage={async message => {
          // AI will have access to context data
          console.log('Message with context:', message);
        }}
      />
    </>
  );
}
