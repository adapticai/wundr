'use client';

import { Phone, PhoneOff, Video } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { getInitials } from '@/lib/utils';

/**
 * Caller information
 */
interface Caller {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/**
 * Props for IncomingCallModal component
 */
interface IncomingCallModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Call ID */
  callId: string;
  /** Call type */
  callType: 'audio' | 'video';
  /** Caller information */
  caller: Caller;
  /** Channel name (for group calls) */
  channelName?: string;
  /** Number of participants in group call */
  participantCount?: number;
  /** Callback when call is accepted */
  onAccept: (callId: string) => void;
  /** Callback when call is declined */
  onDecline: (callId: string) => void;
  /** Callback when modal is dismissed without action */
  onDismiss?: () => void;
  /** Auto-decline timeout in seconds (default: 60) */
  timeoutSeconds?: number;
}

/**
 * IncomingCallModal Component
 *
 * Shows a modal when receiving an incoming call with accept/decline options.
 * Includes a ringing animation and auto-decline timeout.
 */
export function IncomingCallModal({
  open,
  callId,
  callType,
  caller,
  channelName,
  participantCount = 1,
  onAccept,
  onDecline,
  onDismiss,
  timeoutSeconds = 60,
}: IncomingCallModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(timeoutSeconds);
  const [isResponding, setIsResponding] = useState(false);

  const isGroupCall = participantCount > 1;
  const callTypeLabel = callType === 'video' ? 'video call' : 'voice call';

  // Handle auto-decline timeout
  useEffect(() => {
    if (!open) {
      setSecondsRemaining(timeoutSeconds);
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Auto-decline when timeout reaches 0
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, timeoutSeconds]);

  /**
   * Handle accepting the call
   */
  const handleAccept = async () => {
    setIsResponding(true);

    try {
      const response = await fetch(`/api/calls/${callId}/accept`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to accept call');
      }

      onAccept(callId);
    } catch (error) {
      console.error('[IncomingCallModal] Failed to accept call:', error);
      // Still call onAccept to allow client-side handling
      onAccept(callId);
    } finally {
      setIsResponding(false);
    }
  };

  /**
   * Handle declining the call
   */
  const handleDecline = async () => {
    setIsResponding(true);

    try {
      const response = await fetch(`/api/calls/${callId}/decline`, {
        method: 'POST',
      });

      if (!response.ok) {
        console.error('[IncomingCallModal] Failed to decline call');
      }
    } catch (error) {
      console.error('[IncomingCallModal] Error declining call:', error);
    } finally {
      setIsResponding(false);
      onDecline(callId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onDismiss?.()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center justify-center py-6 space-y-6">
          {/* Caller Avatar with Ringing Animation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
            <Avatar className="h-24 w-24 border-4 border-background relative">
              <AvatarImage src={caller.avatarUrl || undefined} alt={caller.name} />
              <AvatarFallback className="text-2xl">
                {getInitials(caller.name)}
              </AvatarFallback>
            </Avatar>
            {callType === 'video' && (
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-2">
                <Video className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Call Information */}
          <div className="text-center space-y-1">
            <DialogTitle className="text-xl font-semibold">
              {caller.name}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {isGroupCall
                ? `Incoming ${callTypeLabel} in ${channelName || 'group'}`
                : `Incoming ${callTypeLabel}`}
            </DialogDescription>
            {isGroupCall && (
              <p className="text-xs text-muted-foreground">
                {participantCount} {participantCount === 1 ? 'person' : 'people'}
              </p>
            )}
          </div>

          {/* Timeout Indicator */}
          <div className="text-xs text-muted-foreground">
            Auto-declining in {secondsRemaining}s
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-4">
            <Button
              size="lg"
              variant="destructive"
              onClick={handleDecline}
              disabled={isResponding}
              className="rounded-full h-14 w-14 p-0"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>

            <Button
              size="lg"
              onClick={handleAccept}
              disabled={isResponding}
              className="rounded-full h-14 w-14 p-0 bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Decline</span>
            <span className="mx-8" />
            <span>Accept</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
