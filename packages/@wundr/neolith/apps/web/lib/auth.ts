/**
 * NextAuth.js v5 Authentication Configuration
 *
 * This module configures authentication for the Neolith App using NextAuth.js v5 (Auth.js).
 * It supports multiple authentication providers:
 * - GitHub OAuth for developer authentication
 * - Google OAuth for general user authentication
 * - Credentials-based authentication for email/password and Orchestrator service accounts
 *
 * @module lib/auth
 */


import { PrismaAdapter } from '@auth/prisma-adapter';
import { avatarService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import crypto from 'crypto';
import type { DefaultSession } from 'next-auth';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

/**
 * Extended session user type with Neolith-specific fields
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isVP: boolean;
      role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
    } & DefaultSession['user'];
  }

  interface User {
    isVP?: boolean;
    role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isVP?: boolean;
    role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
  }
}

/**
 * Verify a password against a stored hash using PBKDF2
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash in format "salt:hash"
 * @returns True if password matches, false otherwise
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      resolve(false);
      return;
    }

    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(hash === derivedKey.toString('hex'));
    });
  });
}

/**
 * NextAuth.js v5 configuration
 *
 * Exports the following utilities:
 * - handlers: GET and POST route handlers for /api/auth/*
 * - auth: Server-side session getter
 * - signIn: Server action for sign in
 * - signOut: Server action for sign out
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Use Prisma adapter for database user/account storage
  adapter: PrismaAdapter(prisma),

  // Use JWT strategy for session management (required for Credentials provider)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  // Enable cookies configuration for OAuth PKCE flow
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  // Configure authentication providers
  providers: [
    /**
     * GitHub OAuth Provider
     * Used for developer authentication and linking GitHub accounts
     */
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          isVP: false,
        };
      },
    }),

    /**
     * Google OAuth Provider
     * Used for general user authentication
     */
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          isVP: false,
        };
      },
    }),

    /**
     * Credentials Provider for Email/Password and OrchestratorService Accounts
     * Supports both regular user login and Orchestrator authentication
     */
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'user@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
        // VP-specific fields (optional)
        apiKey: {
          label: 'API Key',
          type: 'password',
          placeholder: 'VP API Key',
        },
        vpId: {
          label: 'VP ID',
          type: 'text',
          placeholder: 'VP Identifier',
        },
      },
      async authorize(credentials) {
        // Check if this is a Orchestrator authentication request
        if (credentials?.apiKey && credentials?.vpId) {
          try {
            // Look up Orchestrator by ID
            const orchestrator = await prisma.vP.findUnique({
              where: { id: credentials.vpId as string },
              include: { user: true },
            });

            if (!vp) {
              return null;
            }

            // Verify API key (stored in Orchestrator capabilities or config)
            // In production, this should be a secure comparison with hashed keys
            const vpConfig = vp.capabilities as { apiKey?: string } | null;
            if (!vpConfig || vpConfig.apiKey !== credentials.apiKey) {
              // For now, allow any Orchestrator to authenticate for development
              // TODO: Implement proper API key verification in production
              if (process.env.NODE_ENV !== 'development') {
                return null;
              }
            }

            // Return the VP's associated user
            return {
              id: vp.user.id,
              name: vp.user.name,
              email: vp.user.email,
              image: vp.user.avatarUrl,
              isVP: true,
              role: 'MEMBER' as const,
            };
          } catch (error) {
            console.error('VP authentication error:', error);
            return null;
          }
        }

        // Regular email/password authentication
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: {
              accounts: {
                where: {
                  provider: 'credentials',
                  type: 'credentials',
                },
              },
            },
          });

          if (!user || user.accounts.length === 0) {
            // User doesn't exist or doesn't have credentials account
            return null;
          }

          // Get the hashed password from the account's refreshToken field
          const credentialsAccount = user.accounts[0];
          const storedHash = credentialsAccount.refreshToken;

          if (!storedHash) {
            return null;
          }

          // Verify password using PBKDF2
          const isValid = await verifyPassword(
            credentials.password as string,
            storedHash,
          );

          if (!isValid) {
            return null;
          }

          // Check if user is active
          if (user.status !== 'ACTIVE') {
            return null;
          }

          // Return user object
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.avatarUrl,
            isVP: false,
            role: 'MEMBER' as const,
          };
        } catch (error) {
          console.error('Email/password authentication error:', error);
          return null;
        }
      },
    }),
  ],

  // Callback functions for customizing authentication behavior
  callbacks: {
    /**
     * JWT callback - called when JWT is created/updated
     * Adds custom fields to the token
     */
    async jwt({ token, user, account }) {
      // On initial sign in, add user data to token
      if (user) {
        token.isVP = user.isVP ?? false;
        token.role = user.role ?? 'MEMBER';
      }

      // For OAuth accounts, ensure isVP is false
      if (account && account.provider !== 'orchestrator-credentials') {
        token.isVP = false;
      }

      return token;
    },

    /**
     * Session callback - called when session is checked
     * Exposes custom fields from JWT to the client session
     */
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.isVP = token.isVP ?? false;
        session.user.role = token.role ?? 'MEMBER';
      }
      return session;
    },

    /**
     * SignIn callback - called when user signs in
     * Can be used to control who can sign in
     */
    async signIn({ user, account, profile: _profile }) {
      // Handle OAuth sign-ins
      if (account?.provider === 'github' || account?.provider === 'google') {
        // If user has an avatar from OAuth provider, download and store it
        if (user.id && user.image) {
          try {
            await avatarService.uploadOAuthAvatar({
              userId: user.id,
              providerAvatarUrl: user.image,
              provider: account.provider as 'google' | 'github',
            });
          } catch (error) {
            // Log error but don't block sign-in
            console.error('Failed to upload OAuth avatar:', error);

            // Generate fallback avatar with initials
            try {
              await avatarService.generateFallbackAvatar({
                name: user.name || user.email || 'User',
                userId: user.id,
              });
            } catch (fallbackError) {
              console.error('Failed to generate fallback avatar:', fallbackError);
            }
          }
        } else if (user.id && (user.name || user.email)) {
          // No avatar provided, generate fallback
          try {
            await avatarService.generateFallbackAvatar({
              name: user.name || user.email || 'User',
              userId: user.id,
            });
          } catch (error) {
            console.error('Failed to generate fallback avatar:', error);
          }
        }

        return true;
      }

      // For credentials provider (both email/password and VP)
      if (account?.provider === 'credentials') {
        // If user is a VP, check if Orchestrator exists and is active
        if (user.isVP && user.id) {
          try {
            const orchestrator = await prisma.vP.findFirst({
              where: {
                userId: user.id,
                status: { not: 'OFFLINE' },
              },
            });
            return !!vp;
          } catch {
            return false;
          }
        }
        // For regular email/password login, allow sign in
        return true;
      }

      return true;
    },

    /**
     * Redirect callback - customize redirect after sign in/out
     */
    async redirect({ url, baseUrl }) {
      // Redirect to the same origin
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Allow redirects to the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },

  // Custom pages for authentication flows
  pages: {
    signIn: '/login',
    error: '/auth/error',
    newUser: '/onboarding',
  },

  // Events for logging and analytics
  // eslint-disable-next-line no-console -- Intentional audit logging for authentication events
  events: {
    async signIn({ user, account }) {
      // eslint-disable-next-line no-console -- Intentional audit logging
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
    },
    async signOut() {
      // eslint-disable-next-line no-console -- Intentional audit logging
      console.log('User signed out');
    },
    async createUser({ user }) {
      // eslint-disable-next-line no-console -- Intentional audit logging
      console.log(`New user created: ${user.email}`);
    },
    async linkAccount({ user, account }) {
      // eslint-disable-next-line no-console -- Intentional audit logging
      console.log(`Account linked for ${user.email}: ${account.provider}`);
    },
  },

  // Enable debug logging in development
  debug: process.env.NODE_ENV === 'development',

  // Trust the host header for proxy configurations
  trustHost: true,
});

/**
 * Helper function to get the current session on the server
 * Use this in Server Components and Server Actions
 *
 * @example
 * ```tsx
 * import { getServerSession } from "@/lib/auth";
 *
 * export default async function ProtectedPage() {
 *   const session = await getServerSession();
 *   if (!session) {
 *     redirect("/login");
 *   }
 *   return <div>Welcome, {session.user.name}!</div>;
 * }
 * ```
 */
export const getServerSession = auth;

/**
 * Legacy session interface for backward compatibility
 * Use the NextAuth Session type for new code
 */
export interface LegacySession {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  expires: string;
}

/**
 * Helper to get current user from session
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return session !== null;
}
