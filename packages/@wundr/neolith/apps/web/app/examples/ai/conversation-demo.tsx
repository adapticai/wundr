'use client';

import * as React from 'react';

import { Conversation, useConversation } from '@/components/ai/conversation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * Example conversation demo showing all features
 */
export default function ConversationDemo() {
  const [messages, setMessages] = React.useState([
    { id: 1, text: 'Hello! How can I help you today?', sender: 'assistant' },
    { id: 2, text: 'I need help with my account', sender: 'user' },
    {
      id: 3,
      text: "I'd be happy to help! What seems to be the issue?",
      sender: 'assistant',
    },
  ]);

  const addMessage = (text: string, sender: 'user' | 'assistant') => {
    setMessages(prev => [...prev, { id: Date.now(), text, sender }]);
  };

  return (
    <div className='container mx-auto p-4 max-w-4xl'>
      <h1 className='text-3xl font-bold mb-6'>Conversation Component Demo</h1>

      <div className='grid gap-6'>
        {/* Basic Example */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Conversation</CardTitle>
          </CardHeader>
          <CardContent className='h-96'>
            <Conversation initial='smooth'>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </Conversation>
          </CardContent>
        </Card>

        {/* With Custom Input */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex flex-col h-96'>
              <Conversation initial='smooth' className='flex-1'>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </Conversation>
              <ChatInput
                onSendMessage={text => {
                  addMessage(text, 'user');
                  // Simulate assistant response
                  setTimeout(() => {
                    addMessage(
                      'This is a simulated response to: ' + text,
                      'assistant'
                    );
                  }, 1000);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Without Scroll Button */}
        <Card>
          <CardHeader>
            <CardTitle>No Scroll Button</CardTitle>
          </CardHeader>
          <CardContent className='h-64'>
            <Conversation showScrollButton={false}>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </Conversation>
          </CardContent>
        </Card>

        {/* Controls Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Controls</CardTitle>
          </CardHeader>
          <CardContent className='h-64'>
            <ControlledConversation messages={messages} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Message bubble component
 */
function MessageBubble({
  message,
}: {
  message: { id: number; text: string; sender: string };
}) {
  return (
    <div
      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          message.sender === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

/**
 * Chat input with auto-scroll
 */
function ChatInput({
  onSendMessage,
}: {
  onSendMessage: (text: string) => void;
}) {
  const [input, setInput] = React.useState('');
  const { scrollToBottom } = useConversation();

  const handleSend = () => {
    if (!input.trim()) {
      return;
    }

    onSendMessage(input);
    setInput('');

    // Scroll to bottom after sending
    setTimeout(scrollToBottom, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className='flex gap-2 p-4 border-t'>
      <Input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='Type a message...'
        className='flex-1'
      />
      <Button onClick={handleSend}>Send</Button>
    </div>
  );
}

/**
 * Conversation with external controls
 */
function ControlledConversation({ messages }: { messages: any[] }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className='flex flex-col h-full gap-2'>
      <div className='flex gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            // Manual scroll using ref
            const container = scrollRef.current?.querySelector(
              '[data-radix-scroll-area-viewport]'
            );
            if (container) {
              container.scrollTop = 0;
            }
          }}
        >
          Scroll to Top
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            const container = scrollRef.current?.querySelector(
              '[data-radix-scroll-area-viewport]'
            );
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }}
        >
          Scroll to Bottom
        </Button>
      </div>
      <div ref={scrollRef} className='flex-1'>
        <Conversation>
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </Conversation>
      </div>
    </div>
  );
}
