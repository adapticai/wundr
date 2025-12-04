'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCallDuration } from '@/hooks/use-call';
import { useToast } from '@/hooks/use-toast';

import { VideoRoom } from './video-room';

/**
 * Call information
 */
interface CallInfo {
  id: string;
  channelId: string;
  type: 'audio' | 'video';
  roomName: string;
  createdBy: {
    id: string;
    name: string | null;
  };
}

/**
 * Props for DMCallView component
 */
interface DMCallViewProps {
  /** Call information */
  call: CallInfo;
  /** Workspace ID */
  workspaceId: string;
  /** Current user ID */
  userId: string;
  /** Current user display name */
  userName: string;
  /** Whether to start with video enabled */
  startWithVideo?: boolean;
  /** Callback when call ends */
  onCallEnd?: () => void;
}

/**
 * DMCallView Component
 *
 * Full-screen interface for an active DM call.
 * Handles joining, media management, and participant display.
 */
export function DMCallView({
  call,
  userName,
  startWithVideo = false,
  onCallEnd,
}: DMCallViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isJoining, setIsJoining] = useState(true);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const { formattedDuration } = useCallDuration(startTime);

  /**
   * Join the call by getting a token
   */
  useEffect(() => {
    const joinCall = async () => {
      try {
        const response = await fetch(`/api/calls/${call.id}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: userName,
            audioOnly: !startWithVideo,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to join call');
        }

        const data = await response.json();
        setToken(data.data.token);
        setServerUrl(data.data.serverUrl);
        setStartTime(new Date());
        setIsJoining(false);
      } catch (error) {
        console.error('[DMCallView] Failed to join call:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to join call',
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        });
        setIsJoining(false);
        onCallEnd?.();
      }
    };

    joinCall();
  }, [call.id, userName, startWithVideo, toast, onCallEnd]);

  /**
   * End the call
   */
  const handleEndCall = async () => {
    try {
      // Mark call as ended
      await fetch(`/api/calls/${call.id}/end`, {
        method: 'POST',
      });

      toast({
        title: 'Call ended',
        description: `Duration: ${formattedDuration}`,
      });

      onCallEnd?.();
      router.back();
    } catch (error) {
      console.error('[DMCallView] Failed to end call:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to end call',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      });
    }
  };

  // Show loading state while joining
  if (isJoining || !token) {
    return (
      <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-background'>
        <Loader2 className='h-12 w-12 animate-spin text-primary mb-4' />
        <p className='text-lg font-medium'>Joining call...</p>
        <p className='text-sm text-muted-foreground mt-2'>
          Connecting to {call.type === 'video' ? 'video' : 'audio'} call
        </p>
      </div>
    );
  }

  // Render VideoRoom for both audio and video calls
  return (
    <div className='fixed inset-0 z-50 bg-background'>
      <VideoRoom
        token={token}
        serverUrl={serverUrl}
        roomName={call.roomName}
        onDisconnect={handleEndCall}
        initialLayout={call.type === 'video' ? 'grid' : 'sidebar'}
      />
    </div>
  );
}
