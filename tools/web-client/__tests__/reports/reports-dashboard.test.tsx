import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';

// Mock the reports hook
jest.mock('@/hooks/reports/use-reports', () => ({
  useReports: () => ({
    reports: [
      {
        id: '1',
        name: 'Test Migration Report',
        type: 'migration-analysis',
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        createdBy: 'test@example.com',
        tags: ['test'],
        metadata: {
          parameters: {},
          outputFormat: ['pdf'],
        },
        size: 1024000,
        duration: 300,
      },
    ],
    templates: [],
    schedules: [],
    stats: {
      totalReports: 1,
      runningReports: 0,
      scheduledReports: 0,
      recentActivity: [],
      popularTemplates: [],
    },
    loading: false,
    error: null,
    generateReport: jest.fn(),
    exportReport: jest.fn(),
    deleteReport: jest.fn(),
    scheduleReport: jest.fn(),
    getHistoricalReports: jest.fn(),
  }),
}));

describe('ReportsDashboard', () => {
  it('renders the dashboard with reports', async () => {
    render(<ReportsDashboard />);
    
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Generate, schedule, and manage migration reports')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Migration Report')).toBeInTheDocument();
    });
  });

  it('allows searching reports', async () => {
    const user = userEvent.setup();
    render(<ReportsDashboard />);
    
    const searchInput = screen.getByPlaceholderText('Search reports...');
    await user.type(searchInput, 'Test');
    
    expect(searchInput).toHaveValue('Test');
  });

  it('shows stats cards', async () => {
    render(<ReportsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Reports')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
    });
  });
});