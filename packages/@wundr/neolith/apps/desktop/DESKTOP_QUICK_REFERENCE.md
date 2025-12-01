# Desktop App - Quick Reference Guide

## Build Commands

```bash
# Development
npm run dev              # Run in development mode
npm run typecheck        # Type check without building
npm run lint            # Lint electron code

# Building
npm run build           # Compile TypeScript
npm run build:all       # Build web app + package electron app

# Packaging
npm run package         # Package for current platform
npm run package:mac     # Package for macOS (x64 + ARM64)
npm run package:win     # Package for Windows (x64 + ia32 + ARM64)
npm run package:linux   # Package for Linux (AppImage + DEB + RPM)

# Utilities
npm run clean           # Clean build artifacts
./scripts/generate-icons.sh  # Generate Windows .ico from PNG
```

## File Locations

### Configuration

- `electron-builder.yml` - Build configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

### Source Code

- `electron/main.ts` - Main process
- `electron/preload.ts` - Preload script (context bridge)

### Build Resources

- `build/icon.icns` - macOS icon
- `build/icon.ico` - Windows icon
- `build/icon.png` - Source PNG / Linux icon
- `build/icons/` - Linux icon directory
- `build/entitlements.mac.plist` - macOS entitlements
- `build/entitlements.mac.inherit.plist` - macOS child process entitlements

### Scripts

- `scripts/build.js` - Pre-build preparation
- `scripts/notarize.js` - macOS notarization
- `scripts/generate-icons.sh` - Icon generation

### Output

- `dist/` - Compiled JavaScript
- `dist/out/` - Built packages (DMG, EXE, AppImage, etc.)
- `out/` - Web app output (copied from ../web/out)

## Production Build Checklist

### Before Building

1. Ensure web app is built:

   ```bash
   cd ../web && npm run build
   ```

2. Verify TypeScript compiles:

   ```bash
   npm run typecheck
   ```

3. Check all icons exist:
   ```bash
   ls build/icon.{icns,ico,png}
   ```

### For Signed macOS Builds

Set environment variables:

```bash
export CSC_LINK="/path/to/cert.p12"
export CSC_KEY_PASSWORD="cert-password"
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAM_ID"
```

### For Signed Windows Builds

Set environment variables:

```bash
export WIN_CSC_LINK="/path/to/cert.pfx"
export WIN_CSC_KEY_PASSWORD="cert-password"
```

### Build and Package

```bash
npm run build:all
```

Output locations:

- macOS: `dist/out/mac/Neolith.app`, `dist/out/Neolith-*.dmg`
- Windows: `dist/out/Neolith Setup *.exe`, `dist/out/Neolith *.exe` (portable)
- Linux: `dist/out/Neolith-*.AppImage`, `dist/out/Neolith_*.deb`, `dist/out/Neolith-*.rpm`

## Architecture

### Main Process (main.ts)

- Creates BrowserWindow
- Manages system tray
- Handles IPC communication
- Manages auto-updates
- Implements deep linking

### Preload Script (preload.ts)

- Exposes `window.neolith` API to renderer
- Provides type-safe IPC wrappers
- Manages event listeners

### IPC API Categories

1. **Configuration** - Get/set app config
2. **Dialogs** - File/directory/message dialogs
3. **Shell** - External URLs, file paths
4. **App Info** - Version, paths, platform
5. **Window** - Minimize, maximize, close
6. **Updates** - Check, download, install updates

## Supported Platforms

| Platform | Architectures    | Formats                  |
| -------- | ---------------- | ------------------------ |
| macOS    | x64, ARM64       | DMG, ZIP                 |
| Windows  | x64, ia32, ARM64 | NSIS, Portable           |
| Linux    | x64, ARM64       | AppImage, DEB, RPM, Snap |

## Icon Requirements

- **macOS**: `.icns` with sizes 16-1024px
- **Windows**: `.ico` with sizes 16-256px
- **Linux**: `.png` files or directory

Generate from PNG:

```bash
./scripts/generate-icons.sh
```

## Troubleshooting

### Build Fails

```bash
npm run clean
npm run build
npm run build:all
```

### TypeScript Errors

```bash
npm run typecheck
```

### Missing Icons

```bash
./scripts/generate-icons.sh
ls -lh build/icon.*
```

### Web App Not Found

```bash
cd ../web
npm run build
cd ../desktop
npm run build:all
```

## Key Features

1. **Window State Persistence** - Remembers size, position, maximized state
2. **System Tray** - Background operation, quick access menu
3. **Deep Linking** - `neolith://` protocol support
4. **Auto-Updates** - GitHub releases integration
5. **Security** - Hardened runtime, sandboxing, CSP
6. **Dark Mode** - System theme support (macOS)
7. **File Associations** - `.neolith` file type
8. **Multi-Platform** - macOS, Windows, Linux

## Development Tips

1. Use dev tools: Enabled automatically in dev mode
2. Hot reload: Restart with `npm run dev` after changes
3. Test IPC: Use renderer console: `window.neolith.app.getVersion()`
4. Debug main process: Add `--inspect` to electron command
5. Check logs: Main process logs in terminal

## Environment Variables

### Optional for Development

- `NODE_ENV=development` - Enable dev mode

### Required for Signed Releases

- `APPLE_ID` - Apple ID for notarization
- `APPLE_ID_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Developer Team ID
- `CSC_LINK` - Certificate path (macOS)
- `CSC_KEY_PASSWORD` - Certificate password (macOS)
- `WIN_CSC_LINK` - Certificate path (Windows)
- `WIN_CSC_KEY_PASSWORD` - Certificate password (Windows)

## Links

- Electron Builder Docs: https://www.electron.build/
- Electron Docs: https://www.electronjs.org/docs/latest/
- Notarization Guide: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/

---

**Quick Reference - Version 1.0** Last Updated: November 26, 2024
