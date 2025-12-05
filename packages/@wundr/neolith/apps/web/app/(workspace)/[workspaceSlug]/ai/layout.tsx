'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import {
  ResizablePanel,
  ResizablePanelContainer,
  ResizablePanelMain,
} from '@/components/ui/resizable-panel';
import {
  ConversationSidebar,
  type Conversation,
} from '@/components/ai/conversation-sidebar';
import { ModelSelector } from '@/components/ai/model-selector';
import { NewChatButton } from '@/components/ai/new-chat-button';
import { AIKeyboardShortcuts } from '@/components/ai/ai-keyboard-shortcuts';

// Mock data - in production this would come from API
const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'Creating a new workspace',
    preview: 'How do I create a new workspace for my team?',
    timestamp: new Date(),
    isPinned: true,
    model: 'GPT-4o Mini',
    messageCount: 8,
  },
  {
    id: '2',
    title: 'Orchestrator setup',
    preview:
      'Can you help me set up an orchestrator for automated deployments?',
    timestamp: new Date(Date.now() - 3600000),
    isPinned: false,
    model: 'Claude 3.5 Sonnet',
    messageCount: 12,
  },
  {
    id: '3',
    title: 'Workflow automation',
    preview: 'I need to automate my CI/CD pipeline',
    timestamp: new Date(Date.now() - 86400000),
    isPinned: false,
    model: 'GPT-4o Mini',
    messageCount: 5,
  },
  {
    id: '4',
    title: 'Team permissions',
    preview: 'How do I manage team member permissions?',
    timestamp: new Date(Date.now() - 172800000),
    isPinned: false,
    model: 'GPT-4o',
    messageCount: 15,
  },
  {
    id: '5',
    title: 'Analytics dashboard',
    preview: 'Show me how to set up analytics tracking',
    timestamp: new Date(Date.now() - 604800000),
    isPinned: false,
    model: 'DeepSeek Chat',
    messageCount: 7,
  },
];

export default function AILayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] =
    useState<Conversation[]>(mockConversations);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

  const workspaceSlug = params.workspaceSlug as string;
  const conversationId = params.conversationId as string | undefined;

  // Close mobile sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleNewConversation = () => {
    router.push(`/${workspaceSlug}/ai`);
  };

  const handleSelectConversation = (id: string) => {
    router.push(`/${workspaceSlug}/ai/${id}`);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (conversationId === id) {
      router.push(`/${workspaceSlug}/ai`);
    }
  };

  const handlePinConversation = (id: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      currentConversationId={conversationId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      onPinConversation={handlePinConversation}
    />
  );

  return (
    <div className='flex flex-col h-[calc(100vh-3.5rem)]'>
      {/* Keyboard Shortcuts */}
      <AIKeyboardShortcuts
        workspaceSlug={workspaceSlug}
        onNewChat={handleNewConversation}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      />

      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b bg-background'>
        <div className='flex items-center gap-3'>
          {isMobile && (
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setSidebarOpen(true)}
              className='md:hidden'
            >
              <Menu className='h-5 w-5' />
            </Button>
          )}
          <h1 className='text-lg font-semibold'>AI Assistant</h1>
        </div>

        <div className='flex items-center gap-2'>
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
            className='hidden sm:flex'
          />
          <NewChatButton
            workspaceSlug={workspaceSlug}
            variant='outline'
            showLabel={false}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className='flex-1 overflow-hidden'>
        {isMobile ? (
          <>
            {/* Mobile Sidebar Sheet */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetContent side='left' className='p-0 w-[300px]'>
                {sidebar}
              </SheetContent>
            </Sheet>

            {/* Mobile Main Content */}
            <div className='h-full'>{children}</div>
          </>
        ) : (
          <>
            {/* Desktop Resizable Layout */}
            <ResizablePanelContainer>
              <ResizablePanel
                side='left'
                defaultSize={320}
                minSize={280}
                maxSize={480}
                storageKey='ai-sidebar-width'
              >
                {sidebar}
              </ResizablePanel>

              <ResizablePanelMain>{children}</ResizablePanelMain>
            </ResizablePanelContainer>
          </>
        )}
      </div>
    </div>
  );
}
