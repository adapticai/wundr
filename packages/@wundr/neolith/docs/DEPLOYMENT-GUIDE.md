# Neolith Deployment Guide

Production deployment instructions for the Neolith platform across all targets: web (Netlify),
backend services (Railway), desktop (macOS/Windows/Linux), and mobile (iOS/Android). Written for
execution by Claude Code agents.

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │         neolith.ai (Netlify)        │
                    │     Next.js 16 SSR + Static + API   │
                    └──────────┬──────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
   ┌──────────────────┐ ┌───────────┐ ┌─────────────────┐
   │  PostgreSQL (RW)  │ │  Redis    │ │ Orchestrator    │
   │  Railway          │ │  Railway  │ │ Daemon (Railway) │
   └──────────────────┘ └───────────┘ └─────────────────┘

   ┌──────────────────┐ ┌───────────┐ ┌─────────────────┐
   │  S3 / R2 Storage │ │  LiveKit  │ │  Resend Email   │
   └──────────────────┘ └───────────┘ └─────────────────┘

   ┌──────────────────────────────────────────────────────┐
   │  Desktop (Electron)  │  iOS (Capacitor)  │  Android  │
   │  macOS / Windows /   │  App Store        │  Play     │
   │  Linux               │  Connect          │  Store    │
   └──────────────────────────────────────────────────────┘
```

**Monorepo paths:**

| Component         | Path                                                   |
| ----------------- | ------------------------------------------------------ |
| Web app           | `packages/@wundr/neolith/apps/web`                     |
| Desktop app       | `packages/@wundr/neolith/apps/desktop`                 |
| Mobile app        | `packages/@wundr/neolith/apps/mobile`                  |
| Database (Prisma) | `packages/@wundr/neolith/packages/@neolith/database`   |
| Core services     | `packages/@wundr/neolith/packages/@neolith/core`       |
| UI library        | `packages/@wundr/neolith/packages/@neolith/ui`         |
| Daemon SDK        | `packages/@wundr/neolith/packages/@neolith/daemon-sdk` |
| Orchestrator      | `packages/@wundr/orchestrator-daemon`                  |
| Org Genesis       | `packages/@wundr/org-genesis`                          |

---

## 1. Railway: Infrastructure Services

Railway hosts PostgreSQL, Redis, and the Orchestrator Daemon.

### 1.1 Prerequisites

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create a new project (or link existing)
railway init --name neolith-production
```

### 1.2 PostgreSQL Database

```bash
# Add PostgreSQL plugin
railway add --plugin postgresql

# Get the connection string (Railway auto-provisions)
railway variables get DATABASE_URL

# Run Prisma migrations against production
cd packages/@wundr/neolith/packages/@neolith/database
DATABASE_URL="$(railway variables get DATABASE_URL)" npx prisma migrate deploy

# Verify schema
DATABASE_URL="$(railway variables get DATABASE_URL)" npx prisma db pull --print | head -20
```

**Railway Dashboard configuration:**

| Setting            | Value                           |
| ------------------ | ------------------------------- |
| PostgreSQL version | 15                              |
| High Availability  | Enabled (production)            |
| Backup schedule    | Daily, 7-day retention          |
| Max connections    | 100                             |
| Region             | us-east-1 (or closest to users) |

### 1.3 Redis

```bash
# Add Redis plugin
railway add --plugin redis

# Get connection string
railway variables get REDIS_URL
```

**Configuration:**

| Setting     | Value          |
| ----------- | -------------- |
| Persistence | AOF (everysec) |
| Max memory  | 256 MB         |
| Eviction    | allkeys-lru    |

### 1.4 Orchestrator Daemon Service

The daemon runs as a long-lived Railway service.

```bash
# Create a new service for the daemon
railway service create orchestrator-daemon

# Link to the service
railway service orchestrator-daemon

# Set the root directory for Railway to detect
railway variables set RAILWAY_SERVICE_ROOT=packages/@wundr/orchestrator-daemon

# Set environment variables
railway variables set \
  NODE_ENV=production \
  DAEMON_PORT=8787 \
  DAEMON_HOST=0.0.0.0 \
  DAEMON_MAX_SESSIONS=100 \
  LOG_LEVEL=info \
  LOG_FORMAT=json \
  DAEMON_JWT_SECRET="$(openssl rand -base64 32)" \
  DAEMON_CORS_ENABLED=true \
  DAEMON_CORS_ORIGINS=https://neolith.ai \
  NEOLITH_API_URL=https://neolith.ai \
  METRICS_ENABLED=true

# Set the build and start commands
railway variables set \
  RAILWAY_BUILD_COMMAND="cd packages/@wundr/orchestrator-daemon && npm run build" \
  RAILWAY_START_COMMAND="cd packages/@wundr/orchestrator-daemon && node dist/cli/daemon-cli.js start --port 8787"

# Deploy
railway up
```

**Custom `railway.json` for the daemon** (create at
`packages/@wundr/orchestrator-daemon/railway.json`):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node dist/cli/daemon-cli.js start --port ${PORT:-8787}",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5,
    "numReplicas": 1
  }
}
```

**Generate a public domain for the daemon:**

```bash
railway domain --service orchestrator-daemon
# Example output: orchestrator-daemon-production.up.railway.app
```

Record this URL; the web app needs it as `VP_DAEMON_API_URL` and `VP_DAEMON_WS_URL`.

### 1.5 Verify Railway Services

```bash
# Check all services are running
railway status

# Test database connectivity
railway run -- npx prisma db execute --stdin <<< "SELECT 1 AS ok;"

# Test Redis
railway run -- node -e "
  const Redis = require('ioredis');
  const r = new Redis(process.env.REDIS_URL);
  r.ping().then(p => { console.log('Redis:', p); r.quit(); });
"

# Test daemon health
curl -s https://orchestrator-daemon-production.up.railway.app/health
```

---

## 2. Netlify: Web Application (neolith.ai)

### 2.1 Prerequisites

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Link to site (or create new)
netlify init
# When prompted:
#   Team: your-team
#   Site name: neolith
#   Build command: (leave blank, using netlify.toml)
#   Deploy directory: (leave blank, using plugin)
```

### 2.2 Create `netlify.toml`

Create this file at the monorepo root (`/Users/iroselli/wundr/netlify.toml`):

```toml
[build]
  # Base directory - the neolith monorepo root
  base = "packages/@wundr/neolith"
  # Build command runs from base directory
  command = """
    cd apps/web && \
    npx prisma generate --schema=../../packages/@neolith/database/prisma/schema.prisma && \
    npm run build
  """
  # Publish directory (relative to base)
  publish = "apps/web/.next"

# Next.js on Netlify requires the Next.js Runtime plugin
[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "20"
  NPM_FLAGS = "--legacy-peer-deps"
  NEXT_PRIVATE_STANDALONE = "true"

# Redirect www to apex
[[redirects]]
  from = "https://www.neolith.ai/*"
  to = "https://neolith.ai/:splat"
  status = 301
  force = true

# SPA fallback for client-side routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  conditions = {Role = ["admin"]}

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"

# Cache static assets
[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Cache images
[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```

### 2.3 Environment Variables

Set these in the Netlify dashboard (Site > Site configuration > Environment variables) or via CLI:

```bash
netlify env:set NODE_ENV production
netlify env:set APP_URL https://neolith.ai

# Auth
netlify env:set AUTH_SECRET "$(openssl rand -base64 32)"
netlify env:set NEXTAUTH_SECRET "$(openssl rand -base64 32)"
netlify env:set AUTH_URL https://neolith.ai
netlify env:set NEXTAUTH_URL https://neolith.ai

# Database (from Railway)
netlify env:set DATABASE_URL "postgresql://..." --context production

# Redis (from Railway)
netlify env:set REDIS_URL "redis://..." --context production

# OAuth
netlify env:set GOOGLE_CLIENT_ID "your-google-client-id"
netlify env:set GOOGLE_CLIENT_SECRET "your-google-client-secret"
netlify env:set GITHUB_CLIENT_ID "your-github-client-id"
netlify env:set GITHUB_CLIENT_SECRET "your-github-client-secret"

# AI Keys
netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
netlify env:set OPENAI_API_KEY "sk-..."

# S3 / R2 Storage
netlify env:set STORAGE_PROVIDER s3
netlify env:set STORAGE_BUCKET neolith-uploads-production
netlify env:set STORAGE_REGION us-east-1
netlify env:set MY_AWS_ACCESS_KEY_ID "AKIA..."
netlify env:set MY_AWS_SECRET_ACCESS_KEY "..."
netlify env:set STORAGE_PUBLIC_URL https://cdn.neolith.ai

# Orchestrator Daemon
netlify env:set VP_DAEMON_API_URL "https://orchestrator-daemon-production.up.railway.app"
netlify env:set VP_DAEMON_WS_URL "wss://orchestrator-daemon-production.up.railway.app/ws"
netlify env:set VP_DAEMON_AUTH_KEY "$(openssl rand -base64 32)"

# Email
netlify env:set RESEND_API_KEY "re_..."
netlify env:set EMAIL_FROM_ADDRESS noreply@neolith.ai

# LiveKit (video/audio)
netlify env:set LIVEKIT_API_KEY "your-key"
netlify env:set LIVEKIT_API_SECRET "your-secret"
netlify env:set LIVEKIT_URL "wss://livekit.neolith.ai"

# Push notifications
netlify env:set VAPID_PUBLIC_KEY "your-vapid-public"
netlify env:set VAPID_PRIVATE_KEY "your-vapid-private"
```

### 2.4 Custom Domain Setup

```bash
# Add custom domain
netlify domains:add neolith.ai
netlify domains:add www.neolith.ai

# Configure DNS (at your registrar):
# neolith.ai      A       75.2.60.5
# www.neolith.ai  CNAME   your-site.netlify.app

# Enable HTTPS (automatic via Let's Encrypt)
netlify env:set NETLIFY_HTTPS true
```

### 2.5 Deploy

```bash
# Deploy to production
netlify deploy --prod

# Or trigger via git push (if linked to GitHub)
git push origin master
```

### 2.6 Post-Deploy Verification

```bash
# Check site is live
curl -s -o /dev/null -w "%{http_code}" https://neolith.ai/login

# Check API
curl -s https://neolith.ai/api/health

# Check GraphQL
curl -s -X POST https://neolith.ai/api/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __typename }"}'

# Check OAuth callbacks are configured:
# Google: https://neolith.ai/api/auth/callback/google
# GitHub: https://neolith.ai/api/auth/callback/github
```

---

## 3. Desktop Application (Electron)

### 3.1 Build Prerequisites

```bash
cd packages/@wundr/neolith/apps/desktop

# Install dependencies
npm install

# Verify electron-builder config
cat electron-builder.yml
```

**Required code signing environment variables:**

| Platform | Variable                      | Description                               |
| -------- | ----------------------------- | ----------------------------------------- |
| macOS    | `CSC_LINK`                    | Path to .p12 certificate                  |
| macOS    | `CSC_KEY_PASSWORD`            | Certificate password                      |
| macOS    | `APPLE_ID`                    | Apple ID for notarization                 |
| macOS    | `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (appleid.apple.com) |
| macOS    | `APPLE_TEAM_ID`               | Apple Developer Team ID                   |
| Windows  | `WIN_CSC_LINK`                | Path to .pfx code signing certificate     |
| Windows  | `WIN_CSC_KEY_PASSWORD`        | Certificate password                      |

### 3.2 Build the Web App for Electron

The desktop app embeds the web app's static export.

```bash
# Build the web app with static export
cd packages/@wundr/neolith/apps/web
npm run build

# The output goes to apps/web/out/ which Electron references
ls out/index.html
```

### 3.3 Build Desktop Packages

```bash
cd packages/@wundr/neolith/apps/desktop

# Build Electron TypeScript
npm run build

# Copy web output into Electron's expected location
cp -r ../web/out ./out
```

#### macOS (DMG + ZIP)

```bash
# Build for macOS (both Intel and Apple Silicon)
npm run package:mac

# Output:
#   dist/out/Neolith-{version}-arm64.dmg
#   dist/out/Neolith-{version}-x64.dmg
#   dist/out/Neolith-{version}-arm64-mac.zip
#   dist/out/Neolith-{version}-x64-mac.zip
```

To notarize for distribution outside the App Store:

```bash
# Ensure notarize.js script exists at scripts/notarize.js
# Set env vars: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
npm run package:mac
# Notarization runs automatically via afterSign hook
```

#### Windows (NSIS Installer + Portable)

```bash
# Build for Windows (requires Windows or wine on macOS/Linux)
npm run package:win

# Output:
#   dist/out/Neolith Setup {version}.exe    (NSIS installer)
#   dist/out/Neolith {version}.exe          (Portable)
```

#### Linux (AppImage + deb + rpm)

```bash
# Build for Linux
npm run package:linux

# Output:
#   dist/out/Neolith-{version}.AppImage
#   dist/out/neolith_{version}_amd64.deb
#   dist/out/neolith-{version}.x86_64.rpm
```

### 3.4 Publish Desktop Releases

Releases are published to GitHub Releases for auto-update:

```bash
# Set GitHub token
export GH_TOKEN="ghp_your_github_token"

# Build and publish (all platforms)
cd packages/@wundr/neolith/apps/desktop
npx electron-builder build --mac --win --linux --publish always

# Verify release on GitHub
gh release list --repo adapticai/neolith --limit 5
```

The `electron-updater` in the app checks `github.com/adaptic-ai/neolith/releases` for updates
automatically on launch.

### 3.5 macOS App Store Submission

```bash
# Build for Mac App Store (MAS)
npx electron-builder build --mac mas --publish never

# Output: dist/out/Neolith-{version}.pkg

# Submit via Transporter app or xcrun
xcrun altool --upload-app \
  --file dist/out/Neolith-*.pkg \
  --type osx \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

---

## 4. Mobile Applications (Capacitor)

### 4.1 Prerequisites

```bash
# iOS: Xcode 15+ with iOS 17 SDK
xcode-select --install

# Android: Android Studio with SDK 34+
# Ensure ANDROID_HOME is set
echo $ANDROID_HOME

# Capacitor CLI
cd packages/@wundr/neolith/apps/mobile
npm install
```

### 4.2 Build Web Assets for Mobile

```bash
# Build the web app (output goes to apps/web/out/)
cd packages/@wundr/neolith/apps/web
npm run build

# Verify output exists
ls out/index.html
```

### 4.3 iOS

#### Initial Setup (first time only)

```bash
cd packages/@wundr/neolith/apps/mobile

# Add iOS platform
npx cap add ios

# Sync web assets and native plugins
npx cap sync ios
```

#### Build and Run

```bash
# Sync latest web build
npx cap sync ios

# Open in Xcode
npx cap open ios

# Or run directly on simulator
npx cap run ios --target "iPhone 16 Pro"
```

#### App Store Submission

```bash
# In Xcode:
# 1. Select "Any iOS Device (arm64)" as build target
# 2. Product > Archive
# 3. Window > Organizer > Distribute App
# 4. Select "App Store Connect" > Upload

# Or via command line:
cd ios/App
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/Neolith.xcarchive \
  archive

xcodebuild -exportArchive \
  -archivePath build/Neolith.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist

# Upload to App Store Connect
xcrun altool --upload-app \
  --file build/export/App.ipa \
  --type ios \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

**App Store Connect configuration:**

| Setting       | Value                      |
| ------------- | -------------------------- |
| Bundle ID     | `com.wundr.neolith`        |
| App Name      | Neolith                    |
| Category      | Business / Productivity    |
| Privacy URL   | https://neolith.ai/privacy |
| Support URL   | https://neolith.ai/support |
| Marketing URL | https://neolith.ai         |
| SKU           | neolith-ios-001            |

**Required capabilities** (set in Xcode > Signing & Capabilities):

- Push Notifications
- Associated Domains (applinks:neolith.ai)
- Background Modes (Remote notifications)

### 4.4 Android

#### Initial Setup (first time only)

```bash
cd packages/@wundr/neolith/apps/mobile

# Add Android platform
npx cap add android

# Sync web assets and native plugins
npx cap sync android
```

#### Build and Run

```bash
# Sync latest web build
npx cap sync android

# Open in Android Studio
npx cap open android

# Or run on connected device/emulator
npx cap run android
```

#### Play Store Submission

```bash
cd android

# Build release AAB (Android App Bundle)
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab

# Sign the AAB (if not using Play App Signing)
jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore neolith-release.keystore \
  app/build/outputs/bundle/release/app-release.aab \
  neolith-key

# Upload to Play Console via CLI or web
# https://play.google.com/console
```

**Google Play Console configuration:**

| Setting          | Value                      |
| ---------------- | -------------------------- |
| Package name     | `com.wundr.neolith`        |
| App name         | Neolith                    |
| Category         | Business                   |
| Content rating   | Everyone                   |
| Privacy policy   | https://neolith.ai/privacy |
| Default language | English (US)               |

**Required `android/app/build.gradle` settings for release:**

```groovy
android {
    defaultConfig {
        applicationId "com.wundr.neolith"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "0.1.0"
    }
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "neolith-release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS") ?: "neolith-key"
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 4.5 Capacitor Configuration for Production

Update `capacitor.config.ts` for production builds:

```typescript
const config: CapacitorConfig = {
  appId: 'com.wundr.neolith',
  appName: 'Neolith',
  webDir: '../web/out',
  server: {
    // Production: load bundled assets (no URL)
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  // ... rest of config unchanged
};
```

For development/staging, override with a server URL:

```typescript
server: {
  url: 'https://staging.neolith.ai',
  cleartext: false,
}
```

---

## 5. CI/CD Pipeline (GitHub Actions)

### 5.1 Web Deployment Workflow

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web to Netlify

on:
  push:
    branches: [master]
    paths:
      - 'packages/@wundr/neolith/apps/web/**'
      - 'packages/@wundr/neolith/packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: npx prisma generate
        working-directory: packages/@wundr/neolith/packages/@neolith/database

      - name: Build internal packages
        run: |
          pnpm --filter @neolith/ui build
          pnpm --filter @neolith/core build
          pnpm --filter @neolith/daemon-sdk build

      - name: Build web app
        run: pnpm --filter @neolith/web build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=packages/@wundr/neolith/apps/web/.next
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### 5.2 Desktop Build Workflow

Create `.github/workflows/build-desktop.yml`:

```yaml
name: Build Desktop Apps

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., 0.1.0)'
        required: true
      publish:
        description: 'Publish to GitHub Releases'
        type: boolean
        default: false

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Build web assets
        run: pnpm --filter @neolith/web build

      - name: Build desktop
        run: |
          cd packages/@wundr/neolith/apps/desktop
          npm run build
          cp -r ../web/out ./out
        env:
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      - name: Package macOS
        run: |
          cd packages/@wundr/neolith/apps/desktop
          npx electron-builder build --mac --publish ${{ inputs.publish && 'always' || 'never' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        with:
          name: desktop-macos
          path: packages/@wundr/neolith/apps/desktop/dist/out/*.dmg

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Build web assets
        run: pnpm --filter @neolith/web build

      - name: Build and package Windows
        run: |
          cd packages/@wundr/neolith/apps/desktop
          npm run build
          xcopy /E /I ..\web\out out
          npx electron-builder build --win --publish ${{ inputs.publish && 'always' || 'never' }}
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        with:
          name: desktop-windows
          path: packages/@wundr/neolith/apps/desktop/dist/out/*.exe

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Build web assets
        run: pnpm --filter @neolith/web build

      - name: Build and package Linux
        run: |
          cd packages/@wundr/neolith/apps/desktop
          npm run build
          cp -r ../web/out ./out
          npx electron-builder build --linux --publish ${{ inputs.publish && 'always' || 'never' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        with:
          name: desktop-linux
          path: |
            packages/@wundr/neolith/apps/desktop/dist/out/*.AppImage
            packages/@wundr/neolith/apps/desktop/dist/out/*.deb
```

### 5.3 Mobile Build Workflow

Create `.github/workflows/build-mobile.yml`:

```yaml
name: Build Mobile Apps

on:
  workflow_dispatch:
    inputs:
      platform:
        description: 'Target platform'
        type: choice
        options: [ios, android, both]
        default: both

jobs:
  build-ios:
    if: inputs.platform == 'ios' || inputs.platform == 'both'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Build web assets
        run: pnpm --filter @neolith/web build

      - name: Sync Capacitor iOS
        run: |
          cd packages/@wundr/neolith/apps/mobile
          npx cap sync ios

      - name: Build iOS archive
        run: |
          cd packages/@wundr/neolith/apps/mobile/ios/App
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath $RUNNER_TEMP/Neolith.xcarchive \
            archive \
            CODE_SIGN_IDENTITY="${{ secrets.IOS_CODE_SIGN_IDENTITY }}" \
            PROVISIONING_PROFILE_SPECIFIER="${{ secrets.IOS_PROVISIONING_PROFILE }}" \
            DEVELOPMENT_TEAM="${{ secrets.APPLE_TEAM_ID }}"

      - name: Export IPA
        run: |
          xcodebuild -exportArchive \
            -archivePath $RUNNER_TEMP/Neolith.xcarchive \
            -exportPath $RUNNER_TEMP/export \
            -exportOptionsPlist packages/@wundr/neolith/apps/mobile/ios/ExportOptions.plist

      - name: Upload to App Store Connect
        if: github.ref == 'refs/heads/master'
        run: |
          xcrun altool --upload-app \
            --file $RUNNER_TEMP/export/App.ipa \
            --type ios \
            --apiKey ${{ secrets.APP_STORE_API_KEY }} \
            --apiIssuer ${{ secrets.APP_STORE_ISSUER_ID }}

      - uses: actions/upload-artifact@v4
        with:
          name: mobile-ios
          path: ${{ runner.temp }}/export/*.ipa

  build-android:
    if: inputs.platform == 'android' || inputs.platform == 'both'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - run: pnpm install --frozen-lockfile

      - name: Build web assets
        run: pnpm --filter @neolith/web build

      - name: Sync Capacitor Android
        run: |
          cd packages/@wundr/neolith/apps/mobile
          npx cap sync android

      - name: Decode keystore
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > \
            packages/@wundr/neolith/apps/mobile/android/neolith-release.keystore

      - name: Build release AAB
        run: |
          cd packages/@wundr/neolith/apps/mobile/android
          ./gradlew bundleRelease
        env:
          ANDROID_KEYSTORE_PATH: neolith-release.keystore
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}

      - uses: actions/upload-artifact@v4
        with:
          name: mobile-android
          path: packages/@wundr/neolith/apps/mobile/android/app/build/outputs/bundle/release/*.aab
```

---

## 6. Database Migrations

### Production Migration Workflow

```bash
# Preview pending migrations
cd packages/@wundr/neolith/packages/@neolith/database
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate status

# Apply migrations
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate deploy

# If schema changes are needed, create migration locally first:
npx prisma migrate dev --name describe_your_change

# Then deploy to production:
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate deploy
```

### Rollback Strategy

```bash
# List applied migrations
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate status

# To rollback, create a new migration that reverses the changes
npx prisma migrate dev --name rollback_previous_change

# Then deploy
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate deploy
```

---

## 7. DNS and Domain Configuration

### Required DNS Records

| Record Type | Host    | Value                                   | Purpose               |
| ----------- | ------- | --------------------------------------- | --------------------- |
| A           | @       | 75.2.60.5                               | Netlify load balancer |
| CNAME       | www     | neolith.netlify.app                     | Netlify redirect      |
| CNAME       | api     | orchestrator-daemon-prod.up.railway.app | Daemon API            |
| MX          | @       | (Resend/email provider records)         | Email                 |
| TXT         | @       | v=spf1 include:... ~all                 | Email auth            |
| TXT         | \_dmarc | v=DMARC1; p=quarantine; ...             | Email auth            |

### OAuth Callback URLs

Register these with each provider:

| Provider | Callback URL                                  |
| -------- | --------------------------------------------- |
| Google   | `https://neolith.ai/api/auth/callback/google` |
| GitHub   | `https://neolith.ai/api/auth/callback/github` |

---

## 8. Monitoring and Health Checks

### Endpoints

| Service   | Health Check URL                                 |
| --------- | ------------------------------------------------ |
| Web app   | `https://neolith.ai/api/health`                  |
| GraphQL   | `https://neolith.ai/api/graphql` (introspection) |
| Daemon    | `https://api.neolith.ai/health`                  |
| Daemon WS | `wss://api.neolith.ai` (WebSocket ping/pong)     |

### Recommended Monitoring

```bash
# Uptime monitoring (e.g., UptimeRobot, Checkly)
# Monitor these endpoints every 60 seconds:
# - https://neolith.ai/api/health         (expect 200)
# - https://api.neolith.ai/health         (expect {"status":"healthy"})

# Error tracking
# Set SENTRY_DSN in environment variables

# Log aggregation
# Railway provides built-in log streaming
railway logs --service orchestrator-daemon --follow
```

---

## 9. Secrets Checklist

All secrets that must be configured before deployment:

| Secret                        | Where Set      | How to Generate                   |
| ----------------------------- | -------------- | --------------------------------- |
| `AUTH_SECRET`                 | Netlify        | `openssl rand -base64 32`         |
| `DATABASE_URL`                | Netlify        | From Railway PostgreSQL           |
| `REDIS_URL`                   | Netlify        | From Railway Redis                |
| `GOOGLE_CLIENT_ID`            | Netlify        | Google Cloud Console              |
| `GOOGLE_CLIENT_SECRET`        | Netlify        | Google Cloud Console              |
| `GITHUB_CLIENT_ID`            | Netlify        | GitHub Developer Settings         |
| `GITHUB_CLIENT_SECRET`        | Netlify        | GitHub Developer Settings         |
| `ANTHROPIC_API_KEY`           | Netlify        | Anthropic Console                 |
| `OPENAI_API_KEY`              | Netlify        | OpenAI Dashboard                  |
| `MY_AWS_ACCESS_KEY_ID`        | Netlify        | AWS IAM                           |
| `MY_AWS_SECRET_ACCESS_KEY`    | Netlify        | AWS IAM                           |
| `RESEND_API_KEY`              | Netlify        | Resend Dashboard                  |
| `LIVEKIT_API_KEY`             | Netlify        | LiveKit Cloud                     |
| `LIVEKIT_API_SECRET`          | Netlify        | LiveKit Cloud                     |
| `VP_DAEMON_AUTH_KEY`          | Netlify + RW   | `openssl rand -base64 32`         |
| `DAEMON_JWT_SECRET`           | Railway        | `openssl rand -base64 32`         |
| `CSC_LINK` (macOS cert)       | GitHub Actions | Apple Developer Certificate       |
| `WIN_CSC_LINK` (Windows cert) | GitHub Actions | Windows code signing certificate  |
| `APPLE_ID`                    | GitHub Actions | Apple Developer account           |
| `APPLE_TEAM_ID`               | GitHub Actions | Apple Developer membership        |
| `ANDROID_KEYSTORE_BASE64`     | GitHub Actions | `base64 neolith-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD`   | GitHub Actions | Your keystore password            |
| `NETLIFY_AUTH_TOKEN`          | GitHub Actions | `netlify token:create`            |
| `NETLIFY_SITE_ID`             | GitHub Actions | `netlify sites:list`              |

---

## 10. Quick Deploy Commands

### Full Production Deploy (All Services)

```bash
# 1. Database migrations
cd packages/@wundr/neolith/packages/@neolith/database
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate deploy

# 2. Deploy daemon to Railway
cd packages/@wundr/orchestrator-daemon
railway up --service orchestrator-daemon

# 3. Deploy web to Netlify
cd /path/to/wundr
netlify deploy --prod

# 4. Verify
curl -s https://neolith.ai/api/health
curl -s https://api.neolith.ai/health
```

### Desktop Release

```bash
cd packages/@wundr/neolith/apps/desktop
GH_TOKEN="$GITHUB_TOKEN" npx electron-builder build --mac --win --linux --publish always
```

### Mobile Release

```bash
cd packages/@wundr/neolith/apps/mobile

# iOS
npx cap sync ios
cd ios/App && xcodebuild archive ...

# Android
npx cap sync android
cd android && ./gradlew bundleRelease
```
