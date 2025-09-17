/**
 * Authorization Types and Interfaces
 * Enterprise-grade authorization system with RBAC, ABAC, and policy-based access control
 *
 * @fileoverview Complete authorization type definitions for secure access control
 * @author Security Types Specialist
 * @version 1.0.0
 */

import {
  SecurityId,
  SecurityTimestamp,
  SecurityContext,
  SecurityResult,
  SecuritySeverity,
  SecurityAttributeValue,
  GeographicLocation,
  DeviceFingerprint,
  NetworkContext
} from './base';
import {
  ComparisonOperator,
  ResourceType
} from './shared-enums';

/**
 * Policy types
 */
export enum PolicyType {
  RBAC_POLICY = 'rbac_policy',
  ABAC_POLICY = 'abac_policy',
  PRIVACY_POLICY = 'privacy_policy',
  DATA_GOVERNANCE = 'data_governance',
  COMPLIANCE_POLICY = 'compliance_policy',
  SECURITY_POLICY = 'security_policy',
  CUSTOM_POLICY = 'custom_policy'
}

/**
 * Decision types for authorization
 */
export enum DecisionType {
  ALLOW = 'allow',
  DENY = 'deny',
  INDETERMINATE = 'indeterminate',
  NOT_APPLICABLE = 'not_applicable'
}

/**
 * Resource access types
 */
export enum ResourceAccessType {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  ADMIN = 'admin',
  FULL_CONTROL = 'full_control'
}

/**
 * Policy evaluation modes
 */
export enum PolicyEvaluationMode {
  STRICT = 'strict',
  PERMISSIVE = 'permissive',
  AUDIT_ONLY = 'audit_only',
  FAIL_OPEN = 'fail_open',
  FAIL_CLOSED = 'fail_closed'
}

/**
 * Authorization model types
 */
export enum AuthorizationModel {
  RBAC = 'rbac', // Role-Based Access Control
  ABAC = 'abac', // Attribute-Based Access Control
  MAC = 'mac',   // Mandatory Access Control
  DAC = 'dac',   // Discretionary Access Control
  PBAC = 'pbac', // Policy-Based Access Control
  HYBRID = 'hybrid' // Combination of multiple models
}

/**
 * Access decision types
 */
export enum AccessDecision {
  ALLOW = 'allow',
  DENY = 'deny',
  INDETERMINATE = 'indeterminate', // Cannot make decision
  NOT_APPLICABLE = 'not_applicable' // Policy doesn't apply
}

/**
 * Permission effect enumeration
 */
export enum PermissionEffect {
  ALLOW = 'allow',
  DENY = 'deny',
  CONDITIONAL = 'conditional'
}

/**
 * Permission types
 */
export enum PermissionType {
  ALLOW = 'allow',
  DENY = 'deny',
  CONDITIONAL = 'conditional'
}

// ResourceType is now imported from shared-enums

/**
 * Action types for authorization
 */
export enum ActionType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  ADMIN = 'admin',
  APPROVE = 'approve',
  AUDIT = 'audit',
  DELEGATE = 'delegate',
  CUSTOM = 'custom'
}

/**
 * Principal types (subjects requesting access)
 */
export enum PrincipalType {
  USER = 'user',
  SERVICE = 'service',
  APPLICATION = 'application',
  ROLE = 'role',
  GROUP = 'group',
  DEVICE = 'device',
  SYSTEM = 'system'
}

/**
 * Authorization principal interface
 */
export interface AuthorizationPrincipal {
  readonly id: SecurityId;
  readonly type: PrincipalType;
  readonly name: string;
  readonly attributes: PrincipalAttributes;
  readonly roles: readonly string[];
  readonly groups: readonly string[];
  readonly permissions: readonly Permission[];
  readonly delegations: readonly Delegation[];
  readonly metadata?: PrincipalMetadata;
}

/**
 * Principal attributes for ABAC
 */
export interface PrincipalAttributes {
  readonly clearanceLevel?: number;
  readonly department?: string;
  readonly organization?: string;
  readonly location?: string;
  readonly costCenter?: string;
  readonly manager?: SecurityId;
  readonly employeeType?: 'full-time' | 'part-time' | 'contractor' | 'intern';
  readonly securityTraining?: boolean;
  readonly backgroundCheck?: boolean;
  readonly customAttributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Principal metadata
 */
export interface PrincipalMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly lastReview?: SecurityTimestamp;
  readonly reviewedBy?: SecurityId;
  readonly notes?: string;
  readonly tags?: readonly string[];
}

/**
 * Authorization resource interface
 */
export interface AuthorizationResource {
  readonly id: SecurityId;
  readonly type: ResourceType;
  readonly name: string;
  readonly path?: string;
  readonly parent?: SecurityId;
  readonly children?: readonly SecurityId[];
  readonly owner: SecurityId;
  readonly attributes: ResourceAttributes;
  readonly policies: readonly SecurityId[];
  readonly metadata?: ResourceMetadata;
}

/**
 * Resource attributes for ABAC
 */
export interface ResourceAttributes {
  readonly classification?: 'public' | 'internal' | 'confidential' | 'restricted' | 'top-secret';
  readonly sensitivity?: number; // 0-10 scale
  readonly category?: string;
  readonly project?: string;
  readonly department?: string;
  readonly location?: string;
  readonly createdAt?: SecurityTimestamp;
  readonly lastModified?: SecurityTimestamp;
  readonly size?: number;
  readonly format?: string;
  readonly encryption?: boolean;
  readonly backup?: boolean;
  readonly retention?: number; // days
  readonly customAttributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Resource metadata
 */
export interface ResourceMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly lastAccessed?: SecurityTimestamp;
  readonly accessCount?: number;
  readonly checksum?: string;
  readonly version?: string;
  readonly tags?: readonly string[];
}

/**
 * Permission definition interface
 */
export interface Permission {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: PermissionType;
  readonly resource: string; // Resource pattern or ID
  readonly action: string; // Action pattern or specific action
  readonly conditions: readonly Condition[];
  readonly effect: AccessDecision;
  readonly priority: number; // Higher priority wins conflicts
  readonly scope: PermissionScope;
  readonly metadata?: PermissionMetadata;
}

/**
 * Permission scope definition
 */
export interface PermissionScope {
  readonly resourceFilter?: ResourceFilter;
  readonly timeRestriction?: TimeRestriction;
  readonly locationRestriction?: LocationRestriction;
  readonly networkRestriction?: NetworkRestriction;
  readonly deviceRestriction?: DeviceRestriction;
  readonly customRestrictions?: Record<string, SecurityAttributeValue>;
}

/**
 * Resource filter for scoped permissions
 */
export interface ResourceFilter {
  readonly include?: readonly string[]; // Resource patterns to include
  readonly exclude?: readonly string[]; // Resource patterns to exclude
  readonly attributes?: AttributeFilter;
}

/**
 * Attribute filter for resources/principals
 */
export interface AttributeFilter {
  readonly required?: Record<string, SecurityAttributeValue>;
  readonly forbidden?: Record<string, SecurityAttributeValue>;
  readonly range?: Record<string, { min?: number; max?: number }>;
  readonly pattern?: Record<string, string>; // Regex patterns
}

/**
 * Time-based restrictions
 */
export interface TimeRestriction {
  readonly validFrom?: SecurityTimestamp;
  readonly validTo?: SecurityTimestamp;
  readonly daysOfWeek?: readonly number[]; // 0-6, Sunday = 0
  readonly hoursOfDay?: readonly number[]; // 0-23
  readonly timezone?: string;
  readonly maxDuration?: number; // Maximum session duration in milliseconds
}

/**
 * Location-based restrictions
 */
export interface LocationRestriction {
  readonly allowedCountries?: readonly string[];
  readonly deniedCountries?: readonly string[];
  readonly allowedRegions?: readonly string[];
  readonly deniedRegions?: readonly string[];
  readonly geofences?: readonly Geofence[];
  readonly requirePhysicalPresence?: boolean;
}

/**
 * Geofence definition
 */
export interface Geofence {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: 'circle' | 'polygon';
  readonly center?: { latitude: number; longitude: number };
  readonly radius?: number; // meters for circle
  readonly vertices?: readonly { latitude: number; longitude: number }[]; // for polygon
  readonly inverted?: boolean; // true for exclusion zones
}

/**
 * Network-based restrictions
 */
export interface NetworkRestriction {
  readonly allowedIpRanges?: readonly string[];
  readonly deniedIpRanges?: readonly string[];
  readonly allowedAsns?: readonly string[];
  readonly deniedAsns?: readonly string[];
  readonly requireSecureConnection?: boolean;
  readonly denyTor?: boolean;
  readonly denyVpn?: boolean;
  readonly denyProxy?: boolean;
}

/**
 * Device-based restrictions
 */
export interface DeviceRestriction {
  readonly allowedDeviceTypes?: readonly string[];
  readonly deniedDeviceTypes?: readonly string[];
  readonly requireTrustedDevice?: boolean;
  readonly requireManagedDevice?: boolean;
  readonly requireEncryption?: boolean;
  readonly requireScreenLock?: boolean;
  readonly denyJailbroken?: boolean;
}

/**
 * Permission metadata
 */
export interface PermissionMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly description?: string;
  readonly justification?: string;
  readonly reviewDate?: SecurityTimestamp;
  readonly expiryDate?: SecurityTimestamp;
  readonly inheritedFrom?: SecurityId; // Role or group ID
  readonly delegatedFrom?: SecurityId; // Original permission holder
  readonly tags?: readonly string[];
}

/**
 * Role definition interface
 */
export interface Role {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly type: RoleType;
  readonly level: number; // Hierarchical level (higher = more privileged)
  readonly permissions: readonly SecurityId[];
  readonly parents: readonly SecurityId[]; // Inherited roles
  readonly children: readonly SecurityId[]; // Sub-roles
  readonly constraints: RoleConstraints;
  readonly metadata?: RoleMetadata;
}

/**
 * Role types
 */
export enum RoleType {
  SYSTEM = 'system', // Built-in system roles
  FUNCTIONAL = 'functional', // Job function roles
  PROJECT = 'project', // Project-specific roles
  TEMPORARY = 'temporary', // Time-limited roles
  DELEGATED = 'delegated', // Delegated from another user
  CUSTOM = 'custom' // Custom defined roles
}

/**
 * Role constraints
 */
export interface RoleConstraints {
  readonly maxAssignees?: number;
  readonly requireApproval?: boolean;
  readonly approvers?: readonly SecurityId[];
  readonly mutuallyExclusive?: readonly SecurityId[]; // Cannot be held with these roles
  readonly prerequisites?: readonly SecurityId[]; // Must have these roles first
  readonly timeLimit?: number; // Maximum time role can be held (milliseconds)
  readonly reviewInterval?: number; // How often to review assignment (milliseconds)
}

/**
 * Role metadata
 */
export interface RoleMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly version: number;
  readonly status: 'active' | 'deprecated' | 'disabled';
  readonly category?: string;
  readonly complianceFramework?: readonly string[];
  readonly businessJustification?: string;
  readonly tags?: readonly string[];
}

/**
 * Policy definition interface
 */
export interface AuthorizationPolicy {
  readonly id: SecurityId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly type: PolicyType;
  readonly target: PolicyTarget;
  readonly rules: readonly PolicyRule[];
  readonly combiningAlgorithm: CombiningAlgorithm;
  readonly obligations: readonly Obligation[];
  readonly advice: readonly Advice[];
  readonly metadata?: PolicyMetadata;
}

// PolicyType is already defined above

/**
 * Policy target (when policy applies)
 */
export interface PolicyTarget {
  readonly subjects?: readonly TargetExpression[];
  readonly resources?: readonly TargetExpression[];
  readonly actions?: readonly TargetExpression[];
  readonly environments?: readonly TargetExpression[];
}

/**
 * Target expression for policy matching
 */
export interface TargetExpression {
  readonly attribute: string;
  readonly operator: ComparisonOperator;
  readonly value: SecurityAttributeValue;
  readonly dataType?: DataType;
}

// ComparisonOperator is now imported from shared-enums

/**
 * Data types for attribute values
 */
export enum DataType {
  STRING = 'string',
  INTEGER = 'integer',
  DOUBLE = 'double',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  DURATION = 'duration',
  IP_ADDRESS = 'ip_address',
  URI = 'uri',
  EMAIL = 'email'
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  readonly id: SecurityId;
  readonly target?: PolicyTarget;
  readonly condition?: Condition;
  readonly effect: AccessDecision;
  readonly priority: number;
  readonly obligations?: readonly Obligation[];
  readonly advice?: readonly Advice[];
}

/**
 * Condition expression
 */
export interface Condition {
  readonly type: ConditionType;
  readonly expression: ConditionExpression;
}

/**
 * Condition types
 */
export enum ConditionType {
  SIMPLE = 'simple',
  COMPLEX = 'complex',
  FUNCTION_CALL = 'function_call',
  CUSTOM = 'custom'
}

/**
 * Condition expression union type
 */
export type ConditionExpression =
  | SimpleCondition
  | ComplexCondition
  | FunctionCondition
  | CustomCondition;

/**
 * Simple attribute-based condition
 */
export interface SimpleCondition {
  readonly type: 'simple';
  readonly attribute: string;
  readonly operator: ComparisonOperator;
  readonly value: SecurityAttributeValue;
  readonly dataType?: DataType;
}

/**
 * Complex condition with logical operators
 */
export interface ComplexCondition {
  readonly type: 'complex';
  readonly operator: LogicalOperator;
  readonly conditions: readonly Condition[];
}

/**
 * Logical operators for combining conditions
 */
export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  XOR = 'xor',
  NAND = 'nand',
  NOR = 'nor'
}

/**
 * Function-based condition
 */
export interface FunctionCondition {
  readonly type: 'function_call';
  readonly function: string;
  readonly parameters: readonly FunctionParameter[];
  readonly expectedResult: SecurityAttributeValue;
}

/**
 * Function parameter
 */
export interface FunctionParameter {
  readonly name: string;
  readonly value: SecurityAttributeValue;
  readonly dataType: DataType;
}

/**
 * Custom condition (plugin-based)
 */
export interface CustomCondition {
  readonly type: 'custom';
  readonly plugin: string;
  readonly configuration: Record<string, SecurityAttributeValue>;
}

/**
 * Combining algorithms for policy decisions
 */
export enum CombiningAlgorithm {
  DENY_OVERRIDES = 'deny_overrides',
  PERMIT_OVERRIDES = 'permit_overrides',
  FIRST_APPLICABLE = 'first_applicable',
  ONLY_ONE_APPLICABLE = 'only_one_applicable',
  DENY_UNLESS_PERMIT = 'deny_unless_permit',
  PERMIT_UNLESS_DENY = 'permit_unless_deny'
}

/**
 * Policy obligations (must be fulfilled if decision is ALLOW)
 */
export interface Obligation {
  readonly id: SecurityId;
  readonly type: ObligationType;
  readonly handler: string;
  readonly parameters: Record<string, SecurityAttributeValue>;
  readonly fulfillmentOn: FulfillmentTiming;
}

/**
 * Obligation types
 */
export enum ObligationType {
  LOG_ACCESS = 'log_access',
  NOTIFY_OWNER = 'notify_owner',
  ENCRYPT_DATA = 'encrypt_data',
  WATERMARK = 'watermark',
  TIME_LIMIT = 'time_limit',
  AUDIT_TRAIL = 'audit_trail',
  CUSTOM = 'custom'
}

/**
 * When obligations must be fulfilled
 */
export enum FulfillmentTiming {
  BEFORE_ACCESS = 'before_access',
  DURING_ACCESS = 'during_access',
  AFTER_ACCESS = 'after_access',
  ON_DENY = 'on_deny',
  ON_ERROR = 'on_error'
}

/**
 * Policy advice (recommendations, not enforced)
 */
export interface Advice {
  readonly id: SecurityId;
  readonly type: AdviceType;
  readonly message: string;
  readonly severity: SecuritySeverity;
  readonly handler?: string;
  readonly parameters?: Record<string, SecurityAttributeValue>;
}

/**
 * Advice types
 */
export enum AdviceType {
  SECURITY_WARNING = 'security_warning',
  COMPLIANCE_NOTICE = 'compliance_notice',
  BEST_PRACTICE = 'best_practice',
  PERFORMANCE_TIP = 'performance_tip',
  CUSTOM = 'custom'
}

/**
 * Policy metadata
 */
export interface PolicyMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly version: string;
  readonly status: PolicyStatus;
  readonly effectiveDate?: SecurityTimestamp;
  readonly expiryDate?: SecurityTimestamp;
  readonly category?: string;
  readonly complianceFrameworks?: readonly string[];
  readonly businessJustification?: string;
  readonly approvedBy?: readonly SecurityId[];
  readonly tags?: readonly string[];
}

/**
 * Policy status
 */
export enum PolicyStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DISABLED = 'disabled',
  ARCHIVED = 'archived'
}

/**
 * Authorization request interface
 */
export interface AuthorizationRequest {
  readonly principal: AuthorizationPrincipal;
  readonly resource: string | AuthorizationResource;
  readonly action: string;
  readonly environment: AuthorizationEnvironment;
  readonly context: SecurityContext;
  readonly attributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Authorization environment (context for decision)
 */
export interface AuthorizationEnvironment {
  readonly timestamp: SecurityTimestamp;
  readonly location?: GeographicLocation;
  readonly device?: DeviceFingerprint;
  readonly network?: NetworkContext;
  readonly session?: {
    readonly id: SecurityId;
    readonly duration: number;
    readonly mfaVerified: boolean;
    readonly riskScore: number;
  };
  readonly customAttributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Authorization decision result
 */
export interface AuthorizationResult extends SecurityResult<AuthorizationData> {
  readonly decision: AccessDecision;
  readonly obligations: readonly Obligation[];
  readonly advice: readonly Advice[];
  readonly appliedPolicies: readonly SecurityId[];
  readonly evaluationTrace?: EvaluationTrace;
}

/**
 * Authorization data
 */
export interface AuthorizationData {
  readonly grantedPermissions: readonly Permission[];
  readonly deniedPermissions: readonly Permission[];
  readonly conditionalPermissions: readonly ConditionalPermission[];
  readonly effectiveScope: PermissionScope;
  readonly sessionDuration?: number;
  readonly constraints?: Record<string, SecurityAttributeValue>;
}

/**
 * Conditional permission (permission with unfulfilled conditions)
 */
export interface ConditionalPermission {
  readonly permission: Permission;
  readonly unfulfilledConditions: readonly Condition[];
  readonly requiredActions: readonly string[];
}

/**
 * Evaluation trace for debugging and audit
 */
export interface EvaluationTrace {
  readonly requestId: SecurityId;
  readonly steps: readonly EvaluationStep[];
  readonly duration: number; // milliseconds
  readonly cacheHits: number;
  readonly policiesEvaluated: number;
  readonly rulesEvaluated: number;
}

/**
 * Individual evaluation step
 */
export interface EvaluationStep {
  readonly stepId: SecurityId;
  readonly type: EvaluationStepType;
  readonly target: string; // Policy, rule, or condition ID
  readonly input: Record<string, SecurityAttributeValue>;
  readonly output: SecurityAttributeValue;
  readonly decision?: AccessDecision;
  readonly timestamp: SecurityTimestamp;
  readonly duration: number;
}

/**
 * Evaluation step types
 */
export enum EvaluationStepType {
  POLICY_EVALUATION = 'policy_evaluation',
  RULE_EVALUATION = 'rule_evaluation',
  CONDITION_EVALUATION = 'condition_evaluation',
  OBLIGATION_EVALUATION = 'obligation_evaluation',
  ATTRIBUTE_RETRIEVAL = 'attribute_retrieval',
  FUNCTION_CALL = 'function_call'
}

/**
 * Delegation interface for temporary permission grants
 */
export interface Delegation {
  readonly id: SecurityId;
  readonly delegator: SecurityId;
  readonly delegatee: SecurityId;
  readonly permissions: readonly SecurityId[];
  readonly constraints: DelegationConstraints;
  readonly status: DelegationStatus;
  readonly metadata?: DelegationMetadata;
}

/**
 * Delegation constraints
 */
export interface DelegationConstraints {
  readonly validFrom: SecurityTimestamp;
  readonly validTo: SecurityTimestamp;
  readonly maxUses?: number;
  readonly usedCount: number;
  readonly canDelegate: boolean; // Can the delegatee further delegate
  readonly maxDelegationDepth?: number;
  readonly scope?: PermissionScope;
  readonly conditions?: readonly Condition[];
}

/**
 * Delegation status
 */
export enum DelegationStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended',
  EXHAUSTED = 'exhausted' // Max uses reached
}

/**
 * Delegation metadata
 */
export interface DelegationMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly createdBy: SecurityId;
  readonly reason?: string;
  readonly approvedBy?: SecurityId;
  readonly revokedAt?: SecurityTimestamp;
  readonly revokedBy?: SecurityId;
  readonly revocationReason?: string;
  readonly tags?: readonly string[];
}

/**
 * Access control list (ACL) entry
 */
export interface AclEntry {
  readonly principal: SecurityId;
  readonly principalType: PrincipalType;
  readonly permissions: readonly string[];
  readonly type: PermissionType;
  readonly inherited: boolean;
  readonly source?: SecurityId; // Where permission was inherited from
  readonly conditions?: readonly Condition[];
}

/**
 * Access control matrix for bulk operations
 */
export interface AccessControlMatrix {
  readonly principals: readonly SecurityId[];
  readonly resources: readonly SecurityId[];
  readonly actions: readonly string[];
  readonly decisions: readonly AccessDecision[][][]; // [principal][resource][action]
  readonly computed: SecurityTimestamp;
  readonly validUntil: SecurityTimestamp;
}

/**
 * Type guards for authorization types
 */
export const isAuthorizationPrincipal = (value: unknown): value is AuthorizationPrincipal => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'name' in value &&
    'attributes' in value &&
    typeof (value as AuthorizationPrincipal).id === 'string' &&
    Object.values(PrincipalType).includes((value as AuthorizationPrincipal).type)
  );
};

export const isAuthorizationResource = (value: unknown): value is AuthorizationResource => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'name' in value &&
    'owner' in value &&
    'attributes' in value &&
    typeof (value as AuthorizationResource).id === 'string' &&
    Object.values(ResourceType).includes((value as AuthorizationResource).type)
  );
};

export const isPermission = (value: unknown): value is Permission => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'resource' in value &&
    'action' in value &&
    'effect' in value &&
    typeof (value as Permission).id === 'string' &&
    Object.values(PermissionType).includes((value as Permission).type) &&
    Object.values(AccessDecision).includes((value as Permission).effect)
  );
};

export const isRole = (value: unknown): value is Role => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'type' in value &&
    'level' in value &&
    typeof (value as Role).id === 'string' &&
    Object.values(RoleType).includes((value as Role).type) &&
    typeof (value as Role).level === 'number'
  );
};

export const isAuthorizationResult = (value: unknown): value is AuthorizationResult => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'decision' in value &&
    typeof (value as AuthorizationResult).success === 'boolean' &&
    Object.values(AccessDecision).includes((value as AuthorizationResult).decision)
  );
};

/**
 * Utility functions for authorization
 */
export const createAuthorizationRequest = (
  principalId: SecurityId,
  resource: string,
  action: string,
  context: SecurityContext,
  attributes?: Record<string, SecurityAttributeValue>
): Partial<AuthorizationRequest> => ({
  principal: { id: principalId } as AuthorizationPrincipal,
  resource,
  action,
  context,
  attributes,
  environment: {
    timestamp: context.timestamp,
    customAttributes: context.metadata?.customAttributes as Record<string, SecurityAttributeValue> | undefined
  }
});

export const evaluateCondition = (
  condition: Condition,
  attributes: Record<string, SecurityAttributeValue>
): boolean => {
  // Simplified condition evaluation - production would be more sophisticated
  switch (condition.type) {
    case ConditionType.SIMPLE:
      const simpleCondition = condition.expression as SimpleCondition;
      const attributeValue = attributes[simpleCondition.attribute];

      switch (simpleCondition.operator) {
        case ComparisonOperator.EQUALS:
          return attributeValue === simpleCondition.value;
        case ComparisonOperator.NOT_EQUALS:
          return attributeValue !== simpleCondition.value;
        case ComparisonOperator.GREATER_THAN:
          return Number(attributeValue) > Number(simpleCondition.value);
        case ComparisonOperator.LESS_THAN:
          return Number(attributeValue) < Number(simpleCondition.value);
        case ComparisonOperator.IN:
          return Array.isArray(simpleCondition.value) &&
                 simpleCondition.value.includes(attributeValue);
        case ComparisonOperator.CONTAINS:
          return String(attributeValue).includes(String(simpleCondition.value));
        default:
          return false;
      }

    case ConditionType.COMPLEX:
      const complexCondition = condition.expression as ComplexCondition;
      const results = complexCondition.conditions.map(c => evaluateCondition(c, attributes));

      switch (complexCondition.operator) {
        case LogicalOperator.AND:
          return results.every(r => r);
        case LogicalOperator.OR:
          return results.some(r => r);
        case LogicalOperator.NOT:
          return !results[0];
        default:
          return false;
      }

    default:
      return false;
  }
};

export const combineDecisions = (
  decisions: AccessDecision[],
  algorithm: CombiningAlgorithm
): AccessDecision => {
  if (decisions.length === 0) return AccessDecision.INDETERMINATE;

  switch (algorithm) {
    case CombiningAlgorithm.DENY_OVERRIDES:
      return decisions.includes(AccessDecision.DENY) ? AccessDecision.DENY :
             decisions.includes(AccessDecision.ALLOW) ? AccessDecision.ALLOW :
             AccessDecision.INDETERMINATE;

    case CombiningAlgorithm.PERMIT_OVERRIDES:
      return decisions.includes(AccessDecision.ALLOW) ? AccessDecision.ALLOW :
             decisions.includes(AccessDecision.DENY) ? AccessDecision.DENY :
             AccessDecision.INDETERMINATE;

    case CombiningAlgorithm.FIRST_APPLICABLE:
      const firstApplicable = decisions.find(d => d !== AccessDecision.NOT_APPLICABLE);
      return firstApplicable || AccessDecision.NOT_APPLICABLE;

    case CombiningAlgorithm.DENY_UNLESS_PERMIT:
      return decisions.includes(AccessDecision.ALLOW) ? AccessDecision.ALLOW : AccessDecision.DENY;

    case CombiningAlgorithm.PERMIT_UNLESS_DENY:
      return decisions.includes(AccessDecision.DENY) ? AccessDecision.DENY : AccessDecision.ALLOW;

    default:
      return AccessDecision.INDETERMINATE;
  }
};

export const isWithinTimeRestriction = (
  restriction: TimeRestriction,
  timestamp: SecurityTimestamp = new Date().toISOString()
): boolean => {
  const date = new Date(timestamp);

  if (restriction.validFrom && date < new Date(restriction.validFrom)) return false;
  if (restriction.validTo && date > new Date(restriction.validTo)) return false;

  if (restriction.daysOfWeek && !restriction.daysOfWeek.includes(date.getDay())) return false;
  if (restriction.hoursOfDay && !restriction.hoursOfDay.includes(date.getHours())) return false;

  return true;
};

export const isWithinLocationRestriction = (
  restriction: LocationRestriction,
  location?: GeographicLocation
): boolean => {
  if (!location) return !restriction.requirePhysicalPresence;

  if (restriction.allowedCountries && !restriction.allowedCountries.includes(location.country)) {
    return false;
  }

  if (restriction.deniedCountries && restriction.deniedCountries.includes(location.country)) {
    return false;
  }

  // Additional geofence and region checks would go here
  return true;
};