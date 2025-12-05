'use client';

import { clsx } from 'clsx';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { VideoRoom, PreJoin, CallInviteDialog } from '@/components/call';
import { useAuth } from '@/hooks/use-auth';

interface CallDetails {
  id: string;
  roomName: string;
  channelName?: string;
  token: string;
  serverUrl: string;
}

type CallState =
  | 'loading'
  | 'pre-join'
  | 'connecting'
  | 'in-call'
  | 'ended'
  | 'error';

/**
 * Error display component
 */
function CallError({
  error,
  onRetry,
  onLeave,
}: {
  error: string;
  onRetry: () => void;
  onLeave: () => void;
}) {
  return (
    <div className='min-h-screen flex items-center justify-center bg-background p-4'>
      <div className='text-center space-y-4 max-w-md'>
        <div className='w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-8 h-8 text-destructive'
          >
            <circle cx='12' cy='12' r='10' />
            <line x1='12' x2='12' y1='8' y2='12' />
            <line x1='12' x2='12.01' y1='16' y2='16' />
          </svg>
        </div>
        <h1 className='text-xl font-bold text-foreground'>
          Unable to join call
        </h1>
        <p className='text-muted-foreground'>{error}</p>
        <div className='flex justify-center gap-3'>
          <button
            onClick={onLeave}
            className={clsx(
              'px-4 py-2 rounded-lg',
              'bg-muted hover:bg-muted/80',
              'text-foreground font-medium',
              'transition-colors'
            )}
          >
            Leave
          </button>
          <button
            onClick={onRetry}
            className={clsx(
              'px-4 py-2 rounded-lg',
              'bg-primary hover:bg-primary/90',
              'text-primary-foreground font-medium',
              'transition-colors'
            )}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state component
 */
function CallLoading() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <div className='text-center space-y-4'>
        <div className='w-12 h-12 mx-auto border-4 border-muted border-t-primary rounded-full animate-spin' />
        <p className='text-muted-foreground'>Loading call...</p>
      </div>
    </div>
  );
}

/**
 * Call ended screen
 */
function CallEnded({
  onRejoin,
  onLeave,
}: {
  onRejoin: () => void;
  onLeave: () => void;
}) {
  return (
    <div className='min-h-screen flex items-center justify-center bg-background p-4'>
      <div className='text-center space-y-4 max-w-md'>
        <div className='w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-8 h-8 text-primary'
          >
            <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' />
          </svg>
        </div>
        <h1 className='text-xl font-bold text-foreground'>Call ended</h1>
        <p className='text-muted-foreground'>You have left the call.</p>
        <div className='flex justify-center gap-3'>
          <button
            onClick={onLeave}
            className={clsx(
              'px-4 py-2 rounded-lg',
              'bg-muted hover:bg-muted/80',
              'text-foreground font-medium',
              'transition-colors'
            )}
          >
            Back to workspace
          </button>
          <button
            onClick={onRejoin}
            className={clsx(
              'px-4 py-2 rounded-lg',
              'bg-primary hover:bg-primary/90',
              'text-primary-foreground font-medium',
              'transition-colors'
            )}
          >
            Rejoin call
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main call page component
 */
export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [callState, setCallState] = useState<CallState>('loading');
  const [callDetails, setCallDetails] = useState<CallDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [preJoinSettings, setPreJoinSettings] = useState<{
    videoEnabled: boolean;
    audioEnabled: boolean;
    userName: string;
  } | null>(null);

  const workspaceId = params?.workspaceSlug as string;
  const callId = params?.callId as string;

  // Fetch call details and token
  const fetchCallDetails = useCallback(async () => {
    setCallState('loading');
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/calls/${callId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Call not found');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to join this call');
        }
        throw new Error('Failed to load call details');
      }

      const data = await response.json();
      setCallDetails({
        id: data.id,
        roomName: data.roomName,
        channelName: data.channelName,
        token: data.token,
        serverUrl: data.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
      });
      setCallState('pre-join');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load call');
      setCallState('error');
    }
  }, [workspaceId, callId]);

  // Initial load
  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchCallDetails();
    } else if (!isAuthLoading && !user) {
      // Redirect to login
      router.push(`/login?redirect=/workspace/${workspaceId}/call/${callId}`);
    }
  }, [isAuthLoading, user, fetchCallDetails, router, workspaceId, callId]);

  // Handle pre-join completion
  const handleJoin = useCallback(
    (settings: {
      videoEnabled: boolean;
      audioEnabled: boolean;
      userName: string;
    }) => {
      setPreJoinSettings(settings);
      setCallState('in-call');
    },
    []
  );

  // Handle cancel from pre-join
  const handleCancel = useCallback(() => {
    router.push(`/${workspaceId}`);
  }, [router, workspaceId]);

  // Handle disconnect from call
  const handleDisconnect = useCallback(() => {
    setCallState('ended');
  }, []);

  // Handle call error
  const handleError = useCallback((err: Error) => {
    setError(err.message);
    setCallState('error');
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    fetchCallDetails();
  }, [fetchCallDetails]);

  // Handle rejoin
  const handleRejoin = useCallback(() => {
    setCallState('pre-join');
  }, []);

  // Handle leave (navigate away)
  const handleLeave = useCallback(() => {
    router.push(`/${workspaceId}`);
  }, [router, workspaceId]);

  // Handle invite
  const handleInvite = useCallback(
    async (userIds: string[], sendNotification: boolean) => {
      try {
        await fetch(`/api/workspaces/${workspaceId}/calls/${callId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, sendNotification }),
        });
      } catch {
        // Handle silently or show toast
      }
    },
    [workspaceId, callId]
  );

  // Generate invite link
  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${workspaceId}/call/${callId}`
      : '';

  // Render based on state
  if (isAuthLoading || callState === 'loading') {
    return <CallLoading />;
  }

  if (callState === 'error' && error) {
    return (
      <CallError error={error} onRetry={handleRetry} onLeave={handleLeave} />
    );
  }

  if (callState === 'ended') {
    return <CallEnded onRejoin={handleRejoin} onLeave={handleLeave} />;
  }

  if (callState === 'pre-join' && callDetails) {
    return (
      <PreJoin
        roomName={callDetails.channelName || callDetails.roomName}
        userName={user?.name || ''}
        onJoin={handleJoin}
        onCancel={handleCancel}
        requireName={!user?.name}
      />
    );
  }

  if (callState === 'in-call' && callDetails && preJoinSettings) {
    return (
      <>
        <VideoRoom
          token={callDetails.token}
          serverUrl={callDetails.serverUrl}
          roomName={callDetails.roomName}
          channelName={callDetails.channelName}
          onDisconnect={handleDisconnect}
          onError={handleError}
          className='h-screen'
        />
        <CallInviteDialog
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          onInvite={handleInvite}
          inviteLink={inviteLink}
          workspaceId={workspaceId}
          callId={callId}
        />
      </>
    );
  }

  return <CallLoading />;
}
