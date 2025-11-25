# Genesis Mobile App

Cross-platform mobile application for Genesis using Capacitor.

## Prerequisites

### iOS Development

- macOS with Xcode 15+ installed
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer account (for device testing and App Store deployment)

### Android Development

- Android Studio (latest stable version)
- Android SDK (API Level 33+)
- Java Development Kit (JDK 17+)
- Android SDK Build-Tools and Platform-Tools

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Web App

Ensure the web app is built first:

```bash
cd ../web
npm run build
cd ../mobile
```

### 3. Add Native Platforms

#### iOS

```bash
npm run add:ios
```

#### Android

```bash
npm run add:android
```

### 4. Sync Web Assets

After any web app changes:

```bash
npm run sync
```

## iOS Development

### Open in Xcode

```bash
npm run open:ios
```

### Run on iOS Simulator/Device

```bash
npm run run:ios
```

### iOS Configuration

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select your development team in Signing & Capabilities
3. Update bundle identifier if needed (com.wundr.genesis)
4. Configure push notification capabilities
5. Add required privacy descriptions in Info.plist

### Push Notifications (iOS)

1. Enable Push Notifications capability in Xcode
2. Create APNs certificates in Apple Developer Portal
3. Configure push notification service with APNs credentials

## Android Development

### Open in Android Studio

```bash
npm run open:android
```

### Run on Android Emulator/Device

```bash
npm run run:android
```

### Android Configuration

1. Open `android/` folder in Android Studio
2. Update `applicationId` in `android/app/build.gradle` if needed
3. Configure signing config for release builds
4. Add Firebase configuration for push notifications

### Push Notifications (Android)

1. Create Firebase project at https://console.firebase.google.com
2. Add Android app with package name `com.wundr.genesis`
3. Download `google-services.json` to `android/app/`
4. Enable Cloud Messaging in Firebase Console

## Development Workflow

### Live Reload (Development)

For development with live reload, update `capacitor.config.ts`:

```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:5173',
  cleartext: true,
}
```

Then run your web dev server and the mobile app will connect to it.

### Production Build

1. Build the web app for production:

   ```bash
   cd ../web && npm run build
   ```

2. Sync with native projects:

   ```bash
   npm run sync
   ```

3. Build native apps through Xcode/Android Studio

## Building for Release

### iOS App Store

1. Archive the app in Xcode (Product > Archive)
2. Validate and upload to App Store Connect
3. Complete app metadata in App Store Connect
4. Submit for review

### Google Play Store

1. Generate signed APK/AAB in Android Studio
2. Create app listing in Google Play Console
3. Upload signed release build
4. Complete store listing and submit for review

## Troubleshooting

### iOS Issues

- **Pod install fails**: Run `cd ios/App && pod install --repo-update`
- **Build errors**: Clean build folder (Cmd+Shift+K) and rebuild
- **Simulator issues**: Reset simulator (Device > Erase All Content and Settings)

### Android Issues

- **Gradle sync fails**: File > Sync Project with Gradle Files
- **Build errors**: Clean project (Build > Clean Project) and rebuild
- **Emulator issues**: Wipe data in AVD Manager

### General Issues

- **Web assets not updating**: Run `npm run sync` after web changes
- **Plugin not working**: Check native project configuration
- **Network issues**: Verify server URL and cleartext settings
