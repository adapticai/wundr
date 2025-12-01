/**
 * Test setup file for @neolith/web Next.js application.
 *
 * Configures:
 * - React Testing Library with Next.js support
 * - DOM matchers from @testing-library/jest-dom
 * - Next.js router mocks
 * - Environment setup
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: vi
    .fn()
    .mockImplementation(({ src, alt, width = 1, height = 1, ...props }) => {
      {
        /* eslint-disable-next-line @next/next/no-img-element */
      }
      return (
        <img src={src} alt={alt} width={width} height={height} {...props} />
      );
    }),
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: vi.fn().mockImplementation(({ children, href, ...props }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch for API testing
global.fetch = vi.fn();

// Environment variables for testing
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
