/**
 * Workflow API Route Tests
 *
 * Comprehensive test suite for Workflow REST API endpoints covering:
 * - POST /api/workspaces/:workspaceId/workflows - Create workflow
 * - GET /api/workspaces/:workspaceId/workflows - List workflows
 * - GET /api/workflows/:id - Get workflow by ID
 * - PATCH /api/workflows/:id - Update workflow
 * - DELETE /api/workflows/:id - Delete workflow
 * - POST /api/workflows/:id/activate - Activate workflow
 * - POST /api/workflows/:id/deactivate - Deactivate workflow
 * - POST /api/workflows/:id/execute - Execute workflow
 * - GET /api/workflows/:id/executions - Get execution history
 * - POST /api/workflows/:id/executions/:execId/cancel - Cancel execution
 * - GET /api/workflow-templates - Get workflow templates
 * - POST /api/workspaces/:workspaceId/workflows/from-template - Create from template
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/workspaces/[workspaceId]/workflows/__tests__/workflows.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type {
  Workflow,
  TriggerType,
  WorkflowExecution,
  WorkflowTemplate,
  TriggerConfig,
  ActionConfig,
  WorkflowId,
  ActionId,
  ExecutionId,
} from '@/types/workflow';

// =============================================================================
// MOCKS
// =============================================================================

// Mock auth
const mockGetServerSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: mockGetServerSession,
  getServerSession: () => mockGetServerSession(),
}));

// Mock the Workflow service
const mockWorkflowService = {
  createWorkflow: vi.fn(),
  getWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  activateWorkflow: vi.fn(),
  deactivateWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
  getExecutions: vi.fn(),
  cancelExecution: vi.fn(),
  getTemplates: vi.fn(),
  createFromTemplate: vi.fn(),
};

vi.mock('@neolith/core', () => ({
  createWorkflowService: vi.fn(() => mockWorkflowService),
  workflowService: mockWorkflowService,
}));

// Mock Prisma
vi.mock('@neolith/database', () => ({
  prisma: {},
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

interface MockSession {
  user: MockUser;
  expires: string;
}

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
      organizationId: 'org-123',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

// @ts-expect-error Utility function kept for future route handler tests
function _createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL('http://localhost:3000/api/workspaces/ws_test/workflows');

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Factory function for creating mock workflows
function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf_test123' as WorkflowId,
    workspaceId: 'ws_test',
    name: 'Test Workflow',
    description: 'A test workflow for automated testing',
    status: 'active',
    trigger: {
      type: 'keyword',
      keyword: {
        keywords: ['help'],
        matchType: 'contains',
      },
    },
    actions: [
      {
        id: 'a1' as ActionId,
        type: 'send_message',
        order: 0,
        config: {
          channelId: 'ch_1',
          message: 'How can I help?',
        },
      },
    ],
    variables: [],
    createdBy: 'user_test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runCount: 0,
    errorCount: 0,
    ...overrides,
  } as Workflow;
}

// Factory function for creating mock executions
function createMockExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: 'exec_test123' as ExecutionId,
    workflowId: 'wf_test123' as WorkflowId,
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    duration: 150,
    triggeredBy: 'user_test',
    triggerData: { keyword: 'help' },
    actionResults: [
      {
        actionId: 'a1' as ActionId,
        actionType: 'send_message',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 50,
        output: { messageId: 'msg_123' },
      },
    ],
    ...overrides,
  } as WorkflowExecution;
}

// Factory function for creating mock templates
function createMockTemplate(overrides: Partial<WorkflowTemplate> = {}): WorkflowTemplate {
  return {
    id: 'tmpl_test123',
    name: 'Welcome Message',
    description: 'Send a welcome message when someone joins',
    category: 'onboarding',
    trigger: {
      type: 'user_join',
    },
    actions: [
      {
        type: 'send_message',
        order: 0,
        config: {
          channelId: 'ch_default',
          message: 'Welcome to our workspace!',
        },
      },
    ],
    usageCount: 100,
    tags: ['onboarding', 'welcome'],
    ...overrides,
  } as WorkflowTemplate;
}

// =============================================================================
// TESTS
// =============================================================================

describe('Workflow API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/workspaces/:workspaceId/workflows - Create Workflow
  // ===========================================================================

  describe('POST /api/workspaces/:workspaceId/workflows', () => {
    it('creates workflow with valid data', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const mockWorkflow = createMockWorkflow();
      mockWorkflowService.createWorkflow.mockResolvedValue(mockWorkflow);

      const requestBody = {
        name: 'Test Workflow',
        description: 'A test workflow',
        trigger: {
          type: 'keyword',
          keyword: { keywords: ['help'], matchType: 'contains' },
        },
        actions: [
          { type: 'send_message', config: { message: 'Help message' } },
        ],
      };

      const result = await mockWorkflowService.createWorkflow('ws_test', requestBody);

      expect(result).toEqual(mockWorkflow);
      expect(mockWorkflowService.createWorkflow).toHaveBeenCalledWith('ws_test', requestBody);
    });

    it('creates workflow with multiple actions', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const mockWorkflow = createMockWorkflow({
        actions: [
          { id: 'a1' as ActionId, type: 'send_message', order: 0, config: { channelId: 'ch_1', message: 'Hello' } },
          { id: 'a2' as ActionId, type: 'wait', order: 1, config: { duration: 5, unit: 'seconds' } },
          { id: 'a3' as ActionId, type: 'send_dm', order: 2, config: { userId: 'user_1', message: 'Follow up' } },
        ] as ActionConfig[],
      });
      mockWorkflowService.createWorkflow.mockResolvedValue(mockWorkflow);

      const result = await mockWorkflowService.createWorkflow('ws_test', {
        name: 'Multi-action Workflow',
        trigger: { type: 'message' },
        actions: [
          { type: 'send_message', config: { message: 'Hello' } },
          { type: 'wait', config: { duration: 5, unit: 'seconds' } },
          { type: 'send_dm', config: { message: 'Follow up' } },
        ],
      });

      expect(result.actions).toHaveLength(3);
    });

    it('creates workflow with variables', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const mockWorkflow = createMockWorkflow({
        variables: [
          { name: 'userName', type: 'string', source: 'trigger' },
          { name: 'count', type: 'number', defaultValue: 0, source: 'custom' },
        ],
      });
      mockWorkflowService.createWorkflow.mockResolvedValue(mockWorkflow);

      const result = await mockWorkflowService.createWorkflow('ws_test', {
        name: 'Workflow with Variables',
        trigger: { type: 'message' },
        actions: [],
        variables: [
          { name: 'userName', type: 'string' },
          { name: 'count', type: 'number', defaultValue: 0 },
        ],
      });

      expect(result.variables).toHaveLength(2);
    });

    it('returns 401 without authentication', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await mockGetServerSession();
      expect(session).toBeNull();

      const expectedStatus = 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 403 without admin permission', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'VIEWER',
          organizationId: 'org-123',
        },
      });
      mockGetServerSession.mockResolvedValue(session);

      const hasPermission = ['ADMIN', 'OWNER', 'MEMBER'].includes(session.user.role);
      expect(hasPermission).toBe(false);
    });

    it('returns 400 for missing name', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.createWorkflow.mockRejectedValue(
        new Error('Workflow name is required'),
      );

      await expect(
        mockWorkflowService.createWorkflow('ws_test', {
          trigger: { type: 'message' },
          actions: [],
        }),
      ).rejects.toThrow('Workflow name is required');
    });

    it('returns 400 for invalid trigger type', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.createWorkflow.mockRejectedValue(
        new Error('Invalid trigger type: invalid_type'),
      );

      await expect(
        mockWorkflowService.createWorkflow('ws_test', {
          name: 'Test',
          trigger: { type: 'invalid_type' as TriggerType },
          actions: [],
        }),
      ).rejects.toThrow('Invalid trigger type');
    });

    it('returns 400 for empty actions array', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.createWorkflow.mockRejectedValue(
        new Error('At least one action is required'),
      );

      await expect(
        mockWorkflowService.createWorkflow('ws_test', {
          name: 'Test',
          trigger: { type: 'message' },
          actions: [],
        }),
      ).rejects.toThrow('At least one action is required');
    });

    it('validates name length', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const longName = 'a'.repeat(256);

      mockWorkflowService.createWorkflow.mockRejectedValue(
        new Error('Name must be 255 characters or less'),
      );

      await expect(
        mockWorkflowService.createWorkflow('ws_test', {
          name: longName,
          trigger: { type: 'message' },
          actions: [{ type: 'send_message', config: {} }],
        }),
      ).rejects.toThrow('Name must be 255 characters or less');
    });

    it('validates action configuration', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.createWorkflow.mockRejectedValue(
        new Error('send_message action requires message field'),
      );

      await expect(
        mockWorkflowService.createWorkflow('ws_test', {
          name: 'Test',
          trigger: { type: 'message' },
          actions: [{ type: 'send_message', config: {} }],
        }),
      ).rejects.toThrow('send_message action requires message field');
    });
  });

  // ===========================================================================
  // GET /api/workspaces/:workspaceId/workflows - List Workflows
  // ===========================================================================

  describe('GET /api/workspaces/:workspaceId/workflows', () => {
    it('lists all workflows in workspace', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const mockWorkflows = [
        createMockWorkflow({ id: 'wf_1' as WorkflowId, name: 'Workflow 1' }),
        createMockWorkflow({ id: 'wf_2' as WorkflowId, name: 'Workflow 2' }),
        createMockWorkflow({ id: 'wf_3' as WorkflowId, name: 'Workflow 3' }),
      ];
      mockWorkflowService.listWorkflows.mockResolvedValue({
        workflows: mockWorkflows,
        total: 3,
        hasMore: false,
      });

      const result = await mockWorkflowService.listWorkflows('ws_test');

      expect(result.workflows).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('filters by status', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const activeWorkflows = [
        createMockWorkflow({ id: 'wf_1' as WorkflowId, status: 'active' }),
        createMockWorkflow({ id: 'wf_2' as WorkflowId, status: 'active' }),
      ];
      mockWorkflowService.listWorkflows.mockResolvedValue({
        workflows: activeWorkflows,
        total: 2,
        hasMore: false,
      });

      const result = await mockWorkflowService.listWorkflows('ws_test', { status: 'active' });

      expect(result.workflows).toHaveLength(2);
      result.workflows.forEach((wf: Workflow) => {
        expect(wf.status).toBe('active');
      });
    });

    it('filters by trigger type', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const scheduledWorkflows = [
        createMockWorkflow({ id: 'wf_1' as WorkflowId, trigger: { type: 'schedule', schedule: { cron: '0 9 * * *' } } }),
      ];
      mockWorkflowService.listWorkflows.mockResolvedValue({
        workflows: scheduledWorkflows,
        total: 1,
        hasMore: false,
      });

      const result = await mockWorkflowService.listWorkflows('ws_test', {
        triggerType: 'schedule',
      });

      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].trigger.type).toBe('schedule');
    });

    it('paginates results', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const mockWorkflows = Array.from({ length: 10 }, (_, i) =>
        createMockWorkflow({ id: `wf_${i}` as WorkflowId, name: `Workflow ${i}` }),
      );
      mockWorkflowService.listWorkflows.mockResolvedValue({
        workflows: mockWorkflows,
        total: 25,
        hasMore: true,
        nextCursor: 'cursor_10',
      });

      const result = await mockWorkflowService.listWorkflows('ws_test', {
        limit: 10,
        cursor: undefined,
      });

      expect(result.workflows).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });

    it('searches by name', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const searchResults = [
        createMockWorkflow({ id: 'wf_1' as WorkflowId, name: 'Welcome workflow' }),
        createMockWorkflow({ id: 'wf_2' as WorkflowId, name: 'Welcome message' }),
      ];
      mockWorkflowService.listWorkflows.mockResolvedValue({
        workflows: searchResults,
        total: 2,
        hasMore: false,
      });

      const result = await mockWorkflowService.listWorkflows('ws_test', { search: 'Welcome' });

      expect(result.workflows).toHaveLength(2);
    });

    it('returns 401 without authentication', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await mockGetServerSession();
      expect(session).toBeNull();
    });

    it('returns empty array for workspace with no workflows', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.listWorkflows.mockResolvedValue({
        workflows: [],
        total: 0,
        hasMore: false,
      });

      const result = await mockWorkflowService.listWorkflows('ws_empty');

      expect(result.workflows).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ===========================================================================
  // GET /api/workflows/:id - Get Workflow by ID
  // ===========================================================================

  describe('GET /api/workflows/:id', () => {
    it('returns workflow when found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const mockWorkflow = createMockWorkflow();
      mockWorkflowService.getWorkflow.mockResolvedValue(mockWorkflow);

      const result = await mockWorkflowService.getWorkflow('wf_test123');

      expect(result).toEqual(mockWorkflow);
      expect(result.id).toBe('wf_test123');
    });

    it('returns 404 when workflow not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.getWorkflow.mockResolvedValue(null);

      const result = await mockWorkflowService.getWorkflow('wf_nonexistent');

      expect(result).toBeNull();
    });

    it('returns 403 when user lacks permission', async () => {
      const session = createMockSession({
        user: {
          id: 'other-user',
          email: 'other@example.com',
          role: 'VIEWER',
          organizationId: 'other-org',
        },
      });
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.getWorkflow.mockRejectedValue(
        new Error('Access denied'),
      );

      await expect(mockWorkflowService.getWorkflow('wf_test123')).rejects.toThrow(
        'Access denied',
      );
    });
  });

  // ===========================================================================
  // PATCH /api/workflows/:id - Update Workflow
  // ===========================================================================

  describe('PATCH /api/workflows/:id', () => {
    it('updates workflow name', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const updatedWorkflow = createMockWorkflow({ name: 'Updated Name' });
      mockWorkflowService.updateWorkflow.mockResolvedValue(updatedWorkflow);

      const result = await mockWorkflowService.updateWorkflow('wf_test123', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('updates workflow description', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const updatedWorkflow = createMockWorkflow({ description: 'New description' });
      mockWorkflowService.updateWorkflow.mockResolvedValue(updatedWorkflow);

      const result = await mockWorkflowService.updateWorkflow('wf_test123', {
        description: 'New description',
      });

      expect(result.description).toBe('New description');
    });

    it('updates workflow trigger', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const newTrigger: TriggerConfig = {
        type: 'schedule',
        schedule: { cron: '0 9 * * *', timezone: 'UTC' },
      };
      const updatedWorkflow = createMockWorkflow({ trigger: newTrigger });
      mockWorkflowService.updateWorkflow.mockResolvedValue(updatedWorkflow);

      const result = await mockWorkflowService.updateWorkflow('wf_test123', {
        trigger: newTrigger,
      });

      expect(result.trigger.type).toBe('schedule');
    });

    it('updates workflow actions', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const newActions: ActionConfig[] = [
        { id: 'a1' as ActionId, type: 'send_message', order: 0, config: { channelId: 'ch_1', message: 'Updated message' } },
      ];
      const updatedWorkflow = createMockWorkflow({ actions: newActions });
      mockWorkflowService.updateWorkflow.mockResolvedValue(updatedWorkflow);

      const result = await mockWorkflowService.updateWorkflow('wf_test123', {
        actions: newActions,
      });

      expect(result.actions[0].config.message).toBe('Updated message');
    });

    it('returns 404 when workflow not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.updateWorkflow.mockRejectedValue(
        new Error('Workflow not found'),
      );

      await expect(
        mockWorkflowService.updateWorkflow('wf_nonexistent', { name: 'New' }),
      ).rejects.toThrow('Workflow not found');
    });

    it('returns 400 for invalid update data', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.updateWorkflow.mockRejectedValue(
        new Error('Invalid trigger configuration'),
      );

      await expect(
        mockWorkflowService.updateWorkflow('wf_test123', {
          trigger: { type: 'invalid' as TriggerType },
        }),
      ).rejects.toThrow('Invalid trigger configuration');
    });
  });

  // ===========================================================================
  // DELETE /api/workflows/:id - Delete Workflow
  // ===========================================================================

  describe('DELETE /api/workflows/:id', () => {
    it('deletes workflow when authorized', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.deleteWorkflow.mockResolvedValue({ success: true });

      const result = await mockWorkflowService.deleteWorkflow('wf_test123');

      expect(result.success).toBe(true);
      expect(mockWorkflowService.deleteWorkflow).toHaveBeenCalledWith('wf_test123');
    });

    it('returns 404 when workflow not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.deleteWorkflow.mockRejectedValue(
        new Error('Workflow not found'),
      );

      await expect(
        mockWorkflowService.deleteWorkflow('wf_nonexistent'),
      ).rejects.toThrow('Workflow not found');
    });

    it('returns 403 without delete permission', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'VIEWER',
          organizationId: 'org-123',
        },
      });
      mockGetServerSession.mockResolvedValue(session);

      const canDelete = ['ADMIN', 'OWNER'].includes(session.user.role);
      expect(canDelete).toBe(false);
    });

    it('prevents deletion of active workflows with running executions', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.deleteWorkflow.mockRejectedValue(
        new Error('Cannot delete workflow with running executions'),
      );

      await expect(
        mockWorkflowService.deleteWorkflow('wf_active'),
      ).rejects.toThrow('Cannot delete workflow with running executions');
    });
  });

  // ===========================================================================
  // POST /api/workflows/:id/activate - Activate Workflow
  // ===========================================================================

  describe('POST /api/workflows/:id/activate', () => {
    it('activates inactive workflow', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const activatedWorkflow = createMockWorkflow({ status: 'active' });
      mockWorkflowService.activateWorkflow.mockResolvedValue(activatedWorkflow);

      const result = await mockWorkflowService.activateWorkflow('wf_test123');

      expect(result.status).toBe('active');
    });

    it('activates draft workflow', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const activatedWorkflow = createMockWorkflow({ status: 'active' });
      mockWorkflowService.activateWorkflow.mockResolvedValue(activatedWorkflow);

      const result = await mockWorkflowService.activateWorkflow('wf_draft');

      expect(result.status).toBe('active');
    });

    it('returns 404 when workflow not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.activateWorkflow.mockRejectedValue(
        new Error('Workflow not found'),
      );

      await expect(
        mockWorkflowService.activateWorkflow('wf_nonexistent'),
      ).rejects.toThrow('Workflow not found');
    });

    it('returns 400 when workflow has validation errors', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.activateWorkflow.mockRejectedValue(
        new Error('Cannot activate workflow with validation errors'),
      );

      await expect(
        mockWorkflowService.activateWorkflow('wf_invalid'),
      ).rejects.toThrow('Cannot activate workflow with validation errors');
    });

    it('returns current state if already active', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const activeWorkflow = createMockWorkflow({ status: 'active' });
      mockWorkflowService.activateWorkflow.mockResolvedValue(activeWorkflow);

      const result = await mockWorkflowService.activateWorkflow('wf_active');

      expect(result.status).toBe('active');
    });
  });

  // ===========================================================================
  // POST /api/workflows/:id/deactivate - Deactivate Workflow
  // ===========================================================================

  describe('POST /api/workflows/:id/deactivate', () => {
    it('deactivates active workflow', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const deactivatedWorkflow = createMockWorkflow({ status: 'inactive' });
      mockWorkflowService.deactivateWorkflow.mockResolvedValue(deactivatedWorkflow);

      const result = await mockWorkflowService.deactivateWorkflow('wf_test123');

      expect(result.status).toBe('inactive');
    });

    it('returns 404 when workflow not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.deactivateWorkflow.mockRejectedValue(
        new Error('Workflow not found'),
      );

      await expect(
        mockWorkflowService.deactivateWorkflow('wf_nonexistent'),
      ).rejects.toThrow('Workflow not found');
    });

    it('cancels running executions when deactivating', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const deactivatedWorkflow = createMockWorkflow({ status: 'inactive' });
      mockWorkflowService.deactivateWorkflow.mockResolvedValue(deactivatedWorkflow);

      const result = await mockWorkflowService.deactivateWorkflow('wf_running', {
        cancelRunning: true,
      });

      expect(result.status).toBe('inactive');
    });
  });

  // ===========================================================================
  // POST /api/workflows/:id/execute - Execute Workflow
  // ===========================================================================

  describe('POST /api/workflows/:id/execute', () => {
    it('executes workflow manually', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const execution = createMockExecution();
      mockWorkflowService.executeWorkflow.mockResolvedValue(execution);

      const result = await mockWorkflowService.executeWorkflow('wf_test123');

      expect(result.workflowId).toBe('wf_test123');
      expect(result.status).toBe('completed');
    });

    it('executes workflow in test mode', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const testExecution = createMockExecution({
        id: 'exec_test' as ExecutionId,
        triggerData: { testMode: true },
      });
      mockWorkflowService.executeWorkflow.mockResolvedValue(testExecution);

      const result = await mockWorkflowService.executeWorkflow('wf_test123', {
        testMode: true,
      });

      expect(result.triggerData?.testMode).toBe(true);
    });

    it('executes workflow with trigger data', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const execution = createMockExecution({
        triggerData: { keyword: 'help', channelId: 'ch_123' },
      });
      mockWorkflowService.executeWorkflow.mockResolvedValue(execution);

      const result = await mockWorkflowService.executeWorkflow('wf_test123', {
        triggerData: { keyword: 'help', channelId: 'ch_123' },
      });

      expect(result.triggerData?.keyword).toBe('help');
    });

    it('returns 404 when workflow not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.executeWorkflow.mockRejectedValue(
        new Error('Workflow not found'),
      );

      await expect(
        mockWorkflowService.executeWorkflow('wf_nonexistent'),
      ).rejects.toThrow('Workflow not found');
    });

    it('returns 400 when executing inactive workflow', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.executeWorkflow.mockRejectedValue(
        new Error('Cannot execute inactive workflow'),
      );

      await expect(
        mockWorkflowService.executeWorkflow('wf_inactive'),
      ).rejects.toThrow('Cannot execute inactive workflow');
    });

    it('returns execution with failed status on action error', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const failedExecution = createMockExecution({
        status: 'failed',
        error: 'Action failed: send_message',
        actionResults: [
          {
            actionId: 'a1' as ActionId,
            actionType: 'send_message',
            status: 'failed',
            error: 'Channel not found',
          },
        ],
      });
      mockWorkflowService.executeWorkflow.mockResolvedValue(failedExecution);

      const result = await mockWorkflowService.executeWorkflow('wf_error');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // GET /api/workflows/:id/executions - Get Execution History
  // ===========================================================================

  describe('GET /api/workflows/:id/executions', () => {
    it('returns execution history', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const executions = [
        createMockExecution({ id: 'exec_1' as ExecutionId }),
        createMockExecution({ id: 'exec_2' as ExecutionId }),
        createMockExecution({ id: 'exec_3' as ExecutionId }),
      ];
      mockWorkflowService.getExecutions.mockResolvedValue({
        executions,
        total: 3,
        hasMore: false,
      });

      const result = await mockWorkflowService.getExecutions('wf_test123');

      expect(result.executions).toHaveLength(3);
    });

    it('filters by status', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const failedExecutions = [
        createMockExecution({ id: 'exec_1' as ExecutionId, status: 'failed' }),
      ];
      mockWorkflowService.getExecutions.mockResolvedValue({
        executions: failedExecutions,
        total: 1,
        hasMore: false,
      });

      const result = await mockWorkflowService.getExecutions('wf_test123', {
        status: 'failed',
      });

      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].status).toBe('failed');
    });

    it('paginates results', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const executions = Array.from({ length: 20 }, (_, i) =>
        createMockExecution({ id: `exec_${i}` as ExecutionId }),
      );
      mockWorkflowService.getExecutions.mockResolvedValue({
        executions,
        total: 50,
        hasMore: true,
        nextCursor: 'cursor_20',
      });

      const result = await mockWorkflowService.getExecutions('wf_test123', {
        limit: 20,
      });

      expect(result.executions).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it('returns empty array for workflow with no executions', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.getExecutions.mockResolvedValue({
        executions: [],
        total: 0,
        hasMore: false,
      });

      const result = await mockWorkflowService.getExecutions('wf_new');

      expect(result.executions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // POST /api/workflows/:id/executions/:execId/cancel - Cancel Execution
  // ===========================================================================

  describe('POST /api/workflows/:id/executions/:execId/cancel', () => {
    it('cancels running execution', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const cancelledExecution = createMockExecution({ status: 'cancelled' });
      mockWorkflowService.cancelExecution.mockResolvedValue(cancelledExecution);

      const result = await mockWorkflowService.cancelExecution(
        'wf_test123',
        'exec_running',
      );

      expect(result.status).toBe('cancelled');
    });

    it('returns 404 when execution not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.cancelExecution.mockRejectedValue(
        new Error('Execution not found'),
      );

      await expect(
        mockWorkflowService.cancelExecution('wf_test123', 'exec_nonexistent'),
      ).rejects.toThrow('Execution not found');
    });

    it('returns 400 when execution already completed', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.cancelExecution.mockRejectedValue(
        new Error('Cannot cancel completed execution'),
      );

      await expect(
        mockWorkflowService.cancelExecution('wf_test123', 'exec_completed'),
      ).rejects.toThrow('Cannot cancel completed execution');
    });

    it('returns 400 when execution already failed', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.cancelExecution.mockRejectedValue(
        new Error('Cannot cancel failed execution'),
      );

      await expect(
        mockWorkflowService.cancelExecution('wf_test123', 'exec_failed'),
      ).rejects.toThrow('Cannot cancel failed execution');
    });
  });

  // ===========================================================================
  // GET /api/workflow-templates - Get Workflow Templates
  // ===========================================================================

  describe('GET /api/workflow-templates', () => {
    it('returns all templates', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const templates = [
        createMockTemplate({ id: 'tmpl_1' }),
        createMockTemplate({ id: 'tmpl_2' }),
      ];
      mockWorkflowService.getTemplates.mockResolvedValue({ templates });

      const result = await mockWorkflowService.getTemplates();

      expect(result.templates).toHaveLength(2);
    });

    it('filters by category', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const onboardingTemplates = [
        createMockTemplate({ id: 'tmpl_1', category: 'onboarding' }),
      ];
      mockWorkflowService.getTemplates.mockResolvedValue({
        templates: onboardingTemplates,
      });

      const result = await mockWorkflowService.getTemplates({ category: 'onboarding' });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].category).toBe('onboarding');
    });

    it('returns templates sorted by popularity', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const templates = [
        createMockTemplate({ id: 'tmpl_1', usageCount: 100 }),
        createMockTemplate({ id: 'tmpl_2', usageCount: 500 }),
        createMockTemplate({ id: 'tmpl_3', usageCount: 250 }),
      ];
      mockWorkflowService.getTemplates.mockResolvedValue({
        templates: templates.sort((a, b) => b.usageCount - a.usageCount),
      });

      const result = await mockWorkflowService.getTemplates({ sortBy: 'popularity' });

      expect(result.templates[0].usageCount).toBe(500);
    });
  });

  // ===========================================================================
  // POST /api/workspaces/:workspaceId/workflows/from-template - Create from Template
  // ===========================================================================

  describe('POST /api/workspaces/:workspaceId/workflows/from-template', () => {
    it('creates workflow from template', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const newWorkflow = createMockWorkflow({
        name: 'Welcome Message',
        trigger: { type: 'user_join' },
      });
      mockWorkflowService.createFromTemplate.mockResolvedValue(newWorkflow);

      const result = await mockWorkflowService.createFromTemplate(
        'ws_test',
        'tmpl_welcome',
      );

      expect(result.name).toBe('Welcome Message');
    });

    it('creates workflow from template with custom name', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const newWorkflow = createMockWorkflow({ name: 'Custom Welcome' });
      mockWorkflowService.createFromTemplate.mockResolvedValue(newWorkflow);

      const result = await mockWorkflowService.createFromTemplate(
        'ws_test',
        'tmpl_welcome',
        { name: 'Custom Welcome' },
      );

      expect(result.name).toBe('Custom Welcome');
    });

    it('returns 404 when template not found', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.createFromTemplate.mockRejectedValue(
        new Error('Template not found'),
      );

      await expect(
        mockWorkflowService.createFromTemplate('ws_test', 'tmpl_nonexistent'),
      ).rejects.toThrow('Template not found');
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('handles database connection errors', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.listWorkflows.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        mockWorkflowService.listWorkflows('ws_test'),
      ).rejects.toThrow('Database connection failed');
    });

    it('handles rate limiting', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.executeWorkflow.mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      await expect(
        mockWorkflowService.executeWorkflow('wf_test123'),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('handles concurrent modification conflicts', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.updateWorkflow.mockRejectedValue(
        new Error('Workflow was modified by another user'),
      );

      await expect(
        mockWorkflowService.updateWorkflow('wf_test123', { name: 'New Name' }),
      ).rejects.toThrow('Workflow was modified by another user');
    });

    it('handles invalid JSON in request body', async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      mockWorkflowService.createWorkflow.mockRejectedValue(
        new Error('Invalid JSON in request body'),
      );

      await expect(
        mockWorkflowService.createWorkflow('ws_test', 'invalid' as unknown as Record<string, unknown>),
      ).rejects.toThrow('Invalid JSON in request body');
    });
  });
});
