/**
 * NextAuth.js API Route Handler
 *
 * This file exports the GET and POST handlers for NextAuth.js v5.
 * All authentication routes are handled by /api/auth/*
 *
 * Routes handled:
 * - GET /api/auth/signin - Sign in page
 * - GET /api/auth/signout - Sign out page
 * - GET /api/auth/session - Get session
 * - GET /api/auth/csrf - Get CSRF token
 * - GET /api/auth/providers - List providers
 * - GET /api/auth/callback/:provider - OAuth callback
 * - POST /api/auth/signin/:provider - Sign in with provider
 * - POST /api/auth/signout - Sign out
 *
 * @module app/api/auth/[...nextauth]/route
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
