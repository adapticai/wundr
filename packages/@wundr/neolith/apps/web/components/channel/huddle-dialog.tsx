'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VideoRoom } from '@/components/call/video-room';

interface HuddleDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Channel name */
  channelName: string;
  /** LiveKit room token */
  token: string;
  /** LiveKit server URL */
  serverUrl: string;
  /** LiveKit room name */
  roomName: string;
  /** Callback when disconnected */
  onDisconnect?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * HuddleDialog Component
 *
 * Full-screen or large modal dialog showing the huddle video interface.
 * Uses the VideoRoom component for the actual call UI.
 */
export function HuddleDialog({
  open,
  onOpenChange,
  channelName,
  token,
  serverUrl,
  roomName,
  onDisconnect,
  onError,
}: HuddleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Huddle in #{channelName}</DialogTitle>
        </DialogHeader>
        <VideoRoom
          token={token}
          serverUrl={serverUrl}
          roomName={roomName}
          channelName={channelName}
          onDisconnect={onDisconnect}
          onError={onError}
          className="h-full rounded-lg overflow-hidden"
        />
      </DialogContent>
    </Dialog>
  );
}

export default HuddleDialog;
