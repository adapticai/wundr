/**
 * NextAuth.js Type Declarations
 *
 * Extends the default NextAuth.js types with Genesis-specific fields.
 * This ensures type safety when accessing custom session properties.
 *
 * @module types/next-auth
 */

import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

/**
 * User role enumeration matching the database schema
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

declare module 'next-auth' {
  /**
   * Extended Session interface
   * Adds custom fields to the session object
   */
  interface Session {
    user: {
      /** The user's unique identifier */
      id: string;
      /** Whether the user is a VP (Virtual Person/AI Agent) */
      isVP: boolean;
      /** The user's role in the system */
      role: UserRole;
    } & DefaultSession['user'];
  }

  /**
   * Extended User interface
   * Matches the Prisma User model with auth-specific fields
   */
  interface User extends DefaultUser {
    /** Whether the user is a VP (Virtual Person/AI Agent) */
    isVP?: boolean;
    /** The user's role in the system */
    role?: UserRole;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT interface
   * Adds custom fields stored in the JWT token
   */
  interface JWT extends DefaultJWT {
    /** The user's unique identifier (sub claim) */
    id?: string;
    /** Whether the user is a VP (Virtual Person/AI Agent) */
    isVP?: boolean;
    /** The user's role in the system */
    role?: UserRole;
  }
}

/**
 * Extended Account type for custom provider data
 */
declare module 'next-auth' {
  interface Account {
    /** Provider-specific user ID */
    providerAccountId: string;
  }
}
