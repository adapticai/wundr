# LiveKit Video/Audio Call Setup Documentation

This document provides comprehensive setup instructions for the LiveKit video/audio calling
integration in the Neolith application.

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Architecture](#architecture)
4. [API Routes](#api-routes)
5. [React Components](#react-components)
6. [Usage Examples](#usage-examples)
7. [Troubleshooting](#troubleshooting)

## Overview

LiveKit is integrated into Neolith to provide real-time video and audio calling capabilities. The
integration includes:

- **Backend Service**: Server-side LiveKit SDK integration
  (`@neolith/core/services/livekit-service`)
- **API Routes**: REST endpoints for room and token management
- **React Components**: Pre-built UI components for video and audio rooms
- **WebSocket Integration**: LiveKit webhook handling for real-time events

## Environment Variables

### Required Variables

The following environment variables must be set in your `.env.local` file for LiveKit to function:

```bash
# LiveKit Server Configuration (Server-side)
# Used by the backend service to communicate with LiveKit server
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# LiveKit Public URL (Client-side)
# Used by the frontend to connect to LiveKit server
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
```

### Variable Details

| Variable                  | Type   | Description                                    | Example                      |
| ------------------------- | ------ | ---------------------------------------------- | ---------------------------- |
| `LIVEKIT_URL`             | Server | WebSocket URL for LiveKit server (server-side) | `wss://my-app.livekit.cloud` |
| `LIVEKIT_API_KEY`         | Server | API key for authenticating with LiveKit        | `APIxxxxxxxxxxxx`            |
| `LIVEKIT_API_SECRET`      | Server | Secret key for signing JWT tokens              | `xxxxxxxxxxxxxxxx`           |
| `NEXT_PUBLIC_LIVEKIT_URL` | Client | WebSocket URL for LiveKit server (client-side) | `wss://my-app.livekit.cloud` |

### Optional Configuration

Additional environment variables for customizing LiveKit behavior:

```bash
# Token expiration in seconds (default: 3600 = 1 hour)
LIVEKIT_DEFAULT_TOKEN_TTL=3600

# Room empty timeout in seconds (default: 300 = 5 minutes)
LIVEKIT_DEFAULT_EMPTY_TIMEOUT=300

# Maximum participants per room (default: 100)
LIVEKIT_DEFAULT_MAX_PARTICIPANTS=100
```

## Architecture

### Backend Service Layer

The LiveKit service is implemented in `@neolith/core` package:

```
packages/@neolith/core/
├── src/
│   ├── services/
│   │   └── livekit-service.ts    # Main service implementation
│   └── types/
│       └── livekit.ts             # TypeScript types
```

**Key Features:**

- Room management (create, delete, list, update)
- Token generation (host, guest, viewer roles)
- Participant management (list, remove, mute)
- Recording/egress support
- Comprehensive error handling

### API Routes

API routes are located in `apps/web/app/api/livekit/`:

```
apps/web/app/api/livekit/
├── room/
│   ├── route.ts                   # POST: Create room, GET: List rooms
│   └── [roomId]/
│       └── route.ts               # GET: Get room, DELETE: Delete room
├── token/
│   └── route.ts                   # GET: Generate access token
└── webhook/
    └── route.ts                   # POST: Handle LiveKit webhooks
```

### React Components

UI components are in `apps/web/components/call/`:

```
apps/web/components/call/
├── livekit-provider.tsx           # Context provider for LiveKit
├── video-room.tsx                 # Full video room component
├── audio-room.tsx                 # Audio-only room component
├── call-controls.tsx              # Media control buttons
├── call-header.tsx                # Room header with info
└── participant-tile.tsx           # Individual participant view
```

## API Routes

### 1. Create Room

Creates a new LiveKit room.

**Endpoint:** `POST /api/livekit/room`

**Request Body:**

```json
{
  "name": "meeting-123",
  "maxParticipants": 10,
  "emptyTimeout": 300,
  "metadata": "{\"channelId\": \"abc123\"}"
}
```

**Response:**

```json
{
  "data": {
    "name": "meeting-123",
    "sid": "RM_xxxxx",
    "maxParticipants": 10,
    "emptyTimeout": 300,
    "creationTime": "2024-01-01T00:00:00.000Z",
    "numParticipants": 0,
    "metadata": "{\"channelId\": \"abc123\"}"
  },
  "message": "Room created successfully"
}
```

### 2. List Rooms

Lists all active LiveKit rooms.

**Endpoint:** `GET /api/livekit/room`

**Response:**

```json
{
  "data": [
    {
      "name": "meeting-123",
      "sid": "RM_xxxxx",
      "maxParticipants": 10,
      "numParticipants": 3,
      "activeRecording": false
    }
  ]
}
```

### 3. Get Room

Gets details of a specific room.

**Endpoint:** `GET /api/livekit/room/:roomId`

**Response:**

```json
{
  "data": {
    "name": "meeting-123",
    "sid": "RM_xxxxx",
    "numParticipants": 3,
    "participants": [...]
  }
}
```

### 4. Delete Room

Deletes/ends a room.

**Endpoint:** `DELETE /api/livekit/room/:roomId`

**Response:**

```json
{
  "message": "Room deleted successfully"
}
```

### 5. Generate Token

Generates an access token for a participant.

**Endpoint:** `GET /api/livekit/token`

**Query Parameters:**

- `roomName` (required): Name of room to join
- `identity` (optional): Participant identity (defaults to user ID)
- `name` (optional): Display name (defaults to user's name)
- `role` (optional): Participant role - `host`, `guest`, or `viewer` (default: `guest`)
- `metadata` (optional): Custom metadata as JSON string

**Response:**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "serverUrl": "wss://my-app.livekit.cloud",
    "expiresAt": "2024-01-01T01:00:00.000Z",
    "participant": {
      "identity": "user-123",
      "name": "John Doe",
      "roomName": "meeting-123"
    }
  }
}
```

### Token Roles

| Role     | Permissions                                                 |
| -------- | ----------------------------------------------------------- |
| `host`   | Full permissions: publish, subscribe, room admin, recording |
| `guest`  | Standard permissions: publish, subscribe, publish data      |
| `viewer` | Read-only: subscribe only, no publishing                    |

## React Components

### LiveKitProvider

Provides LiveKit configuration to all child components.

```tsx
import { LiveKitProvider } from '@/components/call/livekit-provider';

function App() {
  return (
    <LiveKitProvider serverUrl='wss://my-app.livekit.cloud'>
      <YourApp />
    </LiveKitProvider>
  );
}
```

### VideoRoom

Full-featured video room with multiple layouts.

```tsx
import { VideoRoom } from '@/components/call/video-room';

function MyCall() {
  const handleDisconnect = () => {
    console.log('Disconnected from call');
  };

  return (
    <VideoRoom
      token='eyJhbGciOiJIUzI1NiIs...'
      serverUrl='wss://my-app.livekit.cloud'
      roomName='meeting-123'
      channelName='General'
      onDisconnect={handleDisconnect}
      initialLayout='grid'
    />
  );
}
```

**Features:**

- Grid, spotlight, and sidebar layouts
- Video/audio controls
- Screen sharing
- Participant list
- Speaking indicators
- Pin participants

### AudioRoom

Audio-only room for voice calls.

```tsx
import { AudioRoom } from '@/components/call/audio-room';

function MyAudioCall() {
  return (
    <AudioRoom
      token='eyJhbGciOiJIUzI1NiIs...'
      serverUrl='wss://my-app.livekit.cloud'
      roomName='audio-call-123'
      channelName='Voice Chat'
      onDisconnect={() => console.log('Ended')}
    />
  );
}
```

**Features:**

- Participant list with avatars
- Audio visualization
- Microphone controls
- Speaking indicators
- Audio device selection

## Usage Examples

### Creating and Joining a Call

```typescript
// 1. Create a room
const createRoom = async () => {
  const response = await fetch('/api/livekit/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'my-meeting',
      maxParticipants: 10,
    }),
  });
  const { data } = await response.json();
  return data;
};

// 2. Generate a token
const getToken = async (roomName: string) => {
  const response = await fetch(
    `/api/livekit/token?roomName=${roomName}&role=host`
  );
  const { data } = await response.json();
  return data;
};

// 3. Render the video room
function CallPage() {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);

  useEffect(() => {
    const setupCall = async () => {
      const room = await createRoom();
      const tokenData = await getToken(room.name);
      setToken(tokenData.token);
      setRoomName(room.name);
    };
    setupCall();
  }, []);

  if (!token || !roomName) return <div>Loading...</div>;

  return (
    <VideoRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      roomName={roomName}
    />
  );
}
```

### Using the LiveKit Service Directly

```typescript
import { getLiveKitService } from '@neolith/core';

// Server-side only
async function manageRooms() {
  const liveKitService = getLiveKitService();

  // Create a room
  const room = await liveKitService.createRoom({
    name: 'my-room',
    maxParticipants: 5,
  });

  // Generate a host token
  const token = await liveKitService.generateHostToken('user-123', 'my-room');

  // List participants
  const participants = await liveKitService.listParticipants('my-room');

  // Delete room
  await liveKitService.deleteRoom('my-room');
}
```

## Troubleshooting

### Common Issues

#### 1. "LiveKit not configured" Error

**Problem:** Missing or invalid environment variables.

**Solution:** Ensure all required environment variables are set in `.env.local`:

```bash
LIVEKIT_URL=wss://your-server.com
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-server.com
```

#### 2. "Failed to connect to room" Error

**Problem:** Client-side cannot connect to LiveKit server.

**Solution:**

- Verify `NEXT_PUBLIC_LIVEKIT_URL` is accessible from the browser
- Check that the URL uses `wss://` (secure WebSocket)
- Ensure token is valid and not expired

#### 3. "Token generation failed" Error

**Problem:** Server cannot generate JWT tokens.

**Solution:**

- Verify `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are correct
- Check that the room exists before generating tokens
- Ensure server-side `LIVEKIT_URL` is reachable

#### 4. Video/Audio Not Working

**Problem:** Media devices not accessible.

**Solution:**

- Grant browser permissions for camera/microphone
- Check device selection in call controls
- Verify HTTPS is used (required for media access)

#### 5. Webhook Events Not Received

**Problem:** LiveKit webhooks not triggering.

**Solution:**

- Configure webhook URL in LiveKit dashboard
- Ensure `/api/livekit/webhook` is publicly accessible
- Verify webhook signature validation

### Debug Mode

Enable verbose logging for development:

```typescript
// In your component
import { setLogLevel } from 'livekit-client';

setLogLevel('debug'); // Shows detailed logs in console
```

### Testing Locally

For local development without a LiveKit server:

1. Run LiveKit locally with Docker:

```bash
docker run --rm -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882/udp \
  livekit/livekit-server \
  --dev
```

2. Use local URLs:

```bash
LIVEKIT_URL=ws://localhost:7880
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

## Additional Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit React Components](https://docs.livekit.io/guides/room/client-sdk-react/)
- [LiveKit Server SDK](https://docs.livekit.io/server-sdk-js/)
- [LiveKit Cloud](https://livekit.io/cloud) - Hosted LiveKit solution

## Support

For issues or questions:

1. Check this documentation
2. Review LiveKit official docs
3. Check application logs for errors
4. Contact the development team
