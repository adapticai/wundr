'use client';

import { useParams } from 'next/navigation';
import { AIChatInterface } from '@/components/ai/ai-chat-interface';

export default function ConversationPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const conversationId = params.conversationId as string;

  return (
    <div className='h-full'>
      <AIChatInterface
        conversationId={conversationId}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
