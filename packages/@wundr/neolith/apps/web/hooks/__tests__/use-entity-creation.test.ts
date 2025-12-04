/**
 * Type tests for useEntityCreation hook
 *
 * This file verifies that all entity creation types are properly defined
 * and match the expected API contracts.
 */

import { describe, it, expect } from '@jest/globals';

import type {
  EntityDataMap,
  CreatedEntityMap,
  WorkspaceEntityData,
  OrchestratorEntityData,
  SessionManagerEntityData,
  WorkflowEntityData,
  ChannelEntityData,
  SubagentEntityData,
  CreatedWorkspace,
  CreatedOrchestrator,
  CreatedSessionManager,
  CreatedWorkflow,
  CreatedChannel,
  CreatedSubagent,
  CreateEntityResponse,
  UseEntityCreationOptions,
  UseEntityCreationReturn,
} from '../use-entity-creation';

describe('Entity Creation Types', () => {
  describe('Input Data Types', () => {
    it('should have proper WorkspaceEntityData type', () => {
      const workspaceData: WorkspaceEntityData = {
        name: 'Test Workspace',
        description: 'A test workspace',
        organizationType: 'startup',
        teamSize: 'small',
        purpose: 'testing',
      };

      expect(workspaceData.name).toBeDefined();
      expect(workspaceData.description).toBeDefined();
    });

    it('should have proper OrchestratorEntityData type', () => {
      const orchestratorData: OrchestratorEntityData = {
        workspaceId: 'ws-123',
        name: 'Test Orchestrator',
        role: 'Engineering Lead',
        description: 'Handles engineering tasks',
        capabilities: ['code-review', 'architecture'],
        communicationStyle: 'collaborative',
      };

      expect(orchestratorData.workspaceId).toBeDefined();
      expect(orchestratorData.role).toBeDefined();
    });

    it('should have proper SessionManagerEntityData type', () => {
      const sessionManagerData: SessionManagerEntityData = {
        name: 'Test SM',
        responsibilities: 'Manage sessions',
        parentOrchestrator: 'orch-123',
        context: 'Test context',
        channels: ['#general'],
        escalationCriteria: ['critical-bug'],
        workspaceSlug: 'test-workspace',
      };

      expect(sessionManagerData.name).toBeDefined();
      expect(sessionManagerData.responsibilities).toBeDefined();
    });

    it('should have proper WorkflowEntityData type', () => {
      const workflowData: WorkflowEntityData = {
        workspaceId: 'ws-123',
        name: 'Test Workflow',
        description: 'A test workflow',
        trigger: {
          type: 'manual',
          config: { key: 'value' },
        },
        actions: [
          { action: 'notify', description: 'Send notification' },
          { action: 'create-task', description: 'Create a task' },
        ],
      };

      expect(workflowData.trigger.type).toBeDefined();
      expect(workflowData.actions).toHaveLength(2);
    });

    it('should have proper ChannelEntityData type', () => {
      const channelData: ChannelEntityData = {
        workspaceId: 'ws-123',
        name: 'general',
        description: 'General discussion',
        type: 'PUBLIC',
      };

      expect(channelData.workspaceId).toBeDefined();
      expect(channelData.name).toBeDefined();
    });

    it('should have proper SubagentEntityData type', () => {
      const subagentData: SubagentEntityData = {
        name: 'Test Subagent',
        description: 'A test subagent',
        sessionManagerId: 'sm-123',
        capabilities: ['testing', 'validation'],
        isGlobal: false,
      };

      expect(subagentData.name).toBeDefined();
      expect(subagentData.capabilities).toBeDefined();
    });
  });

  describe('Response Types', () => {
    it('should have proper CreatedWorkspace type', () => {
      const workspace: CreatedWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        type: 'workspace',
        slug: 'test-workspace',
      };

      expect(workspace.type).toBe('workspace');
      expect(workspace.slug).toBeDefined();
    });

    it('should have proper CreatedOrchestrator type', () => {
      const orchestrator: CreatedOrchestrator = {
        id: 'orch-123',
        name: 'Test Orchestrator',
        type: 'orchestrator',
        role: 'Engineering Lead',
      };

      expect(orchestrator.type).toBe('orchestrator');
      expect(orchestrator.role).toBeDefined();
    });

    it('should have proper CreatedSessionManager type', () => {
      const sessionManager: CreatedSessionManager = {
        id: 'sm-123',
        name: 'Test SM',
        type: 'session-manager',
      };

      expect(sessionManager.type).toBe('session-manager');
    });

    it('should have proper CreatedWorkflow type', () => {
      const workflow: CreatedWorkflow = {
        id: 'wf-123',
        name: 'Test Workflow',
        type: 'workflow',
      };

      expect(workflow.type).toBe('workflow');
    });

    it('should have proper CreatedChannel type', () => {
      const channel: CreatedChannel = {
        id: 'ch-123',
        name: 'general',
        type: 'channel',
        slug: 'general',
      };

      expect(channel.type).toBe('channel');
      expect(channel.slug).toBeDefined();
    });

    it('should have proper CreatedSubagent type', () => {
      const subagent: CreatedSubagent = {
        id: 'sa-123',
        name: 'Test Subagent',
        type: 'subagent',
      };

      expect(subagent.type).toBe('subagent');
    });
  });

  describe('Type Mappings', () => {
    it('should map entity types to input data correctly', () => {
      type TestWorkspaceInput = EntityDataMap['workspace'];
      type TestOrchestratorInput = EntityDataMap['orchestrator'];
      type TestSessionManagerInput = EntityDataMap['session-manager'];
      type TestWorkflowInput = EntityDataMap['workflow'];
      type TestChannelInput = EntityDataMap['channel'];
      type TestSubagentInput = EntityDataMap['subagent'];

      const workspaceInput: TestWorkspaceInput = {
        name: 'Test',
        description: 'Test',
      };

      const orchestratorInput: TestOrchestratorInput = {
        workspaceId: 'ws-1',
        name: 'Test',
        role: 'Lead',
        description: 'Test',
      };

      expect(workspaceInput.name).toBeDefined();
      expect(orchestratorInput.role).toBeDefined();
    });

    it('should map entity types to created data correctly', () => {
      type TestWorkspaceCreated = CreatedEntityMap['workspace'];
      type TestOrchestratorCreated = CreatedEntityMap['orchestrator'];
      type TestSessionManagerCreated = CreatedEntityMap['session-manager'];
      type TestWorkflowCreated = CreatedEntityMap['workflow'];
      type TestChannelCreated = CreatedEntityMap['channel'];
      type TestSubagentCreated = CreatedEntityMap['subagent'];

      const workspaceCreated: TestWorkspaceCreated = {
        id: '1',
        name: 'Test',
        type: 'workspace',
        slug: 'test',
      };

      const orchestratorCreated: TestOrchestratorCreated = {
        id: '1',
        name: 'Test',
        type: 'orchestrator',
        role: 'Lead',
      };

      expect(workspaceCreated.slug).toBeDefined();
      expect(orchestratorCreated.role).toBeDefined();
    });
  });

  describe('API Response Types', () => {
    it('should have proper CreateEntityResponse type for workspace', () => {
      const response: CreateEntityResponse<'workspace'> = {
        data: {
          id: 'ws-123',
          name: 'Test Workspace',
          type: 'workspace',
          slug: 'test-workspace',
        },
        timestamp: new Date().toISOString(),
      };

      expect(response.data.type).toBe('workspace');
      expect(response.timestamp).toBeDefined();
    });

    it('should have proper CreateEntityResponse type for orchestrator', () => {
      const response: CreateEntityResponse<'orchestrator'> = {
        data: {
          id: 'orch-123',
          name: 'Test Orchestrator',
          type: 'orchestrator',
          role: 'Engineering Lead',
        },
        timestamp: new Date().toISOString(),
      };

      expect(response.data.type).toBe('orchestrator');
      expect(response.data.role).toBeDefined();
    });
  });

  describe('Hook Types', () => {
    it('should have proper UseEntityCreationOptions type', () => {
      const options: UseEntityCreationOptions<'workspace'> = {
        entityType: 'workspace',
        workspaceSlug: 'test-workspace',
        redirectPath: '/workspaces/test-workspace',
        onSuccess: data => {
          console.log('Created:', data.id);
        },
        onError: error => {
          console.error('Error:', error.message);
        },
      };

      expect(options.entityType).toBe('workspace');
    });

    it('should have proper UseEntityCreationReturn type', () => {
      // This would normally be returned by the hook
      const returnValue: UseEntityCreationReturn<'orchestrator'> = {
        createEntity: async data => {
          return {
            id: 'orch-123',
            name: data.name,
            type: 'orchestrator',
            role: data.role,
          };
        },
        isCreating: false,
        error: null,
        createdEntity: null,
        reset: () => {},
      };

      expect(returnValue.isCreating).toBe(false);
      expect(returnValue.reset).toBeDefined();
    });
  });
});
