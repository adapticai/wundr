import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: AccessCondition[];
  metadata?: Record<string, any>;
}

export interface AccessCondition {
  type: 'time' | 'location' | 'resource_owner' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
  field?: string;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export interface AccessResult {
  granted: boolean;
  reason: string;
  matchedPermissions: string[];
  failedConditions: string[];
  metadata?: Record<string, any>;
}

export interface RBACOptions {
  enableAuditLogging?: boolean;
  enableCaching?: boolean;
  cacheExpirationMs?: number;
  defaultDenyAll?: boolean;
}

export class RoleBasedAccessControl extends EventEmitter {
  private users: Map<string, User> = new Map();
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private accessCache: Map<string, { result: AccessResult; expiresAt: number }> = new Map();
  private options: Required<RBACOptions>;

  constructor(options: RBACOptions = {}) {
    super();
    this.options = {
      enableAuditLogging: options.enableAuditLogging ?? true,
      enableCaching: options.enableCaching ?? true,
      cacheExpirationMs: options.cacheExpirationMs ?? 300000, // 5 minutes
      defaultDenyAll: options.defaultDenyAll ?? true
    };

    this.initializeDefaultRolesAndPermissions();
    this.setupCacheCleanup();
  }

  // User Management
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...userData
    };

    // Validate roles exist
    for (const roleId of user.roles) {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role ${roleId} does not exist`);
      }
    }

    this.users.set(user.id, user);
    this.emit('user:created', user);
    
    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'user.create',
        resource: `user:${user.id}`,
        details: { username: user.username, roles: user.roles }
      });
    }

    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Validate role changes
    if (updates.roles) {
      for (const roleId of updates.roles) {
        if (!this.roles.has(roleId)) {
          throw new Error(`Role ${roleId} does not exist`);
        }
      }
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      id: user.id, // Prevent ID changes
      createdAt: user.createdAt, // Prevent creation date changes
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    this.clearUserCache(userId);
    this.emit('user:updated', updatedUser);

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'user.update',
        resource: `user:${userId}`,
        details: { updates, oldRoles: user.roles, newRoles: updatedUser.roles }
      });
    }

    return updatedUser;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    this.users.delete(userId);
    this.clearUserCache(userId);
    this.emit('user:deleted', { userId, username: user.username });

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'user.delete',
        resource: `user:${userId}`,
        details: { username: user.username }
      });
    }
  }

  getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  listUsers(filter?: { active?: boolean; role?: string }): User[] {
    let users = Array.from(this.users.values());

    if (filter) {
      if (filter.active !== undefined) {
        users = users.filter(user => user.isActive === filter.active);
      }
      if (filter.role) {
        users = users.filter(user => user.roles.includes(filter.role!));
      }
    }

    return users;
  }

  // Role Management
  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const role: Role = {
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...roleData
    };

    // Validate permissions exist
    for (const permissionId of role.permissions) {
      if (!this.permissions.has(permissionId)) {
        throw new Error(`Permission ${permissionId} does not exist`);
      }
    }

    this.roles.set(role.id, role);
    this.clearAllCache(); // Role changes affect all users
    this.emit('role:created', role);

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'role.create',
        resource: `role:${role.id}`,
        details: { name: role.name, permissions: role.permissions }
      });
    }

    return role;
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    if (role.isSystem && (updates.name || updates.permissions)) {
      throw new Error('Cannot modify system role name or permissions');
    }

    // Validate permission changes
    if (updates.permissions) {
      for (const permissionId of updates.permissions) {
        if (!this.permissions.has(permissionId)) {
          throw new Error(`Permission ${permissionId} does not exist`);
        }
      }
    }

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id,
      createdAt: role.createdAt,
      updatedAt: new Date()
    };

    this.roles.set(roleId, updatedRole);
    this.clearAllCache();
    this.emit('role:updated', updatedRole);

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'role.update',
        resource: `role:${roleId}`,
        details: { updates, oldPermissions: role.permissions, newPermissions: updatedRole.permissions }
      });
    }

    return updatedRole;
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    // Remove role from all users
    for (const user of this.users.values()) {
      if (user.roles.includes(roleId)) {
        user.roles = user.roles.filter(id => id !== roleId);
        user.updatedAt = new Date();
      }
    }

    this.roles.delete(roleId);
    this.clearAllCache();
    this.emit('role:deleted', { roleId, name: role.name });

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'role.delete',
        resource: `role:${roleId}`,
        details: { name: role.name }
      });
    }
  }

  getRole(roleId: string): Role | null {
    return this.roles.get(roleId) || null;
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  // Permission Management
  async createPermission(permissionData: Omit<Permission, 'id'>): Promise<Permission> {
    const permission: Permission = {
      id: this.generateId(),
      ...permissionData
    };

    this.permissions.set(permission.id, permission);
    this.clearAllCache();
    this.emit('permission:created', permission);

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'permission.create',
        resource: `permission:${permission.id}`,
        details: { name: permission.name, resource: permission.resource, action: permission.action }
      });
    }

    return permission;
  }

  async deletePermission(permissionId: string): Promise<void> {
    const permission = this.permissions.get(permissionId);
    if (!permission) {
      throw new Error(`Permission ${permissionId} not found`);
    }

    // Remove permission from all roles
    for (const role of this.roles.values()) {
      if (role.permissions.includes(permissionId)) {
        role.permissions = role.permissions.filter(id => id !== permissionId);
        role.updatedAt = new Date();
      }
    }

    this.permissions.delete(permissionId);
    this.clearAllCache();
    this.emit('permission:deleted', { permissionId, name: permission.name });

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'permission.delete',
        resource: `permission:${permissionId}`,
        details: { name: permission.name }
      });
    }
  }

  getPermission(permissionId: string): Permission | null {
    return this.permissions.get(permissionId) || null;
  }

  listPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  // Access Control
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    // Check cache first
    if (this.options.enableCaching) {
      const cacheKey = this.generateCacheKey(request);
      const cached = this.accessCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.result;
      }
    }

    const user = this.users.get(request.userId);
    if (!user) {
      const result: AccessResult = {
        granted: false,
        reason: 'User not found',
        matchedPermissions: [],
        failedConditions: []
      };
      
      if (this.options.enableAuditLogging) {
        this.emit('audit:log', {
          action: 'access.denied',
          resource: request.resource,
          details: { reason: 'User not found', userId: request.userId }
        });
      }
      
      return result;
    }

    if (!user.isActive) {
      const result: AccessResult = {
        granted: false,
        reason: 'User account is inactive',
        matchedPermissions: [],
        failedConditions: []
      };
      
      if (this.options.enableAuditLogging) {
        this.emit('audit:log', {
          action: 'access.denied',
          resource: request.resource,
          details: { reason: 'User inactive', userId: request.userId }
        });
      }
      
      return result;
    }

    // Get all user permissions
    const userPermissions = await this.getUserPermissions(user);
    
    // Check if any permission matches the request
    const matchedPermissions: string[] = [];
    const failedConditions: string[] = [];

    for (const permission of userPermissions) {
      if (this.permissionMatches(permission, request)) {
        // Check conditions if any
        if (permission.conditions && permission.conditions.length > 0) {
          const conditionResult = await this.evaluateConditions(permission.conditions, request);
          if (conditionResult.passed) {
            matchedPermissions.push(permission.id);
          } else {
            failedConditions.push(...conditionResult.failed);
          }
        } else {
          matchedPermissions.push(permission.id);
        }
      }
    }

    const granted = matchedPermissions.length > 0;
    const result: AccessResult = {
      granted,
      reason: granted ? 'Access granted' : (failedConditions.length > 0 ? 'Conditions not met' : 'No matching permissions'),
      matchedPermissions,
      failedConditions
    };

    // Cache the result
    if (this.options.enableCaching) {
      const cacheKey = this.generateCacheKey(request);
      this.accessCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.options.cacheExpirationMs
      });
    }

    // Audit log
    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: granted ? 'access.granted' : 'access.denied',
        resource: request.resource,
        details: {
          userId: request.userId,
          action: request.action,
          reason: result.reason,
          matchedPermissions
        }
      });
    }

    this.emit(granted ? 'access:granted' : 'access:denied', { request, result });

    return result;
  }

  async getUserPermissions(user: User): Promise<Permission[]> {
    const permissions: Permission[] = [];
    const permissionIds = new Set<string>();

    // Direct user permissions
    for (const permissionId of user.permissions) {
      if (!permissionIds.has(permissionId)) {
        const permission = this.permissions.get(permissionId);
        if (permission) {
          permissions.push(permission);
          permissionIds.add(permissionId);
        }
      }
    }

    // Role-based permissions
    for (const roleId of user.roles) {
      const role = this.roles.get(roleId);
      if (role) {
        for (const permissionId of role.permissions) {
          if (!permissionIds.has(permissionId)) {
            const permission = this.permissions.get(permissionId);
            if (permission) {
              permissions.push(permission);
              permissionIds.add(permissionId);
            }
          }
        }
      }
    }

    return permissions;
  }

  // Convenience methods for common operations
  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);
    
    const role = this.roles.get(roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);

    if (!user.roles.includes(roleId)) {
      user.roles.push(roleId);
      user.updatedAt = new Date();
      this.clearUserCache(userId);
      
      this.emit('role:assigned', { userId, roleId });
      
      if (this.options.enableAuditLogging) {
        this.emit('audit:log', {
          action: 'role.assign',
          resource: `user:${userId}`,
          details: { roleId, roleName: role.name }
        });
      }
    }
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const roleIndex = user.roles.indexOf(roleId);
    if (roleIndex !== -1) {
      user.roles.splice(roleIndex, 1);
      user.updatedAt = new Date();
      this.clearUserCache(userId);
      
      this.emit('role:removed', { userId, roleId });
      
      if (this.options.enableAuditLogging) {
        this.emit('audit:log', {
          action: 'role.remove',
          resource: `user:${userId}`,
          details: { roleId }
        });
      }
    }
  }

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const request: AccessRequest = {
      userId,
      resource,
      action,
      timestamp: new Date()
    };
    
    const result = await this.checkAccess(request);
    return result.granted;
  }

  // Helper methods
  private permissionMatches(permission: Permission, request: AccessRequest): boolean {
    // Check resource match (support wildcards)
    if (!this.resourceMatches(permission.resource, request.resource)) {
      return false;
    }

    // Check action match (support wildcards)
    if (!this.actionMatches(permission.action, request.action)) {
      return false;
    }

    return true;
  }

  private resourceMatches(permissionResource: string, requestResource: string): boolean {
    if (permissionResource === '*') return true;
    if (permissionResource === requestResource) return true;
    
    // Support wildcard patterns like "files/*"
    if (permissionResource.endsWith('*')) {
      const prefix = permissionResource.slice(0, -1);
      return requestResource.startsWith(prefix);
    }
    
    return false;
  }

  private actionMatches(permissionAction: string, requestAction: string): boolean {
    if (permissionAction === '*') return true;
    if (permissionAction === requestAction) return true;
    
    // Support action hierarchies like "read" matching "read:*"
    if (requestAction.startsWith(permissionAction + ':')) return true;
    
    return false;
  }

  private async evaluateConditions(conditions: AccessCondition[], request: AccessRequest): Promise<{ passed: boolean; failed: string[] }> {
    const failed: string[] = [];
    
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, request);
      if (!result) {
        failed.push(`${condition.type}: ${condition.field || condition.type} ${condition.operator} ${condition.value}`);
      }
    }
    
    return {
      passed: failed.length === 0,
      failed
    };
  }

  private async evaluateCondition(condition: AccessCondition, request: AccessRequest): Promise<boolean> {
    const context = request.context || {};
    
    switch (condition.type) {
      case 'time':
        return this.evaluateTimeCondition(condition, request.timestamp);
      case 'location':
        return this.evaluateLocationCondition(condition, context.location);
      case 'resource_owner':
        return this.evaluateResourceOwnerCondition(condition, request.userId, context.resourceOwner);
      case 'custom':
        return this.evaluateCustomCondition(condition, context);
      default:
        return false;
    }
  }

  private evaluateTimeCondition(condition: AccessCondition, timestamp: Date): boolean {
    // Example: only allow access during business hours
    if (condition.field === 'hour') {
      const hour = timestamp.getHours();
      switch (condition.operator) {
        case 'greater_than':
          return hour > condition.value;
        case 'less_than':
          return hour < condition.value;
        default:
          return false;
      }
    }
    return false;
  }

  private evaluateLocationCondition(condition: AccessCondition, location?: string): boolean {
    if (!location) return false;
    
    switch (condition.operator) {
      case 'equals':
        return location === condition.value;
      case 'not_equals':
        return location !== condition.value;
      case 'contains':
        return location.includes(condition.value);
      case 'not_contains':
        return !location.includes(condition.value);
      default:
        return false;
    }
  }

  private evaluateResourceOwnerCondition(condition: AccessCondition, userId: string, resourceOwner?: string): boolean {
    if (condition.operator === 'equals') {
      return userId === resourceOwner;
    }
    return false;
  }

  private evaluateCustomCondition(condition: AccessCondition, context: Record<string, any>): boolean {
    const value = condition.field ? context[condition.field] : context;
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return Array.isArray(value) ? value.includes(condition.value) : String(value).includes(condition.value);
      case 'not_contains':
        return Array.isArray(value) ? !value.includes(condition.value) : !String(value).includes(condition.value);
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  }

  private generateCacheKey(request: AccessRequest): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify({
      userId: request.userId,
      resource: request.resource,
      action: request.action,
      context: request.context
    }));
    return hash.digest('hex');
  }

  private clearUserCache(userId: string): void {
    if (!this.options.enableCaching) return;
    
    for (const [key, cached] of this.accessCache) {
      // Simple approach: clear all cache entries for the user
      // In a real implementation, you might want to be more selective
      if (key.includes(userId)) {
        this.accessCache.delete(key);
      }
    }
  }

  private clearAllCache(): void {
    this.accessCache.clear();
  }

  private generateId(): string {
    return crypto.randomBytes(12).toString('hex');
  }

  private setupCacheCleanup(): void {
    if (!this.options.enableCaching) return;
    
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.accessCache) {
        if (now >= cached.expiresAt) {
          this.accessCache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  private initializeDefaultRolesAndPermissions(): void {
    // Create default permissions
    const defaultPermissions = [
      { name: 'read:all', description: 'Read access to all resources', resource: '*', action: 'read' },
      { name: 'write:all', description: 'Write access to all resources', resource: '*', action: 'write' },
      { name: 'admin:all', description: 'Full administrative access', resource: '*', action: '*' },
      { name: 'user:read', description: 'Read user information', resource: 'user', action: 'read' },
      { name: 'user:write', description: 'Modify user information', resource: 'user', action: 'write' },
      { name: 'file:read', description: 'Read files', resource: 'file', action: 'read' },
      { name: 'file:write', description: 'Write files', resource: 'file', action: 'write' }
    ];

    for (const permData of defaultPermissions) {
      const permission: Permission = {
        id: this.generateId(),
        ...permData
      };
      this.permissions.set(permission.id, permission);
    }

    // Create default roles
    const adminRole: Role = {
      id: this.generateId(),
      name: 'Administrator',
      description: 'Full system administrator',
      permissions: [Array.from(this.permissions.values()).find(p => p.name === 'admin:all')!.id],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const userRole: Role = {
      id: this.generateId(),
      name: 'User',
      description: 'Standard user with basic permissions',
      permissions: [
        Array.from(this.permissions.values()).find(p => p.name === 'user:read')!.id,
        Array.from(this.permissions.values()).find(p => p.name === 'file:read')!.id
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.roles.set(adminRole.id, adminRole);
    this.roles.set(userRole.id, userRole);
  }
}