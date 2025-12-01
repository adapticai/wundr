# User Profile API Endpoints

## Overview

This document describes the user profile management API endpoints for the Neolith web application.
These endpoints allow authenticated users to view and update their profile information.

## Endpoints

### 1. GET /api/users/me

Get the profile of the currently authenticated user.

**Authentication:** Required (NextAuth session)

**Response:**

```json
{
  "data": {
    "id": "cuid123",
    "email": "user@example.com",
    "name": "John Doe",
    "displayName": "Johnny",
    "avatarUrl": "https://example.com/avatar.jpg",
    "bio": "Software engineer",
    "status": "ACTIVE",
    "isVP": false,
    "preferences": {
      "theme": "dark"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z",
    "lastActiveAt": "2024-01-03T00:00:00.000Z"
  }
}
```

**Status Codes:**

- `200` - Success
- `401` - Unauthorized (not authenticated)
- `404` - User not found
- `500` - Internal server error

**Example:**

```typescript
const response = await fetch('/api/users/me', {
  headers: {
    'Content-Type': 'application/json',
  },
});

const { data } = await response.json();
console.log(data.name); // "John Doe"
```

---

### 2. PATCH /api/users/me

Update the profile of the currently authenticated user.

**Authentication:** Required (NextAuth session)

**Request Body:**

```json
{
  "name": "John Doe",
  "displayName": "Johnny",
  "bio": "Software engineer and open source contributor"
}
```

**Validation Rules:**

- `name`: 1-100 characters (optional)
- `displayName`: 1-50 characters (optional)
- `bio`: max 500 characters (optional, nullable)
- `avatarUrl`: valid URL (optional, nullable)
- `preferences`: JSON object (optional)

**Response:**

```json
{
  "data": {
    "id": "cuid123",
    "email": "user@example.com",
    "name": "John Doe",
    "displayName": "Johnny",
    "bio": "Software engineer and open source contributor",
    "avatarUrl": "https://example.com/avatar.jpg",
    "status": "ACTIVE",
    "isVP": false,
    "preferences": {
      "theme": "dark"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z",
    "lastActiveAt": "2024-01-03T00:00:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

**Status Codes:**

- `200` - Success
- `400` - Validation error
- `401` - Unauthorized (not authenticated)
- `500` - Internal server error

**Example:**

```typescript
const response = await fetch('/api/users/me', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    bio: 'Updated bio',
  }),
});

const { data, message } = await response.json();
console.log(message); // "Profile updated successfully"
```

---

### 3. GET /api/users/[id]

Get a user's profile by their ID.

**Authentication:** Required (NextAuth session)

**Parameters:**

- `id` - User ID (path parameter)

**Response (viewing another user's profile):**

```json
{
  "data": {
    "id": "cuid123",
    "email": "user@example.com",
    "name": "John Doe",
    "displayName": "Johnny",
    "avatarUrl": "https://example.com/avatar.jpg",
    "bio": "Software engineer",
    "status": "ACTIVE",
    "isVP": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActiveAt": "2024-01-03T00:00:00.000Z"
  }
}
```

**Note:** When viewing another user's profile, sensitive fields like `preferences`, `updatedAt`, and
`vpConfig` are excluded. When viewing your own profile via this endpoint, all fields are included
(same as `/api/users/me`).

**Status Codes:**

- `200` - Success
- `400` - Invalid user ID
- `401` - Unauthorized (not authenticated)
- `404` - User not found
- `500` - Internal server error

**Example:**

```typescript
const userId = 'cuid123';
const response = await fetch(`/api/users/${userId}`, {
  headers: {
    'Content-Type': 'application/json',
  },
});

const { data } = await response.json();
console.log(data.name); // "John Doe"
```

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "additional": "error details"
  }
}
```

### Error Codes

- `UNAUTHORIZED` - Authentication required
- `USER_NOT_FOUND` - User does not exist
- `VALIDATION_ERROR` - Input validation failed
- `INTERNAL_ERROR` - Server error
- `FORBIDDEN` - Insufficient permissions

---

## Related Endpoints

### Avatar Management

- **GET /api/users/[id]/avatar** - Get user avatar URL
- **POST /api/users/[id]/avatar** - Upload new avatar
- **DELETE /api/users/[id]/avatar** - Delete avatar

See `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/users/[id]/avatar/route.ts` for
details.

### Notification Preferences

- **GET /api/users/me/notifications** - Get notification preferences
- **PATCH /api/users/me/notifications** - Update notification preferences

See `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/users/me/notifications/route.ts`
for details.

---

## Implementation Details

### Files

1. **Validation Schema**: `/lib/validations/user.ts`
   - Zod schemas for input validation
   - Type definitions
   - Error response helpers

2. **Current User Endpoint**: `/app/api/users/me/route.ts`
   - GET and PATCH handlers
   - Full profile access with preferences

3. **User by ID Endpoint**: `/app/api/users/[id]/route.ts`
   - GET handler
   - Public profile for other users
   - Full profile for own user

4. **Tests**: `/__tests__/api/users-profile.test.ts`
   - Comprehensive test coverage
   - All edge cases covered

### Database Schema

The User model includes:

- `id`: Unique identifier (CUID)
- `email`: Unique email address
- `name`: Full name
- `displayName`: Display name (shown in UI)
- `avatarUrl`: Avatar image URL
- `bio`: User biography
- `status`: Account status (ACTIVE, INACTIVE, PENDING, SUSPENDED)
- `isVP`: Orchestrator flag
- `preferences`: JSON preferences object
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- `lastActiveAt`: Last activity timestamp

### Security

- All endpoints require authentication via NextAuth session
- Users can only update their own profile
- Sensitive fields (preferences, vpConfig) are excluded when viewing other users' profiles
- Input validation using Zod schemas
- SQL injection protection via Prisma ORM

---

## Usage Examples

### React Hook

```typescript
import { useState, useEffect } from 'react';

function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => {
        setProfile(data.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  const updateProfile = async updates => {
    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (response.ok) {
      setProfile(data.data);
    } else {
      throw new Error(data.error);
    }
  };

  return { profile, loading, error, updateProfile };
}
```

### Server Component

```typescript
import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <div>Not authenticated</div>;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
    },
  });

  return (
    <div>
      <h1>{user.displayName || user.name}</h1>
      <p>{user.bio}</p>
      <img src={user.avatarUrl} alt="Avatar" />
    </div>
  );
}
```

---

## Testing

Run the test suite:

```bash
npm test -- __tests__/api/users-profile.test.ts
```

Test coverage includes:

- Authentication checks
- Profile retrieval
- Profile updates
- Validation errors
- Not found errors
- Public vs private profile fields

---

## Changelog

### 2024-11-26 - Initial Implementation

- Created user profile validation schema
- Implemented GET /api/users/me
- Implemented PATCH /api/users/me
- Implemented GET /api/users/[id]
- Added comprehensive test suite
- Documentation completed
