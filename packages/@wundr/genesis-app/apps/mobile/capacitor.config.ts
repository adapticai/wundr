import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wundr.genesis',
  appName: 'Genesis',
  webDir: '../web/dist',
  server: {
    // For development, uncomment the following to connect to local dev server
    // url: 'http://localhost:5173',
    // cleartext: true,
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Genesis',
    backgroundColor: '#ffffff',
    allowsLinkPreview: true,
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Preferences: {
      // Preferences plugin configuration (uses defaults)
    },
    App: {
      // App plugin configuration (uses defaults)
    },
  },
};

export default config;
