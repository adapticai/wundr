/**
 * InMemoryWorkflowStore Tests
 *
 * Verifies CRUD operations for workflow definitions and executions,
 * list filtering, defensive cloning, and clear/reset behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryWorkflowStore } from '../workflow-store';

import type { WorkflowDefinition, WorkflowExecution } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    version: '1.0.0',
    status: 'ACTIVE',
    steps: [
      { id: 'step-1', name: 'Step 1', type: 'task', config: {}, dependencies: [] },
    ],
    triggers: [{ type: 'manual', config: {} }],
    variables: { foo: 'bar' },
    metadata: { createdBy: 'test' },
    ...overrides,
  };
}

function makeExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: 'exec-1',
    workflowId: 'wf-1',
    status: 'RUNNING',
    variables: {},
    stepResults: new Map(),
    startedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryWorkflowStore', () => {
  let store: InMemoryWorkflowStore;

  beforeEach(() => {
    store = new InMemoryWorkflowStore();
  });

  // -------------------------------------------------------------------------
  // Definitions
  // -------------------------------------------------------------------------

  describe('saveDefinition / getDefinition', () => {
    it('should persist and retrieve a workflow definition', async () => {
      const def = makeDefinition();
      await store.saveDefinition(def);

      const loaded = await store.getDefinition('wf-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('wf-1');
      expect(loaded!.name).toBe('Test Workflow');
      expect(loaded!.steps).toHaveLength(1);
    });

    it('should return null for a non-existent definition', async () => {
      const loaded = await store.getDefinition('does-not-exist');
      expect(loaded).toBeNull();
    });

    it('should overwrite an existing definition on re-save', async () => {
      await store.saveDefinition(makeDefinition());
      await store.saveDefinition(makeDefinition({ name: 'Updated' }));

      const loaded = await store.getDefinition('wf-1');
      expect(loaded!.name).toBe('Updated');
      expect(store.definitionCount).toBe(1);
    });
  });

  describe('listDefinitions', () => {
    it('should return all stored definitions', async () => {
      await store.saveDefinition(makeDefinition({ id: 'wf-1' }));
      await store.saveDefinition(makeDefinition({ id: 'wf-2', name: 'Second' }));

      const list = await store.listDefinitions();
      expect(list).toHaveLength(2);
      expect(list.map((d) => d.id).sort()).toEqual(['wf-1', 'wf-2']);
    });

    it('should return an empty array when the store is empty', async () => {
      const list = await store.listDefinitions();
      expect(list).toEqual([]);
    });
  });

  describe('deleteDefinition', () => {
    it('should remove a definition by id', async () => {
      await store.saveDefinition(makeDefinition());
      await store.deleteDefinition('wf-1');

      expect(await store.getDefinition('wf-1')).toBeNull();
      expect(store.definitionCount).toBe(0);
    });

    it('should be a no-op for a non-existent id', async () => {
      await expect(store.deleteDefinition('ghost')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Executions
  // -------------------------------------------------------------------------

  describe('saveExecution / getExecution', () => {
    it('should persist and retrieve an execution', async () => {
      const exec = makeExecution();
      await store.saveExecution(exec);

      const loaded = await store.getExecution('exec-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('exec-1');
      expect(loaded!.status).toBe('RUNNING');
    });

    it('should return null for a non-existent execution', async () => {
      expect(await store.getExecution('nope')).toBeNull();
    });
  });

  describe('listExecutions', () => {
    it('should return all executions when no filter is provided', async () => {
      await store.saveExecution(makeExecution({ id: 'e-1', workflowId: 'wf-1' }));
      await store.saveExecution(makeExecution({ id: 'e-2', workflowId: 'wf-2' }));

      const all = await store.listExecutions();
      expect(all).toHaveLength(2);
    });

    it('should filter executions by workflowId', async () => {
      await store.saveExecution(makeExecution({ id: 'e-1', workflowId: 'wf-1' }));
      await store.saveExecution(makeExecution({ id: 'e-2', workflowId: 'wf-2' }));
      await store.saveExecution(makeExecution({ id: 'e-3', workflowId: 'wf-1' }));

      const filtered = await store.listExecutions('wf-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.workflowId === 'wf-1')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // clear()
  // -------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all definitions and executions', async () => {
      await store.saveDefinition(makeDefinition());
      await store.saveExecution(makeExecution());

      store.clear();

      expect(store.definitionCount).toBe(0);
      expect(store.executionCount).toBe(0);
      expect(await store.getDefinition('wf-1')).toBeNull();
      expect(await store.getExecution('exec-1')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Defensive cloning
  // -------------------------------------------------------------------------

  describe('defensive cloning', () => {
    it('should not reflect external mutation of a returned definition', async () => {
      await store.saveDefinition(makeDefinition());

      const loaded = await store.getDefinition('wf-1');
      loaded!.name = 'MUTATED';
      loaded!.steps.push({ id: 'injected', name: 'Injected', type: 'task', config: {}, dependencies: [] });

      const reloaded = await store.getDefinition('wf-1');
      expect(reloaded!.name).toBe('Test Workflow');
      expect(reloaded!.steps).toHaveLength(1);
    });

    it('should not reflect external mutation of a returned execution', async () => {
      await store.saveExecution(makeExecution());

      const loaded = await store.getExecution('exec-1');
      loaded!.status = 'FAILED';
      loaded!.variables['injected'] = true;

      const reloaded = await store.getExecution('exec-1');
      expect(reloaded!.status).toBe('RUNNING');
      expect(reloaded!.variables).not.toHaveProperty('injected');
    });
  });
});
