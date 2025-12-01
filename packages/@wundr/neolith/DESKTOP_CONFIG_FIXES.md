# Desktop App Configuration Fixes - Summary

## Overview

Fixed critical configuration issues in the Neolith Desktop application to enable proper production
builds and packaging with the Next.js web app integration.

## Critical Issues Fixed

### 1. Production Renderer Path (main.ts)

**Problem:** The desktop app's production path was incorrectly set to `../renderer/index.html`
**Solution:** Updated to properly start a Next.js server in production mode

- Dev mode: Loads from `http://localhost:3000` (Next.js dev server)
- Production mode: Spawns a `next start` process and loads from the local server
- Added fallback to load static HTML if server fails

**File:** `/apps/desktop/electron/main.ts` **Changes:**

- Lines 117-154: Complete rewrite of production server startup logic
- Added proper server startup with stdio capture
- Added error handling and timeout mechanisms
- Lines 49, 683-705: Added server process management

### 2. Build Output Directory Configuration (electron-builder.yml)

**Problem:** Output directory conflicts between electron-builder and web app **Solution:** Changed
output directory from `out` to `dist/out`

- Prevents conflict with web app's `out/` directory
- Properly separates build artifacts

**File:** `/apps/desktop/electron-builder.yml` **Changes:**

- Line 10: Changed `output: out` to `output: dist/out`
- Lines 14-18: Updated files configuration to include both `dist/preload.js`, `dist/main.js`, and
  `out/**/*`
- Line 172: Removed missing icon reference (`file-icon.icns`)
- Line 177: Commented out missing notarize.js hook

### 3. Build Process Automation (package.json)

**Problem:** No automated process to include web app files in desktop package **Solution:** Added
build script to copy web app output before packaging

**File:** `/apps/desktop/package.json` **Changes:**

- Added `prebuild:app` script that runs build preparation
- Updated `package`, `package:mac`, `package:win`, `package:linux` scripts to run prebuild
- Added new `build:all` script for complete workflow

### 4. Web App Build Preparation Script

**New File:** `/apps/desktop/scripts/build.js`

This Node.js script handles:

1. Checks if web app is built (builds if needed)
2. Copies entire web app `out/` directory to desktop `out/` directory
3. Enables desktop app packaging with all necessary web app files

### 5. Next.js Standalone Mode Configuration

**Problem:** Web app needs to be bundled with desktop app for production **Solution:** Enabled
`standalone: true` option in Next.js config

**File:** `/apps/web/next.config.js` **Changes:**

- Line 6: Added `output: 'export'` comment explaining approach
- Line 80: Added `standalone: true` for Electron/desktop bundling
- Preserves API routes and server functionality for desktop app's internal server

## Build & Packaging Flow

```
npm run package
  ├─ prebuild:app (scripts/build.js)
  │  ├─ Checks if web app is built
  │  ├─ Builds web app if needed
  │  └─ Copies web app/out to desktop/out
  ├─ Desktop TypeScript compilation
  └─ Electron-builder packaging
     └─ Creates DMG/ZIP with all files

Result: dist/out/*.dmg and dist/out/*.zip
```

## File Structure

### Desktop App Package Contents

```
Resources/app.asar/
├── dist/
│   ├── main.js (compiled Electron main process)
│   └── preload.js (compiled preload script)
├── out/ (copied from web app build)
│   ├── index.html
│   ├── server/ (Next.js server code)
│   ├── static/ (client assets)
│   └── ...
├── build/ (icons and resources)
├── assets/ (app icons)
├── package.json
└── ...
```

### Production App Startup

```
Electron Main Process
├── Starts Next.js server: next start -p 3000
│   ├── Loads from desktop/out directory
│   ├── Serves API routes and pages
│   └── Runs on localhost:3000
└── Loads http://localhost:3000 in BrowserWindow
```

## Verification Checklist

- [x] Desktop TypeScript builds successfully
- [x] Web app builds to `out/` directory with `distDir: 'out'`
- [x] Build script copies web app files to desktop
- [x] Packaging creates DMG and ZIP files
- [x] Asar package includes web app files (index.html, static assets, server code)
- [x] Production server startup logic implemented
- [x] Error handling and fallback mechanisms in place
- [x] All icon references resolved
- [x] Build hooks commented out (notarization requires certificates)

## Testing

### Build Test

```bash
cd packages/@wundr/neolith/apps/desktop
npm run build      # TypeScript compilation
npm run prebuild:app  # Prepare web app files
npm run package    # Full packaging (runs both above)
```

### Output

- `dist/out/Neolith-0.1.0.dmg` - macOS DMG installer
- `dist/out/Neolith-0.1.0-mac.zip` - macOS ZIP distribution
- `dist/out/Neolith-0.1.0-arm64.dmg` - ARM64 DMG installer
- `dist/out/Neolith-0.1.0-arm64-mac.zip` - ARM64 ZIP distribution
- `dist/out/mac/Neolith.app` - macOS app bundle

## Configuration Files Modified

1. `/apps/desktop/electron/main.ts` - Production server startup
2. `/apps/desktop/electron-builder.yml` - Build configuration
3. `/apps/desktop/package.json` - Build scripts
4. `/apps/web/next.config.js` - Standalone mode (minimal change)

## New Files Created

1. `/apps/desktop/scripts/build.js` - Build preparation script

## Environment Notes

- **Node.js**: 18+ required
- **Next.js**: 16.0.3 (with standalone support)
- **Electron**: 28.3.3
- **Platform**: Tested on macOS 14.3
- **Architecture**: Supports both x64 and arm64

## Known Limitations

1. **Code Signing**: Currently skips code signing (requires Apple Developer certificate)
2. **Notarization**: Disabled (requires Apple ID authentication)
3. **Server Dependencies**: Desktop app requires Node.js to be available for running `next start`
4. **Database**: Backend API requires database connection (for auth and data operations)

## Future Improvements

1. Integrate with CI/CD for automated builds
2. Implement code signing and notarization workflow
3. Add Windows and Linux build support
4. Consider bundling Node.js with app
5. Implement auto-update mechanism
6. Add app version sync between desktop and web

## Debugging

If the app fails to start in production mode:

1. Check console logs: `mainWindow.webContents.openDevTools()`
2. Verify `out/` directory exists and contains web app files
3. Check if port 3000 is available
4. Verify Next.js server starts: `npm run dev` in web app directory
5. Check system logs for permission issues

## Contact & Support

For issues or questions about the desktop app configuration, contact the engineering team at
engineering@adaptic.ai
