/**
 * Edge-compatible Auth Export
 *
 * Re-exports the auth function from the main auth module for use in Edge Runtime
 * (middleware, proxy, etc.). The main auth.ts uses Prisma which is Node.js compatible.
 *
 * @module lib/auth.edge
 */

export { auth } from './auth';
