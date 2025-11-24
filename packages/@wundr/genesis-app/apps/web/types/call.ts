/**
 * Call Types for Genesis App
 * Types for video calls and huddles using LiveKit
 */

import type { User } from './chat';

export type CallStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type CallType = 'video' | 'audio' | 'huddle';

export type ParticipantConnectionQuality = 'excellent' | 'good' | 'poor' | 'lost';

export interface CallParticipant {
  id: string;
  identity: string;
  name: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isPinned: boolean;
  connectionQuality: ParticipantConnectionQuality;
  isLocal: boolean;
}

export interface Call {
  id: string;
  roomName: string;
  type: CallType;
  channelId?: string;
  workspaceId: string;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  participants: CallParticipant[];
  createdBy: User;
  isRecording: boolean;
  maxParticipants?: number;
}

export interface Huddle {
  id: string;
  name: string;
  workspaceId: string;
  channelId?: string;
  participants: HuddleParticipant[];
  createdAt: Date;
  isActive: boolean;
}

export interface HuddleParticipant {
  id: string;
  user: User;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: Date;
}

export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export interface CallSettings {
  videoEnabled: boolean;
  audioEnabled: boolean;
  selectedVideoDevice?: string;
  selectedAudioDevice?: string;
  selectedAudioOutput?: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export interface CallInvite {
  callId: string;
  roomName: string;
  invitedBy: User;
  invitedAt: Date;
  expiresAt: Date;
  link: string;
}
