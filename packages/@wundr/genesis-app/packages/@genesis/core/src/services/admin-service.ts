/**
 * Admin Service for Genesis-App
 */
import { DEFAULT_GENERAL_SETTINGS, DEFAULT_SECURITY_SETTINGS, DEFAULT_MESSAGING_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_INTEGRATION_SETTINGS, DEFAULT_COMPLIANCE_SETTINGS, DEFAULT_BRANDING_SETTINGS, PLAN_FEATURES, SYSTEM_ROLES } from '../types/admin';

import type { WorkspaceSettings, Role, MemberInfo, Invite, BillingInfo, AdminAction, AdminActionType, UpdateSettingsInput, CreateRoleInput, InviteMemberInput, PlanType, MemberCustomFields } from '../types/admin';

export class AdminError extends Error {
  constructor(message: string, public code: string) {
 super(message); this.name = 'AdminError'; 
}
}
export class SettingsNotFoundError extends AdminError {
 constructor(id: string) {
 super(`Settings not found: ${id}`, 'SETTINGS_NOT_FOUND'); 
} 
}
export class RoleNotFoundError extends AdminError {
 constructor(id: string) {
 super(`Role not found: ${id}`, 'ROLE_NOT_FOUND'); 
} 
}
export class SystemRoleError extends AdminError {
 constructor(msg: string) {
 super(msg, 'SYSTEM_ROLE_ERROR'); 
} 
}
export class MemberNotFoundError extends AdminError {
 constructor(ws: string, u: string) {
 super(`Member not found: ${u} in ${ws}`, 'MEMBER_NOT_FOUND'); 
} 
}
export class InviteNotFoundError extends AdminError {
 constructor(id: string) {
 super(`Invite not found: ${id}`, 'INVITE_NOT_FOUND'); 
} 
}
export class InviteExpiredError extends AdminError {
 constructor(id: string) {
 super(`Invite expired: ${id}`, 'INVITE_EXPIRED'); 
} 
}

/**
 * Filters for querying workspace members.
 */
export interface MemberFilters {
  /** Filter by member status */
  status?: MemberInfo['status'];
  /** Filter by role ID */
  roleId?: string;
  /** Search by name or email */
  search?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip for pagination */
  offset?: number;
}

/**
 * Updates that can be applied to a workspace member.
 */
export interface MemberUpdates {
  /** New role ID for the member */
  roleId?: string;
  /** Custom fields to update (merged with existing) */
  customFields?: MemberCustomFields;
}
/**
 * Filters for querying admin actions/audit log.
 */
export interface AdminActionFilters {
  /** Filter by action type */
  action?: AdminActionType;
  /** Filter by actor ID */
  actorId?: string;
  /** Filter actions from this date */
  from?: Date;
  /** Filter actions until this date */
  to?: Date;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip for pagination */
  offset?: number;
}

/**
 * Valid section names for workspace settings that can be reset.
 */
export type WorkspaceSettingsSection =
  | 'general'
  | 'security'
  | 'messaging'
  | 'notifications'
  | 'integrations'
  | 'compliance'
  | 'branding';

export interface AdminStorage {
  getSettings(workspaceId: string): Promise<WorkspaceSettings | null>;
  saveSettings(settings: WorkspaceSettings): Promise<void>;
  getRole(id: string): Promise<Role | null>;
  getRolesByWorkspace(workspaceId: string): Promise<Role[]>;
  saveRole(role: Role): Promise<void>;
  deleteRole(id: string): Promise<void>;
  getMember(workspaceId: string, userId: string): Promise<MemberInfo | null>;
  getMembersByWorkspace(workspaceId: string): Promise<MemberInfo[]>;
  saveMember(member: MemberInfo): Promise<void>;
  deleteMember(workspaceId: string, userId: string): Promise<void>;
  getInvite(id: string): Promise<Invite | null>;
  getInvitesByWorkspace(workspaceId: string): Promise<Invite[]>;
  saveInvite(invite: Invite): Promise<void>;
  getBilling(workspaceId: string): Promise<BillingInfo | null>;
  saveBilling(billing: BillingInfo): Promise<void>;
  saveAdminAction(action: AdminAction): Promise<void>;
  getAdminActions(workspaceId: string): Promise<AdminAction[]>;
}

function generateId(prefix: string): string { 
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); 
}

export class InMemoryAdminStorage implements AdminStorage {
  private settings = new Map<string, WorkspaceSettings>();
  private roles = new Map<string, Role>();
  private members = new Map<string, MemberInfo>();
  private invites = new Map<string, Invite>();
  private billing = new Map<string, BillingInfo>();
  private adminActions: AdminAction[] = [];
  async getSettings(id: string) {
 return this.settings.get(id) || null; 
}
  async saveSettings(s: WorkspaceSettings) {
 this.settings.set(s.workspaceId, s); 
}
  async getRole(id: string) {
 return this.roles.get(id) || null; 
}
  async getRolesByWorkspace(ws: string) {
 return Array.from(this.roles.values()).filter(r => r.workspaceId === ws); 
}
  async saveRole(r: Role) {
 this.roles.set(r.id, r); 
}
  async deleteRole(id: string) {
 this.roles.delete(id); 
}
  async getMember(ws: string, u: string) {
 return this.members.get(ws + ':' + u) || null; 
}
  async getMembersByWorkspace(ws: string) {
 return Array.from(this.members.values()).filter(m => m.workspaceId === ws); 
}
  async saveMember(m: MemberInfo) {
 this.members.set(m.workspaceId + ':' + m.userId, m); 
}
  async deleteMember(ws: string, u: string) {
 this.members.delete(ws + ':' + u); 
}
  async getInvite(id: string) {
 return this.invites.get(id) || null; 
}
  async getInvitesByWorkspace(ws: string) {
 return Array.from(this.invites.values()).filter(i => i.workspaceId === ws); 
}
  async saveInvite(i: Invite) {
 this.invites.set(i.id, i); 
}
  async getBilling(ws: string) {
 return this.billing.get(ws) || null; 
}
  async saveBilling(b: BillingInfo) {
 this.billing.set(b.workspaceId, b); 
}
  async saveAdminAction(a: AdminAction) {
 this.adminActions.push(a); 
}
  async getAdminActions(ws: string) {
 return this.adminActions.filter(a => a.workspaceId === ws); 
}
}

export class AdminService {
  constructor(private storage: AdminStorage) {}

  async getSettings(workspaceId: string): Promise<WorkspaceSettings> {
    let s = await this.storage.getSettings(workspaceId);
    if (!s) {
 s = this.createDefaultSettings(workspaceId); await this.storage.saveSettings(s); 
}
    return s;
  }

  async updateSettings(workspaceId: string, updates: UpdateSettingsInput, updatedBy: string): Promise<WorkspaceSettings> {
    const s = await this.getSettings(workspaceId);
    if (updates.general) {
s.general = { ...s.general, ...updates.general };
}
    if (updates.security) {
s.security = { ...s.security, ...updates.security };
}
    if (updates.messaging) {
s.messaging = { ...s.messaging, ...updates.messaging };
}
    if (updates.notifications) {
s.notifications = { ...s.notifications, ...updates.notifications };
}
    if (updates.integrations) {
s.integrations = { ...s.integrations, ...updates.integrations };
}
    if (updates.compliance) {
s.compliance = { ...s.compliance, ...updates.compliance };
}
    if (updates.branding) {
s.branding = { ...s.branding, ...updates.branding };
}
    s.updatedAt = new Date(); s.updatedBy = updatedBy;
    await this.storage.saveSettings(s); return s;
  }

  /**
   * Resets workspace settings to defaults.
   * If a section is specified, only that section is reset.
   * Otherwise, all settings are reset to defaults.
   *
   * @param workspaceId - The workspace ID
   * @param section - Optional specific section to reset
   * @returns The reset workspace settings
   */
  async resetSettings(workspaceId: string, section?: WorkspaceSettingsSection): Promise<WorkspaceSettings> {
    const s = await this.getSettings(workspaceId);
    const d = this.createDefaultSettings(workspaceId);
    if (section) {
      this.resetSettingsSection(s, d, section);
    } else {
      Object.assign(s, d);
    }
    s.updatedAt = new Date();
    await this.storage.saveSettings(s);
    return s;
  }

  /**
   * Resets a specific section of workspace settings.
   */
  private resetSettingsSection(
    target: WorkspaceSettings,
    defaults: WorkspaceSettings,
    section: WorkspaceSettingsSection,
  ): void {
    switch (section) {
      case 'general':
        target.general = { ...defaults.general };
        break;
      case 'security':
        target.security = { ...defaults.security };
        break;
      case 'messaging':
        target.messaging = { ...defaults.messaging };
        break;
      case 'notifications':
        target.notifications = { ...defaults.notifications };
        break;
      case 'integrations':
        target.integrations = { ...defaults.integrations };
        break;
      case 'compliance':
        target.compliance = { ...defaults.compliance };
        break;
      case 'branding':
        target.branding = { ...defaults.branding };
        break;
    }
  }

  private createDefaultSettings(workspaceId: string): WorkspaceSettings {
    return { 
      id: generateId('settings'), 
      workspaceId, 
      general: { ...DEFAULT_GENERAL_SETTINGS }, 
      security: { ...DEFAULT_SECURITY_SETTINGS }, 
      messaging: { ...DEFAULT_MESSAGING_SETTINGS }, 
      notifications: { ...DEFAULT_NOTIFICATION_SETTINGS }, 
      integrations: { ...DEFAULT_INTEGRATION_SETTINGS }, 
      compliance: { ...DEFAULT_COMPLIANCE_SETTINGS }, 
      branding: { ...DEFAULT_BRANDING_SETTINGS }, 
      updatedAt: new Date(), 
      updatedBy: 'system', 
    };
  }

  async createRole(workspaceId: string, input: CreateRoleInput, _createdBy: string): Promise<Role> {
    const role: Role = { 
      id: generateId('role'), 
      workspaceId, 
      name: input.name, 
      description: input.description, 
      permissions: input.permissions, 
      isDefault: false, 
      isSystemRole: false, 
      priority: input.priority ?? 50, 
      createdAt: new Date(), 
      updatedAt: new Date(), 
    };
    await this.storage.saveRole(role); return role;
  }

  async getRole(id: string): Promise<Role | null> {
 return this.storage.getRole(id); 
}
  async listRoles(workspaceId: string): Promise<Role[]> {
 return this.storage.getRolesByWorkspace(workspaceId); 
}

  async updateRole(id: string, updates: Partial<CreateRoleInput>): Promise<Role> {
    const role = await this.storage.getRole(id); if (!role) {
throw new RoleNotFoundError(id);
}
    if (role.isSystemRole && (updates.permissions || updates.name)) {
throw new SystemRoleError('Cannot modify system role');
}
    if (updates.name) {
role.name = updates.name;
}
    if (updates.description !== undefined) {
role.description = updates.description;
}
    if (updates.permissions) {
role.permissions = updates.permissions;
}
    if (updates.priority !== undefined) {
role.priority = updates.priority;
}
    role.updatedAt = new Date(); await this.storage.saveRole(role); return role;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.storage.getRole(id); if (!role) {
throw new RoleNotFoundError(id);
}
    if (role.isSystemRole) {
throw new SystemRoleError('Cannot delete system role');
}
    await this.storage.deleteRole(id);
  }

  getDefaultRoles() {
 return SYSTEM_ROLES; 
}

  async listMembers(workspaceId: string, filters?: MemberFilters): Promise<{ members: MemberInfo[]; total: number }> {
    let members = await this.storage.getMembersByWorkspace(workspaceId);
    if (filters?.status) {
members = members.filter(m => m.status === filters.status);
}
    if (filters?.roleId) {
members = members.filter(m => m.roleId === filters.roleId);
}
    if (filters?.search) { 
      const s = filters.search.toLowerCase(); 
      members = members.filter(m => m.user?.name?.toLowerCase().includes(s) || m.user?.email?.toLowerCase().includes(s)); 
    }
    const total = members.length;
    members = members.slice(filters?.offset ?? 0, (filters?.offset ?? 0) + (filters?.limit ?? 50));
    return { members, total };
  }

  async getMember(workspaceId: string, userId: string): Promise<MemberInfo | null> { 
    return this.storage.getMember(workspaceId, userId); 
  }

  async updateMember(workspaceId: string, userId: string, updates: MemberUpdates): Promise<MemberInfo> {
    const m = await this.storage.getMember(workspaceId, userId); 
    if (!m) {
throw new MemberNotFoundError(workspaceId, userId);
}
    if (updates.roleId) {
m.roleId = updates.roleId;
}
    if (updates.customFields) {
m.customFields = { ...m.customFields, ...updates.customFields };
}
    await this.storage.saveMember(m); return m;
  }

  async suspendMember(workspaceId: string, userId: string): Promise<MemberInfo> {
    const m = await this.storage.getMember(workspaceId, userId); 
    if (!m) {
throw new MemberNotFoundError(workspaceId, userId);
}
    m.status = 'suspended'; await this.storage.saveMember(m); return m;
  }

  async unsuspendMember(workspaceId: string, userId: string): Promise<MemberInfo> {
    const m = await this.storage.getMember(workspaceId, userId); 
    if (!m) {
throw new MemberNotFoundError(workspaceId, userId);
}
    m.status = 'active'; await this.storage.saveMember(m); return m;
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const m = await this.storage.getMember(workspaceId, userId); 
    if (!m) {
throw new MemberNotFoundError(workspaceId, userId);
}
    await this.storage.deleteMember(workspaceId, userId);
  }

  async changeMemberRole(workspaceId: string, userId: string, roleId: string): Promise<MemberInfo> {
    const role = await this.storage.getRole(roleId); 
    if (!role) {
throw new RoleNotFoundError(roleId);
}
    return this.updateMember(workspaceId, userId, { roleId });
  }

  async createInvite(workspaceId: string, input: InviteMemberInput, invitedBy: string): Promise<Invite> {
    const invite: Invite = { 
      id: generateId('invite'), 
      workspaceId, 
      email: input.email, 
      roleId: input.roleId ?? 'member', 
      status: 'pending', 
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      createdBy: invitedBy, 
      createdAt: new Date(), 
    };
    await this.storage.saveInvite(invite); return invite;
  }

  async listInvites(workspaceId: string, status?: Invite['status']): Promise<Invite[]> {
    let invites = await this.storage.getInvitesByWorkspace(workspaceId);
    if (status) {
invites = invites.filter(i => i.status === status);
}
    return invites;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const invite = await this.storage.getInvite(inviteId); 
    if (!invite) {
throw new InviteNotFoundError(inviteId);
}
    invite.status = 'revoked'; await this.storage.saveInvite(invite);
  }

  async acceptInvite(inviteId: string, userId: string): Promise<MemberInfo> {
    const invite = await this.storage.getInvite(inviteId); 
    if (!invite) {
throw new InviteNotFoundError(inviteId);
}
    if (invite.status !== 'pending') {
throw new AdminError('Invite is ' + invite.status, 'INVITE_INVALID');
}
    if (new Date() > invite.expiresAt) { 
      invite.status = 'expired'; 
      await this.storage.saveInvite(invite); 
      throw new InviteExpiredError(inviteId); 
    }
    const member: MemberInfo = { 
      id: generateId('member'), 
      userId, 
      workspaceId: invite.workspaceId, 
      roleId: invite.roleId, 
      status: 'active', 
      joinedAt: new Date(), 
      invitedBy: invite.createdBy, 
    };
    await this.storage.saveMember(member);
    invite.status = 'accepted'; invite.acceptedAt = new Date(); 
    await this.storage.saveInvite(invite);
    return member;
  }

  async getBillingInfo(workspaceId: string): Promise<BillingInfo> {
    let b = await this.storage.getBilling(workspaceId);
    if (!b) {
 b = this.createDefaultBilling(workspaceId); await this.storage.saveBilling(b); 
}
    return b;
  }

  async updatePlan(workspaceId: string, plan: PlanType): Promise<BillingInfo> {
    const b = await this.getBillingInfo(workspaceId); 
    b.plan = plan; b.features = PLAN_FEATURES[plan];
    await this.storage.saveBilling(b); return b;
  }

  private createDefaultBilling(workspaceId: string): BillingInfo {
    const now = new Date();
    return { 
      id: generateId('billing'), 
      workspaceId, 
      plan: 'free', 
      status: 'active', 
      currentPeriodStart: now, 
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), 
      seats: 10, 
      seatsUsed: 0, 
      features: PLAN_FEATURES.free, 
    };
  }

  async logAdminAction(action: Omit<AdminAction, 'id' | 'timestamp'>): Promise<AdminAction> {
    const a: AdminAction = { ...action, id: generateId('action'), timestamp: new Date() };
    await this.storage.saveAdminAction(a); return a;
  }

  async getAdminActions(workspaceId: string, filters?: AdminActionFilters): Promise<{ actions: AdminAction[]; total: number }> {
    let actions = await this.storage.getAdminActions(workspaceId);
    if (filters?.action) {
actions = actions.filter(a => a.action === filters.action);
}
    if (filters?.actorId) {
actions = actions.filter(a => a.actorId === filters.actorId);
}
    if (filters?.from) {
actions = actions.filter(a => a.timestamp >= filters.from!);
}
    if (filters?.to) {
actions = actions.filter(a => a.timestamp <= filters.to!);
}
    actions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const total = actions.length;
    actions = actions.slice(filters?.offset ?? 0, (filters?.offset ?? 0) + (filters?.limit ?? 50));
    return { actions, total };
  }
}

export function createAdminService(storage?: AdminStorage): AdminService { 
  return new AdminService(storage ?? new InMemoryAdminStorage()); 
}
