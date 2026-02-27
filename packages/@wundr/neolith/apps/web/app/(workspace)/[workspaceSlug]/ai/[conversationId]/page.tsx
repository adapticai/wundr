'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AIChatInterface } from '@/components/ai/ai-chat-interface';
import { usePageHeader } from '@/contexts/page-header-context';

export default function ConversationPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const conversationId = params.conversationId as string;
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader('AI Assistant', 'Resuming conversation');
  }, [setPageHeader]);

  return (
    <div className='h-full'>
      <AIChatInterface
        conversationId={conversationId}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
