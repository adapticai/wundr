/**
 * Huddles Store - State management for huddles (video/audio conferences)
 */

export type Participant = {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  isHandRaised: boolean;
};

export type HuddleState = {
  id: string | null;
  isActive: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  participants: Participant[];
  activeStream: MediaStream | null;
  screenStream: MediaStream | null;
};

export type HuddleActions = {
  startHuddle: (huddleId: string) => void;
  endHuddle: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (
    participantId: string,
    updates: Partial<Participant>
  ) => void;
  setActiveStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;
};

export type HuddleStore = HuddleState & HuddleActions;

// Simple store implementation (Zustand-like pattern)
type Listener = () => void;

class Store {
  private state: HuddleState = {
    id: null,
    isActive: false,
    isMuted: false,
    isVideoEnabled: false,
    isScreenSharing: false,
    participants: [],
    activeStream: null,
    screenStream: null,
  };

  private listeners: Set<Listener> = new Set();

  getState(): HuddleState {
    return this.state;
  }

  setState(partial: Partial<HuddleState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Actions
  actions: HuddleActions = {
    startHuddle: (huddleId: string) => {
      console.log('[HuddleStore] Starting huddle:', huddleId);
      this.setState({ id: huddleId, isActive: true });
      // TODO: Initialize media devices and connections
    },

    endHuddle: () => {
      console.log('[HuddleStore] Ending huddle');
      // TODO: Clean up media streams and connections
      this.setState({
        id: null,
        isActive: false,
        isMuted: false,
        isVideoEnabled: false,
        isScreenSharing: false,
        participants: [],
        activeStream: null,
        screenStream: null,
      });
    },

    toggleMute: () => {
      const newMutedState = !this.state.isMuted;
      console.log('[HuddleStore] Toggle mute:', newMutedState);
      this.setState({ isMuted: newMutedState });
      // TODO: Update audio track enabled state
      // this.state.activeStream?.getAudioTracks().forEach(track => {
      //   track.enabled = !newMutedState;
      // });
    },

    toggleVideo: () => {
      const newVideoState = !this.state.isVideoEnabled;
      console.log('[HuddleStore] Toggle video:', newVideoState);
      this.setState({ isVideoEnabled: newVideoState });
      // TODO: Update video track enabled state
      // this.state.activeStream?.getVideoTracks().forEach(track => {
      //   track.enabled = newVideoState;
      // });
    },

    toggleScreenShare: () => {
      const newScreenShareState = !this.state.isScreenSharing;
      console.log('[HuddleStore] Toggle screen share:', newScreenShareState);
      this.setState({ isScreenSharing: newScreenShareState });
      // TODO: Start/stop screen sharing
      // if (newScreenShareState) {
      //   navigator.mediaDevices.getDisplayMedia()
      //     .then(stream => this.actions.setScreenStream(stream));
      // } else {
      //   this.state.screenStream?.getTracks().forEach(track => track.stop());
      //   this.actions.setScreenStream(null);
      // }
    },

    addParticipant: (participant: Participant) => {
      console.log('[HuddleStore] Adding participant:', participant.id);
      this.setState({
        participants: [...this.state.participants, participant],
      });
    },

    removeParticipant: (participantId: string) => {
      console.log('[HuddleStore] Removing participant:', participantId);
      this.setState({
        participants: this.state.participants.filter(
          p => p.id !== participantId,
        ),
      });
    },

    updateParticipant: (
      participantId: string,
      updates: Partial<Participant>,
    ) => {
      console.log(
        '[HuddleStore] Updating participant:',
        participantId,
        updates,
      );
      this.setState({
        participants: this.state.participants.map(p =>
          p.id === participantId ? { ...p, ...updates } : p,
        ),
      });
    },

    setActiveStream: (stream: MediaStream | null) => {
      console.log('[HuddleStore] Setting active stream:', stream?.id);
      this.setState({ activeStream: stream });
    },

    setScreenStream: (stream: MediaStream | null) => {
      console.log('[HuddleStore] Setting screen stream:', stream?.id);
      this.setState({ screenStream: stream });
    },
  };
}

// Singleton store instance
const store = new Store();

/**
 * Hook-like function to use the huddle store
 */
export function useHuddleStore(): HuddleStore;
export function useHuddleStore<T>(selector: (state: HuddleState) => T): T;
export function useHuddleStore<T>(
  selector?: (state: HuddleState) => T,
): HuddleStore | T {
  if (selector) {
    return selector(store.getState());
  }
  return { ...store.getState(), ...store.actions };
}

/**
 * Subscribe to store changes
 */
export function subscribeToHuddleStore(listener: Listener): () => void {
  return store.subscribe(listener);
}

/**
 * Get current huddle state
 */
export function getHuddleState(): HuddleState {
  return store.getState();
}

/**
 * Get huddle actions
 */
export function getHuddleActions(): HuddleActions {
  return store.actions;
}

// ============================================================================
// HUDDLE MANAGEMENT FUNCTIONS
// ============================================================================

// In-memory huddles store for server-side management
const huddlesStore = new Map<
  string,
  {
    id: string;
    workspaceId: string;
    channelId: string;
    participants: Participant[];
    startedAt: Date;
    endedAt?: Date;
    status: 'active' | 'ended';
  }
>();

// Subscribers store for real-time updates
const subscribersStore = new Map<string, Set<string>>();

/**
 * Create a new huddle
 */
export function createHuddle(
  workspaceId: string,
  channelId: string,
  initiator: Participant,
): { id: string; participants: Participant[] } {
  const huddleId = `huddle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const huddle = {
    id: huddleId,
    workspaceId,
    channelId,
    participants: [initiator],
    startedAt: new Date(),
    status: 'active' as const,
  };
  huddlesStore.set(huddleId, huddle);
  console.log('[HuddleStore] Created huddle:', huddleId);
  return { id: huddleId, participants: [initiator] };
}

/**
 * Get huddle by ID
 */
export function getHuddle(huddleId: string) {
  return huddlesStore.get(huddleId);
}

/**
 * Get all huddles for a workspace
 */
export function getWorkspaceHuddles(workspaceId: string) {
  return Array.from(huddlesStore.values()).filter(
    h => h.workspaceId === workspaceId,
  );
}

/**
 * End a huddle
 */
export function endHuddle(huddleId: string): boolean {
  const huddle = huddlesStore.get(huddleId);
  if (!huddle) {
    return false;
  }
  huddle.status = 'ended';
  huddle.endedAt = new Date();
  huddlesStore.set(huddleId, huddle);
  console.log('[HuddleStore] Ended huddle:', huddleId);
  return true;
}

/**
 * Join a huddle
 */
export function joinHuddle(
  huddleId: string,
  participant: Participant,
): boolean {
  const huddle = huddlesStore.get(huddleId);
  if (!huddle || huddle.status !== 'active') {
    return false;
  }
  if (!huddle.participants.some(p => p.id === participant.id)) {
    huddle.participants.push(participant);
    huddlesStore.set(huddleId, huddle);
    console.log(
      '[HuddleStore] Participant joined huddle:',
      huddleId,
      participant.id,
    );
  }
  return true;
}

/**
 * Leave a huddle
 */
export function leaveHuddle(huddleId: string, participantId: string): boolean {
  const huddle = huddlesStore.get(huddleId);
  if (!huddle) {
    return false;
  }
  huddle.participants = huddle.participants.filter(p => p.id !== participantId);
  huddlesStore.set(huddleId, huddle);
  console.log(
    '[HuddleStore] Participant left huddle:',
    huddleId,
    participantId,
  );
  // End huddle if no participants left
  if (huddle.participants.length === 0) {
    endHuddle(huddleId);
  }
  return true;
}

/**
 * Toggle mute for a participant in a huddle
 */
export function toggleMute(huddleId: string, participantId: string): boolean {
  const huddle = huddlesStore.get(huddleId);
  if (!huddle) {
    return false;
  }
  const participant = huddle.participants.find(p => p.id === participantId);
  if (!participant) {
    return false;
  }
  participant.isMuted = !participant.isMuted;
  huddlesStore.set(huddleId, huddle);
  console.log(
    '[HuddleStore] Toggle mute:',
    huddleId,
    participantId,
    participant.isMuted,
  );
  return true;
}

/**
 * Update speaking status for a participant
 */
export function updateSpeaking(
  huddleId: string,
  participantId: string,
  isSpeaking: boolean,
): boolean {
  const huddle = huddlesStore.get(huddleId);
  if (!huddle) {
    return false;
  }
  const participant = huddle.participants.find(p => p.id === participantId);
  if (!participant) {
    return false;
  }
  participant.isSpeaking = isSpeaking;
  huddlesStore.set(huddleId, huddle);
  return true;
}

/**
 * Add a subscriber to a huddle for real-time updates
 */
export function addSubscriber(huddleId: string, subscriberId: string): void {
  if (!subscribersStore.has(huddleId)) {
    subscribersStore.set(huddleId, new Set());
  }
  subscribersStore.get(huddleId)!.add(subscriberId);
  console.log('[HuddleStore] Added subscriber:', huddleId, subscriberId);
}

/**
 * Remove a subscriber from a huddle
 */
export function removeSubscriber(huddleId: string, subscriberId: string): void {
  const subscribers = subscribersStore.get(huddleId);
  if (subscribers) {
    subscribers.delete(subscriberId);
    console.log('[HuddleStore] Removed subscriber:', huddleId, subscriberId);
  }
}
