'use client';

import {
  Shield,
  Users,
  Eye,
  Edit,
  Play,
  Trash2,
  Copy,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { WorkflowId } from '@/types/workflow';

/**
 * Permission levels for workflow access control
 */
export type WorkflowPermissionLevel = 'view' | 'edit' | 'execute' | 'admin';

/**
 * Permission subject types
 */
export type PermissionSubjectType = 'user' | 'team' | 'role';

/**
 * Visibility settings for workflows
 */
export type WorkflowVisibility = 'private' | 'workspace' | 'public';

/**
 * Permission entry for a user/team/role
 */
export interface WorkflowPermission {
  id: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectName: string;
  subjectEmail?: string;
  subjectAvatarUrl?: string;
  level: WorkflowPermissionLevel;
  inheritedFrom?: string; // workspace, team, etc.
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

/**
 * Access log entry
 */
export interface WorkflowAccessLog {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  action: 'viewed' | 'edited' | 'executed' | 'shared' | 'permission_changed';
  timestamp: string;
  details?: string;
}

/**
 * Workflow sharing configuration
 */
export interface WorkflowSharingConfig {
  visibility: WorkflowVisibility;
  allowPublicAccess: boolean;
  publicShareLink?: string;
  requireApproval: boolean;
  inheritWorkspacePermissions: boolean;
}

interface WorkflowPermissionsProps {
  workflowId: WorkflowId;
  workflowName: string;
  permissions: WorkflowPermission[];
  accessLog: WorkflowAccessLog[];
  sharingConfig: WorkflowSharingConfig;
  workspacePermissions?: WorkflowPermission[];
  isOwner?: boolean;
  onUpdatePermission: (permissionId: string, level: WorkflowPermissionLevel) => Promise<void>;
  onRemovePermission: (permissionId: string) => Promise<void>;
  onAddPermission: (
    subjectType: PermissionSubjectType,
    subjectId: string,
    level: WorkflowPermissionLevel
  ) => Promise<void>;
  onUpdateSharingConfig: (config: Partial<WorkflowSharingConfig>) => Promise<void>;
  onGenerateShareLink: () => Promise<string>;
  onRevokeShareLink: () => Promise<void>;
  onCopyShareLink: (link: string) => void;
}

const PERMISSION_CONFIG = {
  view: {
    label: 'View',
    description: 'Can view workflow details and execution history',
    icon: Eye,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  edit: {
    label: 'Edit',
    description: 'Can modify workflow configuration and settings',
    icon: Edit,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  execute: {
    label: 'Execute',
    description: 'Can trigger and run the workflow',
    icon: Play,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
  },
  admin: {
    label: 'Admin',
    description: 'Full control including permissions management',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
  },
} as const;

const ACTION_LABELS = {
  viewed: 'Viewed',
  edited: 'Edited',
  executed: 'Executed',
  shared: 'Shared',
  permission_changed: 'Changed permissions',
} as const;

export function WorkflowPermissions({
  workflowId,
  workflowName,
  permissions,
  accessLog,
  sharingConfig,
  workspacePermissions = [],
  isOwner = false,
  onUpdatePermission,
  onRemovePermission,
  onAddPermission,
  onUpdateSharingConfig,
  onGenerateShareLink,
  onRevokeShareLink,
  onCopyShareLink,
}: WorkflowPermissionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectType, setSelectedSubjectType] = useState<PermissionSubjectType>('user');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showAccessLog, setShowAccessLog] = useState(false);
  const [expandedLogItems, setExpandedLogItems] = useState<Set<string>>(new Set());

  // Filter permissions based on search query
  const filteredPermissions = useMemo(() => {
    if (!searchQuery) {
return permissions;
}
    const query = searchQuery.toLowerCase();
    return permissions.filter(
      (p) =>
        p.subjectName.toLowerCase().includes(query) ||
        p.subjectEmail?.toLowerCase().includes(query),
    );
  }, [permissions, searchQuery]);

  // Group permissions by type
  const groupedPermissions = useMemo(() => {
    const groups: Record<PermissionSubjectType, WorkflowPermission[]> = {
      user: [],
      team: [],
      role: [],
    };
    filteredPermissions.forEach((p) => {
      groups[p.subjectType].push(p);
    });
    return groups;
  }, [filteredPermissions]);

  const handleGenerateShareLink = useCallback(async () => {
    setIsGeneratingLink(true);
    try {
      const link = await onGenerateShareLink();
      onCopyShareLink(link);
    } finally {
      setIsGeneratingLink(false);
    }
  }, [onGenerateShareLink, onCopyShareLink]);

  const handleToggleLogItem = useCallback((logId: string) => {
    setExpandedLogItems((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
return 'Just now';
}
    if (diffMins < 60) {
return `${diffMins}m ago`;
}
    if (diffHours < 24) {
return `${diffHours}h ago`;
}
    if (diffDays < 7) {
return `${diffDays}d ago`;
}
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Workflow Permissions</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who can access and modify this workflow
        </p>
      </div>

      {/* Sharing Settings */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="visibility" className="text-base font-medium">
              Visibility
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Control who can discover this workflow
            </p>
          </div>
          <Select
            value={sharingConfig.visibility}
            onValueChange={(value) =>
              onUpdateSharingConfig({ visibility: value as WorkflowVisibility })
            }
            disabled={!isOwner}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="inherit-permissions" className="text-base font-medium">
              Inherit Workspace Permissions
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Apply workspace-level permissions to this workflow
            </p>
          </div>
          <Switch
            id="inherit-permissions"
            checked={sharingConfig.inheritWorkspacePermissions}
            onCheckedChange={(checked) =>
              onUpdateSharingConfig({ inheritWorkspacePermissions: checked })
            }
            disabled={!isOwner}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="public-access" className="text-base font-medium">
              Public Share Link
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Allow anyone with the link to access
            </p>
          </div>
          <Switch
            id="public-access"
            checked={sharingConfig.allowPublicAccess}
            onCheckedChange={(checked) =>
              onUpdateSharingConfig({ allowPublicAccess: checked })
            }
            disabled={!isOwner}
          />
        </div>

        {sharingConfig.allowPublicAccess && (
          <div className="space-y-2">
            {sharingConfig.publicShareLink ? (
              <div className="flex gap-2">
                <Input
                  value={sharingConfig.publicShareLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onCopyShareLink(sharingConfig.publicShareLink!)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => window.open(sharingConfig.publicShareLink, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {isOwner && (
                  <Button size="icon" variant="destructive" onClick={onRevokeShareLink}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleGenerateShareLink}
                disabled={isGeneratingLink}
                className="w-full"
              >
                Generate Share Link
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Inherited Permissions Banner */}
      {sharingConfig.inheritWorkspacePermissions && workspacePermissions.length > 0 && (
        <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-medium text-blue-900 dark:text-blue-100">
                Workspace Permissions Active
              </span>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                {workspacePermissions.length} permission(s) inherited from workspace settings
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedSubjectType} onValueChange={(v) => setSelectedSubjectType(v as PermissionSubjectType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </div>
            </SelectItem>
            <SelectItem value="team">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Teams
              </div>
            </SelectItem>
            <SelectItem value="role">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Roles
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Permissions List */}
      <div className="border rounded-lg">
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No permissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPermissions.map((permission) => {
                  const config = PERMISSION_CONFIG[permission.level];
                  const Icon = config.icon;
                  const isInherited = !!permission.inheritedFrom;

                  return (
                    <TableRow key={permission.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={permission.subjectAvatarUrl} />
                            <AvatarFallback>{getInitials(permission.subjectName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{permission.subjectName}</div>
                            {permission.subjectEmail && (
                              <div className="text-xs text-muted-foreground">
                                {permission.subjectEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {permission.subjectType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1 rounded', config.bgColor)}>
                            <Icon className={cn('h-3 w-3', config.color)} />
                          </div>
                          <span className="font-medium">{config.label}</span>
                          {isInherited && (
                            <Badge variant="secondary" className="text-xs">
                              Inherited
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(permission.grantedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isInherited && isOwner && (
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={permission.level}
                              onValueChange={(value) =>
                                onUpdatePermission(permission.id, value as WorkflowPermissionLevel)
                              }
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PERMISSION_CONFIG).map(([level, cfg]) => (
                                  <SelectItem key={level} value={level}>
                                    <div className="flex items-center gap-2">
                                      <cfg.icon className="h-3 w-3" />
                                      {cfg.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => onRemovePermission(permission.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Access Log */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowAccessLog(!showAccessLog)}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Access Log ({accessLog.length} entries)
          </div>
          {showAccessLog ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {showAccessLog && (
          <div className="border rounded-lg">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {accessLog.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No access log entries yet
                  </div>
                ) : (
                  accessLog.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 mt-0.5">
                          <AvatarImage src={log.userAvatarUrl} />
                          <AvatarFallback>{getInitials(log.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-medium">{log.userName}</span>
                              <span className="text-muted-foreground mx-2">·</span>
                              <span className="text-sm text-muted-foreground">
                                {ACTION_LABELS[log.action]}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          {log.details && (
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleToggleLogItem(log.id)}
                              >
                                {expandedLogItems.has(log.id) ? 'Hide' : 'Show'} details
                              </Button>
                              {expandedLogItems.has(log.id) && (
                                <div className="mt-2 p-3 bg-muted/50 rounded text-sm">
                                  {log.details}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Permission Levels Legend */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
        <h4 className="text-sm font-semibold">Permission Levels</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(PERMISSION_CONFIG).map(([level, config]) => {
            const Icon = config.icon;
            return (
              <div key={level} className="flex items-start gap-3">
                <div className={cn('p-2 rounded', config.bgColor)}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
