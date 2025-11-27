# Mobile App Configuration Verification Report
## Phase 4 Task 4.2: Mobile App Configuration

**Date**: 2025-11-26
**Status**: CRITICAL CONFIGURATION ISSUE IDENTIFIED
**Platform**: Capacitor v6.0.0 + Next.js 16.0.3

---

## Executive Summary

The mobile app configuration has been reviewed and a **CRITICAL ISSUE** has been identified that prevents Capacitor from properly loading the web application. The Next.js configuration is building in standalone server mode rather than static export mode, which is incompatible with Capacitor's static file requirements.

---

## Configuration Review

### 1. Capacitor Configuration ✅ CORRECT

**File**: `capacitor.config.ts`

```typescript
{
  appId: 'com.wundr.neolith',
  appName: 'Neolith',
  webDir: '../web/out',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  }
}
```

**Status**: Configuration is correct
- App ID follows reverse domain naming convention
- App name is properly set
- WebDir path points to correct location (`../web/out`)
- Platform-specific schemes configured properly

**Plugins Configured**:
- SplashScreen (with 2s duration, auto-hide)
- PushNotifications
- Preferences
- App

---

### 2. Package.json Scripts ✅ CORRECT

**File**: `package.json`

```json
{
  "build": "echo 'Mobile build depends on web build...'",
  "build:full": "npm run build:web && npx cap sync",
  "build:web": "cd ../web && npm run build",
  "sync": "npx cap sync",
  "sync:ios": "npx cap sync ios",
  "sync:android": "npx cap sync android",
  "add:ios": "npx cap add ios",
  "add:android": "npx cap add android"
}
```

**Status**: All scripts properly configured
- Build workflow clearly documented
- Platform-specific sync commands available
- IDE opening commands present
- Run commands for both platforms

---

### 3. Next.js Configuration ❌ CRITICAL ISSUE

**File**: `../web/next.config.js`

**Current Configuration**:
```javascript
{
  distDir: 'out',
  standalone: true,
  // ❌ MISSING: output: 'export'
}
```

**Status**: INCOMPATIBLE WITH CAPACITOR

**Issue Identified**:
The Next.js configuration is missing the `output: 'export'` setting, which means:

1. **Current Behavior**: Next.js builds in standalone server mode
   - Creates server bundles in `out/server/`
   - Generates `.nft.json` files for server deployment
   - Does NOT create static HTML files
   - Requires Node.js runtime to serve pages

2. **Required for Capacitor**: Static export mode
   - Must generate static HTML, CSS, and JS files
   - All pages pre-rendered at build time
   - No server runtime required
   - Files can be loaded directly by Capacitor WebView

**Verification**:
```bash
$ cd apps/web && ls -la out/
# Shows: server/, build/, .nft.json files
# Missing: Static HTML files (index.html, dashboard/index.html, etc.)

$ test -f out/index.html
# Result: No static index.html - confirms server build not static export
```

---

### 4. Build Pipeline ⚠️ PARTIALLY WORKING

**Pre-build Script**: `apps/web/scripts/pre-build.sh` ✅
- Removes stale Next.js lock files
- Cleans cache lock files
- Terminates running Next.js processes
- Prevents build conflicts

**Post-build Script**: `apps/web/scripts/postbuild.js` ✅
- Creates mobile-specific `index.html` entry point
- Includes mobile meta tags and viewport settings
- Provides loading screen during app initialization
- Redirects to `/dashboard` after 1 second

**However**: The postbuild script creates an index.html, but this is a workaround that doesn't solve the fundamental issue of missing static pages for all routes.

---

## Critical Issues Found

### 1. Next.js Static Export Not Enabled ❌

**Impact**: BLOCKING - Mobile app cannot load properly

**Problem**:
- Capacitor requires static files
- Next.js is building server bundles instead
- Web app cannot run in mobile WebView without Node.js runtime

**Solution Required**:
```javascript
// next.config.js
const nextConfig = {
  output: 'export',  // ← ADD THIS
  distDir: 'out',
  // ... rest of config
}
```

**Considerations**:
- This requires removing server-side features:
  - API routes (`app/api/*`) - must move to separate backend
  - Server Actions - must convert to client-side logic
  - Dynamic routes with `generateStaticParams`
  - Image optimization (must use `unoptimized: true`)

---

### 2. Native Platform Folders Not Initialized ⚠️

**Status**: Expected on first setup

```bash
$ ls apps/mobile/
# Shows: capacitor.config.ts, package.json, README.md
# Missing: ios/, android/ folders
```

**Required**: Run platform initialization:
```bash
cd apps/mobile
npm run add:ios     # Creates ios/ folder
npm run add:android # Creates android/ folder
```

---

### 3. No Mobile Asset Resources ⚠️

**Status**: Missing but optional for initial setup

**Missing**:
- App icons (icon.png, icon-only.png)
- Splash screens (splash.png)
- Platform-specific resources

**Note**: Capacitor will use defaults, but production apps need custom assets.

---

## Compatibility Analysis

### Current Architecture Incompatibility

**Web App Features Using Server-Side Rendering**:
1. API Routes in `app/api/`:
   - `/api/auth/[...nextauth]` - Authentication
   - `/api/graphql` - GraphQL endpoint
   - `/api/workspaces/*` - Workspace management
   - `/api/vps/*` - Orchestrator management
   - `/api/tasks/*` - Task management

2. Server Components:
   - Multiple pages using `async` server components
   - Database queries in component files
   - Direct Prisma usage in pages

**Impact on Mobile Build**:
- Cannot use `output: 'export'` without major refactoring
- All API routes must move to separate backend service
- All server components must become client components with API calls
- Authentication flow needs complete redesign

---

## Recommended Actions

### Immediate (Required for Mobile to Work)

1. **Decision Point**: Choose architecture strategy:

   **Option A - Full Static Export** (Recommended for true mobile app):
   - Move all API routes to separate backend service
   - Convert server components to client components
   - Implement client-side data fetching
   - Use environment variables for API endpoints
   - Enable `output: 'export'` in next.config.js

   **Option B - Hybrid Approach** (Quick fix but not ideal):
   - Keep web app as server-rendered
   - Create separate static build for mobile only
   - Use conditional config based on environment
   - Duplicate some logic for mobile compatibility

2. **Update Next.js Configuration**:
   ```javascript
   // For Option A
   output: 'export',
   images: { unoptimized: true },

   // For Option B
   output: process.env.BUILD_TARGET === 'mobile' ? 'export' : undefined,
   ```

3. **Initialize Native Platforms**:
   ```bash
   npm run add:ios
   npm run add:android
   ```

### Short-term (Required for Production)

4. **Add Mobile Assets**:
   - Create app icons (1024x1024 source)
   - Design splash screens
   - Run Capacitor asset generation
   - Configure adaptive icons (Android)

5. **Configure Build Pipeline**:
   - Update Turborepo to handle mobile builds
   - Add mobile-specific environment variables
   - Configure CI/CD for mobile builds

6. **Test Mobile Build**:
   ```bash
   cd apps/web && npm run build
   cd ../mobile && npm run sync
   npm run open:ios  # Test in Xcode
   ```

### Long-term (Production Readiness)

7. **Platform-Specific Configuration**:
   - iOS signing certificates
   - Android keystore setup
   - Push notification credentials
   - App Store/Play Store metadata

8. **Performance Optimization**:
   - Code splitting for mobile
   - Reduce bundle size
   - Optimize images for mobile
   - Implement offline support

---

## Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Capacitor Config | ✅ | Properly configured |
| Package Scripts | ✅ | All scripts correct |
| Next.js Export | ❌ | Missing `output: 'export'` |
| Native Platforms | ⚠️ | Not yet initialized |
| Mobile Assets | ⚠️ | Not yet created |
| Build Pipeline | ⚠️ | Works but incomplete |
| Architecture | ❌ | Incompatible with static export |

---

## Conclusion

The mobile app configuration files are **technically correct**, but the web app architecture is **fundamentally incompatible** with Capacitor's requirements for static files.

**Critical Path**:
1. Decide on static export vs hybrid approach
2. Refactor web app if choosing static export
3. Update Next.js configuration
4. Initialize native platforms
5. Test full mobile build pipeline

**Estimated Effort**:
- Option A (Full Static): 3-5 days of refactoring
- Option B (Hybrid): 1-2 days of configuration

**Recommendation**:
Given this is a monorepo with separate mobile app, **Option A** is strongly recommended for maintainability and true mobile app experience. The refactoring effort is worthwhile for long-term success.

---

## Files Reviewed

1. `/apps/mobile/capacitor.config.ts` ✅
2. `/apps/mobile/package.json` ✅
3. `/apps/web/next.config.js` ❌
4. `/apps/web/scripts/pre-build.sh` ✅
5. `/apps/web/scripts/postbuild.js` ✅
6. `/apps/web/package.json` ✅

---

**Next Steps**: Await decision on architecture approach before proceeding with implementation.
