import { RoleBasedAccessControl } from '../../src/rbac/RoleBasedAccessControl';
import { jest } from '@jest/globals';

describe('RoleBasedAccessControl', () => {
  let rbac: RoleBasedAccessControl;
  
  beforeEach(() => {
    rbac = new RoleBasedAccessControl({
      enableAuditLogging: false,
      enableCaching: false,
      defaultDenyAll: true
    });
  });

  describe('User Management', () => {
    it('should create a user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject user creation with invalid roles', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: ['non-existent-role'],
        permissions: [],
        isActive: true
      };

      await expect(rbac.createUser(userData)).rejects.toThrow('Role non-existent-role does not exist');
    });

    it('should update user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        isActive: true
      };

      const user = await rbac.createUser(userData);
      const updatedUser = await rbac.updateUser(user.id, { 
        email: 'newemail@example.com' 
      });

      expect(updatedUser.email).toBe('newemail@example.com');
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
    });

    it('should delete user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        isActive: true
      };

      const user = await rbac.createUser(userData);
      await rbac.deleteUser(user.id);

      const retrievedUser = rbac.getUser(user.id);
      expect(retrievedUser).toBeNull();
    });

    it('should list users with filters', async () => {
      const userData1 = {
        username: 'activeuser',
        email: 'active@example.com',
        roles: [],
        permissions: [],
        isActive: true
      };

      const userData2 = {
        username: 'inactiveuser',
        email: 'inactive@example.com',
        roles: [],
        permissions: [],
        isActive: false
      };

      await rbac.createUser(userData1);
      await rbac.createUser(userData2);

      const activeUsers = rbac.listUsers({ active: true });
      const inactiveUsers = rbac.listUsers({ active: false });

      expect(activeUsers).toHaveLength(1);
      expect(inactiveUsers).toHaveLength(1);
      expect(activeUsers[0].username).toBe('activeuser');
      expect(inactiveUsers[0].username).toBe('inactiveuser');
    });
  });

  describe('Role Management', () => {
    it('should create role with valid permissions', async () => {
      // First create a permission
      const permission = await rbac.createPermission({
        name: 'test:read',
        description: 'Test read permission',
        resource: 'test',
        action: 'read'
      });

      const roleData = {
        name: 'Test Role',
        description: 'A test role',
        permissions: [permission.id],
        isSystem: false
      };

      const role = await rbac.createRole(roleData);

      expect(role.id).toBeDefined();
      expect(role.name).toBe('Test Role');
      expect(role.permissions).toContain(permission.id);
    });

    it('should reject role creation with invalid permissions', async () => {
      const roleData = {
        name: 'Test Role',
        description: 'A test role',
        permissions: ['non-existent-permission'],
        isSystem: false
      };

      await expect(rbac.createRole(roleData)).rejects.toThrow('Permission non-existent-permission does not exist');
    });

    it('should prevent deletion of system roles', async () => {
      const roles = rbac.listRoles();
      const systemRole = roles.find(role => role.isSystem);
      
      if (systemRole) {
        await expect(rbac.deleteRole(systemRole.id)).rejects.toThrow('Cannot delete system role');
      }
    });
  });

  describe('Permission Management', () => {
    it('should create permission successfully', async () => {
      const permissionData = {
        name: 'file:write',
        description: 'Write file permission',
        resource: 'file',
        action: 'write'
      };

      const permission = await rbac.createPermission(permissionData);

      expect(permission.id).toBeDefined();
      expect(permission.name).toBe('file:write');
      expect(permission.resource).toBe('file');
      expect(permission.action).toBe('write');
    });

    it('should delete permission and remove from roles', async () => {
      // Create permission
      const permission = await rbac.createPermission({
        name: 'test:delete',
        description: 'Test delete permission',
        resource: 'test',
        action: 'delete'
      });

      // Create role with permission
      const role = await rbac.createRole({
        name: 'Test Role',
        description: 'Test role',
        permissions: [permission.id],
        isSystem: false
      });

      // Delete permission
      await rbac.deletePermission(permission.id);

      // Check that permission is removed from role
      const updatedRole = rbac.getRole(role.id);
      expect(updatedRole?.permissions).not.toContain(permission.id);

      // Check that permission is deleted
      const deletedPermission = rbac.getPermission(permission.id);
      expect(deletedPermission).toBeNull();
    });
  });

  describe('Access Control', () => {
    it('should deny access when user not found', async () => {
      const request = {
        userId: 'non-existent-user',
        resource: 'test-resource',
        action: 'read',
        timestamp: new Date()
      };

      const result = await rbac.checkAccess(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User not found');
    });

    it('should deny access when user is inactive', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        isActive: false
      };

      const user = await rbac.createUser(userData);

      const request = {
        userId: user.id,
        resource: 'test-resource',
        action: 'read',
        timestamp: new Date()
      };

      const result = await rbac.checkAccess(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User account is inactive');
    });

    it('should grant access with matching permission', async () => {
      // Create permission
      const permission = await rbac.createPermission({
        name: 'file:read',
        description: 'Read file permission',
        resource: 'file',
        action: 'read'
      });

      // Create user with permission
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [permission.id],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      const request = {
        userId: user.id,
        resource: 'file',
        action: 'read',
        timestamp: new Date()
      };

      const result = await rbac.checkAccess(request);

      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Access granted');
      expect(result.matchedPermissions).toContain(permission.id);
    });

    it('should grant access with role-based permission', async () => {
      // Create permission
      const permission = await rbac.createPermission({
        name: 'file:write',
        description: 'Write file permission',
        resource: 'file',
        action: 'write'
      });

      // Create role with permission
      const role = await rbac.createRole({
        name: 'File Writer',
        description: 'Can write files',
        permissions: [permission.id],
        isSystem: false
      });

      // Create user with role
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [role.id],
        permissions: [],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      const request = {
        userId: user.id,
        resource: 'file',
        action: 'write',
        timestamp: new Date()
      };

      const result = await rbac.checkAccess(request);

      expect(result.granted).toBe(true);
      expect(result.matchedPermissions).toContain(permission.id);
    });

    it('should handle wildcard permissions', async () => {
      // Create wildcard permission
      const permission = await rbac.createPermission({
        name: 'admin:all',
        description: 'Full admin access',
        resource: '*',
        action: '*'
      });

      // Create user with permission
      const userData = {
        username: 'admin',
        email: 'admin@example.com',
        roles: [],
        permissions: [permission.id],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      const request = {
        userId: user.id,
        resource: 'any-resource',
        action: 'any-action',
        timestamp: new Date()
      };

      const result = await rbac.checkAccess(request);

      expect(result.granted).toBe(true);
      expect(result.matchedPermissions).toContain(permission.id);
    });
  });

  describe('Convenience Methods', () => {
    it('should assign role to user', async () => {
      // Create role
      const role = await rbac.createRole({
        name: 'Test Role',
        description: 'Test role',
        permissions: [],
        isSystem: false
      });

      // Create user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      // Assign role
      await rbac.assignRoleToUser(user.id, role.id);

      const updatedUser = rbac.getUser(user.id);
      expect(updatedUser?.roles).toContain(role.id);
    });

    it('should remove role from user', async () => {
      // Create role
      const role = await rbac.createRole({
        name: 'Test Role',
        description: 'Test role',
        permissions: [],
        isSystem: false
      });

      // Create user with role
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [role.id],
        permissions: [],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      // Remove role
      await rbac.removeRoleFromUser(user.id, role.id);

      const updatedUser = rbac.getUser(user.id);
      expect(updatedUser?.roles).not.toContain(role.id);
    });

    it('should check permission existence', async () => {
      // Create permission
      const permission = await rbac.createPermission({
        name: 'test:check',
        description: 'Test check permission',
        resource: 'test',
        action: 'check'
      });

      // Create user with permission
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [permission.id],
        isActive: true
      };

      const user = await rbac.createUser(userData);

      // Check permission
      const hasPermission = await rbac.hasPermission(user.id, 'test', 'check');
      const noPermission = await rbac.hasPermission(user.id, 'other', 'action');

      expect(hasPermission).toBe(true);
      expect(noPermission).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit events for user operations', async () => {
      const eventSpy = jest.fn();
      rbac.on('user:created', eventSpy);

      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        isActive: true
      };

      await rbac.createUser(userData);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        username: 'testuser',
        email: 'test@example.com'
      }));
    });

    it('should emit events for access control', async () => {
      const deniedEventSpy = jest.fn();
      rbac.on('access:denied', deniedEventSpy);

      const request = {
        userId: 'non-existent',
        resource: 'test',
        action: 'read',
        timestamp: new Date()
      };

      await rbac.checkAccess(request);

      expect(deniedEventSpy).toHaveBeenCalled();
    });
  });
});