# Mobile Configuration Quick Reference

## Phase 4 Task 4.2 - Configuration Status & Action Items

**Last Updated**: 2025-11-26 **Status**: 🔴 Configuration Issues - Action Required

---

## TL;DR - What You Need to Know

✅ **Working**: Capacitor config files are correctly set up ❌ **Broken**: Web app builds server
bundles instead of static files ⚠️ **Missing**: Native iOS and Android projects not initialized 📊
**Impact**: Mobile app cannot run until architecture is refactored

---

## Quick Status Check

```bash
# Run this to verify current state
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/mobile

# Check Capacitor config
cat capacitor.config.ts | grep -E "appId|webDir"
# ✅ appId: 'com.wundr.neolith'
# ✅ webDir: '../web/out'

# Check if native platforms exist
ls ios android 2>/dev/null || echo "⚠️ Not initialized"

# Check web build output
ls -la ../web/out/*.html 2>/dev/null || echo "❌ No static HTML files"

# Check server bundles (should NOT exist for mobile)
ls -d ../web/out/server 2>/dev/null && echo "❌ Server build detected"
```

---

## Configuration Files Status

### 1. capacitor.config.ts ✅

```typescript
Location: apps/mobile/capacitor.config.ts
Status:   CORRECT
Issues:   None

Key Settings:
  appId:   'com.wundr.neolith'
  appName: 'Neolith'
  webDir:  '../web/out'

Plugins Configured:
  - SplashScreen
  - PushNotifications
  - Preferences
  - App
```

### 2. package.json ✅

```json
Location: apps/mobile/package.json
Status:   CORRECT
Issues:   None

Key Scripts:
  build:full    - Build web + sync to native
  sync          - Sync web assets to native
  add:ios       - Initialize iOS platform
  add:android   - Initialize Android platform

Dependencies: @capacitor/* v6.0.0
```

### 3. next.config.js ❌

```javascript
Location: apps/web/next.config.js
Status:   INCOMPATIBLE WITH CAPACITOR
Issues:   Missing static export configuration

Current:
  distDir: 'out',
  standalone: true,  // ❌ Server mode

Required:
  output: 'export',  // ← ADD THIS
  images: { unoptimized: true }
```

---

## The Problem in Plain English

**What's Happening**:

- Capacitor needs static HTML/CSS/JS files
- Next.js is building server bundles that need Node.js
- Mobile app cannot load server bundles in native WebView

**Why It's Happening**:

- next.config.js missing `output: 'export'`
- Web app uses 189 API route files (server-side)
- Architecture designed for server rendering, not static export

**What Needs to Change**:

- Enable static export in Next.js config
- Move API routes to separate backend service
- Convert server components to client components
- Use client-side data fetching with API calls

---

## Refactoring Scope

### Current Architecture Analysis

```bash
API Routes:        189 files
API Directories:   50+ endpoints
Server Components: ~4 files
Dependencies:      @apollo/server, next-auth, prisma
```

### Major Components Requiring Changes

**1. Authentication** (High Priority)

- Current: next-auth with API routes
- Required: Client-side auth with separate auth service
- Files: `app/api/auth/[...nextauth]/`

**2. GraphQL API** (High Priority)

- Current: @apollo/server in API routes
- Required: Standalone GraphQL backend
- Files: `app/api/graphql/`

**3. Business Logic APIs** (Medium Priority)

- Organizations: 10+ endpoints
- Tasks: 8+ endpoints
- Messages: 5+ endpoints
- Calls: 8+ endpoints
- Workspaces: 15+ endpoints
- VPs: 20+ endpoints

**4. Data Fetching** (Medium Priority)

- Convert server components to client components
- Implement SWR or React Query for data fetching
- Add API client layer

---

## Action Plan

### Phase 1: Quick Assessment (1 day)

```bash
# 1. Review API dependencies
cd apps/web
grep -r "prisma\|database" app/api/ | wc -l

# 2. Check for server-only code
grep -r "server-only" app/ | wc -l

# 3. Identify all API consumers
grep -r "fetch.*api/" app/ --include="*.tsx" | wc -l
```

### Phase 2: Architecture Decision (1 day)

**Option A: Full Static Export** (Recommended)

- Pros: True mobile app, offline capable, better performance
- Cons: 7-10 days refactoring, separate backend needed
- Best for: Production mobile app

**Option B: Hybrid Build**

- Pros: Quick fix, minimal changes
- Cons: Maintains technical debt, limited mobile features
- Best for: MVP or prototype

**Option C: React Native**

- Pros: Native performance, full mobile capabilities
- Cons: Complete rewrite, 4-6 weeks
- Best for: Long-term mobile strategy

### Phase 3: Implementation (7-10 days)

If choosing Option A:

**Day 1-2: Backend Setup**

```bash
# Create standalone backend
mkdir packages/backend-api
npm create vite@latest backend-api -- --template node

# Move API routes
mv apps/web/app/api/* packages/backend-api/src/routes/
```

**Day 3-4: Client Refactoring**

```typescript
// Convert from:
export default async function Page() {
  const data = await prisma.user.findMany()
  return <div>{data}</div>
}

// To:
'use client'
export default function Page() {
  const { data } = useSWR('/api/users', fetcher)
  return <div>{data}</div>
}
```

**Day 5-6: Configuration Updates**

```javascript
// next.config.js
module.exports = {
  output: 'export',
  distDir: 'out',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL,
  },
};
```

**Day 7-8: Testing**

```bash
# Build and test
cd apps/web
npm run build

# Verify static output
ls -la out/*.html  # Should see HTML files

# Sync to mobile
cd ../mobile
npm run sync
npm run open:ios
```

**Day 9-10: Polish & Deploy**

- Fix remaining issues
- Test on real devices
- Update documentation

---

## Quick Commands Reference

```bash
# Navigate to mobile app
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/mobile

# Initialize platforms (one-time setup)
npm run add:ios
npm run add:android

# Build web app
npm run build:web

# Sync to native platforms
npm run sync

# Open in IDE
npm run open:ios      # Opens Xcode
npm run open:android  # Opens Android Studio

# Run on device/simulator
npm run run:ios
npm run run:android

# Check Capacitor status
npx cap doctor
```

---

## Verification Tests

```bash
# Test 1: Check static export
cd apps/web
npm run build
test -f out/index.html && echo "✅ Static export working" || echo "❌ Still server mode"

# Test 2: Verify Capacitor compatibility
cd ../mobile
npx cap copy web
npx cap doctor

# Test 3: Build iOS (requires Xcode)
npx cap build ios

# Test 4: Build Android (requires Android Studio)
npx cap build android
```

---

## Environment Variables Required

```bash
# For static export with external API
NEXT_PUBLIC_API_URL=https://api.neolith.app
NEXT_PUBLIC_WS_URL=wss://api.neolith.app
NEXT_PUBLIC_GRAPHQL_URL=https://api.neolith.app/graphql

# For development with local backend
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

---

## Common Issues & Solutions

### Issue: "No static HTML files generated"

```bash
# Cause: output: 'export' not set
# Fix: Add to next.config.js
output: 'export'
```

### Issue: "API routes not working"

```bash
# Cause: Static export doesn't support API routes
# Fix: Move to separate backend or use external API
```

### Issue: "Image optimization error"

```bash
# Cause: Static export doesn't support image optimization
# Fix: Add to next.config.js
images: { unoptimized: true }
```

### Issue: "Platform not found"

```bash
# Cause: ios/android folders not initialized
# Fix: Run platform add commands
npm run add:ios
npm run add:android
```

---

## File Paths Reference

```
Mobile App Root:
/Users/iroselli/wundr/packages/@wundr/neolith/apps/mobile/

Key Files:
├── capacitor.config.ts    ✅ Correct
├── package.json           ✅ Correct
├── ios/                   ⚠️ Not initialized
├── android/               ⚠️ Not initialized
└── README.md              ✅ Complete

Web App Root:
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/

Key Files:
├── next.config.js         ❌ Needs update
├── out/                   ❌ Server bundles only
├── app/api/              ❌ 189 files need migration
└── scripts/
    ├── pre-build.sh       ✅ Correct
    └── postbuild.js       ✅ Correct but insufficient
```

---

## Documentation Files

Generated for this task:

1. `MOBILE_CONFIG_VERIFICATION_REPORT.md` - Detailed analysis
2. `CONFIG_VERIFICATION_RESULTS.md` - Test results
3. `MOBILE_CONFIG_QUICK_REFERENCE.md` - This file

---

## Decision Matrix

| Factor          | Static Export | Hybrid Build | React Native |
| --------------- | ------------- | ------------ | ------------ |
| Timeline        | 7-10 days     | 2-3 days     | 4-6 weeks    |
| Effort          | High          | Low          | Very High    |
| Mobile UX       | Excellent     | Good         | Excellent    |
| Maintainability | High          | Low          | High         |
| Offline Support | Yes           | Limited      | Yes          |
| Native Features | Limited       | Limited      | Full         |
| Performance     | Good          | Good         | Excellent    |
| **Recommended** | ✅            | ⚠️           | 🔮 Future    |

---

## Next Steps

1. **Review this document** and make architecture decision
2. **If Static Export**: Start backend planning
3. **If Hybrid**: Implement conditional config
4. **If React Native**: Create migration plan

**Contact**: DevOps Engineer for implementation support

---

**Report Status**: COMPLETE **Phase 4 Task 4.2**: VERIFIED - ISSUES IDENTIFIED **Action Required**:
Architecture decision needed before proceeding
