export { useAuth } from "./use-auth";
export type { AuthUser, UseAuthReturn } from "./use-auth";

// VP hooks
export { useVP, useVPs, useVPMutations } from "./use-vp";

// Chat hooks
export {
  useMessages,
  useThread,
  useSendMessage,
  useReactions,
  useTypingIndicator,
  useChannel,
  useMentionSuggestions,
} from "./use-chat";

// Upload hooks
export { useFileUpload, useSignedUpload, useChannelFiles } from "./use-upload";

// Call hooks
export { useCall, useLocalMedia, useHuddle, useCallDuration } from "./use-call";

// Notification hooks
export {
  useNotifications,
  usePushNotifications,
  useOfflineStatus,
  useNotificationSettings,
} from "./use-notifications";

// Analytics hooks
export { useAnalytics, useMetrics, useRealTimeStats } from "./use-analytics";

// Integration hooks
export {
  useIntegrations,
  useIntegration,
  useIntegrationMutations,
  useWebhooks,
  useWebhook,
  useWebhookDeliveries,
} from "./use-integrations";

// Re-export from next-auth/react for convenience
export { signIn, signOut, useSession } from "next-auth/react";
