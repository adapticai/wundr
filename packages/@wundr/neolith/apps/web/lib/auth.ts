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

import crypto from 'crypto';

import { avatarService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

import { CustomPrismaAdapter } from './prisma-adapter';

import type { DefaultSession } from 'next-auth';

/**
 * Check if OAuth providers are configured
 * Returns which providers are available based on environment variables
 */
function getConfiguredProviders() {
  const github = !!(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );
  const google = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  // Log which providers are available (helpful for debugging deployments)
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `Auth providers configured: GitHub=${github}, Google=${google}`,
    );
  }

  return { github, google };
}

const configuredProviders = getConfiguredProviders();

/**
 * Email verification configuration
 */
const EMAIL_VERIFICATION_REQUIRED =
  process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

/**
 * Extended session user type with Neolith-specific fields
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isOrchestrator: boolean;
      role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
      emailVerified?: Date | null;
    } & DefaultSession['user'];
  }

  interface User {
    isOrchestrator?: boolean;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isOrchestrator?: boolean;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  }
}

/**
 * Verify a password against a stored hash using PBKDF2
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash in format "salt:hash"
 * @returns True if password matches, false otherwise
 */
async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  return new Promise(resolve => {
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
 * Securely verify API key using constant-time comparison
 * @param providedKey - API key provided by the client
 * @param storedHash - Stored hash of the API key in format "salt:hash"
 * @returns True if API key matches, false otherwise
 */
async function verifyApiKey(
  providedKey: string,
  storedHash: string,
): Promise<boolean> {
  return new Promise(resolve => {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      resolve(false);
      return;
    }

    crypto.pbkdf2(
      providedKey,
      salt,
      100000,
      64,
      'sha512',
      (err, derivedKey) => {
        if (err) {
          resolve(false);
          return;
        }
        // Use timingSafeEqual for constant-time comparison to prevent timing attacks
        try {
          const hashBuffer = Buffer.from(hash, 'hex');
          const derivedBuffer = derivedKey;
          if (hashBuffer.length !== derivedBuffer.length) {
            resolve(false);
            return;
          }
          resolve(crypto.timingSafeEqual(hashBuffer, derivedBuffer));
        } catch {
          resolve(false);
        }
      },
    );
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
  // Use custom Prisma adapter for database user/account storage
  // Custom adapter handles snake_case to camelCase field mapping for OAuth accounts
  adapter: CustomPrismaAdapter(prisma),

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
  // Only include OAuth providers when their environment variables are configured
  providers: [
    // GitHub OAuth Provider (only if configured)
    ...(configuredProviders.github
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
            profile(profile) {
              return {
                id: profile.id.toString(),
                name: profile.name ?? profile.login,
                email: profile.email,
                image: profile.avatar_url,
                isOrchestrator: false,
              };
            },
          }),
        ]
      : []),

    // Google OAuth Provider (only if configured)
    ...(configuredProviders.google
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
            profile(profile) {
              return {
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                image: profile.picture,
                isOrchestrator: false,
              };
            },
          }),
        ]
      : []),

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
        // Orchestrator-specific fields (optional)
        apiKey: {
          label: 'API Key',
          type: 'password',
          placeholder: 'Orchestrator API Key',
        },
        orchestratorId: {
          label: 'Orchestrator ID',
          type: 'text',
          placeholder: 'Orchestrator Identifier',
        },
      },
      async authorize(credentials) {
        // Check if this is a Orchestrator authentication request
        if (credentials?.apiKey && credentials?.orchestratorId) {
          try {
            // Validate input types
            const orchestratorId = String(credentials.orchestratorId).trim();
            const apiKey = String(credentials.apiKey).trim();

            if (!orchestratorId || !apiKey) {
              return null;
            }

            // Look up Orchestrator by ID
            const orchestrator = await prisma.orchestrator.findUnique({
              where: { id: orchestratorId },
              include: { user: true },
            });

            if (!orchestrator) {
              return null;
            }

            // Verify API key using secure comparison
            // API key hash should be stored in orchestrator.capabilities.apiKeyHash
            const orchestratorConfig = orchestrator.capabilities as {
              apiKeyHash?: string;
            } | null;

            if (!orchestratorConfig?.apiKeyHash) {
              // No API key hash configured for this orchestrator
              if (process.env.NODE_ENV === 'development') {
                console.error(
                  'Orchestrator authentication failed: No API key hash configured',
                  {
                    orchestratorId,
                  },
                );
              } else {
                console.error(
                  'Orchestrator authentication failed: Configuration error',
                );
              }
              return null;
            }

            // Verify API key using constant-time comparison to prevent timing attacks
            const isValidKey = await verifyApiKey(
              apiKey,
              orchestratorConfig.apiKeyHash,
            );

            if (!isValidKey) {
              if (process.env.NODE_ENV === 'development') {
                console.error(
                  'Orchestrator authentication failed: Invalid API key',
                  {
                    orchestratorId,
                  },
                );
              } else {
                console.error('Orchestrator authentication failed');
              }
              return null;
            }

            // Check orchestrator status
            if (orchestrator.status === 'OFFLINE') {
              if (process.env.NODE_ENV === 'development') {
                console.error(
                  'Orchestrator authentication failed: Orchestrator is offline',
                  {
                    orchestratorId,
                  },
                );
              } else {
                console.error(
                  'Orchestrator authentication failed: Service unavailable',
                );
              }
              return null;
            }

            // Return the Orchestrator's associated user
            return {
              id: orchestrator.user.id,
              name: orchestrator.user.name,
              email: orchestrator.user.email,
              image: orchestrator.user.avatarUrl,
              isOrchestrator: true,
              role: 'MEMBER' as const,
            };
          } catch (error: unknown) {
            // Only log detailed errors in development
            if (process.env.NODE_ENV === 'development') {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              console.error('Orchestrator authentication error:', {
                error: errorMessage,
                orchestratorId: credentials.orchestratorId,
              });
            } else {
              console.error('Orchestrator authentication error');
            }
            return null;
          }
        }

        // Regular email/password authentication
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Validate and sanitize input
          const email = String(credentials.email).trim().toLowerCase();
          const password = String(credentials.password);

          if (!email || !password || password.length === 0) {
            return null;
          }

          // Basic email format validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            return null;
          }

          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email },
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

          // Verify password using PBKDF2 with constant-time comparison
          const isValid = await verifyPassword(password, storedHash);

          if (!isValid) {
            return null;
          }

          // Check if user is active
          if (user.status !== 'ACTIVE') {
            return null;
          }

          // Check email verification if required
          if (EMAIL_VERIFICATION_REQUIRED && !user.emailVerified) {
            // User needs to verify their email before logging in
            if (process.env.NODE_ENV === 'development') {
              console.error('Login failed: Email not verified', {
                email: user.email,
              });
            } else {
              console.error('Login failed: Email verification required');
            }
            return null;
          }

          // Return user object
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.avatarUrl,
            isOrchestrator: false,
            role: 'MEMBER' as const,
          };
        } catch (error: unknown) {
          // Only log detailed errors in development
          if (process.env.NODE_ENV === 'development') {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            console.error('Email/password authentication error:', {
              error: errorMessage,
              email: credentials.email,
            });
          } else {
            console.error('Email/password authentication error');
          }
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
        token.isOrchestrator = user.isOrchestrator ?? false;
        token.role = user.role ?? 'MEMBER';
      }

      // For OAuth accounts, ensure isOrchestrator is false
      if (account && account.provider !== 'orchestrator-credentials') {
        token.isOrchestrator = false;
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
        session.user.isOrchestrator = Boolean(token.isOrchestrator ?? false);
        session.user.role =
          (token.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST') ?? 'MEMBER';

        // Fetch the user's avatar and email verification status from the database
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { avatarUrl: true, emailVerified: true },
          });
          if (dbUser?.avatarUrl) {
            session.user.image = dbUser.avatarUrl;
          }
          session.user.emailVerified = dbUser?.emailVerified ?? null;
        } catch (error: unknown) {
          // Don't block session creation on avatar fetch failure
          if (process.env.NODE_ENV === 'development') {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to fetch user avatar:', {
              error: errorMessage,
              userId: token.sub,
            });
          } else {
            console.error('Failed to fetch user avatar');
          }
        }
      }
      return session;
    },

    /**
     * SignIn callback - called when user signs in
     * Can be used to control who can sign in
     *
     * For OAuth providers, checks if existing users have an S3 avatar.
     * If not, uploads their provider avatar to S3.
     */
    async signIn({ user, account, profile }) {
      // For OAuth providers, check and upload avatar for existing users
      if (account?.provider === 'github' || account?.provider === 'google') {
        // Get the provider's avatar URL
        const providerAvatarUrl =
          account.provider === 'github'
            ? (profile as { avatar_url?: string })?.avatar_url
            : (profile as { picture?: string })?.picture;

        if (user.id && providerAvatarUrl) {
          try {
            // Check if user already has an S3 avatar
            const existingUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { avatarUrl: true },
            });

            // If no S3 avatar (avatarUrl is null or doesn't contain 'avatars/'), upload the provider avatar
            const hasS3Avatar = existingUser?.avatarUrl?.includes('avatars/');

            if (!hasS3Avatar) {
              await avatarService.uploadOAuthAvatar({
                userId: user.id,
                providerAvatarUrl,
                provider: account.provider as 'google' | 'github',
              });
              console.log(
                `Uploaded OAuth avatar for existing user ${user.id} from ${account.provider}`,
              );
            }
          } catch (error: unknown) {
            // Log error but don't block sign in
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            console.error(
              `Failed to upload OAuth avatar for user ${user.id}:`,
              errorMessage,
            );
          }
        }
        return true;
      }

      // For credentials provider (both email/password and Orchestrator)
      if (account?.provider === 'credentials') {
        // If user is an Orchestrator, check if Orchestrator exists and is active
        if (user.isOrchestrator && user.id) {
          try {
            const orchestrator = await prisma.orchestrator.findFirst({
              where: {
                userId: user.id,
                status: { not: 'OFFLINE' },
              },
            });
            return !!orchestrator;
          } catch (error: unknown) {
            if (process.env.NODE_ENV === 'development') {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              console.error(
                'Failed to verify orchestrator status during sign-in:',
                { error: errorMessage, userId: user.id },
              );
            } else {
              console.error(
                'Failed to verify orchestrator status during sign-in',
              );
            }
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
    /**
     * Called when a new user is created in the database.
     * This is the correct place to handle OAuth avatar uploads because
     * at this point user.id is guaranteed to be our database ID.
     */
    async createUser({ user }) {
      // eslint-disable-next-line no-console -- Intentional audit logging
      console.log(`New user created: ${user.email}`);

      // Handle OAuth avatar for new users
      // The user.image contains the OAuth provider's avatar URL
      if (user.id && user.image) {
        try {
          await avatarService.uploadOAuthAvatar({
            userId: user.id,
            providerAvatarUrl: user.image,
            // Determine provider from the image URL
            provider: user.image.includes('googleusercontent')
              ? 'google'
              : 'github',
          });
          console.log(`Successfully uploaded OAuth avatar for user ${user.id}`);
        } catch (error: unknown) {
          // Log error but don't fail user creation
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(
            `Failed to upload OAuth avatar for new user ${user.id}:`,
            errorMessage,
          );

          // Generate fallback avatar if OAuth avatar fails
          try {
            await avatarService.generateFallbackAvatar({
              name: user.name || user.email || 'User',
              userId: user.id,
            });
            console.log(`Generated fallback avatar for user ${user.id}`);
          } catch (fallbackError: unknown) {
            const fallbackErrMessage =
              fallbackError instanceof Error
                ? fallbackError.message
                : 'Unknown error';
            console.error(
              `Failed to generate fallback avatar for user ${user.id}:`,
              fallbackErrMessage,
            );
          }
        }
      } else if (user.id && (user.name || user.email)) {
        // No OAuth avatar provided, generate fallback
        try {
          await avatarService.generateFallbackAvatar({
            name: user.name || user.email || 'User',
            userId: user.id,
          });
          console.log(`Generated fallback avatar for new user ${user.id}`);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(
            `Failed to generate fallback avatar for user ${user.id}:`,
            errorMessage,
          );
        }
      }
    },
    /**
     * Called when an OAuth account is linked to an existing user.
     * Updates avatar if the user doesn't have one in S3.
     */
    async linkAccount({ user, account }) {
      // eslint-disable-next-line no-console -- Intentional audit logging
      console.log(`Account linked for ${user.email}: ${account.provider}`);

      // Only process OAuth providers
      if (account.provider !== 'github' && account.provider !== 'google') {
        return;
      }

      // Check if user already has an S3 avatar
      if (user.id) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { avatarUrl: true },
          });

          const hasS3Avatar = existingUser?.avatarUrl?.includes('avatars/');

          // If no S3 avatar but has OAuth image, upload it
          if (!hasS3Avatar && user.image) {
            await avatarService.uploadOAuthAvatar({
              userId: user.id,
              providerAvatarUrl: user.image,
              provider: account.provider as 'google' | 'github',
            });
            console.log(
              `Uploaded OAuth avatar from linked ${account.provider} account for user ${user.id}`,
            );
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(
            'Failed to upload avatar for linked account:',
            errorMessage,
          );
        }
      }
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
