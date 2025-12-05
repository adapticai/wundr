/**
 * Tests for Workflow AI Assistant Component
 *
 * @module components/workflow/__tests__/workflow-ai-assistant.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WorkflowAIAssistant } from '../workflow-ai-assistant';

// Mock useChat hook
const mockSendMessage = vi.fn();
const mockMessages: any[] = [];
const mockStatus = 'idle';

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: mockMessages,
    status: mockStatus,
    sendMessage: mockSendMessage,
  })),
}));

describe('WorkflowAIAssistant', () => {
  const defaultProps = {
    workspaceSlug: 'test-workspace',
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<WorkflowAIAssistant {...defaultProps} />);

    expect(screen.getByText('Workflow AI')).toBeInTheDocument();
    expect(screen.getByText('Create, optimize, and troubleshoot workflows with AI')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<WorkflowAIAssistant {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Workflow AI')).not.toBeInTheDocument();
  });

  it('displays quick action buttons', () => {
    render(<WorkflowAIAssistant {...defaultProps} />);

    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('shows optimize button when workflow is provided', () => {
    const workflow = {
      id: 'wf_1' as any,
      name: 'Test Workflow',
      status: 'active' as const,
      workspaceId: 'ws_1',
      trigger: { type: 'message' as const, message: { channelIds: [] } },
      actions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user_1',
      runCount: 0,
      errorCount: 0,
    };

    render(<WorkflowAIAssistant {...defaultProps} workflow={workflow} />);

    expect(screen.getByText('Optimize')).toBeInTheDocument();
  });

  it('shows diagnose button when execution has errors', () => {
    const execution = {
      id: 'exec_1' as any,
      workflowId: 'wf_1' as any,
      status: 'failed' as const,
      startedAt: new Date().toISOString(),
      triggeredBy: 'user_1',
      actionResults: [],
    };

    render(<WorkflowAIAssistant {...defaultProps} execution={execution} />);

    expect(screen.getByText('Diagnose')).toBeInTheDocument();
  });

  it('handles chat input submission', async () => {
    const user = userEvent.setup();
    render(<WorkflowAIAssistant {...defaultProps} />);

    // Expand chat section
    const chatButton = screen.getByText('Ask AI Assistant');
    await user.click(chatButton);

    // Type message
    const textarea = screen.getByPlaceholderText(/when a message is received/i);
    await user.type(textarea, 'Create a welcome workflow');

    // Submit
    const sendButton = screen.getByRole('button', { name: /send message/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        text: 'Create a welcome workflow',
      });
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<WorkflowAIAssistant {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close workflow ai/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('disables input when chat is loading', () => {
    // Mock loading state
    vi.mocked(require('@ai-sdk/react').useChat).mockReturnValue({
      messages: mockMessages,
      status: 'streaming',
      sendMessage: mockSendMessage,
    });

    render(<WorkflowAIAssistant {...defaultProps} />);

    const chatButton = screen.getByText('Ask AI Assistant');
    userEvent.click(chatButton);

    const textarea = screen.getByPlaceholderText(/when a message is received/i);
    expect(textarea).toBeDisabled();
  });
});
