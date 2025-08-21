/**
 * Profile personalization utilities for customizing user development environment
 */

export { ProfilePersonalizerSimple as ProfilePersonalizer } from './profile-personalizer-simple';
export { WallpaperGenerator } from './wallpaper-generator';
export { SlackIntegration } from './slack-integration';
export type { GmailIntegration } from './gmail-integration';
export { GmailIntegrationService } from './gmail-integration';
export { MacPersonalizer } from './mac-personalizer';

// Type exports
export type { ProfileConfig, ProfilePhoto } from './profile-personalizer';
export type { WallpaperConfig } from './wallpaper-generator';
export type { SlackProfileData } from './slack-integration';
// Note: Gmail types not yet fully implemented
export type { DockApp, HotCorner } from './mac-personalizer';