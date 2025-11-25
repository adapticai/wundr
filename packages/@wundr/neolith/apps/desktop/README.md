# Genesis Desktop Application

Electron-based desktop application for AI-powered organizational design.

## Overview

The Genesis Desktop application provides a native desktop experience for designing and generating
organizational structures using AI. Built with Electron, it offers cross-platform support for macOS,
Windows, and Linux.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- For macOS code signing: Apple Developer account and certificates
- For Windows code signing: Code signing certificate
- For Linux: Required build dependencies

## Development Setup

### Install Dependencies

```bash
cd packages/@wundr/genesis-app/apps/desktop
npm install
```

### Development Mode

Run the application in development mode with hot reload:

```bash
npm run dev
```

This starts:

- The Electron main process
- Development server for the renderer process (when integrated)

### Build for Production

Build the TypeScript files:

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Packaging

### Build for All Platforms

```bash
npm run package
```

### Platform-Specific Builds

```bash
# macOS
npm run package:mac

# Windows
npm run package:win

# Linux
npm run package:linux
```

Built applications are output to the `out/` directory.

## Code Signing

### macOS

Set the following environment variables:

```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your-certificate-password
export APPLE_ID=your-apple-id@example.com
export APPLE_ID_PASSWORD=app-specific-password
export APPLE_TEAM_ID=your-team-id
```

### Windows

Set the following environment variables:

```bash
export WIN_CSC_LINK=/path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD=your-certificate-password
```

## Project Structure

```
apps/desktop/
├── electron/
│   ├── main.ts          # Main process entry point
│   └── preload.ts       # Preload script with context bridge
├── assets/              # Application assets (icons, etc.)
├── build/               # Build resources (icons, entitlements)
├── dist/                # Compiled TypeScript output
├── out/                 # Packaged applications
├── electron-builder.yml # Electron Builder configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture

### Main Process (`electron/main.ts`)

- Window management with state persistence
- IPC handlers for renderer communication
- System tray integration
- Deep link handling (`genesis://`)
- Auto-update functionality
- Application menu setup
- Security configuration

### Preload Script (`electron/preload.ts`)

- Context bridge for secure IPC
- Type-safe API exposure to renderer
- Event subscription management

### Renderer Process

The renderer process is served by a separate web application (located in the `renderer/` directory
when integrated with the web application).

## Security Features

- Context isolation enabled
- Node integration disabled
- Sandbox mode enabled
- Web security enabled
- Remote module disabled
- Secure external link handling
- Navigation restrictions

## IPC API

The following APIs are exposed to the renderer process via `window.genesis`:

### Configuration

```typescript
window.genesis.config.get(key); // Get config value
window.genesis.config.set(key, val); // Set config value
window.genesis.config.getAll(); // Get all config
```

### Dialog

```typescript
window.genesis.dialog.openDirectory()           // Open directory picker
window.genesis.dialog.openFile(filters?)        // Open file picker
window.genesis.dialog.saveFile(path?, filters?) // Save file dialog
window.genesis.dialog.message(options)          // Message box
```

### Shell

```typescript
window.genesis.shell.openExternal(url); // Open URL in browser
window.genesis.shell.openPath(path); // Open file/folder
window.genesis.shell.showItemInFolder(p); // Show in file manager
```

### App Info

```typescript
window.genesis.app.getVersion(); // App version
window.genesis.app.getPath(name); // System paths
window.genesis.app.getPlatform(); // OS platform
```

### Window

```typescript
window.genesis.window.minimize(); // Minimize window
window.genesis.window.maximize(); // Toggle maximize
window.genesis.window.close(); // Close window
window.genesis.window.isMaximized(); // Check maximized state
```

### Updates

```typescript
window.genesis.updates.check(); // Check for updates
window.genesis.updates.download(); // Download update
window.genesis.updates.install(); // Install and restart
```

### Events

```typescript
// Menu events
window.genesis.on.newOrganization(callback);
window.genesis.on.openOrganization(callback);
window.genesis.on.save(callback);
window.genesis.on.export(callback);
window.genesis.on.preferences(callback);

// Deep link events
window.genesis.on.deepLink(callback);

// Update events
window.genesis.on.updateAvailable(callback);
window.genesis.on.updateDownloaded(callback);
window.genesis.on.updateProgress(callback);
```

## Deep Linking

The application registers the `genesis://` protocol for deep linking.

Example URLs:

- `genesis://org/new` - Create new organization
- `genesis://org/open?id=abc123` - Open organization

## Auto Updates

Auto-updates are configured via GitHub Releases. The application checks for updates on startup and
notifies users when updates are available.

To publish an update:

1. Update version in `package.json`
2. Build and sign the application
3. Create a GitHub release with the built artifacts

## Troubleshooting

### macOS: "App is damaged"

This occurs when the app is not properly signed or notarized. Ensure code signing credentials are
configured correctly.

### Windows: SmartScreen Warning

This occurs with unsigned or new certificates. Ensure the app is properly signed with a trusted
certificate.

### Linux: AppImage Won't Run

Make the AppImage executable:

```bash
chmod +x Genesis-x.x.x.AppImage
```

## License

UNLICENSED - Proprietary software of Adaptic.ai
