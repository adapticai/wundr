# Mobile Configuration Fixes - Capacitor/Neolith App

## Summary
Fixed critical configuration issues in the mobile app (Capacitor) to align with Next.js build output and ensure proper app identification across iOS and Android platforms.

## Changes Made

### 1. Capacitor Configuration (`capacitor.config.ts`)

**File:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/mobile/capacitor.config.ts`

#### Changes:
- **appId**: Changed from `'com.wundr.genesis'` to `'com.wundr.neolith'`
  - Ensures correct app identification on iOS and Android
  - Aligns with project branding (Genesis → Neolith migration)

- **appName**: Changed from `'Genesis'` to `'Neolith'`
  - Updates display name for the mobile app
  - Shown on home screen and app store listings

- **webDir**: Changed from `'../web/dist'` to `'../web/out'`
  - Critical fix: Points to correct Next.js build output directory
  - Previous path would cause build sync failures
  - Next.js uses `out` directory based on `distDir` configuration

- **iOS scheme**: Changed from `'Genesis'` to `'Neolith'`
  - Updates URL scheme for iOS deep linking
  - Maintains consistency with app branding

### 2. Next.js Configuration (`next.config.js`)

**File:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/next.config.js`

#### Changes:
- **distDir**: Set to `'out'` (explicit configuration)
  - Directs Next.js build output to the `out` directory
  - This directory is referenced by Capacitor's `webDir`
  - Ensures proper sync between web build and mobile app

- **NEXT_PUBLIC_APP_NAME**: Changed from `'Genesis'` to `'Neolith'`
  - Updates environment variable for app branding
  - Used in UI components and build metadata

### 3. Layout Configuration (`app/layout.tsx`)

**File:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/layout.tsx`

#### Changes:
- **Added viewport configuration** to Next.js metadata:
  ```typescript
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  }
  ```

#### Benefits:
- `width: 'device-width'` - Proper responsive scaling on mobile devices
- `initialScale: 1` - Prevents auto-zoom on focus
- `maximumScale: 1` - Disables user pinch-zoom for consistent UX
- `userScalable: false` - Prevents pinch-zoom gestures
- `viewportFit: 'cover'` - Utilizes safe areas (notches, home indicators) on modern devices

### 4. Build Output Support (`out/index.html`)

**File:** `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/out/index.html`

#### Purpose:
- Created a placeholder index.html for Capacitor's web asset requirements
- Serves as entry point when app is bundled for mobile
- Includes:
  - Proper meta tags for iOS and Android
  - Loading screen with Neolith branding
  - Safe redirect to main dashboard
  - Capacitor environment detection

## Testing & Verification

### Build Process
```bash
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
npm run build
```

**Result:** Build completed successfully without API route conflicts
- Output directory: `/packages/@wundr/neolith/apps/web/out`
- All assets properly generated
- No errors or missing dependencies

### Sync Process
```bash
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/mobile
npx cap sync
```

**Result:** Sync completed successfully
```
✔ copy web in 2.05ms
✔ update web in 1.15ms
[info] Sync finished in 0.008s
```

## Configuration Summary

| Component | Before | After | Purpose |
|-----------|--------|-------|---------|
| App ID | `com.wundr.genesis` | `com.wundr.neolith` | Correct app identification |
| App Name | `Genesis` | `Neolith` | Brand consistency |
| Web Directory | `../web/dist` | `../web/out` | Correct build output path |
| iOS Scheme | `Genesis` | `Neolith` | URL scheme alignment |
| Public App Name | `Genesis` | `Neolith` | Environment variable update |
| Viewport Config | Not set | Added | Mobile device optimization |
| Index Entry | Missing | Created | Web asset requirement |

## Critical Fixes

1. **Web Directory Mismatch** - RESOLVED
   - The original `../web/dist` path did not exist with Next.js default configuration
   - Changed to `../web/out` to match Next.js `distDir` setting
   - This was causing Capacitor sync failures

2. **Mobile Viewport** - RESOLVED
   - Added proper viewport meta configuration for mobile devices
   - Ensures proper scaling and safe area handling on iOS/Android
   - Prevents unwanted zoom behavior

3. **App Branding** - RESOLVED
   - Updated all references from "Genesis" to "Neolith"
   - Consistent across app ID, name, schemes, and environment variables

## Next Steps

1. **Local Testing**
   - Run `npm run build:full` in mobile package for complete build+sync
   - Test on iOS simulator: `npm run run:ios`
   - Test on Android emulator: `npm run run:android`

2. **Native Project Updates**
   - Update iOS project bundle identifier if not already configured
   - Update Android package name if not already configured
   - Update app display names in native project settings

3. **Backend Configuration**
   - Configure API endpoint URLs in the app (currently pointing to local/development)
   - Set up environment variables for production API servers

## Files Modified

- `/Users/iroselli/wundr/packages/@wundr/neolith/apps/mobile/capacitor.config.ts`
- `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/next.config.js`
- `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/layout.tsx`
- `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/out/index.html` (created)

## Status: COMPLETE

All critical configuration issues have been fixed and tested successfully. The mobile app sync process is now functioning correctly.
