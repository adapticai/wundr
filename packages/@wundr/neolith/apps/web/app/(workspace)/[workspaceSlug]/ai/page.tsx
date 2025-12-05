'use client';

import { useParams } from 'next/navigation';
import { AIChatInterface } from '@/components/ai/ai-chat-interface';

export default function AIPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  return (
    <div className='h-full'>
      <AIChatInterface workspaceSlug={workspaceSlug} />
    </div>
  );
}
