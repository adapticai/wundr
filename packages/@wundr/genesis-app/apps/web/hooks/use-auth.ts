"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useCallback } from "react";

/**
 * Extended user type with Genesis-specific fields
 * Matches the session user type from lib/auth.ts
 */
export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isVP: boolean;
  role?: "ADMIN" | "MEMBER" | "VIEWER";
}

export interface UseAuthReturn {
  /** The authenticated user, or undefined if not authenticated */
  user: AuthUser | undefined;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether the session is currently loading */
  isLoading: boolean;
  /** Whether the authenticated user is a VP (Virtual Person) agent */
  isVP: boolean;
  /** The user's role in the system */
  role: "ADMIN" | "MEMBER" | "VIEWER" | undefined;
  /** Function to trigger sign in */
  signIn: typeof signIn;
  /** Function to sign out and redirect to home */
  signOut: () => Promise<void>;
  /** The raw session data */
  session: ReturnType<typeof useSession>["data"];
  /** Update the session (refetch from server) */
  update: ReturnType<typeof useSession>["update"];
}

/**
 * Client-side authentication hook
 *
 * Provides access to the current user session and authentication functions.
 * Uses next-auth/react under the hood.
 *
 * @example
 * ```tsx
 * function ProfileButton() {
 *   const { user, isAuthenticated, signIn, signOut } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <button onClick={() => signIn()}>Sign In</button>;
 *   }
 *
 *   return (
 *     <div>
 *       <span>Welcome, {user?.name}</span>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const { data: session, status, update } = useSession();

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
  }, []);

  const user = session?.user as AuthUser | undefined;

  return {
    user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    isVP: user?.isVP ?? false,
    role: user?.role,
    signIn,
    signOut: handleSignOut,
    session,
    update,
  };
}
