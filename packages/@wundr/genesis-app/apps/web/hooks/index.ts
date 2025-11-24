export { useAuth } from "./use-auth";
export type { AuthUser, UseAuthReturn } from "./use-auth";

// VP hooks
export { useVP, useVPs, useVPMutations } from "./use-vp";

// Re-export from next-auth/react for convenience
export { signIn, signOut, useSession } from "next-auth/react";
