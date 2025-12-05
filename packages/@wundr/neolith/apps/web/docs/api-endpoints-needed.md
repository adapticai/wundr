# Required API Endpoints for Security Settings

This document outlines the API endpoints needed for the Security Settings page to function properly.

## Sessions Management

### GET /api/user/sessions
Fetch all active sessions for the current user.

**Response:**
```json
{
  "sessions": [
    {
      "id": "string",
      "device": "string",
      "browser": "string",
      "os": "string",
      "location": "string",
      "lastActive": "string",
      "current": boolean,
      "deviceType": "desktop" | "mobile" | "tablet"
    }
  ]
}
```

### DELETE /api/user/sessions/:sessionId
Revoke a specific session.

**Response:**
```json
{
  "success": true,
  "message": "Session revoked"
}
```

### POST /api/user/sessions/revoke-all
Revoke all sessions except the current one.

**Response:**
```json
{
  "success": true,
  "message": "All sessions revoked",
  "revokedCount": number
}
```

## Connected Accounts Management

### GET /api/user/connected-accounts
Fetch all connected social accounts for the current user.

**Response:**
```json
{
  "accounts": [
    {
      "provider": "google" | "github" | "facebook" | etc,
      "email": "string" (optional),
      "username": "string" (optional),
      "connected": boolean
    }
  ]
}
```

### DELETE /api/user/social/:provider
Disconnect a social account provider.

**Parameters:**
- `provider`: The social provider name (e.g., "google", "github")

**Response:**
```json
{
  "success": true,
  "message": "Account disconnected"
}
```

## Implementation Notes

1. **Sessions endpoint** should:
   - Return sessions sorted by last active (current session first)
   - Include geolocation data if available
   - Parse User-Agent to extract browser, OS, and device type
   - Mark the current session with `current: true`

2. **Connected accounts endpoint** should:
   - Only return providers that are actually connected
   - Include the primary identifier (email or username)
   - Validate that at least one authentication method remains before allowing disconnect

3. **Security considerations**:
   - All endpoints require authentication
   - Rate limiting should be applied
   - Session revocation should invalidate tokens immediately
   - Audit log should track all session and account changes
   - Prevent disconnecting the last authentication method

## Current Hook Behavior

Until these endpoints are implemented, the hooks will:
- Return empty arrays (`sessions: []`, `accounts: []`)
- Set `isLoading: false` after failed fetch
- Set appropriate error messages in `error` property
- Not break the UI (graceful degradation)
