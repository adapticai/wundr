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

// Re-export from next-auth/react for convenience
export { signIn, signOut, useSession } from "next-auth/react";
