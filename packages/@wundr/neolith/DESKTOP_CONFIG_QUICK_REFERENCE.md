# Desktop App Configuration - Quick Reference

## Critical Fixes Applied

### 1. Main.ts Production Path
- **Before:** `mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))`
- **After:** Spawns Next.js server and loads from `http://localhost:3000`
- **Location:** `/apps/desktop/electron/main.ts` lines 117-154

### 2. Build Output Directory
- **Before:** `directories.output: out` (conflicts with web app)
- **After:** `directories.output: dist/out`
- **Location:** `/apps/desktop/electron-builder.yml` line 10

### 3. Web App Integration
- **Added:** Build script that copies web app output to desktop
- **File:** `/apps/desktop/scripts/build.js`
- **Runs:** Automatically before packaging

### 4. Package Scripts
- **New:** `npm run prebuild:app` - Prepares web app files
- **Updated:** `npm run package` - Now includes prebuild step
- **Location:** `/apps/desktop/package.json` lines 8-20

## Build Commands

```bash
# Development
cd apps/desktop
npm run dev              # Dev mode with Next.js dev server

# Production Build
npm run build            # TypeScript compilation only
npm run prebuild:app    # Prepare web app files
npm run package         # Full packaging (includes both above)

# Platform-Specific
npm run package:mac     # macOS only
npm run package:win     # Windows only
npm run package:linux   # Linux only

# Cleanup
npm run clean           # Remove build artifacts
```

## Packaging Output

Success produces:
```
dist/out/
├── Neolith-0.1.0.dmg              (Intel macOS)
├── Neolith-0.1.0-mac.zip          (Intel macOS ZIP)
├── Neolith-0.1.0-arm64.dmg        (ARM64 macOS)
├── Neolith-0.1.0-arm64-mac.zip    (ARM64 macOS ZIP)
└── mac/Neolith.app                (App bundle)
```

## Configuration Details

| File | Change | Reason |
|------|--------|--------|
| `electron/main.ts` | Added server startup logic | Enable production server |
| `electron-builder.yml` | `out` → `dist/out` | Prevent directory conflicts |
| `electron-builder.yml` | Removed `file-icon.icns` | File didn't exist |
| `electron-builder.yml` | Commented `afterSign` hook | Certificate not available |
| `package.json` | Added `prebuild:app` script | Automate file copying |
| `package.json` | Updated package scripts | Include prebuild step |
| `scripts/build.js` | New file | Prepare web app for packaging |
| `next.config.js` | Added `standalone: true` | Enable server bundling |

## How It Works

1. **Dev Mode** (`npm run dev`)
   - Starts Next.js dev server on port 3000
   - Opens Electron window pointing to dev server
   - Full live reload support

2. **Production Mode** (after `npm run package`)
   - Electron spawns `next start` process
   - App loads from local server on port 3000
   - All web app code bundled with desktop app

## Files Included in Package

✓ Electron main process (dist/main.js, dist/preload.js)
✓ Next.js app (out/ directory)
✓ Static assets (CSS, JS, images)
✓ App icons
✓ Configuration files

## Verification

After packaging, verify contents:
```bash
# List app.asar contents
npx asar list dist/out/mac/Neolith.app/Contents/Resources/app.asar

# Should include:
# /out/index.html
# /out/static/
# /out/server/
# /dist/main.js
# /dist/preload.js
```

## Testing the Package

```bash
# Mount DMG and test app
open dist/out/Neolith-0.1.0.dmg

# Or run app bundle directly
open dist/out/mac/Neolith.app
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check if port 3000 is available |
| Build fails | Run `npm run clean` then retry |
| Missing web files | Ensure `npm run prebuild:app` completes successfully |
| Server not starting | Check `/out` directory exists with web app files |
| Icon errors | Run `npm run clean` to regenerate |

## Environment Requirements

- Node.js 18+
- npm or pnpm
- macOS 10.13+ (for Intel and ARM64)
- Next.js 16.0.3
- Electron 28.3.3

## Key Improvements

✓ Fixed production renderer path
✓ Proper server lifecycle management
✓ Automated web app integration
✓ Clean build artifact organization
✓ Error handling and fallbacks
✓ Support for both dev and production modes
✓ Proper resource bundling

## Next Steps

1. Test production build: `npm run package`
2. Test packaged app: `open dist/out/Neolith-0.1.0.dmg`
3. Verify all features work (API calls, auth, etc.)
4. Set up code signing for distribution
5. Configure auto-updater for production releases
