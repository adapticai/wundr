# Orchestrator Daemon Integration API

Complete type-safe daemon API integration for Orchestrator session lifecycle management.

## Created Files

### 1. Type Definitions (`types/daemon.ts`)

Comprehensive TypeScript interfaces for daemon integration:

**Core Interfaces:**

- `DaemonRegistration` - Registration request payload
- `DaemonInfo` - Daemon instance information
- `DaemonHeartbeat` - Heartbeat request with metrics
- `DaemonMetrics` - Performance metrics
- `Session` - Session data structure
- `SessionCreate` - Session creation request
- `SessionUpdate` - Session update request
- `DaemonStatus` - Daemon status information
- `DaemonAuthCredentials` - Authentication credentials
- `DaemonAuthResponse` - Authentication response

**Response Types:**

- `DaemonRegistrationResponse` - Registration confirmation
- `DaemonHeartbeatResponse` - Heartbeat acknowledgment
- `SessionListResponse` - Session list
- `SessionCreateResponse` - Session creation confirmation
- `SessionUpdateResponse` - Session update confirmation
- `SessionDeleteResponse` - Session deletion confirmation
- `DaemonErrorResponse` - Standardized error response

### 2. Main Daemon Route (`app/api/daemon/route.ts`)

Primary daemon management endpoint with full CRUD operations:

**Endpoints:**

#### POST /api/daemon

- Register new daemon instance
- Validates Orchestrator ownership and API key
- Stores daemon info in Redis
- Updates Orchestrator status to ONLINE
- Returns heartbeat configuration

**Request:**

```json
{
  "vpId": "vp_123",
  "organizationId": "org_456",
  "apiKey": "vp_abc123_xyz789",
  "daemonInfo": {
    "instanceId": "daemon_001",
    "version": "1.0.0",
    "host": "localhost",
    "port": 8080,
    "protocol": "http",
    "startedAt": "2024-01-01T00:00:00Z",
    "capabilities": ["chat", "voice", "screen_share"]
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "vpId": "vp_123",
    "organizationId": "org_456",
    "registeredAt": "2024-01-01T00:00:00Z",
    "daemonInfo": { ... },
    "heartbeatInterval": 30000,
    "healthCheckEndpoint": "/api/daemon/health/vp_123"
  },
  "message": "Daemon registered successfully"
}
```

#### GET /api/daemon

- Get current daemon status
- Requires authentication token
- Returns online/offline status with metrics

**Request:**

```
GET /api/daemon
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "vpId": "vp_123",
    "daemonId": "daemon_session_vp123_1234567890",
    "status": "online",
    "lastHeartbeat": "2024-01-01T00:05:00Z",
    "metrics": {
      "memoryUsageMB": 256,
      "cpuUsagePercent": 15.5
    },
    "session": {
      "id": "session_daemon_vp123_...",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T00:05:00Z"
    }
  }
}
```

#### DELETE /api/daemon

- Unregister daemon instance
- Cleans up Redis data
- Sets Orchestrator status to OFFLINE

**Request:**

```
DELETE /api/daemon
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Daemon unregistered successfully"
}
```

### 3. Session Management Route (`app/api/daemon/sessions/route.ts`)

Complete session lifecycle management:

**Endpoints:**

#### GET /api/daemon/sessions

- List all sessions for authenticated Orchestrator
- Returns active and recent sessions

**Request:**

```
GET /api/daemon/sessions
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "sessions": [
    {
      "id": "session_daemon_vp123_1234567890_abc",
      "vpId": "vp_123",
      "type": "daemon",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T00:05:00Z",
      "expiresAt": "2024-01-08T00:00:00Z",
      "metadata": {
        "userAgent": "Orchestrator-Daemon/1.0.0",
        "ipAddress": "192.168.1.100"
      }
    }
  ],
  "total": 1
}
```

#### POST /api/daemon/sessions

- Create new session
- Configurable TTL (default: 7 days)
- Stores in Redis with metadata

**Request:**

```json
{
  "vpId": "vp_123",
  "type": "daemon",
  "metadata": {
    "userAgent": "Orchestrator-Daemon/1.0.0",
    "ipAddress": "192.168.1.100",
    "location": "US-East"
  },
  "timeoutSeconds": 604800
}
```

**Response (201):**

```json
{
  "success": true,
  "session": {
    "id": "session_daemon_vp123_1234567890_abc",
    "vpId": "vp_123",
    "type": "daemon",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastActivityAt": "2024-01-01T00:00:00Z",
    "expiresAt": "2024-01-08T00:00:00Z",
    "metadata": { ... }
  },
  "message": "Session created successfully"
}
```

#### PATCH /api/daemon/sessions

- Update session status or metadata
- Extend TTL if needed
- Update last activity timestamp

**Request:**

```json
{
  "sessionId": "session_daemon_vp123_1234567890_abc",
  "status": "idle",
  "extendTTL": true,
  "metadata": {
    "customField": "value"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "session": { ... },
  "message": "Session updated successfully"
}
```

#### DELETE /api/daemon/sessions

- Terminate session
- Cleanup Redis data
- Requires sessionId query parameter

**Request:**

```
DELETE /api/daemon/sessions?sessionId=session_daemon_vp123_1234567890_abc
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

## Security Features

### Authentication

- JWT-based token authentication
- Bearer token in Authorization header
- Access token (1 hour) and refresh token (7 days)
- Token type validation (access vs refresh)

### Authorization

- Orchestrator ownership validation
- Organization membership checks
- Session ownership verification
- API key hash validation

### Data Protection

- Sensitive data stored in Redis with TTL
- API keys hashed before storage
- Session tokens hashed in Redis
- Proper error handling without data leaks

## Error Handling

All endpoints use standardized error responses:

```json
{
  "error": {
    "message": "Descriptive error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "additional context"
    }
  }
}
```

**Error Codes:**

- `VALIDATION_ERROR` - Invalid input data (400)
- `UNAUTHORIZED` - Authentication failed (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `SESSION_NOT_FOUND` - Session doesn't exist (404)
- `VP_NOT_FOUND` - Orchestrator doesn't exist (404)
- `DAEMON_ALREADY_REGISTERED` - Duplicate registration (409)
- `INTERNAL_ERROR` - Server error (500)

## Redis Data Structures

### Daemon Registration

- Key: `daemon:registration:{vpId}`
- TTL: 7 days
- Data: DaemonInfo + registration metadata

### Heartbeat

- Key: `daemon:heartbeat:{vpId}`
- TTL: 90 seconds (3 missed heartbeats)
- Data: Latest heartbeat with metrics

### Metrics History

- Key: `daemon:metrics:{vpId}`
- TTL: 24 hours
- Data: Last 100 heartbeat metrics (list)

### Session

- Key: `daemon:session:{sessionId}`
- TTL: 7 days (configurable)
- Data: Complete session object

## Integration with Existing Daemon Endpoints

The new endpoints complement existing daemon infrastructure:

**Existing Endpoints:**

- `/api/daemon/auth` - Authentication (unchanged)
- `/api/daemon/heartbeat` - Heartbeat (unchanged)
- `/api/daemon/register` - Old registration (can be deprecated)
- `/api/daemon/unregister` - Old unregistration (can be deprecated)
- `/api/daemon/health/{vpId}` - Health check
- `/api/daemon/status` - Status check
- `/api/daemon/channels` - Channel management
- `/api/daemon/messages` - Message handling
- `/api/daemon/presence` - Presence updates

**New Endpoints:**

- `/api/daemon` - Main daemon CRUD (replaces register/unregister)
- `/api/daemon/sessions` - Session lifecycle management

## Usage Examples

### Complete Daemon Lifecycle

```typescript
// 1. Register daemon
const registration = await fetch('/api/daemon', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    vpId: 'vp_123',
    organizationId: 'org_456',
    apiKey: 'vp_abc123_xyz789',
    daemonInfo: {
      instanceId: 'daemon_001',
      version: '1.0.0',
      host: 'localhost',
      port: 8080,
      protocol: 'http',
      startedAt: new Date().toISOString(),
      capabilities: ['chat', 'voice'],
    },
  }),
});

// 2. Authenticate to get tokens
const auth = await fetch('/api/daemon/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: 'vp_abc123_xyz789',
    apiSecret: 'secret_xyz',
    scopes: ['messages:read', 'messages:write'],
  }),
});

const { accessToken } = await auth.json();

// 3. Create session
const session = await fetch('/api/daemon/sessions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    vpId: 'vp_123',
    type: 'daemon',
    metadata: {
      userAgent: 'Orchestrator-Daemon/1.0.0',
    },
  }),
});

// 4. Send heartbeat
const heartbeat = await fetch('/api/daemon/heartbeat', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'session_daemon_vp123_...',
    status: 'active',
    metrics: {
      memoryUsageMB: 256,
      cpuUsagePercent: 15.5,
      activeConnections: 5,
    },
  }),
});

// 5. Get daemon status
const status = await fetch('/api/daemon', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

// 6. Unregister on shutdown
const unregister = await fetch('/api/daemon', {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

## File Locations

```
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/
├── types/
│   └── daemon.ts                    # Type definitions
└── app/api/daemon/
    ├── route.ts                     # Main daemon endpoint (NEW)
    ├── sessions/
    │   └── route.ts                 # Session management (NEW)
    ├── auth/
    │   └── route.ts                 # Authentication (existing)
    └── heartbeat/
        └── route.ts                 # Heartbeat (existing)
```

## TypeScript Validation

All endpoints are type-safe with:

- ✅ Zero TypeScript errors
- ✅ Full type inference
- ✅ Zod schema validation
- ✅ Proper Next.js 15 patterns
- ✅ Path alias support (`@/types/daemon`)

## Next Steps

1. Update existing `/api/daemon/register` to redirect to `/api/daemon` (POST)
2. Update existing `/api/daemon/unregister` to redirect to `/api/daemon` (DELETE)
3. Add session cleanup cron job for expired sessions
4. Add session analytics and monitoring
5. Implement session replay for debugging
6. Add WebSocket support for real-time session events
