/**
 * Custom Prisma Adapter for NextAuth.js v5
 *
 * This adapter handles the field mapping between Auth.js (which uses snake_case)
 * and our Prisma schema (which uses camelCase with @map directives).
 *
 * The standard @auth/prisma-adapter doesn't properly handle custom field mappings,
 * so we need to transform the OAuth account data before inserting.
 */

import type { PrismaClient } from '@neolith/database';
import type { Adapter, AdapterAccount } from 'next-auth/adapters';

/**
 * Custom Prisma adapter that properly maps OAuth account fields
 */
export function CustomPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    async createUser(data) {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          avatarUrl: data.image,
          emailVerified: data.emailVerified,
          status: 'ACTIVE',
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: user.emailVerified,
      };
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: user.emailVerified,
      };
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: user.emailVerified,
      };
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const account = await prisma.account.findFirst({
        where: {
          provider,
          providerAccountId,
        },
        include: { user: true },
      });
      if (!account?.user) {
        return null;
      }
      return {
        id: account.user.id,
        email: account.user.email,
        name: account.user.name,
        image: account.user.avatarUrl,
        emailVerified: account.user.emailVerified,
      };
    },

    async updateUser(data) {
      const user = await prisma.user.update({
        where: { id: data.id },
        data: {
          email: data.email,
          name: data.name,
          avatarUrl: data.image,
          emailVerified: data.emailVerified,
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: user.emailVerified,
      };
    },

    async deleteUser(userId) {
      await prisma.user.delete({ where: { id: userId } });
    },

    /**
     * Link an OAuth account to a user
     * This is where we need to transform snake_case to camelCase
     */
    async linkAccount(
      data: AdapterAccount,
    ): Promise<AdapterAccount | null | undefined> {
      // Transform snake_case fields from Auth.js to camelCase for Prisma
      await prisma.account.create({
        data: {
          userId: data.userId,
          type: data.type,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          // Map snake_case OAuth fields to camelCase Prisma fields
          refreshToken: data.refresh_token ?? null,
          accessToken: data.access_token ?? null,
          expiresAt: data.expires_at ?? null,
          tokenType: data.token_type ?? null,
          scope: data.scope ?? null,
          idToken: data.id_token ?? null,
          sessionState: (data.session_state as string) ?? null,
        },
      });
      return data;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await prisma.account.deleteMany({
        where: { provider, providerAccountId },
      });
    },

    async createSession(data) {
      const session = await prisma.session.create({
        data: {
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires,
        },
      });
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!session) {
        return null;
      }
      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.avatarUrl,
          emailVerified: session.user.emailVerified,
        },
      };
    },

    async updateSession(data) {
      const session = await prisma.session.update({
        where: { sessionToken: data.sessionToken },
        data: {
          expires: data.expires,
          userId: data.userId,
        },
      });
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({ where: { sessionToken } });
    },

    async createVerificationToken(data) {
      const token = await prisma.verificationToken.create({
        data: {
          identifier: data.identifier,
          token: data.token,
          expires: data.expires,
        },
      });
      return {
        identifier: token.identifier,
        token: token.token,
        expires: token.expires,
      };
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const verificationToken = await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
        return {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
          expires: verificationToken.expires,
        };
      } catch {
        return null;
      }
    },

    async getAccount(providerAccountId, provider) {
      const account = await prisma.account.findFirst({
        where: { provider, providerAccountId },
      });
      if (!account) {
        return null;
      }
      return {
        userId: account.userId,
        type: account.type as AdapterAccount['type'],
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refreshToken ?? undefined,
        access_token: account.accessToken ?? undefined,
        expires_at: account.expiresAt ?? undefined,
        token_type: account.tokenType ?? undefined,
        scope: account.scope ?? undefined,
        id_token: account.idToken ?? undefined,
        session_state: account.sessionState ?? undefined,
      };
    },
  } as Adapter;
}
