/**
 * Admin Console Types for Genesis-App
 * Settings, roles, permissions, compliance
 */

/** Workspace settings */
export interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  general: GeneralSettings;
  security: SecuritySettings;
  messaging: MessagingSettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
  compliance: ComplianceSettings;
  branding: BrandingSettings;
  updatedAt: Date;
  updatedBy: string;
}

export interface GeneralSettings {
  displayName: string;
  description?: string;
  timezone: string;
  locale: string;
  defaultChannel?: string;
  allowGuestAccess: boolean;
  requireApprovalToJoin: boolean;
}

export interface SecuritySettings {
  passwordPolicy: PasswordPolicy;
  sessionTimeout: number;
  mfaRequired: boolean;
  allowedDomains?: string[];
  ipWhitelist?: string[];
  ssoEnabled: boolean;
  ssoProvider?: 'okta' | 'azure_ad' | 'google' | 'saml';
  ssoConfig?: SSOConfig;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expirationDays?: number;
  preventReuse: number;
}

/** SSO Configuration types per provider */
export interface OktaSSOConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  issuer?: string;
}

export interface AzureADSSOConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface GoogleSSOConfig {
  clientId: string;
  clientSecret: string;
  hostedDomain?: string;
}

export interface SAMLSSOConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  privateKey?: string;
}

export type SSOConfig =
  | OktaSSOConfig
  | AzureADSSOConfig
  | GoogleSSOConfig
  | SAMLSSOConfig;

/** Custom member field value types */
export type MemberCustomFieldValue =
  | string
  | number
  | boolean
  | string[]
  | Date;

/** Custom member fields map */
export type MemberCustomFields = Record<string, MemberCustomFieldValue>;

export interface MessagingSettings {
  allowEditing: boolean;
  editWindowMinutes: number;
  allowDeleting: boolean;
  deleteWindowMinutes: number;
  maxMessageLength: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  enableThreads: boolean;
  enableReactions: boolean;
}

export interface NotificationSettings {
  defaultDesktop: boolean;
  defaultMobile: boolean;
  defaultEmail: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestFrequency: 'never' | 'daily' | 'weekly';
}

export interface IntegrationSettings {
  allowThirdPartyApps: boolean;
  approvedProviders: string[];
  webhooksEnabled: boolean;
  apiRateLimitPerMinute: number;
}

export interface ComplianceSettings {
  dataRetentionDays: number;
  exportEnabled: boolean;
  dlpEnabled: boolean;
  dlpRules?: DLPRule[];
  eDiscoveryEnabled: boolean;
  legalHoldEnabled: boolean;
}

export interface DLPRule {
  id: string;
  name: string;
  pattern: string;
  action: 'warn' | 'block' | 'redact';
  enabled: boolean;
}

export interface BrandingSettings {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  customCss?: string;
}

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage';
export type PermissionResource =
  | 'workspace'
  | 'channels'
  | 'messages'
  | 'members'
  | 'roles'
  | 'integrations'
  | 'workflows'
  | 'analytics'
  | 'audit_logs'
  | 'settings'
  | 'billing';

export interface Permission {
  resource: PermissionResource;
  actions: PermissionAction[];
}

export interface Role {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault: boolean;
  isSystemRole: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SystemRoleName = 'owner' | 'admin' | 'member' | 'guest';

export interface MemberInfo {
  id: string;
  userId: string;
  workspaceId: string;
  roleId: string;
  status: 'active' | 'suspended' | 'pending';
  joinedAt: Date;
  lastActiveAt?: Date;
  invitedBy?: string;
  customFields?: MemberCustomFields;
  user?: { id: string; name: string; email: string; image?: string };
  role?: Role;
}

export interface Invite {
  id: string;
  workspaceId: string;
  email: string;
  roleId: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
  acceptedAt?: Date;
}

export type PlanType = 'free' | 'starter' | 'professional' | 'enterprise';

export interface BillingInfo {
  id: string;
  workspaceId: string;
  plan: PlanType;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  seats: number;
  seatsUsed: number;
  features: PlanFeatures;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface PlanFeatures {
  maxMembers: number;
  maxChannels: number;
  maxStorage: number;
  maxIntegrations: number;
  maxWorkflows: number;
  auditLogs: boolean;
  sso: boolean;
  customRoles: boolean;
  priority_support: boolean;
  vp_agents: number;
}

export interface AdminAction {
  id: string;
  workspaceId: string;
  actorId: string;
  action: AdminActionType;
  resource: string;
  resourceId?: string;
  details: AdminActionDetails;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export type AdminActionType =
  | 'settings.updated'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'member.invited'
  | 'member.removed'
  | 'member.suspended'
  | 'member.role_changed'
  | 'invite.revoked'
  | 'billing.plan_changed'
  | 'security.mfa_enabled'
  | 'security.sso_configured'
  | 'compliance.dlp_rule_added'
  | 'compliance.legal_hold_applied';

/** Admin action detail types based on action type */
export interface SettingsUpdatedDetails {
  section: keyof WorkspaceSettings;
  previousValue: string;
  newValue: string;
}

export interface RoleActionDetails {
  roleName: string;
  roleId: string;
  permissions?: Permission[];
}

export interface MemberActionDetails {
  memberId: string;
  memberEmail: string;
  previousRole?: string;
  newRole?: string;
  reason?: string;
}

export interface InviteActionDetails {
  inviteId: string;
  email: string;
  roleId?: string;
}

export interface BillingActionDetails {
  previousPlan: PlanType;
  newPlan: PlanType;
  seats?: number;
}

export interface SecurityActionDetails {
  setting: string;
  enabled: boolean;
  provider?: string;
}

export interface ComplianceActionDetails {
  ruleId?: string;
  ruleName?: string;
  targetType?: string;
  targetId?: string;
}

export type AdminActionDetails =
  | SettingsUpdatedDetails
  | RoleActionDetails
  | MemberActionDetails
  | InviteActionDetails
  | BillingActionDetails
  | SecurityActionDetails
  | ComplianceActionDetails;

export interface UpdateSettingsInput {
  general?: Partial<GeneralSettings>;
  security?: Partial<SecuritySettings>;
  messaging?: Partial<MessagingSettings>;
  notifications?: Partial<NotificationSettings>;
  integrations?: Partial<IntegrationSettings>;
  compliance?: Partial<ComplianceSettings>;
  branding?: Partial<BrandingSettings>;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
  priority?: number;
}

export interface InviteMemberInput {
  email: string;
  roleId?: string;
  message?: string;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  displayName: 'Workspace',
  timezone: 'UTC',
  locale: 'en-US',
  allowGuestAccess: false,
  requireApprovalToJoin: true,
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    preventReuse: 3,
  },
  sessionTimeout: 480,
  mfaRequired: false,
  ssoEnabled: false,
};

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  allowEditing: true,
  editWindowMinutes: 15,
  allowDeleting: true,
  deleteWindowMinutes: 60,
  maxMessageLength: 10000,
  maxFileSize: 100 * 1024 * 1024,
  allowedFileTypes: ['*'],
  enableThreads: true,
  enableReactions: true,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  defaultDesktop: true,
  defaultMobile: true,
  defaultEmail: false,
  quietHoursEnabled: false,
  digestFrequency: 'never',
};

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  allowThirdPartyApps: true,
  approvedProviders: [],
  webhooksEnabled: true,
  apiRateLimitPerMinute: 100,
};

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = {
  dataRetentionDays: 365,
  exportEnabled: true,
  dlpEnabled: false,
  eDiscoveryEnabled: false,
  legalHoldEnabled: false,
};

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {};

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: {
    maxMembers: 10,
    maxChannels: 25,
    maxStorage: 5 * 1024 * 1024 * 1024,
    maxIntegrations: 2,
    maxWorkflows: 5,
    auditLogs: false,
    sso: false,
    customRoles: false,
    priority_support: false,
    vp_agents: 1,
  },
  starter: {
    maxMembers: 50,
    maxChannels: 100,
    maxStorage: 25 * 1024 * 1024 * 1024,
    maxIntegrations: 10,
    maxWorkflows: 25,
    auditLogs: true,
    sso: false,
    customRoles: false,
    priority_support: false,
    vp_agents: 5,
  },
  professional: {
    maxMembers: 250,
    maxChannels: 500,
    maxStorage: 100 * 1024 * 1024 * 1024,
    maxIntegrations: 50,
    maxWorkflows: 100,
    auditLogs: true,
    sso: true,
    customRoles: true,
    priority_support: true,
    vp_agents: 25,
  },
  enterprise: {
    maxMembers: -1,
    maxChannels: -1,
    maxStorage: -1,
    maxIntegrations: -1,
    maxWorkflows: -1,
    auditLogs: true,
    sso: true,
    customRoles: true,
    priority_support: true,
    vp_agents: -1,
  },
};

export const SYSTEM_ROLES: Omit<
  Role,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt'
>[] = [
  {
    name: 'owner',
    description: 'Workspace owner with full control',
    permissions: [
      {
        resource: 'workspace',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'channels',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'messages',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'members',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'roles',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'integrations',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'workflows',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      { resource: 'analytics', actions: ['read', 'manage'] },
      { resource: 'audit_logs', actions: ['read', 'manage'] },
      { resource: 'settings', actions: ['read', 'update', 'manage'] },
      { resource: 'billing', actions: ['read', 'update', 'manage'] },
    ],
    isDefault: false,
    isSystemRole: true,
    priority: 100,
  },
  {
    name: 'admin',
    description: 'Workspace administrator',
    permissions: [
      {
        resource: 'channels',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      {
        resource: 'messages',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
      { resource: 'members', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'roles', actions: ['read'] },
      {
        resource: 'integrations',
        actions: ['create', 'read', 'update', 'delete'],
      },
      {
        resource: 'workflows',
        actions: ['create', 'read', 'update', 'delete'],
      },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'audit_logs', actions: ['read'] },
      { resource: 'settings', actions: ['read', 'update'] },
    ],
    isDefault: false,
    isSystemRole: true,
    priority: 80,
  },
  {
    name: 'member',
    description: 'Standard workspace member',
    permissions: [
      { resource: 'channels', actions: ['create', 'read'] },
      { resource: 'messages', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'members', actions: ['read'] },
      { resource: 'integrations', actions: ['read'] },
      { resource: 'workflows', actions: ['read'] },
    ],
    isDefault: true,
    isSystemRole: true,
    priority: 50,
  },
  {
    name: 'guest',
    description: 'Limited guest access',
    permissions: [
      { resource: 'channels', actions: ['read'] },
      { resource: 'messages', actions: ['create', 'read'] },
      { resource: 'members', actions: ['read'] },
    ],
    isDefault: false,
    isSystemRole: true,
    priority: 10,
  },
];
