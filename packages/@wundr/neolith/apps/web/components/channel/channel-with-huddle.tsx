/**
 * Channel With Huddle Example Component
 *
 * Example implementation showing how to integrate huddle features
 * into a channel view. This demonstrates the complete huddle workflow:
 * - Displaying huddle button in channel header
 * - Starting/joining/leaving huddles
 * - Showing huddle bar when active
 * - Picture-in-picture mode
 * - Full-screen huddle dialog
 *
 * @module components/channel/channel-with-huddle
 */

'use client';

import { useState, useCallback } from 'react';
import { ChannelHeader } from './channel-header';
import { HuddleButton } from './huddle-button';
import { HuddleBar } from './huddle-bar';
import { HuddlePip } from './huddle-pip';
import { HuddleDialog } from './huddle-dialog';
import { useChannelHuddle } from '@/hooks/use-channel-huddle';
import type { Channel, ChannelPermissions } from '@/types/channel';

interface ChannelWithHuddleProps {
  channel: Channel;
  permissions: ChannelPermissions;
  workspaceId: string;
}

/**
 * Example: Channel view with integrated huddle features
 *
 * This component shows how to:
 * 1. Add huddle button to channel header
 * 2. Manage huddle state with useChannelHuddle hook
 * 3. Show different views (bar, PIP, dialog) based on state
 */
export function ChannelWithHuddle({
  channel,
  permissions,
  workspaceId,
}: ChannelWithHuddleProps) {
  // Huddle state management
  const {
    huddle,
    isInHuddle,
    isLoading,
    joinData,
    startHuddle,
    joinHuddle,
    leaveHuddle,
  } = useChannelHuddle({
    channelId: channel.id,
    autoPoll: true,
  });

  // UI state
  const [huddleView, setHuddleView] = useState<'bar' | 'pip' | 'dialog'>('bar');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);

  // Handlers
  const handleStartHuddle = useCallback(
    async (audioOnly: boolean) => {
      try {
        await startHuddle(audioOnly);
        setIsVideoEnabled(!audioOnly);
        setHuddleView('dialog');
      } catch (error) {
        console.error('Failed to start huddle:', error);
      }
    },
    [startHuddle]
  );

  const handleJoinHuddle = useCallback(
    async (audioOnly: boolean) => {
      try {
        await joinHuddle(audioOnly);
        setIsVideoEnabled(!audioOnly);
        setHuddleView('dialog');
      } catch (error) {
        console.error('Failed to join huddle:', error);
      }
    },
    [joinHuddle]
  );

  const handleLeaveHuddle = useCallback(async () => {
    try {
      await leaveHuddle();
      setHuddleView('bar');
    } catch (error) {
      console.error('Failed to leave huddle:', error);
    }
  }, [leaveHuddle]);

  const handleToggleAudio = useCallback(() => {
    setIsAudioEnabled(prev => !prev);
  }, []);

  const handleToggleVideo = useCallback(() => {
    setIsVideoEnabled(prev => !prev);
  }, []);

  const handleMinimize = useCallback(() => {
    setHuddleView('pip');
  }, []);

  const handleExpand = useCallback(() => {
    setHuddleView('dialog');
  }, []);

  return (
    <div className='flex flex-col h-full'>
      {/* Channel Header */}
      <div className='flex items-center border-b'>
        <ChannelHeader
          channel={channel}
          permissions={permissions}
          workspaceId={workspaceId}
        />
        {/* Add huddle button to header */}
        <div className='mr-4'>
          <HuddleButton
            hasActiveHuddle={!!huddle && huddle.status === 'active'}
            participantCount={huddle?.participantCount ?? 0}
            isInHuddle={isInHuddle}
            onStartHuddle={handleStartHuddle}
            onJoinHuddle={handleJoinHuddle}
            onLeaveHuddle={handleLeaveHuddle}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Main channel content */}
      <div className='flex-1 overflow-auto'>
        {/* Your channel content here (messages, canvas, files, etc.) */}
      </div>

      {/* Huddle UI overlays */}
      {isInHuddle && joinData && (
        <>
          {/* Huddle Bar - shown at bottom */}
          {huddleView === 'bar' && (
            <HuddleBar
              huddleId={huddle?.id ?? ''}
              channelName={channel.name}
              participants={huddle?.participants ?? []}
              isAudioEnabled={isAudioEnabled}
              isVideoEnabled={isVideoEnabled}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onMinimize={handleMinimize}
              onLeave={handleLeaveHuddle}
              onExpand={handleExpand}
            />
          )}

          {/* Picture-in-Picture - floating window */}
          {huddleView === 'pip' && (
            <HuddlePip
              channelName={channel.name}
              participants={huddle?.participants ?? []}
              isAudioEnabled={isAudioEnabled}
              isVideoEnabled={isVideoEnabled}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onExpand={handleExpand}
              onLeave={handleLeaveHuddle}
            />
          )}

          {/* Full Dialog - modal view */}
          {huddleView === 'dialog' && (
            <HuddleDialog
              open={true}
              onOpenChange={open => {
                if (!open) {
                  setHuddleView('bar');
                }
              }}
              channelName={channel.name}
              token={joinData.token}
              serverUrl={joinData.serverUrl}
              roomName={joinData.roomName}
              onDisconnect={handleLeaveHuddle}
              onError={error => {
                console.error('Huddle error:', error);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default ChannelWithHuddle;
