/**
 * Next.js Proxy for Authentication
 *
 * This proxy runs before every request to protected routes.
 * It uses NextAuth.js v5's auth() function to check authentication status
 * and redirects unauthenticated users to the login page.
 *
 * Route Protection Rules:
 * - Public routes: /, /api/health, /api/auth/*
 * - Auth routes: /login, /register, /auth/* (redirect to dashboard if logged in)
 * - Protected routes: Everything else (redirect to login if not logged in)
 *
 * @module proxy
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth.edge';

/**
 * List of routes that should be accessible without authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/api/health',
  '/api/graphql', // GraphQL has its own auth handling
];

/**
 * List of authentication-related routes
 * Users who are already logged in will be redirected away from these
 */
const AUTH_ROUTES = ['/login', '/register', '/auth/error', '/auth/verify'];

/**
 * List of API routes that should bypass proxy entirely
 * These are handled by their own authentication logic
 */
const API_ROUTES = ['/api/auth', '/api/health', '/api/graphql'];

/**
 * Check if a path matches any of the given route prefixes
 */
function matchesRoutes(pathname: string, routes: string[]): boolean {
  return routes.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * NextAuth.js v5 proxy with route protection
 *
 * This proxy:
 * 1. Allows all requests to public and API routes
 * 2. Redirects authenticated users away from auth pages
 * 3. Redirects unauthenticated users to login for protected routes
 */
export default auth(req => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Skip proxy for API routes that handle their own auth
  if (matchesRoutes(pathname, API_ROUTES)) {
    return NextResponse.next();
  }

  // Check if this is a public route
  const isPublicRoute = matchesRoutes(pathname, PUBLIC_ROUTES);

  // Check if this is an auth-related route (login, register, etc.)
  const isAuthRoute = matchesRoutes(pathname, AUTH_ROUTES);

  // Redirect authenticated users away from auth pages to dashboard
  if (isAuthRoute && isLoggedIn) {
    const dashboardUrl = new URL('/dashboard', req.nextUrl);
    return NextResponse.redirect(dashboardUrl);
  }

  // Allow access to public routes regardless of auth status
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL('/login', req.nextUrl);
    // Preserve the intended destination for redirect after login
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow the request to proceed
  return NextResponse.next();
});

/**
 * Proxy matcher configuration
 *
 * Excludes:
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico (favicon file)
 * - Public assets in /public folder
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images folder
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|images|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
