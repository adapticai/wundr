# Huddle Feature Implementation

This document describes the complete implementation of the Huddle feature for channels in the
Neolith Next.js app.

## Overview

The Huddle feature provides Slack-like audio/video huddles for channels, allowing team members to
quickly start informal voice or video conversations directly from any channel.

## Components

### UI Components

#### 1. HuddleButton (`components/channel/huddle-button.tsx`)

Button component for the channel header that:

- Shows "Huddle" when no active huddle exists
- Shows "Join Huddle (N)" when there's an active huddle
- Shows "In Huddle (N)" when user is participating
- Provides dropdown options for video or audio-only modes

**Props:**

```typescript
interface HuddleButtonProps {
  hasActiveHuddle?: boolean;
  participantCount?: number;
  isInHuddle?: boolean;
  onStartHuddle?: (audioOnly: boolean) => void;
  onJoinHuddle?: (audioOnly: boolean) => void;
  onLeaveHuddle?: () => void;
  className?: string;
  isLoading?: boolean;
}
```

#### 2. HuddleBar (`components/channel/huddle-bar.tsx`)

Floating bar displayed at the bottom of the screen when in a huddle:

- Shows channel name
- Displays participant avatars (up to 5, with overflow count)
- Audio/video mute controls
- Minimize and leave buttons
- Click to expand to full view

**Props:**

```typescript
interface HuddleBarProps {
  huddleId: string;
  channelName: string;
  participants: CallParticipant[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  onMinimize?: () => void;
  onLeave?: () => void;
  onExpand?: () => void;
  className?: string;
}
```

#### 3. HuddlePip (`components/channel/huddle-pip.tsx`)

Picture-in-picture floating window:

- Draggable around the screen
- Shows participant video tiles (up to 6)
- Quick controls for audio/video
- Expand and leave buttons

**Props:**

```typescript
interface HuddlePipProps {
  channelName: string;
  participants: CallParticipant[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  onExpand?: () => void;
  onLeave?: () => void;
  className?: string;
}
```

#### 4. HuddleDialog (`components/channel/huddle-dialog.tsx`)

Full-screen modal dialog with video interface:

- Uses the `VideoRoom` component for call UI
- Full LiveKit integration
- Modal with close/minimize options

**Props:**

```typescript
interface HuddleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  token: string;
  serverUrl: string;
  roomName: string;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
```

## API Endpoints

### Channel-Specific Endpoints

All endpoints are scoped to a specific channel:

#### 1. Start Huddle

```
POST /api/channels/:channelId/huddle/start
```

Creates a new huddle in the channel. Only one active huddle per channel is allowed.

**Response:**

```json
{
  "data": {
    "id": "huddle_xyz",
    "workspaceId": "ws_123",
    "name": "#general Huddle",
    "description": "Huddle in #general",
    "isPublic": true,
    "roomName": "huddle-channel-xyz-abc123",
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z",
    "endedAt": null,
    "createdBy": {
      "id": "user_123",
      "name": "John Doe"
    },
    "participantCount": 1
  },
  "message": "Huddle started successfully"
}
```

#### 2. Join Huddle

```
POST /api/channels/:channelId/huddle/join
```

Join the active huddle in the channel and receive LiveKit token.

**Request Body:**

```json
{
  "displayName": "John Doe",
  "audioOnly": false
}
```

**Response:**

```json
{
  "data": {
    "token": "eyJhbGc...",
    "roomName": "huddle-channel-xyz-abc123",
    "serverUrl": "wss://livekit.example.com",
    "participant": {
      "identity": "user_123",
      "name": "John Doe"
    }
  },
  "message": "Joined huddle successfully"
}
```

#### 3. Leave Huddle

```
POST /api/channels/:channelId/huddle/leave
```

Leave the current huddle. If the last participant leaves, the huddle ends automatically.

**Response:**

```json
{
  "message": "Left huddle successfully"
}
```

#### 4. Get Huddle Status

```
GET /api/channels/:channelId/huddle/status
```

Get the current status of the channel's huddle.

**Response:**

```json
{
  "data": {
    "id": "huddle_xyz",
    "workspaceId": "ws_123",
    "name": "#general Huddle",
    "description": "Huddle in #general",
    "isPublic": true,
    "roomName": "huddle-channel-xyz-abc123",
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z",
    "endedAt": null,
    "createdBy": {
      "id": "user_123",
      "name": "John Doe"
    },
    "participantCount": 3
  }
}
```

Returns `null` if no active huddle.

## Custom Hook

### `useChannelHuddle`

React hook for managing huddle state in a channel.

**Usage:**

```typescript
const {
  huddle, // Current huddle data
  isInHuddle, // Whether user is in the huddle
  isLoading, // Loading state
  error, // Any error
  joinData, // LiveKit token and room info when joined
  startHuddle, // Start a new huddle
  joinHuddle, // Join existing huddle
  leaveHuddle, // Leave current huddle
  refreshStatus, // Manually refresh status
} = useChannelHuddle({
  channelId: 'ch_123',
  pollInterval: 30000, // Poll every 30s
  autoPoll: true, // Enable auto-polling
});
```

**Features:**

- Automatic polling for huddle status updates
- Manages LiveKit token state
- Handles all API calls
- Error handling
- Loading states

## Integration Example

See `components/channel/channel-with-huddle.tsx` for a complete example.

Basic integration:

```typescript
import { useChannelHuddle } from '@/hooks/use-channel-huddle';
import {
  HuddleButton,
  HuddleBar,
  HuddlePip,
  HuddleDialog,
} from '@/components/channel';

function ChannelPage({ channel }) {
  const {
    huddle,
    isInHuddle,
    joinData,
    startHuddle,
    joinHuddle,
    leaveHuddle,
  } = useChannelHuddle({ channelId: channel.id });

  const [view, setView] = useState('bar'); // 'bar' | 'pip' | 'dialog'

  return (
    <div>
      {/* Add to channel header */}
      <HuddleButton
        hasActiveHuddle={huddle?.status === 'active'}
        participantCount={huddle?.participantCount}
        isInHuddle={isInHuddle}
        onStartHuddle={startHuddle}
        onJoinHuddle={joinHuddle}
        onLeaveHuddle={leaveHuddle}
      />

      {/* Show appropriate view when in huddle */}
      {isInHuddle && joinData && (
        <>
          {view === 'bar' && <HuddleBar ... />}
          {view === 'pip' && <HuddlePip ... />}
          {view === 'dialog' && <HuddleDialog ... />}
        </>
      )}
    </div>
  );
}
```

## Data Storage

Huddles are stored in the channel's `settings` JSON field:

```typescript
interface ChannelSettings {
  activeHuddle?: {
    id: string;
    channelId: string;
    name: string;
    roomName: string;
    status: 'active' | 'ended';
    createdAt: string;
    endedAt: string | null;
    createdBy: {
      id: string;
      name: string | null;
    };
    participantCount: number;
  };
  // ... other settings
}
```

This approach:

- Allows one active huddle per channel
- Doesn't require database migrations
- Simple to implement and query
- Can be migrated to dedicated tables later if needed

## LiveKit Integration

The huddle feature uses LiveKit for real-time audio/video:

1. **Token Generation**: Server generates JWT tokens with room permissions
2. **Room Naming**: Unique room names per channel huddle
3. **Permissions**:
   - Audio-only mode: microphone only
   - Video mode: camera, microphone, screen share

**Environment Variables:**

```bash
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

## User Flows

### Starting a Huddle

1. User clicks "Huddle" button in channel header
2. Selects "Start with video" or "Start audio only"
3. API creates huddle record and returns huddle data
4. User automatically joins the huddle
5. LiveKit token is generated
6. Huddle dialog opens with video interface

### Joining a Huddle

1. User sees "Join Huddle (N)" button indicating active huddle
2. Clicks and selects video or audio-only
3. API generates LiveKit token for the room
4. Huddle dialog opens
5. User can minimize to PIP or bar

### Leaving a Huddle

1. User clicks "Leave" from any view (bar, PIP, dialog)
2. API call to leave endpoint
3. Huddle UI closes
4. If last participant, huddle automatically ends

## View States

The huddle UI has three view states:

1. **Bar** (default): Floating bar at bottom showing participants
2. **PIP**: Draggable floating window with video tiles
3. **Dialog**: Full-screen modal with complete video interface

Users can switch between views using minimize/expand buttons.

## Real-time Updates

The hook polls the status endpoint every 30 seconds (configurable) to:

- Update participant count
- Detect if huddle ended
- Sync huddle state across tabs

For production, consider using:

- WebSocket connections for real-time updates
- LiveKit webhooks for participant events
- Server-sent events (SSE) for status changes

## Permissions

Channel-based permissions apply:

- Must be a channel member to start/join huddles
- Archived channels cannot have huddles
- Private channels: huddles inherit privacy

## Future Enhancements

Possible improvements:

1. **Database Tables**: Migrate from JSON to dedicated tables
   - `huddles` table with full history
   - `huddle_participants` for tracking joins/leaves
   - Better querying and analytics

2. **WebSocket Updates**: Real-time participant updates

3. **Recording**: Add recording capabilities via LiveKit egress

4. **Invitations**: Send notifications to specific members

5. **Scheduled Huddles**: Schedule huddles for later

6. **Huddle History**: View past huddles and recordings

7. **Reactions**: Add emoji reactions during huddles

8. **Background Blur**: Video background effects

## Testing

Key scenarios to test:

- [ ] Start huddle in channel
- [ ] Join existing huddle
- [ ] Leave huddle
- [ ] Audio/video toggle
- [ ] Screen sharing
- [ ] Multiple participants
- [ ] Last participant leaves (auto-end)
- [ ] Minimize to PIP
- [ ] Expand from PIP
- [ ] Network disconnection/reconnection
- [ ] Permission checks
- [ ] Archived channel handling

## File Structure

```
apps/web/
├── components/channel/
│   ├── huddle-button.tsx       # Huddle button component
│   ├── huddle-bar.tsx          # Floating bar view
│   ├── huddle-pip.tsx          # Picture-in-picture view
│   ├── huddle-dialog.tsx       # Full-screen dialog
│   └── channel-with-huddle.tsx # Integration example
├── hooks/
│   └── use-channel-huddle.ts   # Huddle state management hook
└── app/api/channels/[channelId]/huddle/
    ├── start/route.ts          # Start huddle endpoint
    ├── join/route.ts           # Join huddle endpoint
    ├── leave/route.ts          # Leave huddle endpoint
    └── status/route.ts         # Get status endpoint
```

## Dependencies

Required packages:

- `@livekit/components-react` - LiveKit React components
- `livekit-client` - LiveKit client SDK
- `lucide-react` - Icons

Already included in the project.
