/**
 * Admin Service Tests
 *
 * Comprehensive test suite for the admin service covering:
 * - Workspace settings management
 * - Role CRUD operations
 * - Member management
 * - Invite management
 * - Billing operations
 * - Admin activity logging
 *
 * @module @genesis/core/services/__tests__/admin-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_MESSAGING_SETTINGS,
  SYSTEM_ROLES,
  PLAN_FEATURES,
} from '../../types/admin';
import {
  createAdminService,
  InMemoryAdminStorage,
  SettingsNotFoundError,
  RoleNotFoundError,
  SystemRoleError,
  MemberNotFoundError,
  InviteNotFoundError,
  InviteExpiredError,
} from '../admin-service';

import type {
  WorkspaceSettings,
  Role,
  MemberInfo,
  Invite,
  BillingInfo,
  Permission,
  CreateRoleInput,
} from '../../types/admin';
import type { AdminService } from '../admin-service';

// =============================================================================
// TEST UTILITIES
// =============================================================================

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `test_${Date.now()}_${idCounter}`;
}

function createTestWorkspaceSettings(workspaceId: string, overrides: Partial<WorkspaceSettings> = {}): WorkspaceSettings {
  return {
    id: generateId(),
    workspaceId,
    general: { ...DEFAULT_GENERAL_SETTINGS },
    security: { ...DEFAULT_SECURITY_SETTINGS, passwordPolicy: { ...DEFAULT_SECURITY_SETTINGS.passwordPolicy } },
    messaging: { ...DEFAULT_MESSAGING_SETTINGS },
    notifications: { defaultDesktop: true, defaultMobile: true, defaultEmail: false, quietHoursEnabled: false, digestFrequency: 'never' },
    integrations: { allowThirdPartyApps: true, approvedProviders: [], webhooksEnabled: true, apiRateLimitPerMinute: 60 },
    compliance: { dataRetentionDays: 365, exportEnabled: true, dlpEnabled: false, eDiscoveryEnabled: false, legalHoldEnabled: false },
    branding: {},
    updatedAt: new Date(),
    updatedBy: 'test_user',
    ...overrides,
  };
}

function createTestRole(workspaceId: string, overrides: Partial<Role> = {}): Role {
  return {
    id: generateId(),
    workspaceId,
    name: 'Test Role',
    description: 'A test role',
    permissions: [{ resource: 'messages', actions: ['read', 'create'] }],
    isDefault: false,
    isSystemRole: false,
    priority: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestMember(workspaceId: string, userId: string, overrides: Partial<MemberInfo> = {}): MemberInfo {
  return {
    id: generateId(),
    userId,
    workspaceId,
    roleId: 'role_123',
    status: 'active',
    joinedAt: new Date(),
    user: { id: userId, name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

function createTestInvite(workspaceId: string, overrides: Partial<Invite> = {}): Invite {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    id: generateId(),
    workspaceId,
    email: 'invite@example.com',
    roleId: 'role_123',
    status: 'pending',
    expiresAt,
    createdBy: 'inviter_123',
    createdAt: new Date(),
    ...overrides,
  };
}

function createTestBillingInfo(workspaceId: string, overrides: Partial<BillingInfo> = {}): BillingInfo {
  const now = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    id: generateId(),
    workspaceId,
    plan: 'starter',
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    seats: 10,
    seatsUsed: 5,
    features: PLAN_FEATURES.starter,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('AdminService', () => {
  let storage: InMemoryAdminStorage;
  let adminService: AdminService;
  const workspaceId = 'workspace_123';
  const userId = 'user_123';

  beforeEach(() => {
    idCounter = 0;
    storage = new InMemoryAdminStorage();
    adminService = createAdminService(storage);
    storage.addWorkspace(workspaceId);
    storage.addUser(userId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Settings Tests
  // ===========================================================================

  describe('Settings', () => {
    describe('SettingsNotFoundError', () => {
      it('is properly instantiated with id', () => {
        const error = new SettingsNotFoundError('settings_123');

        expect(error).toBeInstanceOf(SettingsNotFoundError);
        expect(error.message).toBe('Settings not found: settings_123');
        expect(error.code).toBe('SETTINGS_NOT_FOUND');
        expect(error.name).toBe('AdminError');
      });

      it('can be used for strict settings retrieval', async () => {
        // This test demonstrates how SettingsNotFoundError can be used
        // when strict settings retrieval is needed (e.g., in APIs that
        // require settings to already exist)
        const strictGetSettings = async (workspaceId: string): Promise<WorkspaceSettings> => {
          const settings = await storage.getSettings(workspaceId);
          if (!settings) {
            throw new SettingsNotFoundError(workspaceId);
          }
          return settings;
        };

        // Throws when settings don't exist
        await expect(
          strictGetSettings('nonexistent_workspace'),
        ).rejects.toThrow(SettingsNotFoundError);

        // Returns settings when they exist
        const existingSettings = createTestWorkspaceSettings(workspaceId);
        await storage.saveSettings(existingSettings);

        const result = await strictGetSettings(workspaceId);
        expect(result.workspaceId).toBe(workspaceId);
      });
    });

    describe('getSettings', () => {
      it('returns existing settings', async () => {
        const existingSettings = createTestWorkspaceSettings(workspaceId);
        await storage.saveSettings(existingSettings);

        const result = await adminService.getSettings(workspaceId);

        expect(result.workspaceId).toBe(workspaceId);
        expect(result.general).toBeDefined();
        expect(result.security).toBeDefined();
      });

      it('creates default settings if not found', async () => {
        const result = await adminService.getSettings(workspaceId);

        expect(result.workspaceId).toBe(workspaceId);
        expect(result.general.timezone).toBe('UTC');
        expect(result.security.sessionTimeout).toBeGreaterThan(0);
      });

      it('includes all default sections', async () => {
        const result = await adminService.getSettings(workspaceId);

        expect(result.general).toBeDefined();
        expect(result.security).toBeDefined();
        expect(result.messaging).toBeDefined();
        expect(result.notifications).toBeDefined();
        expect(result.integrations).toBeDefined();
        expect(result.compliance).toBeDefined();
        expect(result.branding).toBeDefined();
      });
    });

    describe('updateSettings', () => {
      it('updates general settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          general: { displayName: 'My Workspace', timezone: 'America/New_York' },
        }, userId);

        expect(result.general.displayName).toBe('My Workspace');
        expect(result.general.timezone).toBe('America/New_York');
      });

      it('updates security settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          security: { mfaRequired: true, sessionTimeout: 120 },
        }, userId);

        expect(result.security.mfaRequired).toBe(true);
        expect(result.security.sessionTimeout).toBe(120);
      });

      it('updates password policy within security', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          security: { passwordPolicy: { minLength: 12 } },
        }, userId);

        expect(result.security.passwordPolicy.minLength).toBe(12);
        expect(result.security.passwordPolicy.requireUppercase).toBe(true); // Preserved
      });

      it('updates messaging settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          messaging: { maxMessageLength: 10000, enableThreads: false },
        }, userId);

        expect(result.messaging.maxMessageLength).toBe(10000);
        expect(result.messaging.enableThreads).toBe(false);
      });

      it('updates notification settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          notifications: { defaultEmail: true, digestFrequency: 'daily' },
        }, userId);

        expect(result.notifications.defaultEmail).toBe(true);
        expect(result.notifications.digestFrequency).toBe('daily');
      });

      it('updates integration settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          integrations: { allowThirdPartyApps: false, apiRateLimitPerMinute: 30 },
        }, userId);

        expect(result.integrations.allowThirdPartyApps).toBe(false);
        expect(result.integrations.apiRateLimitPerMinute).toBe(30);
      });

      it('updates compliance settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          compliance: { dlpEnabled: true, dataRetentionDays: 90 },
        }, userId);

        expect(result.compliance.dlpEnabled).toBe(true);
        expect(result.compliance.dataRetentionDays).toBe(90);
      });

      it('updates branding settings', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          branding: { primaryColor: '#FF0000', logoUrl: 'https://example.com/logo.png' },
        }, userId);

        expect(result.branding.primaryColor).toBe('#FF0000');
        expect(result.branding.logoUrl).toBe('https://example.com/logo.png');
      });

      it('updates multiple sections at once', async () => {
        const result = await adminService.updateSettings(workspaceId, {
          general: { displayName: 'Updated' },
          security: { mfaRequired: true },
          messaging: { maxMessageLength: 5000 },
        }, userId);

        expect(result.general.displayName).toBe('Updated');
        expect(result.security.mfaRequired).toBe(true);
        expect(result.messaging.maxMessageLength).toBe(5000);
      });

      it('logs admin action on update', async () => {
        await adminService.updateSettings(workspaceId, {
          general: { displayName: 'Test' },
        }, userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.length).toBe(1);
        expect(actions.data[0].action).toBe('settings.updated');
      });

      it('updates updatedAt and updatedBy', async () => {
        const before = new Date();
        const result = await adminService.updateSettings(workspaceId, {
          general: { displayName: 'Test' },
        }, 'user_456');

        expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(result.updatedBy).toBe('user_456');
      });
    });

    describe('resetSettings', () => {
      it('resets specific section to defaults', async () => {
        await adminService.updateSettings(workspaceId, {
          general: { displayName: 'Custom', timezone: 'Asia/Tokyo' },
        }, userId);

        const result = await adminService.resetSettings(workspaceId, 'general');

        expect(result.general.displayName).toBe('Workspace');
        expect(result.general.timezone).toBe('UTC');
      });

      it('resets all sections to defaults', async () => {
        await adminService.updateSettings(workspaceId, {
          general: { displayName: 'Custom' },
          security: { mfaRequired: true },
        }, userId);

        const result = await adminService.resetSettings(workspaceId);

        expect(result.general.displayName).toBe('Workspace');
        expect(result.security.mfaRequired).toBe(false);
      });

      it('resets security section including password policy', async () => {
        await adminService.updateSettings(workspaceId, {
          security: { passwordPolicy: { minLength: 20 } },
        }, userId);

        const result = await adminService.resetSettings(workspaceId, 'security');

        expect(result.security.passwordPolicy.minLength).toBe(8);
      });
    });
  });

  // ===========================================================================
  // Role Tests
  // ===========================================================================

  describe('Roles', () => {
    describe('createRole', () => {
      it('creates a new role', async () => {
        const input: CreateRoleInput = {
          name: 'Moderator',
          description: 'Can moderate content',
          permissions: [{ resource: 'messages', actions: ['read', 'delete'] }],
        };

        const result = await adminService.createRole(workspaceId, input, userId);

        expect(result.name).toBe('Moderator');
        expect(result.description).toBe('Can moderate content');
        expect(result.permissions).toHaveLength(1);
        expect(result.isSystemRole).toBe(false);
      });

      it('creates role with default priority', async () => {
        const input: CreateRoleInput = {
          name: 'Custom Role',
          permissions: [{ resource: 'channels', actions: ['read'] }],
        };

        const result = await adminService.createRole(workspaceId, input, userId);

        expect(result.priority).toBe(50);
      });

      it('creates role with custom priority', async () => {
        const input: CreateRoleInput = {
          name: 'High Priority Role',
          permissions: [{ resource: 'channels', actions: ['read'] }],
          priority: 200,
        };

        const result = await adminService.createRole(workspaceId, input, userId);

        expect(result.priority).toBe(200);
      });

      it('throws error for duplicate role name', async () => {
        const input: CreateRoleInput = {
          name: 'Unique Role',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        };

        await adminService.createRole(workspaceId, input, userId);

        await expect(
          adminService.createRole(workspaceId, input, userId),
        ).rejects.toThrow(RoleAlreadyExistsError);
      });

      it('throws validation error for empty name', async () => {
        const input: CreateRoleInput = {
          name: '',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        };

        await expect(
          adminService.createRole(workspaceId, input, userId),
        ).rejects.toThrow(RoleValidationError);
      });

      it('throws validation error for empty permissions', async () => {
        const input: CreateRoleInput = {
          name: 'No Permissions',
          permissions: [],
        };

        await expect(
          adminService.createRole(workspaceId, input, userId),
        ).rejects.toThrow(RoleValidationError);
      });

      it('throws validation error for name too long', async () => {
        const input: CreateRoleInput = {
          name: 'A'.repeat(100),
          permissions: [{ resource: 'messages', actions: ['read'] }],
        };

        await expect(
          adminService.createRole(workspaceId, input, userId),
        ).rejects.toThrow(RoleValidationError);
      });

      it('logs admin action on create', async () => {
        const input: CreateRoleInput = {
          name: 'New Role',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        };

        await adminService.createRole(workspaceId, input, userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'role.created')).toBe(true);
      });
    });

    describe('getRole', () => {
      it('returns role by ID', async () => {
        const created = await adminService.createRole(workspaceId, {
          name: 'Test',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        const result = await adminService.getRole(created.id);

        expect(result).not.toBeNull();
        expect(result?.name).toBe('Test');
      });

      it('returns null for non-existent role', async () => {
        const result = await adminService.getRole('non_existent');

        expect(result).toBeNull();
      });
    });

    describe('listRoles', () => {
      it('lists all roles in workspace', async () => {
        await adminService.createRole(workspaceId, {
          name: 'Role 1',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);
        await adminService.createRole(workspaceId, {
          name: 'Role 2',
          permissions: [{ resource: 'channels', actions: ['read'] }],
        }, userId);

        const result = await adminService.listRoles(workspaceId);

        expect(result).toHaveLength(2);
      });

      it('returns empty array for workspace with no roles', async () => {
        const result = await adminService.listRoles('empty_workspace');

        expect(result).toHaveLength(0);
      });

      it('sorts roles by priority descending', async () => {
        await adminService.createRole(workspaceId, {
          name: 'Low',
          permissions: [{ resource: 'messages', actions: ['read'] }],
          priority: 10,
        }, userId);
        await adminService.createRole(workspaceId, {
          name: 'High',
          permissions: [{ resource: 'messages', actions: ['read'] }],
          priority: 100,
        }, userId);

        const result = await adminService.listRoles(workspaceId);

        expect(result[0].name).toBe('High');
        expect(result[1].name).toBe('Low');
      });
    });

    describe('updateRole', () => {
      it('updates role name', async () => {
        const role = await adminService.createRole(workspaceId, {
          name: 'Original',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        const result = await adminService.updateRole(role.id, {
          name: 'Updated',
        }, userId);

        expect(result.name).toBe('Updated');
      });

      it('updates role permissions', async () => {
        const role = await adminService.createRole(workspaceId, {
          name: 'Test',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        const newPermissions: Permission[] = [
          { resource: 'messages', actions: ['read', 'create', 'delete'] },
        ];

        const result = await adminService.updateRole(role.id, {
          permissions: newPermissions,
        }, userId);

        expect(result.permissions[0].actions).toContain('delete');
      });

      it('updates role priority', async () => {
        const role = await adminService.createRole(workspaceId, {
          name: 'Test',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        const result = await adminService.updateRole(role.id, {
          priority: 150,
        }, userId);

        expect(result.priority).toBe(150);
      });

      it('throws error for non-existent role', async () => {
        await expect(
          adminService.updateRole('non_existent', { name: 'New' }, userId),
        ).rejects.toThrow(RoleNotFoundError);
      });

      it('throws error when updating system role', async () => {
        const systemRole = createTestRole(workspaceId, { isSystemRole: true });
        await storage.saveRole(systemRole);

        await expect(
          adminService.updateRole(systemRole.id, { name: 'New' }, userId),
        ).rejects.toThrow(SystemRoleError);
      });

      it('throws error for duplicate name when updating', async () => {
        await adminService.createRole(workspaceId, {
          name: 'Existing',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);
        const role = await adminService.createRole(workspaceId, {
          name: 'Another',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        await expect(
          adminService.updateRole(role.id, { name: 'Existing' }, userId),
        ).rejects.toThrow(RoleAlreadyExistsError);
      });

      it('logs admin action on update', async () => {
        const role = await adminService.createRole(workspaceId, {
          name: 'Test',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        await adminService.updateRole(role.id, { name: 'Updated' }, userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'role.updated')).toBe(true);
      });
    });

    describe('deleteRole', () => {
      it('deletes a custom role', async () => {
        const role = await adminService.createRole(workspaceId, {
          name: 'ToDelete',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        await adminService.deleteRole(role.id, userId);

        const result = await adminService.getRole(role.id);
        expect(result).toBeNull();
      });

      it('throws error for non-existent role', async () => {
        await expect(
          adminService.deleteRole('non_existent', userId),
        ).rejects.toThrow(RoleNotFoundError);
      });

      it('throws error when deleting system role', async () => {
        const systemRole = createTestRole(workspaceId, { isSystemRole: true });
        await storage.saveRole(systemRole);

        await expect(
          adminService.deleteRole(systemRole.id, userId),
        ).rejects.toThrow(SystemRoleError);
      });

      it('logs admin action on delete', async () => {
        const role = await adminService.createRole(workspaceId, {
          name: 'ToDelete',
          permissions: [{ resource: 'messages', actions: ['read'] }],
        }, userId);

        await adminService.deleteRole(role.id, userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'role.deleted')).toBe(true);
      });
    });

    describe('getDefaultRoles', () => {
      it('returns all system role templates matching SYSTEM_ROLES', () => {
        const defaults = adminService.getDefaultRoles();

        // Verify the service returns the exact SYSTEM_ROLES definitions
        expect(defaults).toBe(SYSTEM_ROLES);
        expect(defaults).toHaveLength(SYSTEM_ROLES.length);
      });

      it('contains owner, admin, member, and guest roles', () => {
        const defaults = adminService.getDefaultRoles();
        const roleNames = defaults.map(r => r.name);

        expect(roleNames).toContain('owner');
        expect(roleNames).toContain('admin');
        expect(roleNames).toContain('member');
        expect(roleNames).toContain('guest');
      });

      it('owner role has highest priority based on SYSTEM_ROLES', () => {
        const defaults = adminService.getDefaultRoles();
        const owner = defaults.find(r => r.name === 'owner');
        const admin = defaults.find(r => r.name === 'admin');
        const member = defaults.find(r => r.name === 'member');
        const guest = defaults.find(r => r.name === 'guest');

        expect(owner).toBeDefined();
        expect(admin).toBeDefined();
        expect(member).toBeDefined();
        expect(guest).toBeDefined();

        // Verify priority hierarchy matches SYSTEM_ROLES definitions
        expect(owner!.priority).toBeGreaterThan(admin!.priority);
        expect(admin!.priority).toBeGreaterThan(member!.priority);
        expect(member!.priority).toBeGreaterThan(guest!.priority);

        // Verify against the actual SYSTEM_ROLES constant values
        const systemOwner = SYSTEM_ROLES.find(r => r.name === 'owner');
        const systemAdmin = SYSTEM_ROLES.find(r => r.name === 'admin');
        expect(owner!.priority).toBe(systemOwner!.priority);
        expect(admin!.priority).toBe(systemAdmin!.priority);
      });

      it('all system roles are marked as system roles per SYSTEM_ROLES', () => {
        const defaults = adminService.getDefaultRoles();

        // Verify every role from SYSTEM_ROLES is marked as a system role
        for (const role of defaults) {
          expect(role.isSystemRole).toBe(true);
        }

        // Cross-reference with SYSTEM_ROLES constant
        for (const systemRole of SYSTEM_ROLES) {
          expect(systemRole.isSystemRole).toBe(true);
        }
      });

      it('member role is marked as default per SYSTEM_ROLES', () => {
        const defaults = adminService.getDefaultRoles();
        const member = defaults.find(r => r.name === 'member');
        const owner = defaults.find(r => r.name === 'owner');

        expect(member!.isDefault).toBe(true);
        expect(owner!.isDefault).toBe(false);

        // Verify consistency with SYSTEM_ROLES constant
        const systemMember = SYSTEM_ROLES.find(r => r.name === 'member');
        expect(systemMember!.isDefault).toBe(true);
      });

      it('owner role has full permissions as defined in SYSTEM_ROLES', () => {
        const defaults = adminService.getDefaultRoles();
        const owner = defaults.find(r => r.name === 'owner');
        const systemOwner = SYSTEM_ROLES.find(r => r.name === 'owner');

        expect(owner).toBeDefined();
        expect(systemOwner).toBeDefined();
        expect(owner!.permissions).toEqual(systemOwner!.permissions);

        // Owner should have permissions on all resources including billing
        const resources = owner!.permissions.map(p => p.resource);
        expect(resources).toContain('workspace');
        expect(resources).toContain('billing');
        expect(resources).toContain('settings');
      });
    });
  });

  // ===========================================================================
  // Member Tests
  // ===========================================================================

  describe('Members', () => {
    beforeEach(async () => {
      // Create a default role for members
      const role = createTestRole(workspaceId, { id: 'role_123', isDefault: true });
      await storage.saveRole(role);
    });

    describe('listMembers', () => {
      it('lists members in workspace', async () => {
        const member1 = createTestMember(workspaceId, 'user_1');
        const member2 = createTestMember(workspaceId, 'user_2');
        await storage.saveMember(member1);
        await storage.saveMember(member2);

        const result = await adminService.listMembers(workspaceId);

        expect(result.data).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('filters by status', async () => {
        const active = createTestMember(workspaceId, 'user_1', { status: 'active' });
        const suspended = createTestMember(workspaceId, 'user_2', { status: 'suspended' });
        await storage.saveMember(active);
        await storage.saveMember(suspended);

        const result = await adminService.listMembers(workspaceId, { status: 'active' });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('active');
      });

      it('filters by role', async () => {
        const member1 = createTestMember(workspaceId, 'user_1', { roleId: 'role_1' });
        const member2 = createTestMember(workspaceId, 'user_2', { roleId: 'role_2' });
        await storage.saveMember(member1);
        await storage.saveMember(member2);

        const result = await adminService.listMembers(workspaceId, { roleId: 'role_1' });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].roleId).toBe('role_1');
      });

      it('searches by name and email', async () => {
        const john = createTestMember(workspaceId, 'user_1', { user: { id: 'user_1', name: 'John Doe', email: 'john@example.com' } });
        const jane = createTestMember(workspaceId, 'user_2', { user: { id: 'user_2', name: 'Jane Smith', email: 'jane@example.com' } });
        await storage.saveMember(john);
        await storage.saveMember(jane);

        const result = await adminService.listMembers(workspaceId, { search: 'john' });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].user?.name).toBe('John Doe');
      });

      it('paginates results', async () => {
        for (let i = 0; i < 10; i++) {
          await storage.saveMember(createTestMember(workspaceId, `user_${i}`));
        }

        const page1 = await adminService.listMembers(workspaceId, { skip: 0, take: 5 });
        const page2 = await adminService.listMembers(workspaceId, { skip: 5, take: 5 });

        expect(page1.data).toHaveLength(5);
        expect(page2.data).toHaveLength(5);
        expect(page1.hasMore).toBe(true);
        expect(page2.hasMore).toBe(false);
      });

      it('returns hasMore correctly', async () => {
        for (let i = 0; i < 3; i++) {
          await storage.saveMember(createTestMember(workspaceId, `user_${i}`));
        }

        const result = await adminService.listMembers(workspaceId, { skip: 0, take: 5 });

        expect(result.hasMore).toBe(false);
        expect(result.total).toBe(3);
      });
    });

    describe('getMember', () => {
      it('returns member by workspace and user ID', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        const result = await adminService.getMember(workspaceId, userId);

        expect(result).not.toBeNull();
        expect(result?.userId).toBe(userId);
      });

      it('returns null for non-existent member', async () => {
        const result = await adminService.getMember(workspaceId, 'non_existent');

        expect(result).toBeNull();
      });
    });

    describe('updateMember', () => {
      it('updates member role', async () => {
        const newRole = createTestRole(workspaceId, { id: 'new_role' });
        await storage.saveRole(newRole);
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        const result = await adminService.updateMember(workspaceId, userId, {
          roleId: 'new_role',
        }, 'admin_user');

        expect(result.roleId).toBe('new_role');
      });

      it('updates member status', async () => {
        const member = createTestMember(workspaceId, userId, { status: 'active' });
        await storage.saveMember(member);

        const result = await adminService.updateMember(workspaceId, userId, {
          status: 'suspended',
        }, 'admin_user');

        expect(result.status).toBe('suspended');
      });

      it('updates custom fields', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        const result = await adminService.updateMember(workspaceId, userId, {
          customFields: { department: 'Engineering' },
        }, 'admin_user');

        expect(result.customFields?.department).toBe('Engineering');
      });

      it('throws error for non-existent member', async () => {
        await expect(
          adminService.updateMember(workspaceId, 'non_existent', { status: 'active' }, userId),
        ).rejects.toThrow(MemberNotFoundError);
      });

      it('throws error for non-existent role', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        await expect(
          adminService.updateMember(workspaceId, userId, { roleId: 'non_existent' }, 'admin'),
        ).rejects.toThrow(RoleNotFoundError);
      });
    });

    describe('suspendMember', () => {
      it('suspends a member with reason', async () => {
        const member = createTestMember(workspaceId, userId, { status: 'active' });
        await storage.saveMember(member);

        const result = await adminService.suspendMember(
          workspaceId, userId, 'Violation of terms', 'admin_user',
        );

        expect(result.status).toBe('suspended');
        expect(result.customFields?.suspensionReason).toBe('Violation of terms');
      });

      it('logs admin action on suspend', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        await adminService.suspendMember(workspaceId, userId, 'Test reason', 'admin_user');

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'member.suspended')).toBe(true);
      });

      it('throws error for non-existent member', async () => {
        await expect(
          adminService.suspendMember(workspaceId, 'non_existent', 'Test', userId),
        ).rejects.toThrow(MemberNotFoundError);
      });
    });

    describe('removeMember', () => {
      it('removes member from workspace', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        await adminService.removeMember(workspaceId, userId, 'admin_user');

        const result = await adminService.getMember(workspaceId, userId);
        expect(result).toBeNull();
      });

      it('logs admin action on remove', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        await adminService.removeMember(workspaceId, userId, 'admin_user');

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'member.removed')).toBe(true);
      });

      it('throws error for non-existent member', async () => {
        await expect(
          adminService.removeMember(workspaceId, 'non_existent', userId),
        ).rejects.toThrow(MemberNotFoundError);
      });
    });

    describe('changeMemberRole', () => {
      it('changes member role', async () => {
        const newRole = createTestRole(workspaceId, { id: 'admin_role', name: 'Admin' });
        await storage.saveRole(newRole);
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        const result = await adminService.changeMemberRole(
          workspaceId, userId, 'admin_role', 'owner_user',
        );

        expect(result.roleId).toBe('admin_role');
        expect(result.role?.name).toBe('Admin');
      });

      it('logs admin action with previous and new role', async () => {
        const newRole = createTestRole(workspaceId, { id: 'new_role' });
        await storage.saveRole(newRole);
        const member = createTestMember(workspaceId, userId, { roleId: 'old_role' });
        await storage.saveMember(member);

        await adminService.changeMemberRole(workspaceId, userId, 'new_role', 'admin_user');

        const actions = await adminService.getAdminActions(workspaceId);
        const action = actions.data.find(a => a.action === 'member.role_changed');
        expect(action?.details.previousRoleId).toBe('old_role');
        expect(action?.details.newRoleId).toBe('new_role');
      });

      it('throws error for non-existent member', async () => {
        await expect(
          adminService.changeMemberRole(workspaceId, 'non_existent', 'role_123', userId),
        ).rejects.toThrow(MemberNotFoundError);
      });

      it('throws error for non-existent role', async () => {
        const member = createTestMember(workspaceId, userId);
        await storage.saveMember(member);

        await expect(
          adminService.changeMemberRole(workspaceId, userId, 'non_existent', 'admin'),
        ).rejects.toThrow(RoleNotFoundError);
      });
    });
  });

  // ===========================================================================
  // Invite Tests
  // ===========================================================================

  describe('Invites', () => {
    beforeEach(async () => {
      const role = createTestRole(workspaceId, { id: 'role_123', isDefault: true });
      await storage.saveRole(role);
    });

    describe('createInvite', () => {
      it('creates a new invite', async () => {
        const result = await adminService.createInvite(workspaceId, {
          email: 'newuser@example.com',
        }, userId);

        expect(result.email).toBe('newuser@example.com');
        expect(result.status).toBe('pending');
        expect(result.workspaceId).toBe(workspaceId);
      });

      it('normalizes email to lowercase', async () => {
        const result = await adminService.createInvite(workspaceId, {
          email: 'User@Example.COM',
        }, userId);

        expect(result.email).toBe('user@example.com');
      });

      it('uses default role when not specified', async () => {
        const result = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        expect(result.roleId).toBe('role_123');
      });

      it('uses specified role', async () => {
        const customRole = createTestRole(workspaceId, { id: 'custom_role' });
        await storage.saveRole(customRole);

        const result = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
          roleId: 'custom_role',
        }, userId);

        expect(result.roleId).toBe('custom_role');
      });

      it('returns existing pending invite for same email', async () => {
        const first = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);
        const second = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        expect(second.id).toBe(first.id);
      });

      it('sets expiration date', async () => {
        const before = new Date();
        const result = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        expect(result.expiresAt.getTime()).toBeGreaterThan(before.getTime());
      });

      it('logs admin action', async () => {
        await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'member.invited')).toBe(true);
      });
    });

    describe('listInvites', () => {
      it('lists pending invites', async () => {
        await adminService.createInvite(workspaceId, { email: 'user1@example.com' }, userId);
        await adminService.createInvite(workspaceId, { email: 'user2@example.com' }, userId);

        const result = await adminService.listInvites(workspaceId);

        expect(result).toHaveLength(2);
      });

      it('excludes non-pending invites', async () => {
        const invite = await adminService.createInvite(workspaceId, { email: 'user@example.com' }, userId);
        await adminService.revokeInvite(invite.id, userId);

        const result = await adminService.listInvites(workspaceId);

        expect(result).toHaveLength(0);
      });

      it('sorts by creation date descending', async () => {
        await adminService.createInvite(workspaceId, { email: 'user1@example.com' }, userId);
        await new Promise(resolve => setTimeout(resolve, 10));
        await adminService.createInvite(workspaceId, { email: 'user2@example.com' }, userId);

        const result = await adminService.listInvites(workspaceId);

        expect(result[0].email).toBe('user2@example.com');
      });
    });

    describe('revokeInvite', () => {
      it('revokes a pending invite', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        await adminService.revokeInvite(invite.id, userId);

        const updated = await storage.getInvite(invite.id);
        expect(updated?.status).toBe('revoked');
      });

      it('logs admin action', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        await adminService.revokeInvite(invite.id, userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'invite.revoked')).toBe(true);
      });

      it('throws error for non-existent invite', async () => {
        await expect(
          adminService.revokeInvite('non_existent', userId),
        ).rejects.toThrow(InviteNotFoundError);
      });
    });

    describe('acceptInvite', () => {
      it('accepts invite and creates member', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        const result = await adminService.acceptInvite(invite.id, 'new_user_123');

        expect(result.userId).toBe('new_user_123');
        expect(result.workspaceId).toBe(workspaceId);
        expect(result.status).toBe('active');
      });

      it('marks invite as accepted', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);

        await adminService.acceptInvite(invite.id, 'new_user_123');

        const updated = await storage.getInvite(invite.id);
        expect(updated?.status).toBe('accepted');
        expect(updated?.acceptedAt).toBeDefined();
      });

      it('assigns role from invite', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
          roleId: 'role_123',
        }, userId);

        const result = await adminService.acceptInvite(invite.id, 'new_user_123');

        expect(result.roleId).toBe('role_123');
      });

      it('records inviter', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, 'inviter_user');

        const result = await adminService.acceptInvite(invite.id, 'new_user_123');

        expect(result.invitedBy).toBe('inviter_user');
      });

      it('throws error for non-existent invite', async () => {
        await expect(
          adminService.acceptInvite('non_existent', userId),
        ).rejects.toThrow(InviteNotFoundError);
      });

      it('throws error for revoked invite', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);
        await adminService.revokeInvite(invite.id, userId);

        await expect(
          adminService.acceptInvite(invite.id, 'new_user'),
        ).rejects.toThrow(InviteInvalidError);
      });

      it('throws error for already accepted invite', async () => {
        const invite = await adminService.createInvite(workspaceId, {
          email: 'user@example.com',
        }, userId);
        await adminService.acceptInvite(invite.id, 'first_user');

        await expect(
          adminService.acceptInvite(invite.id, 'second_user'),
        ).rejects.toThrow(InviteInvalidError);
      });

      it('throws error for expired invite', async () => {
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 1);
        const invite = createTestInvite(workspaceId, { expiresAt: expiredDate });
        await storage.saveInvite(invite);

        await expect(
          adminService.acceptInvite(invite.id, 'new_user'),
        ).rejects.toThrow(InviteExpiredError);
      });

      it('marks invite as expired when accepting an expired invite', async () => {
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 1);
        const invite = createTestInvite(workspaceId, { expiresAt: expiredDate });
        await storage.saveInvite(invite);

        await expect(
          adminService.acceptInvite(invite.id, 'new_user'),
        ).rejects.toThrow(InviteExpiredError);

        const updated = await storage.getInvite(invite.id);
        expect(updated?.status).toBe('expired');
      });
    });
  });

  // ===========================================================================
  // Billing Tests
  // ===========================================================================

  describe('Billing', () => {
    describe('getBillingInfo', () => {
      it('returns billing info for workspace', async () => {
        const billing = createTestBillingInfo(workspaceId);
        await storage.saveBillingInfo(billing);

        const result = await adminService.getBillingInfo(workspaceId);

        expect(result).not.toBeNull();
        expect(result?.plan).toBe('starter');
      });

      it('returns null when no billing info exists', async () => {
        const result = await adminService.getBillingInfo('no_billing_workspace');

        expect(result).toBeNull();
      });
    });

    describe('updatePlan', () => {
      it('creates billing info when updating plan', async () => {
        const result = await adminService.updatePlan(workspaceId, 'professional', userId);

        expect(result.plan).toBe('professional');
        expect(result.features).toEqual(PLAN_FEATURES.professional);
      });

      it('updates existing billing info', async () => {
        const billing = createTestBillingInfo(workspaceId, { plan: 'free' });
        await storage.saveBillingInfo(billing);

        const result = await adminService.updatePlan(workspaceId, 'enterprise', userId);

        expect(result.plan).toBe('enterprise');
      });

      it('updates features based on plan', async () => {
        const result = await adminService.updatePlan(workspaceId, 'enterprise', userId);

        expect(result.features.maxMembers).toBe(-1); // unlimited
        expect(result.features.sso).toBe(true);
      });

      it('logs admin action', async () => {
        await adminService.updatePlan(workspaceId, 'professional', userId);

        const actions = await adminService.getAdminActions(workspaceId);
        expect(actions.data.some(a => a.action === 'billing.plan_changed')).toBe(true);
      });

      it('updates period dates', async () => {
        const before = new Date();
        const result = await adminService.updatePlan(workspaceId, 'starter', userId);

        expect(result.currentPeriodStart.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(result.currentPeriodEnd.getTime()).toBeGreaterThan(result.currentPeriodStart.getTime());
      });
    });
  });

  // ===========================================================================
  // Admin Actions Tests
  // ===========================================================================

  describe('Admin Actions', () => {
    describe('logAdminAction', () => {
      it('logs action with generated ID and timestamp', async () => {
        const result = await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'settings.updated',
          resource: 'settings',
          details: { section: 'general' },
        });

        expect(result.id).toBeDefined();
        expect(result.timestamp).toBeDefined();
        expect(result.action).toBe('settings.updated');
      });

      it('preserves all provided fields', async () => {
        const result = await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'member.invited',
          resource: 'invites',
          resourceId: 'invite_123',
          details: { email: 'test@example.com' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        });

        expect(result.resourceId).toBe('invite_123');
        expect(result.ipAddress).toBe('192.168.1.1');
        expect(result.userAgent).toBe('Mozilla/5.0');
      });
    });

    describe('getAdminActions', () => {
      it('lists actions for workspace', async () => {
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'settings.updated',
          resource: 'settings',
          details: {},
        });
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'role.created',
          resource: 'roles',
          details: {},
        });

        const result = await adminService.getAdminActions(workspaceId);

        expect(result.data).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('filters by actor', async () => {
        await adminService.logAdminAction({
          workspaceId,
          actorId: 'user_1',
          action: 'settings.updated',
          resource: 'settings',
          details: {},
        });
        await adminService.logAdminAction({
          workspaceId,
          actorId: 'user_2',
          action: 'role.created',
          resource: 'roles',
          details: {},
        });

        const result = await adminService.getAdminActions(workspaceId, {
          actorId: 'user_1',
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].actorId).toBe('user_1');
      });

      it('filters by action type', async () => {
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'settings.updated',
          resource: 'settings',
          details: {},
        });
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'role.created',
          resource: 'roles',
          details: {},
        });

        const result = await adminService.getAdminActions(workspaceId, {
          action: 'role.created',
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].action).toBe('role.created');
      });

      it('filters by resource', async () => {
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'settings.updated',
          resource: 'settings',
          details: {},
        });
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'member.invited',
          resource: 'invites',
          details: {},
        });

        const result = await adminService.getAdminActions(workspaceId, {
          resource: 'settings',
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].resource).toBe('settings');
      });

      it('filters by date range', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 10);
        const recentDate = new Date();

        await storage.saveAdminAction({
          id: 'old_action',
          workspaceId,
          actorId: userId,
          action: 'settings.updated',
          resource: 'settings',
          details: {},
          timestamp: oldDate,
        });
        await storage.saveAdminAction({
          id: 'recent_action',
          workspaceId,
          actorId: userId,
          action: 'role.created',
          resource: 'roles',
          details: {},
          timestamp: recentDate,
        });

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 5);

        const result = await adminService.getAdminActions(workspaceId, {
          startDate,
        });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('recent_action');
      });

      it('paginates results', async () => {
        for (let i = 0; i < 10; i++) {
          await adminService.logAdminAction({
            workspaceId,
            actorId: userId,
            action: 'settings.updated',
            resource: 'settings',
            details: { index: i },
          });
        }

        const page1 = await adminService.getAdminActions(workspaceId, { skip: 0, take: 5 });
        const page2 = await adminService.getAdminActions(workspaceId, { skip: 5, take: 5 });

        expect(page1.data).toHaveLength(5);
        expect(page2.data).toHaveLength(5);
        expect(page1.hasMore).toBe(true);
      });

      it('sorts by timestamp descending', async () => {
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'settings.updated',
          resource: 'settings',
          details: { order: 1 },
        });
        await new Promise(resolve => setTimeout(resolve, 10));
        await adminService.logAdminAction({
          workspaceId,
          actorId: userId,
          action: 'role.created',
          resource: 'roles',
          details: { order: 2 },
        });

        const result = await adminService.getAdminActions(workspaceId);

        expect(result.data[0].details.order).toBe(2);
        expect(result.data[1].details.order).toBe(1);
      });
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createAdminService', () => {
    it('creates service instance with custom storage', () => {
      const customStorage = new InMemoryAdminStorage();
      const service = createAdminService(customStorage);

      expect(service).toBeInstanceOf(AdminServiceImpl);
    });

    it('operations use provided storage', async () => {
      const customStorage = new InMemoryAdminStorage();
      customStorage.addWorkspace('custom_workspace');
      const service = createAdminService(customStorage);

      const settings = await service.getSettings('custom_workspace');

      expect(settings.workspaceId).toBe('custom_workspace');
    });
  });
});
