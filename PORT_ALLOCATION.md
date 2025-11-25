# Port Allocation Guide

This document defines the port allocation strategy for all services in the Wundr monorepo to prevent conflicts.

## Port Ranges

- **3000-3099**: Frontend Web Applications
- **4000-4099**: Backend API Services
- **5000-5099**: Database Services
- **6000-6099**: Cache/Queue Services
- **8000-8099**: Development Tools & Utilities

## Allocated Ports

### Frontend Applications (3000-3099)

| Port | Service | Package Path | Status |
|------|---------|--------------|--------|
| 3000 | **Neolith Web App (PRIMARY)** | `@wundr/neolith/apps/web` | ✅ Reserved |
| 3001 | Wundr Dashboard | `@wundr/dashboard` | ✅ Configured |
| 3002 | *Available* | - | - |
| 3003 | Web Client Tool | `tools/web-client` | ✅ Configured |
| 3004-3099 | *Available for future apps* | - | - |

### Backend Services (4000-4099)

| Port | Service | Package Path | Status |
|------|---------|--------------|--------|
| 4000 | GraphQL API Server | `@neolith/api` | ✅ Configured |
| 4001-4099 | *Available for future services* | - | - |

### Database Services (5000-5099)

| Port | Service | Package Path | Status |
|------|---------|--------------|--------|
| 5432 | PostgreSQL | Docker/Local | ✅ Standard Port |

### Cache/Queue Services (6000-6099)

| Port | Service | Package Path | Status |
|------|---------|--------------|--------|
| 6379 | Redis | Docker/Local | ✅ Standard Port |

## Configuration Files

### Neolith Web App (Port 3000)

**package.json** location: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/package.json`

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "start": "next start -p 3000"
  }
}
```

**Environment variables** (`.env.local`):
```bash
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
BASE_URL=http://localhost:3000
```

### Wundr Dashboard (Port 3001)

**package.json** location: `/Users/iroselli/wundr/packages/@wundr/dashboard/package.json`

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "start": "next start -p 3001"
  }
}
```

**Environment variables** (`.env.local`):
```bash
NEXTAUTH_URL=http://localhost:3001
AUTH_URL=http://localhost:3001
```

### Web Client Tool (Port 3003)

**package.json** location: `/Users/iroselli/wundr/tools/web-client/package.json`

```json
{
  "scripts": {
    "dev": "next dev -p 3003",
    "start": "next start -p 3003"
  }
}
```

## Rules & Best Practices

### ✅ DO:

1. **Always specify explicit ports** in package.json dev scripts using `-p` flag
2. **Always match environment variables** to the specified port
3. **Check this document** before adding new services
4. **Update this document** when allocating a new port
5. **Use the next available port** in the appropriate range

### ❌ DON'T:

1. **Never use `next dev` without `-p` flag** - it defaults to 3000 and causes conflicts
2. **Never hardcode port 3000** in any package except `@neolith/web`
3. **Never use ports outside the designated ranges** without updating this document
4. **Never skip port numbers** arbitrarily - use sequential allocation

## How to Add a New Service

1. Identify the service type (Frontend/Backend/Database/etc.)
2. Find the next available port in the appropriate range
3. Update the service's `package.json`:
   ```json
   {
     "scripts": {
       "dev": "next dev -p XXXX",
       "start": "next start -p XXXX"
     }
   }
   ```
4. Update/create the service's `.env.local`:
   ```bash
   NEXTAUTH_URL=http://localhost:XXXX
   AUTH_URL=http://localhost:XXXX
   BASE_URL=http://localhost:XXXX
   ```
5. Add the port allocation to this document
6. Commit both changes together

## Troubleshooting Port Conflicts

If you see port conflict errors:

1. Check what's using the port:
   ```bash
   lsof -i :3000
   ```

2. Kill the process if needed:
   ```bash
   kill -9 <PID>
   ```

3. Verify the service's package.json has explicit `-p` flag
4. Verify .env.local matches the package.json port
5. Restart the dev server

## Port Verification Script

Run this to verify all ports are correctly configured:

```bash
# Check for missing -p flags
grep -r "\"dev\".*next dev" packages/ --include="package.json" | grep -v "\-p"

# List all allocated ports
grep -r "next dev -p" packages/ --include="package.json"
```

## Last Updated

- Date: 2025-11-25
- Updated By: Claude Code
- Reason: Initial port allocation documentation and Neolith web app port reservation
