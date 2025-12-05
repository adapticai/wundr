import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WorkflowDebugger } from '@/components/workflows/workflow-debugger';

import type { Workflow } from '@/types/workflow';

describe('WorkflowDebugger', () => {
  const mockWorkflow: Workflow = {
    id: 'workflow-1' as any,
    name: 'Test Workflow',
    description: 'A test workflow for debugging',
    status: 'draft',
    workspaceId: 'workspace-1',
    trigger: {
      type: 'message',
      message: {
        channelIds: ['channel-1'],
      },
    },
    actions: [
      {
        id: 'action-1' as any,
        type: 'send_message',
        order: 0,
        config: {
          channelId: 'channel-1',
          message: 'Hello {{trigger.message.content}}',
        },
      },
      {
        id: 'action-2' as any,
        type: 'http_request',
        order: 1,
        config: {
          url: 'https://api.example.com/webhook',
          method: 'POST',
          body: '{"data": "{{trigger.message.content}}"}',
        },
      },
      {
        id: 'action-3' as any,
        type: 'wait',
        order: 2,
        config: {
          duration: 5,
          unit: 'seconds',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    runCount: 0,
    errorCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test Mode Toggle', () => {
    it('should render with test mode disabled by default', () => {
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      expect(screen.getByText('Debug Mode')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
      expect(
        screen.getByText('Enable Debug Mode to start testing'),
      ).toBeInTheDocument();
    });

    it('should enable test mode when toggled', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('Test Data')).toBeInTheDocument();
      expect(screen.getByText('Mock External Services')).toBeInTheDocument();
      expect(screen.getByText('Controls')).toBeInTheDocument();
    });

    it('should show all debugging panels when enabled', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      // Check left panel
      expect(screen.getByText('Test Data')).toBeInTheDocument();
      expect(screen.getByText('Mock External Services')).toBeInTheDocument();
      expect(screen.getByText('Controls')).toBeInTheDocument();

      // Check center panel
      expect(screen.getByText('Execution Flow')).toBeInTheDocument();

      // Check right panel
      expect(screen.getByText('Variable Inspector')).toBeInTheDocument();
      expect(screen.getByText('Execution Logs')).toBeInTheDocument();
    });
  });

  describe('Test Data Input', () => {
    it('should initialize with default trigger data', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(expect.stringContaining('message'));
      expect(textarea).toHaveValue(expect.stringContaining('content'));
    });

    it('should validate JSON input', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Clear and set invalid JSON
      await user.clear(textarea);
      await user.click(textarea);
      await user.paste('invalid json');

      // Trigger blur to validate
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/Invalid JSON|Unexpected token/i)).toBeInTheDocument();
      });
    });

    it('should clear error on valid JSON', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Set invalid JSON first
      await user.clear(textarea);
      await user.click(textarea);
      await user.paste('invalid json');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/Invalid JSON|Unexpected token/i)).toBeInTheDocument();
      });

      // Now set valid JSON
      await user.clear(textarea);
      await user.click(textarea);
      await user.paste('{"valid": true}');
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByText(/Invalid JSON|Unexpected token/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Mock Services', () => {
    it('should display all mock services', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(screen.getByText('HTTP Requests')).toBeInTheDocument();
      expect(screen.getByText('Channel Operations')).toBeInTheDocument();
      expect(screen.getByText('Message Operations')).toBeInTheDocument();
    });

    it('should toggle mock services on and off', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const switches = screen.getAllByRole('switch');
      const httpMockSwitch = switches.find(
        s => s.closest('div')?.textContent?.includes('HTTP Requests'),
      );

      expect(httpMockSwitch).toBeDefined();
      if (httpMockSwitch) {
        expect(httpMockSwitch).not.toBeChecked();
        await user.click(httpMockSwitch);
        expect(httpMockSwitch).toBeChecked();
      }
    });
  });

  describe('Execution Flow Visualization', () => {
    it('should display trigger and all actions', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      // Check trigger
      expect(
        screen.getByText(/Trigger: message/i),
      ).toBeInTheDocument();

      // Check actions
      expect(screen.getByText('Send Message')).toBeInTheDocument();
      expect(screen.getByText('Http Request')).toBeInTheDocument();
      expect(screen.getByText('Wait')).toBeInTheDocument();
    });

    it('should show breakpoint toggles for each action', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const breakpointButtons = screen.getAllByRole('button', {
        name: /Toggle breakpoint/i,
      });

      expect(breakpointButtons).toHaveLength(mockWorkflow.actions.length);
    });

    it('should toggle breakpoints when clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const breakpointButtons = screen.getAllByRole('button', {
        name: /Toggle breakpoint/i,
      });
      const firstBreakpoint = breakpointButtons[0];

      // Initial state - not set
      expect(firstBreakpoint).not.toHaveClass('border-red-500');

      // Click to set breakpoint
      await user.click(firstBreakpoint);
      expect(firstBreakpoint).toHaveClass('border-red-500');

      // Click again to remove
      await user.click(firstBreakpoint);
      expect(firstBreakpoint).not.toHaveClass('border-red-500');
    });
  });

  describe('Execution Controls', () => {
    it('should show run test button when not executing', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(
        screen.getByRole('button', { name: /Run Test/i }),
      ).toBeInTheDocument();
    });

    it('should disable run button when test data is empty', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      expect(runButton).toBeDisabled();
    });

    it('should start execution when run test is clicked', async () => {
      const user = userEvent.setup();
      const onExecutionComplete = vi.fn();
      render(
        <WorkflowDebugger
          workflow={mockWorkflow}
          onExecutionComplete={onExecutionComplete}
        />,
      );

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      // Should show pause and stop buttons during execution
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
      });
    });

    it('should complete execution and call callback', async () => {
      const user = userEvent.setup();
      const onExecutionComplete = vi.fn();
      render(
        <WorkflowDebugger
          workflow={mockWorkflow}
          onExecutionComplete={onExecutionComplete}
        />,
      );

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      await waitFor(
        () => {
          expect(onExecutionComplete).toHaveBeenCalled();
        },
        { timeout: 10000 },
      );
    }, 15000);

    it('should show reset button after execution completes', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    }, 15000);
  });

  describe('Variable Inspector', () => {
    it('should show placeholder when no execution', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(
        screen.getByText(/No variables available/i),
      ).toBeInTheDocument();
    });

    it('should display variables during execution', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      await waitFor(
        () => {
          expect(screen.getByText('trigger')).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    }, 10000);
  });

  describe('Execution Logs', () => {
    it('should show placeholder when no logs', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      expect(
        screen.getByText(/No logs yet/i),
      ).toBeInTheDocument();
    });

    it('should display logs during execution', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Starting workflow execution/i),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    }, 10000);
  });

  describe('Step-by-step Debugging', () => {
    it('should pause at breakpoint', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      // Set breakpoint on first action
      const breakpointButtons = screen.getAllByRole('button', {
        name: /Toggle breakpoint/i,
      });
      await user.click(breakpointButtons[0]);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      // Should pause at breakpoint
      await waitFor(
        () => {
          expect(
            screen.getByRole('button', { name: /Step Over/i }),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    }, 10000);

    it('should continue execution after step over', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      // Set breakpoint on first action
      const breakpointButtons = screen.getAllByRole('button', {
        name: /Toggle breakpoint/i,
      });
      await user.click(breakpointButtons[0]);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      // Wait for breakpoint
      await waitFor(
        () => {
          expect(
            screen.getByRole('button', { name: /Step Over/i }),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Step over
      const stepButton = screen.getByRole('button', { name: /Step Over/i });
      await user.click(stepButton);

      // Should continue execution
      await waitFor(
        () => {
          expect(screen.queryByRole('button', { name: /Step Over/i })).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    }, 15000);
  });

  describe('Execution Summary', () => {
    it('should show execution summary after completion', async () => {
      const user = userEvent.setup();
      render(<WorkflowDebugger workflow={mockWorkflow} />);

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      const runButton = screen.getByRole('button', { name: /Run Test/i });
      await user.click(runButton);

      await waitFor(
        () => {
          expect(screen.getByText('Execution Summary')).toBeInTheDocument();
          expect(screen.getByText('Status:')).toBeInTheDocument();
          expect(screen.getByText('Duration:')).toBeInTheDocument();
          expect(screen.getByText('Actions:')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    }, 15000);
  });
});
