/**
 * @neolith/hooks/settings
 *
 * Settings state management hooks for the Neolith web app.
 * Provides comprehensive settings management with caching, sync,
 * validation, and optimistic updates.
 *
 * @module hooks/settings
 */

// Core settings hooks
export {
  useUserSettings,
  type UseUserSettingsOptions,
  type UseUserSettingsReturn,
} from './use-user-settings';

export {
  useSettingsUpdate,
  type UseSettingsUpdateOptions,
  type UseSettingsUpdateReturn,
} from './use-settings-update';

// Specialized settings hooks
export {
  useNotificationPreferences,
  type UseNotificationPreferencesReturn,
} from './use-notification-preferences';

export {
  useThemeSettings,
  type UseThemeSettingsReturn,
  type ResolvedTheme,
} from './use-theme-settings';

export {
  usePrivacySettings,
  type UsePrivacySettingsReturn,
} from './use-privacy-settings';

export {
  useAccessibilitySettings,
  type UseAccessibilitySettingsReturn,
} from './use-accessibility-settings';

export {
  useSecuritySettings,
  type UseSecuritySettingsReturn,
  type SessionInfo,
  type TwoFactorStatus,
  type SecuritySettings,
} from './use-security-settings';

export {
  useBillingInfo,
  type UseBillingInfoReturn,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type PaymentMethod,
  type Invoice,
  type SubscriptionInfo,
  type BillingInfo,
} from './use-billing-info';

// Utility hooks
export {
  useSettingsSync,
  type UseSettingsSyncOptions,
  type UseSettingsSyncReturn,
} from './use-settings-sync';

export {
  useSettingsValidation,
  type UseSettingsValidationOptions,
  type UseSettingsValidationReturn,
  type ValidationError,
  type ValidationResult,
} from './use-settings-validation';
