'use client';

import { PhoneOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';

/**
 * Participant being called
 */
interface RingingParticipant {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/**
 * Props for CallRinging component
 */
interface CallRingingProps {
  /** Call ID */
  callId: string;
  /** Type of call */
  callType: 'audio' | 'video';
  /** List of participants being called */
  participants: RingingParticipant[];
  /** Callback when call is cancelled */
  onCancel: () => void;
  /** Optional custom className */
  className?: string;
}

/**
 * CallRinging Component
 *
 * Displays a "calling..." state while waiting for participants to join.
 * Shows participant avatars and provides a cancel button.
 */
export function CallRinging({
  callType,
  participants,
  onCancel,
  className,
}: CallRingingProps) {
  const [dots, setDots] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  const isGroupCall = participants.length > 1;
  const callTypeLabel = callType === 'video' ? 'video call' : 'voice call';

  // Animate the "calling..." dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Track call duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-cancel after 60 seconds with no answer
  useEffect(() => {
    const timeout = setTimeout(() => {
      onCancel();
    }, 60000);

    return () => clearTimeout(timeout);
  }, [onCancel]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-background ${className}`}>
      {/* Participant Avatars */}
      <div className="mb-8">
        {isGroupCall ? (
          <div className="flex -space-x-4">
            {participants.slice(0, 3).map((participant) => (
              <div key={participant.id} className="relative">
                <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
                <Avatar className="h-20 w-20 border-4 border-background relative">
                  <AvatarImage src={participant.avatarUrl || undefined} alt={participant.name} />
                  <AvatarFallback className="text-lg">
                    {getInitials(participant.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            ))}
            {participants.length > 3 && (
              <div className="flex items-center justify-center h-20 w-20 rounded-full bg-muted border-4 border-background text-lg font-semibold relative">
                +{participants.length - 3}
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
            <Avatar className="h-32 w-32 border-4 border-background relative">
              <AvatarImage src={participants[0]?.avatarUrl || undefined} alt={participants[0]?.name || 'Unknown'} />
              <AvatarFallback className="text-3xl">
                {getInitials(participants[0]?.name || 'U')}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Call Status */}
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl font-semibold">
          {isGroupCall ? (
            <>Calling {participants.length} {participants.length === 1 ? 'person' : 'people'}</>
          ) : (
            <>Calling {participants[0]?.name}</>
          )}
        </h2>
        <p className="text-lg text-muted-foreground">
          {callTypeLabel}{dots}
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
        </p>
      </div>

      {/* Participant Names */}
      {isGroupCall && (
        <div className="mb-8 text-center max-w-md">
          <p className="text-sm text-muted-foreground">
            {participants.map((p) => p.name).join(', ')}
          </p>
        </div>
      )}

      {/* Cancel Button */}
      <Button
        size="lg"
        variant="destructive"
        onClick={onCancel}
        className="rounded-full h-16 w-16 p-0"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
      <p className="text-sm text-muted-foreground mt-4">Cancel</p>

      {/* Auto-cancel warning */}
      {callDuration > 45 && (
        <p className="text-xs text-muted-foreground mt-8 animate-pulse">
          Auto-cancelling in {60 - callDuration}s
        </p>
      )}
    </div>
  );
}
