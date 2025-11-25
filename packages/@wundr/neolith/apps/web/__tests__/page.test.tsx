/**
 * Home Page Tests
 *
 * Sample test file demonstrating Next.js page testing with:
 * - Component rendering
 * - Navigation testing
 * - Accessibility checks
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Mock the page component since we need to test it
// In a real scenario, you would import the actual page
const HomePage = () => {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center'>
      <h1>Welcome to Genesis App</h1>
      <p>AI-powered organizational structure generation platform</p>
      <nav>
        <a href='/dashboard'>Go to Dashboard</a>
        <a href='/auth/login'>Sign In</a>
      </nav>
    </main>
  );
};

describe('Home Page', () => {
  describe('Rendering', () => {
    it('should render the main heading', () => {
      render(<HomePage />);

      expect(
        screen.getByRole('heading', { name: /welcome to genesis app/i }),
      ).toBeInTheDocument();
    });

    it('should render the description', () => {
      render(<HomePage />);

      expect(
        screen.getByText(
          /ai-powered organizational structure generation platform/i,
        ),
      ).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      render(<HomePage />);

      expect(
        screen.getByRole('link', { name: /go to dashboard/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /sign in/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have correct dashboard link', () => {
      render(<HomePage />);

      const dashboardLink = screen.getByRole('link', {
        name: /go to dashboard/i,
      });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('should have correct sign in link', () => {
      render(<HomePage />);

      const signInLink = screen.getByRole('link', { name: /sign in/i });
      expect(signInLink).toHaveAttribute('href', '/auth/login');
    });
  });

  describe('Accessibility', () => {
    it('should have a main landmark', () => {
      render(<HomePage />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should have a navigation region', () => {
      render(<HomePage />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<HomePage />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      expect(headings[0].tagName).toBe('H1');
    });
  });

  describe('Responsiveness', () => {
    it('should have responsive classes applied', () => {
      render(<HomePage />);

      const main = screen.getByRole('main');
      expect(main).toHaveClass('min-h-screen');
    });
  });
});

describe('Page Integration', () => {
  it('should render without errors', () => {
    expect(() => render(<HomePage />)).not.toThrow();
  });

  it('should be a valid React component', () => {
    const { container } = render(<HomePage />);
    expect(container.firstChild).toBeTruthy();
  });
});
