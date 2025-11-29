'use client';

import { Phone, Video, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

/**
 * Props for DMCallButton component
 */
interface DMCallButtonProps {
  /** Channel ID for the DM */
  channelId: string;
  /** Workspace ID */
  workspaceId: string;
  /** List of participant user IDs (excluding current user) */
  participantIds: string[];
  /** Callback when call is initiated successfully */
  onCallInitiated?: (callId: string, type: 'audio' | 'video') => void;
  /** Optional custom className */
  className?: string;
  /** Show as icon only (no text) */
  iconOnly?: boolean;
}

/**
 * DMCallButton Component
 *
 * Provides a dropdown button to initiate audio or video calls in DMs.
 * Shows different UI for 1:1 vs group DMs.
 */
export function DMCallButton({
  channelId,
  participantIds,
  onCallInitiated,
  className,
  iconOnly = false,
}: DMCallButtonProps) {
  const [isInitiating, setIsInitiating] = useState(false);
  const { toast } = useToast();

  const isGroupDM = participantIds.length > 1;

  /**
   * Initiates a call (audio or video)
   */
  const initiateCall = async (type: 'audio' | 'video') => {
    setIsInitiating(true);

    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
          type,
          invitees: participantIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to initiate call');
      }

      const data = await response.json();

      toast({
        title: `${type === 'video' ? 'Video' : 'Audio'} call started`,
        description: isGroupDM
          ? `Calling ${participantIds.length} ${participantIds.length === 1 ? 'person' : 'people'}...`
          : 'Ringing...',
      });

      onCallInitiated?.(data.data.id, type);
    } catch (error) {
      console.error('[DMCallButton] Failed to initiate call:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to start call',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsInitiating(false);
    }
  };

  if (iconOnly) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={className}
            disabled={isInitiating}
          >
            {isInitiating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => initiateCall('audio')}
            disabled={isInitiating}
          >
            <Phone className="mr-2 h-4 w-4" />
            Start audio call
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => initiateCall('video')}
            disabled={isInitiating}
          >
            <Video className="mr-2 h-4 w-4" />
            Start video call
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isInitiating}
          >
            {isInitiating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting call...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => initiateCall('audio')}
            disabled={isInitiating}
          >
            <Phone className="mr-2 h-4 w-4" />
            Audio call
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => initiateCall('video')}
            disabled={isInitiating}
          >
            <Video className="mr-2 h-4 w-4" />
            Video call
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
