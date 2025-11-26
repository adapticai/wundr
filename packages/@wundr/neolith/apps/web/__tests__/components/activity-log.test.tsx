/**
 * Activity Log Component Tests
 *
 * Tests for the ActivityLog component to ensure:
 * - Renders activity items from API
 * - Proper icons for different activity types
 * - Time formatting (relative times with proper singular/plural)
 * - Actor linking
 * - Infinite scroll and pagination
 * - Loading and empty states
 * - Error handling
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ActivityLog } from '@/components/admin/activity-log';

// Mock fetch
global.fetch = jest.fn();

const mockActivities = {
  actions: [
    {
      id: '1',
      action: 'Created workspace member',
      actorId: 'user-1',
      actor: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://example.com/avatar.jpg',
      },
      targetType: 'member',
      targetId: 'member-1',
      targetName: 'Jane Smith',
      metadata: { role: 'admin' },
      ipAddress: '192.168.1.1',
      createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    },
    {
      id: '2',
      action: 'Updated workspace settings',
      actorId: 'user-2',
      actor: {
        id: 'user-2',
        name: 'Alice Johnson',
        email: 'alice@example.com',
      },
      targetType: 'settings',
      targetId: 'settings-1',
      targetName: 'General Settings',
      metadata: {},
      createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    },
  ],
  total: 2,
};

describe('ActivityLog', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders activity items from API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockActivities,
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('displays proper icons for different activity types', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockActivities,
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      // Check for icons by color classes
      const createIcon = screen.getByText('John Doe').closest('.space-y-3')?.querySelector('.bg-emerald-500');
      const updateIcon = screen.getByText('Alice Johnson').closest('.space-y-3')?.querySelector('.bg-stone-500');

      expect(createIcon).toBeInTheDocument();
      expect(updateIcon).toBeInTheDocument();
    });
  });

  it('formats time correctly with singular/plural', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockActivities,
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('1 minute ago')).toBeInTheDocument(); // Singular
      expect(screen.getByText('2 hours ago')).toBeInTheDocument(); // Plural
    });
  });

  it('creates clickable links for actors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockActivities,
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      const actorLink = screen.getByText('John Doe');
      expect(actorLink.tagName).toBe('A');
      expect(actorLink).toHaveAttribute('href', '/workspaces/workspace-1/members/user-1');
    });
  });

  it('shows loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ActivityLog workspaceId="workspace-1" />);

    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loading spinner
  });

  it('shows empty state when no activities', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ actions: [], total: 0 }),
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('No activity recorded')).toBeInTheDocument();
    });
  });

  it('shows error state and retry button on fetch failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Error loading activities')).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries fetch when retry button is clicked', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivities,
      });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Error loading activities')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('supports infinite scroll mode', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockActivities, total: 50 }),
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const infiniteScrollButton = screen.getByText('Use Infinite Scroll');
    fireEvent.click(infiniteScrollButton);

    await waitFor(() => {
      expect(screen.getByText('Load More')).toBeInTheDocument();
    });
  });

  it('supports pagination mode', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockActivities, total: 50 }),
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of/i)).toBeInTheDocument();
    });
  });

  it('filters activities by action type', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockActivities,
    });

    render(<ActivityLog workspaceId="workspace-1" />);

    await waitFor(() => {
      const filterSelect = screen.getByRole('combobox', { name: /all actions/i });
      expect(filterSelect).toBeInTheDocument();
    });
  });
});
