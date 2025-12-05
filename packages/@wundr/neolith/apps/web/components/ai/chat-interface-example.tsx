'use client';

import { useState } from 'react';
import { ChatInterface } from './chat-interface';
import type { AIMessage } from './chat-interface';

/**
 * Example usage of ChatInterface component
 *
 * This demonstrates a fully functional AI chat with:
 * - Message history
 * - Streaming responses
 * - File attachments
 * - Conversation history
 * - Feedback system
 *
 * @example
 * ```tsx
 * import { ChatInterfaceExample } from '@/components/ai/chat-interface-example';
 *
 * export default function AIChatPage() {
 *   return <ChatInterfaceExample />;
 * }
 * ```
 */
export function ChatInterfaceExample() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date(Date.now() - 60000),
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const [conversations, setConversations] = useState([
    {
      id: '1',
      title: 'Getting Started',
      lastMessage: "Hello! I'm your AI assistant.",
      timestamp: new Date(Date.now() - 3600000),
      messageCount: 5,
    },
    {
      id: '2',
      title: 'Code Review Help',
      lastMessage: 'Can you review this React component?',
      timestamp: new Date(Date.now() - 86400000),
      messageCount: 12,
    },
    {
      id: '3',
      title: 'TypeScript Tips',
      lastMessage: 'What are the best practices for TypeScript?',
      timestamp: new Date(Date.now() - 172800000),
      messageCount: 8,
    },
  ]);

  const [activeConversationId, setActiveConversationId] = useState('1');

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    // Create user message
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      attachments: attachments?.map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
      })),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Simulate API call with streaming
      // In production, replace this with your actual API call
      const response = await simulateAIResponse(content);

      const assistantMessage: AIMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        metadata: {
          model: 'gpt-4o',
          tokensUsed: Math.floor(Math.random() * 1000),
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: AIMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateResponse = async (messageId: string) => {
    // Find the message to regenerate
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Get the previous user message
    const previousUserMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find(m => m.role === 'user');

    if (!previousUserMessage) return;

    // Remove the old response
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setIsLoading(true);

    try {
      // Regenerate response
      const response = await simulateAIResponse(previousUserMessage.content);

      const assistantMessage: AIMessage = {
        id: `msg-${Date.now()}-regenerated`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        metadata: {
          model: 'gpt-4o',
          tokensUsed: Math.floor(Math.random() * 1000),
          regenerateCount: 1,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error regenerating response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageFeedback = (
    messageId: string,
    feedback: 'up' | 'down'
  ) => {
    console.log(`Feedback for message ${messageId}:`, feedback);

    // In production, send this to your analytics/feedback system
    // fetch('/api/feedback', {
    //   method: 'POST',
    //   body: JSON.stringify({ messageId, feedback }),
    // });
  };

  const handleNewConversation = () => {
    const newConv = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      lastMessage: '',
      timestamp: new Date(),
      messageCount: 0,
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your AI assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);

    // In production, load messages for this conversation from your backend
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Loading conversation...',
        timestamp: new Date(),
      },
    ]);
  };

  const handleDeleteConversation = (conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));

    // If deleting active conversation, switch to first available
    if (conversationId === activeConversationId && conversations.length > 1) {
      const nextConv = conversations.find(c => c.id !== conversationId);
      if (nextConv) {
        handleSelectConversation(nextConv.id);
      }
    }
  };

  return (
    <ChatInterface
      messages={messages}
      onSendMessage={handleSendMessage}
      onRegenerateResponse={handleRegenerateResponse}
      onMessageFeedback={handleMessageFeedback}
      isLoading={isLoading}
      showHistory={true}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      assistantAvatar={{
        name: 'AI Assistant',
        fallback: 'AI',
      }}
      userAvatar={{
        name: 'You',
        fallback: 'U',
      }}
      placeholder='Ask me anything...'
      maxFileSize={10 * 1024 * 1024} // 10MB
      allowedFileTypes={['image/*', '.pdf', '.txt', '.doc', '.docx']}
      className='h-screen'
    />
  );
}

/**
 * Simulate AI response with delay
 * In production, replace this with actual API call
 */
async function simulateAIResponse(userMessage: string): Promise<string> {
  // Simulate network delay
  await new Promise(resolve =>
    setTimeout(resolve, 1000 + Math.random() * 2000)
  );

  // Generate contextual responses based on user message
  const lowercaseMessage = userMessage.toLowerCase();

  if (lowercaseMessage.includes('hello') || lowercaseMessage.includes('hi')) {
    return 'Hello! How can I assist you today? I can help with coding, explanations, creative writing, and much more.';
  }

  if (
    lowercaseMessage.includes('code') ||
    lowercaseMessage.includes('programming')
  ) {
    return `I'd be happy to help with coding! Here's an example:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet('World');
console.log(message); // Output: Hello, World!
\`\`\`

This is a simple TypeScript function that demonstrates type annotations and template literals. Is there something specific you'd like help with?`;
  }

  if (
    lowercaseMessage.includes('react') ||
    lowercaseMessage.includes('component')
  ) {
    return `Here's a modern React component example using hooks:

\`\`\`tsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
\`\`\`

This demonstrates the \`useState\` hook for managing component state. Would you like to learn more about React hooks?`;
  }

  // Default response
  return `I understand you're asking about: "${userMessage}"

I'm here to help! Here are some things I can assist with:

- **Code Review**: Share your code and I'll provide feedback
- **Debugging**: Describe your issue and I'll help troubleshoot
- **Learning**: Ask about programming concepts, patterns, or best practices
- **Writing**: Help with technical documentation or creative content

What would you like to explore?`;
}
