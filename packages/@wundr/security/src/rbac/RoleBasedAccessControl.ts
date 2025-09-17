import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// Enterprise-grade metadata interface for user context
export interface UserMetadata {
  department?: string;
  location?: string;
  clearanceLevel?: number;
  costCenter?: string;
  manager?: string;
  attributes?: Record<string, string | number | boolean>;
  tags?: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  metadata?: UserMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Enterprise role metadata for hierarchical and organizational context
export interface RoleMetadata {
  hierarchy?: {
    level: number;
    parentRoles?: string[];
    childRoles?: string[];
  };
  organizational?: {
    department?: string;
    division?: string;
    businessUnit?: string;
  };
  temporal?: {
    effectiveDate?: Date;
    expirationDate?: Date;
    maxDuration?: number; // in milliseconds
  };
  delegation?: {
    canDelegate: boolean;
    maxDelegationDepth?: number;
    delegationRestrictions?: string[];
  };
  compliance?: {
    requiredApprovals?: string[];
    auditFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    certificationRequired?: boolean;
  };
  attributes?: Record<string, string | number | boolean>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  metadata?: RoleMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// Enterprise permission metadata for fine-grained control
export interface PermissionMetadata {
  category?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  compliance?: {
    framework?: string[];
    requirements?: string[];
  };
  risk?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors?: string[];
  };
  delegation?: {
    isDelegatable: boolean;
    maxDelegationTime?: number;
    requiresApproval?: boolean;
  };
  attributes?: Record<string, string | number | boolean>;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: AccessCondition[];
  metadata?: PermissionMetadata;
}

// Strongly typed condition values for enterprise security
export type ConditionValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | number[]
  | { min: number; max: number }
  | { pattern: string; flags?: string }
  | { ipRange: string; cidr?: number }
  | { coordinates: { lat: number; lng: number }; radius?: number };

export interface AccessCondition {
  type: 'time' | 'location' | 'resource_owner' | 'custom' | 'ip_address' | 'device' | 'mfa_verified' | 'risk_score';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in_range' | 'matches_pattern' | 'within_radius';
  value: ConditionValue;
  field?: string;
  description?: string;
}

// Enterprise access request context for comprehensive security evaluation
export interface AccessContext {
  // Network context
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: { lat: number; lng: number };
  };

  // Device context
  device?: {
    id?: string;
    type?: 'desktop' | 'mobile' | 'tablet' | 'server' | 'unknown';
    os?: string;
    browser?: string;
    trusted?: boolean;
  };

  // Session context
  sessionId?: string;
  mfaVerified?: boolean;
  authMethod?: 'password' | 'sso' | 'certificate' | 'token' | 'biometric';
  riskScore?: number;

  // Resource context
  resourceOwner?: string;
  resourceMetadata?: Record<string, string | number | boolean>;

  // Temporal context
  requestedDuration?: number;
  delegation?: {
    delegatedBy?: string;
    delegationChain?: string[];
    originalRequester?: string;
  };

  // Custom attributes
  customAttributes?: Record<string, string | number | boolean | Date>;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  context?: AccessContext;
  timestamp: Date;
  requestId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

// Enterprise access result with comprehensive decision context
export interface AccessResultMetadata {
  evaluationTimeMs?: number;
  cacheHit?: boolean;
  riskAssessment?: {
    score: number;
    factors: string[];
    recommendations?: string[];
  };
  complianceChecks?: {
    framework: string;
    passed: boolean;
    violations?: string[];
  }[];
  auditTrail?: {
    evaluatedRoles: string[];
    evaluatedPermissions: string[];
    conditionEvaluations: { condition: string; result: boolean }[];
  };
  delegation?: {
    isDelegated: boolean;
    delegatedBy?: string;
    delegationLevel?: number;
  };
}

export interface AccessResult {
  granted: boolean;
  reason: string;
  matchedPermissions: string[];
  failedConditions: string[];
  metadata?: AccessResultMetadata;
  confidence?: number; // 0-1 confidence score
  alternatives?: string[]; // Alternative actions that would be permitted
  expires?: Date; // When this decision expires
}

export interface RBACOptions {
  enableAuditLogging?: boolean;
  enableCaching?: boolean;
  cacheExpirationMs?: number;
  defaultDenyAll?: boolean;
  enableHierarchicalRoles?: boolean;
  enableDelegation?: boolean;
  maxDelegationDepth?: number;
  enableRiskAssessment?: boolean;
  requireMfaForHighRisk?: boolean;
  sessionTimeoutMs?: number;
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
      defaultDenyAll: options.defaultDenyAll ?? true,
      enableHierarchicalRoles: options.enableHierarchicalRoles ?? false,
      enableDelegation: options.enableDelegation ?? false,
      maxDelegationDepth: options.maxDelegationDepth ?? 3,
      enableRiskAssessment: options.enableRiskAssessment ?? true,
      requireMfaForHighRisk: options.requireMfaForHighRisk ?? true,
      sessionTimeoutMs: options.sessionTimeoutMs ?? 28800000 // 8 hours
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
    const startTime = Date.now();
    const _requestId = request.requestId || this.generateId();

    // Check cache first
    if (this.options.enableCaching) {
      const cacheKey = this.generateCacheKey(request);
      const _cached = this.accessCache.get(cacheKey);
      if (_cached && Date.now() < _cached.expiresAt) {
        // Add cache hit metadata
        return {
          ..._cached.result,
          metadata: {
            ..._cached.result.metadata,
            cacheHit: true,
            evaluationTimeMs: Date.now() - startTime
          }
        };
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
    const evaluationTime = Date.now() - startTime;

    // Calculate confidence score based on various factors
    const confidence = this.calculateConfidenceScore(user, matchedPermissions, failedConditions, request.context);

    const result: AccessResult = {
      granted,
      reason: granted ? 'Access granted' : (failedConditions.length > 0 ? 'Conditions not met' : 'No matching permissions'),
      matchedPermissions,
      failedConditions,
      confidence,
      metadata: {
        evaluationTimeMs: evaluationTime,
        cacheHit: false,
        auditTrail: {
          evaluatedRoles: user.roles,
          evaluatedPermissions: userPermissions.map(p => p.id),
          conditionEvaluations: [] // This would be populated during condition evaluation
        },
        riskAssessment: this.calculateRiskAssessment(request, user, granted)
      }
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

  // Enterprise delegation management
  async delegatePermission(
    delegatorId: string,
    delegateeId: string,
    permissionId: string,
    options: {
      duration?: number;
      maxSubDelegations?: number;
      conditions?: AccessCondition[];
      reason?: string;
    } = {}
  ): Promise<string> {
    if (!this.options.enableDelegation) {
      throw new Error('Delegation is not enabled in this RBAC instance');
    }

    const delegator = this.users.get(delegatorId);
    if (!delegator) throw new Error(`Delegator ${delegatorId} not found`);

    const delegatee = this.users.get(delegateeId);
    if (!delegatee) throw new Error(`Delegatee ${delegateeId} not found`);

    const permission = this.permissions.get(permissionId);
    if (!permission) throw new Error(`Permission ${permissionId} not found`);

    // Check if delegator has the permission
    const delegatorPermissions = await this.getUserPermissions(delegator);
    const hasPermission = delegatorPermissions.some(p => p.id === permissionId);
    if (!hasPermission) {
      throw new Error('Delegator does not have the permission to delegate');
    }

    const delegationId = this.generateId();
    const expiration = options.duration ? new Date(Date.now() + options.duration) : undefined;

    // Create delegation record
    const delegation = {
      id: delegationId,
      delegatorId,
      delegateeId,
      permissionId,
      createdAt: new Date(),
      expiresAt: expiration,
      maxSubDelegations: options.maxSubDelegations ?? 0,
      conditions: options.conditions,
      reason: options.reason,
      isActive: true
    };

    // Add permission to delegatee temporarily
    if (!delegatee.permissions.includes(permissionId)) {
      delegatee.permissions.push(permissionId);
      delegatee.updatedAt = new Date();
    }

    this.clearUserCache(delegateeId);
    this.emit('permission:delegated', { delegation });

    if (this.options.enableAuditLogging) {
      this.emit('audit:log', {
        action: 'permission.delegate',
        resource: `permission:${permissionId}`,
        details: {
          delegatorId,
          delegateeId,
          delegationId,
          duration: options.duration,
          reason: options.reason
        }
      });
    }

    return delegationId;
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
    const context = request.context || {} as AccessContext;
    
    switch (condition.type) {
      case 'time':
        return this.evaluateTimeCondition(condition, request.timestamp);
      case 'location':
        return this.evaluateLocationCondition(condition, context.location);
      case 'resource_owner':
        return this.evaluateResourceOwnerCondition(condition, request.userId, context.resourceOwner);
      case 'ip_address':
        return this.evaluateIpAddressCondition(condition, context.ipAddress);
      case 'device':
        return this.evaluateDeviceCondition(condition, context.device);
      case 'mfa_verified':
        return this.evaluateMfaCondition(condition, context.mfaVerified);
      case 'risk_score':
        return this.evaluateRiskScoreCondition(condition, context.riskScore);
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
      const conditionValue = condition.value;

      // Type guard to ensure we have a number for comparison
      if (typeof conditionValue !== 'number') {
        return false;
      }

      switch (condition.operator) {
        case 'greater_than':
          return hour > conditionValue;
        case 'less_than':
          return hour < conditionValue;
        default:
          return false;
      }
    }
    return false;
  }

  private evaluateLocationCondition(condition: AccessCondition, location?: AccessContext['location']): boolean {
    if (!location) return false;

    const locationValue = condition.field ?
      this.getNestedValue(location, condition.field) :
      location.country || location.region || location.city;

    return this.evaluateConditionValue(locationValue, condition.operator, condition.value);
  }

  private getNestedValue(obj: any, field: string): unknown {
    const parts = field.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateIpAddressCondition(condition: AccessCondition, ipAddress?: string): boolean {
    if (!ipAddress) return false;

    if (typeof condition.value === 'object' && condition.value !== null && 'ipRange' in condition.value) {
      // Implement IP range checking
      return this.isIpInRange(ipAddress, condition.value.ipRange, condition.value.cidr);
    }

    return this.evaluateConditionValue(ipAddress, condition.operator, condition.value);
  }

  private evaluateDeviceCondition(condition: AccessCondition, device?: AccessContext['device']): boolean {
    if (!device) return false;

    const deviceValue = condition.field ?
      this.getNestedValue(device, condition.field) :
      device.type;

    return this.evaluateConditionValue(deviceValue, condition.operator, condition.value);
  }

  private evaluateMfaCondition(condition: AccessCondition, mfaVerified?: boolean): boolean {
    return this.evaluateConditionValue(mfaVerified, condition.operator, condition.value);
  }

  private evaluateRiskScoreCondition(condition: AccessCondition, riskScore?: number): boolean {
    if (riskScore === undefined) return false;

    return this.evaluateConditionValue(riskScore, condition.operator, condition.value);
  }

  private isIpInRange(ip: string, range: string, cidr?: number): boolean {
    // Simplified IP range checking - in production, use a proper CIDR library
    try {
      const ipParts = ip.split('.').map(Number);
      const rangeParts = range.split('.').map(Number);
      const mask = cidr || 24;

      const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
      const rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
      const maskNum = (-1 << (32 - mask)) >>> 0;

      return (ipNum & maskNum) === (rangeNum & maskNum);
    } catch {
      return false;
    }
  }

  private evaluateResourceOwnerCondition(condition: AccessCondition, userId: string, resourceOwner?: string): boolean {
    if (condition.operator === 'equals') {
      return userId === resourceOwner;
    }
    return false;
  }

  private evaluateCustomCondition(condition: AccessCondition, context: AccessContext): boolean {
    const contextValue = condition.field ?
      this.getNestedContextValue(context, condition.field) :
      context.customAttributes;

    return this.evaluateConditionValue(contextValue, condition.operator, condition.value);
  }

  private getNestedContextValue(context: AccessContext, field: string): unknown {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateConditionValue(contextValue: unknown, operator: AccessCondition['operator'], conditionValue: ConditionValue): boolean {
    switch (operator) {
      case 'equals':
        return contextValue === conditionValue;
      case 'not_equals':
        return contextValue !== conditionValue;
      case 'contains':
        if (Array.isArray(contextValue)) {
          return contextValue.includes(conditionValue);
        }
        return String(contextValue).includes(String(conditionValue));
      case 'not_contains':
        if (Array.isArray(contextValue)) {
          return !contextValue.includes(conditionValue);
        }
        return !String(contextValue).includes(String(conditionValue));
      case 'greater_than':
        return Number(contextValue) > Number(conditionValue);
      case 'less_than':
        return Number(contextValue) < Number(conditionValue);
      case 'in_range':
        if (typeof conditionValue === 'object' && conditionValue !== null && 'min' in conditionValue && 'max' in conditionValue) {
          const numValue = Number(contextValue);
          return numValue >= conditionValue.min && numValue <= conditionValue.max;
        }
        return false;
      case 'matches_pattern':
        if (typeof conditionValue === 'object' && conditionValue !== null && 'pattern' in conditionValue) {
          const regex = new RegExp(conditionValue.pattern, conditionValue.flags || '');
          return regex.test(String(contextValue));
        }
        return false;
      case 'within_radius':
        return this.evaluateLocationRadius(contextValue, conditionValue);
      default:
        return false;
    }
  }

  private evaluateLocationRadius(contextValue: unknown, conditionValue: ConditionValue): boolean {
    if (typeof conditionValue === 'object' && conditionValue !== null && 'coordinates' in conditionValue) {
      // Implement geospatial distance calculation
      // This is a simplified implementation - in production, use a proper geospatial library
      if (typeof contextValue === 'object' && contextValue !== null &&
          'coordinates' in (contextValue as any)) {
        const contextCoords = (contextValue as any).coordinates;
        const targetCoords = conditionValue.coordinates;
        const radius = conditionValue.radius || 1000; // Default 1km

        // Simple distance calculation (Haversine formula would be more accurate)
        const distance = Math.sqrt(
          Math.pow(targetCoords.lat - contextCoords.lat, 2) +
          Math.pow(targetCoords.lng - contextCoords.lng, 2)
        ) * 111000; // Rough conversion to meters

        return distance <= radius;
      }
    }
    return false;
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

  private calculateConfidenceScore(user: User, matchedPermissions: string[], failedConditions: string[], context?: AccessContext): number {
    let score = 0.5; // Base confidence

    // Boost confidence for direct permissions vs inherited
    const directPermissions = matchedPermissions.filter(p => user.permissions.includes(p));
    score += directPermissions.length * 0.1;

    // Reduce confidence for failed conditions
    score -= failedConditions.length * 0.2;

    // Boost confidence for MFA verified sessions
    if (context?.mfaVerified) {
      score += 0.2;
    }

    // Adjust based on risk score
    if (context?.riskScore !== undefined) {
      score -= context.riskScore * 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateRiskAssessment(request: AccessRequest, user: User, granted: boolean): AccessResultMetadata['riskAssessment'] {
    const factors: string[] = [];
    let score = 0;

    // Assess various risk factors
    if (request.context?.riskScore && request.context.riskScore > 0.7) {
      factors.push('High user risk score');
      score += 0.3;
    }

    if (!request.context?.mfaVerified) {
      factors.push('MFA not verified');
      score += 0.2;
    }

    if (request.context?.device && !request.context.device.trusted) {
      factors.push('Untrusted device');
      score += 0.1;
    }

    // Check for privilege escalation
    if (request.action.includes('admin') || request.action.includes('delete')) {
      factors.push('High-privilege action');
      score += 0.2;
    }

    const recommendations: string[] = [];
    if (score > 0.5) {
      recommendations.push('Consider additional verification');
    }
    if (factors.length > 2) {
      recommendations.push('Monitor session closely');
    }

    return {
      score: Math.min(1, score),
      factors,
      recommendations
    };
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