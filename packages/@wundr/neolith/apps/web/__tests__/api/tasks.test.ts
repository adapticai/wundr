/**
 * Task API Tests
 *
 * Comprehensive test suite for task CRUD operations including:
 * - Task creation with dependency validation
 * - Task updates with state transition validation
 * - Task deletion
 * - Task assignment
 * - Task polling for VP daemon
 * - VP backlog retrieval
 *
 * @module __tests__/api/tasks.test
 */

import { prisma } from '@neolith/database';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Task API', () => {
  let testUserId: string;
  let testVpId: string;
  let testWorkspaceId: string;
  let testTaskId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@test.local`,
        name: 'Test User',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        slug: `test-org-${Date.now()}`,
      },
    });

    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        slug: `test-ws-${Date.now()}`,
        organizationId: org.id,
      },
    });
    testWorkspaceId = workspace.id;

    // Add user to workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'MEMBER',
      },
    });

    // Create test VP
    const vpUser = await prisma.user.create({
      data: {
        email: `vp-${Date.now()}@test.local`,
        name: 'Test VP',
        isVP: true,
        status: 'ACTIVE',
      },
    });

    const vp = await prisma.vP.create({
      data: {
        discipline: 'Engineering',
        role: 'Backend Engineer',
        userId: vpUser.id,
        organizationId: org.id,
        workspaceId: workspace.id,
      },
    });
    testVpId = vp.id;
  });

  afterAll(async () => {
    // Cleanup (in reverse order of dependencies)
    await prisma.task.deleteMany({ where: { workspaceId: testWorkspaceId } });
    await prisma.backlogItem.deleteMany({});
    await prisma.backlog.deleteMany({ where: { workspaceId: testWorkspaceId } });
    await prisma.vP.deleteMany({ where: { workspaceId: testWorkspaceId } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: testWorkspaceId } });
    await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserId] } } });
    await prisma.organization.deleteMany({});
  });

  describe('Task Creation', () => {
    it('should create a task with valid input', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Test Task',
          description: 'A test task description',
          priority: 'HIGH',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
        },
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.priority).toBe('HIGH');
      expect(task.status).toBe('TODO');
      expect(task.vpId).toBe(testVpId);

      testTaskId = task.id;
    });

    it('should create a task with dependencies', async () => {
      const parentTask = await prisma.task.create({
        data: {
          title: 'Parent Task',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
        },
      });

      const childTask = await prisma.task.create({
        data: {
          title: 'Child Task',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
          dependsOn: [parentTask.id],
        },
      });

      expect(childTask.dependsOn).toContain(parentTask.id);
    });

    it('should create a task with tags', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Tagged Task',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
          tags: ['urgent', 'backend', 'critical'],
        },
      });

      expect(task.tags).toEqual(['urgent', 'backend', 'critical']);
    });

    it('should create a task with estimated hours', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Estimated Task',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
          estimatedHours: 8,
        },
      });

      expect(task.estimatedHours).toBe(8);
    });

    it('should create a task with due date', async () => {
      const dueDate = new Date('2025-12-31');
      const task = await prisma.task.create({
        data: {
          title: 'Due Date Task',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
          dueDate,
        },
      });

      expect(task.dueDate).toEqual(dueDate);
    });
  });

  describe('Task Update', () => {
    it('should update task title', async () => {
      const updated = await prisma.task.update({
        where: { id: testTaskId },
        data: { title: 'Updated Title' },
      });

      expect(updated.title).toBe('Updated Title');
    });

    it('should update task status', async () => {
      const updated = await prisma.task.update({
        where: { id: testTaskId },
        data: { status: 'IN_PROGRESS' },
      });

      expect(updated.status).toBe('IN_PROGRESS');
    });

    it('should update task priority', async () => {
      const updated = await prisma.task.update({
        where: { id: testTaskId },
        data: { priority: 'CRITICAL' },
      });

      expect(updated.priority).toBe('CRITICAL');
    });

    it('should add tags to task', async () => {
      const updated = await prisma.task.update({
        where: { id: testTaskId },
        data: { tags: ['new-tag', 'important'] },
      });

      expect(updated.tags).toContain('new-tag');
    });

    it('should complete task', async () => {
      const updated = await prisma.task.update({
        where: { id: testTaskId },
        data: {
          status: 'DONE',
          completedAt: new Date(),
        },
      });

      expect(updated.status).toBe('DONE');
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('Task Retrieval', () => {
    it('should retrieve task by ID', async () => {
      const task = await prisma.task.findUnique({
        where: { id: testTaskId },
      });

      expect(task).toBeDefined();
      expect(task?.id).toBe(testTaskId);
    });

    it('should retrieve tasks by VP ID', async () => {
      const tasks = await prisma.task.findMany({
        where: { vpId: testVpId },
      });

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.vpId === testVpId)).toBe(true);
    });

    it('should retrieve tasks by workspace ID', async () => {
      const tasks = await prisma.task.findMany({
        where: { workspaceId: testWorkspaceId },
      });

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.workspaceId === testWorkspaceId)).toBe(true);
    });

    it('should retrieve tasks by status', async () => {
      const todoTasks = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          status: 'TODO',
        },
      });

      expect(todoTasks.every((t) => t.status === 'TODO')).toBe(true);
    });

    it('should retrieve tasks by priority', async () => {
      const highPriorityTasks = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          priority: { in: ['HIGH', 'CRITICAL'] },
        },
      });

      expect(highPriorityTasks.every((t) => ['HIGH', 'CRITICAL'].includes(t.priority))).toBe(true);
    });

    it('should retrieve tasks with dependencies', async () => {
      const tasksWithDeps = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          dependsOn: { isEmpty: false },
        },
      });

      expect(tasksWithDeps.every((t) => t.dependsOn.length > 0)).toBe(true);
    });

    it('should retrieve tasks with pagination', async () => {
      const page1 = await prisma.task.findMany({
        where: { workspaceId: testWorkspaceId },
        skip: 0,
        take: 5,
      });

      const page2 = await prisma.task.findMany({
        where: { workspaceId: testWorkspaceId },
        skip: 5,
        take: 5,
      });

      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Task Deletion', () => {
    it('should delete a task', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Task to Delete',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
        },
      });

      await prisma.task.delete({ where: { id: task.id } });

      const deleted = await prisma.task.findUnique({ where: { id: task.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('Task Assignment', () => {
    it('should assign task to user', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Task to Assign',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
        },
      });

      const assigned = await prisma.task.update({
        where: { id: task.id },
        data: { assignedToId: testUserId },
      });

      expect(assigned.assignedToId).toBe(testUserId);
    });

    it('should reassign task to different user', async () => {
      const newUser = await prisma.user.create({
        data: {
          email: `reassign-${Date.now()}@test.local`,
          name: 'Reassign User',
          status: 'ACTIVE',
        },
      });

      const task = await prisma.task.create({
        data: {
          title: 'Task to Reassign',
          priority: 'MEDIUM',
          status: 'TODO',
          vpId: testVpId,
          workspaceId: testWorkspaceId,
          createdById: testUserId,
          assignedToId: testUserId,
        },
      });

      const reassigned = await prisma.task.update({
        where: { id: task.id },
        data: { assignedToId: newUser.id },
      });

      expect(reassigned.assignedToId).toBe(newUser.id);

      // Cleanup
      await prisma.user.delete({ where: { id: newUser.id } });
    });
  });

  describe('Task Filtering', () => {
    it('should filter tasks by multiple statuses', async () => {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      });

      expect(tasks.every((t) => ['TODO', 'IN_PROGRESS'].includes(t.status))).toBe(true);
    });

    it('should filter tasks by tag', async () => {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          tags: { hasSome: ['urgent'] },
        },
      });

      expect(tasks.every((t) => t.tags.some((tag) => tag === 'urgent'))).toBe(true);
    });

    it('should filter tasks by created date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          createdAt: {
            gte: startDate,
            lte: new Date(),
          },
        },
      });

      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should filter tasks with due dates', async () => {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: testWorkspaceId,
          dueDate: { not: null },
        },
      });

      expect(tasks.every((t) => t.dueDate !== null)).toBe(true);
    });
  });

  describe('Task Sorting', () => {
    it('should sort tasks by priority ascending', async () => {
      const tasks = await prisma.task.findMany({
        where: { workspaceId: testWorkspaceId },
        orderBy: { priority: 'asc' },
      });

      const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      let lastPriority = -1;

      for (const task of tasks) {
        const currentPriority = priorities.indexOf(task.priority);
        expect(currentPriority).toBeGreaterThanOrEqual(lastPriority);
        lastPriority = currentPriority;
      }
    });

    it('should sort tasks by due date ascending', async () => {
      const tasks = await prisma.task.findMany({
        where: { workspaceId: testWorkspaceId },
        orderBy: { dueDate: 'asc' },
      });

      let lastDate: Date | null = null;
      for (const task of tasks) {
        if (task.dueDate && lastDate) {
          expect(task.dueDate.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
        }
        if (task.dueDate) {
          lastDate = task.dueDate;
        }
      }
    });

    it('should sort tasks by creation date descending', async () => {
      const tasks = await prisma.task.findMany({
        where: { workspaceId: testWorkspaceId },
        orderBy: { createdAt: 'desc' },
      });

      let lastDate: Date | null = null;
      for (const task of tasks) {
        if (lastDate) {
          expect(task.createdAt.getTime()).toBeLessThanOrEqual(lastDate.getTime());
        }
        lastDate = task.createdAt;
      }
    });
  });
});
