'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AIChatInterface } from '@/components/ai/ai-chat-interface';
import { usePageHeader } from '@/contexts/page-header-context';

export default function AIPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader('AI Assistant', 'Chat with your workspace AI');
  }, [setPageHeader]);

  return (
    <div className='h-full'>
      <AIChatInterface workspaceSlug={workspaceSlug} />
    </div>
  );
}
