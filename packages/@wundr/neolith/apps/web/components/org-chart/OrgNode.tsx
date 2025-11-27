'use client';

import { Building2, ChevronDown, ChevronRight, Folder, User } from 'lucide-react';
import React from 'react';
import { OrchestratorStatusDot } from '@/components/orchestrator/orchestrator-status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { DISCIPLINE_COLORS, type OrgHierarchyNode, type OrgNodeProps } from './types';
import { OrchestratorDetailsPopover } from './OrchestratorDetailsPopover';

/**
 * Individual node component in the org hierarchy tree
 * Supports: Organization, Workspace, and Orchestrator nodes with appropriate styling
 */
export function OrgNode({ node, depth, onNodeClick, isExpanded, onToggleExpand }: OrgNodeProps) {
  const hasChildren = node.children && node.children.length > 0;

  const getNodeIcon = () => {
    switch (node.type) {
      case 'organization':
        return <Building2 className="h-5 w-5 text-primary" />;
      case 'workspace':
        return <Folder className="h-5 w-5 text-blue-600" />;
      case 'orchestrator':
        return node.data?.avatarUrl ? null : <User className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'default';
      case 'ADMIN':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const disciplineColor = node.data?.discipline
    ? DISCIPLINE_COLORS[node.data.discipline] || 'bg-gray-100 text-gray-800 border-gray-300'
    : '';

  // Organization node
  if (node.type === 'organization') {
    return (
      <div className="space-y-4">
        <Card
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg border-2',
            isExpanded && 'border-primary',
          )}
          onClick={() => {
            onNodeClick?.(node);
            onToggleExpand();
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getNodeIcon()}
                <div>
                  <h2 className="text-xl font-bold">{node.name}</h2>
                  {node.data?.role && (
                    <Badge variant={getRoleBadgeVariant(node.data.role)} className="mt-2">
                      {node.data.role}
                    </Badge>
                  )}
                </div>
              </div>
              {hasChildren && (
                <button className="p-2 hover:bg-accent rounded-md transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {isExpanded && hasChildren && (
          <div className="ml-8 space-y-3 border-l-2 border-border pl-6">
            {node.children?.map((child) => (
              <OrgNodeRenderer key={child.id} node={child} depth={depth + 1} onNodeClick={onNodeClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Workspace node
  if (node.type === 'workspace') {
    return (
      <div className="space-y-3">
        <Card
          className={cn(
            'cursor-pointer transition-all hover:shadow-md',
            isExpanded && 'border-blue-500',
          )}
          onClick={() => {
            onNodeClick?.(node);
            onToggleExpand();
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getNodeIcon()}
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{node.name}</h3>
                  {(node.data?.orchestratorCount !== undefined || node.data?.onlineOrchestratorCount !== undefined) && (
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {node.data.orchestratorCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {node.data.orchestratorCount} Orchestrators
                        </span>
                      )}
                      {node.data.onlineOrchestratorCount !== undefined && (
                        <span className="flex items-center gap-1 text-green-600">
                          <OrchestratorStatusDot status="ONLINE" size="sm" showPulse={false} />
                          {node.data.onlineOrchestratorCount} Online
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {hasChildren && (
                <button className="p-2 hover:bg-accent rounded-md transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {isExpanded && hasChildren && (
          <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
            {/* Group Orchestrators by discipline */}
            {groupByDiscipline(node.children || []).map(([discipline, orchestrators]) => (
              <div key={discipline} className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1">
                  <span className={cn('text-xs font-semibold px-2 py-1 rounded-md', disciplineColor)}>
                    {discipline || 'Uncategorized'}
                  </span>
                  <span className="text-xs text-muted-foreground">({orchestrators.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {orchestrators.map((orchestrator) => (
                    <OrgNodeRenderer key={orchestrator.id} node={orchestrator} depth={depth + 1} onNodeClick={onNodeClick} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Orchestrator node
  if (node.type === 'orchestrator' && node.data?.status) {
    const orchestratorDetails = {
      id: node.id,
      name: node.name,
      avatarUrl: node.data.avatarUrl,
      discipline: node.data.discipline,
      status: node.data.status,
      currentTask: node.data.currentTask,
    };

    return (
      <OrchestratorDetailsPopover orchestrator={orchestratorDetails}>
        <Card
          className={cn(
            'cursor-pointer transition-all hover:shadow-md hover:border-primary/50 relative overflow-hidden',
            disciplineColor && 'border-l-4',
          )}
          style={
            node.data.discipline
              ? {
                  borderLeftColor: `var(--${node.data.discipline.toLowerCase().replace(/\s+/g, '-')}-border, #ccc)`,
                }
              : undefined
          }
          onClick={() => onNodeClick?.(node)}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  {node.data.avatarUrl && <AvatarImage src={node.data.avatarUrl} alt={node.name} />}
                  <AvatarFallback className="text-xs font-semibold">
                    {getInitials(node.name)}
                  </AvatarFallback>
                </Avatar>
                {node.data.status && (
                  <div className="absolute -bottom-1 -right-1">
                    <OrchestratorStatusDot status={node.data.status} size="md" showPulse />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h4 className="font-semibold text-sm truncate">{node.name}</h4>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{node.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {node.data.currentTask && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {node.data.currentTask}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{node.data.currentTask}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {node.data.role && (
                <Badge variant={getRoleBadgeVariant(node.data.role)} className="text-xs">
                  {node.data.role}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </OrchestratorDetailsPopover>
    );
  }

  return null;
}

/**
 * Helper component to manage node expansion state
 */
function OrgNodeRenderer({
  node,
  depth,
  onNodeClick,
}: {
  node: OrgHierarchyNode;
  depth: number;
  onNodeClick?: (node: OrgHierarchyNode) => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(depth < 2); // Auto-expand first 2 levels

  return (
    <OrgNode
      node={node}
      depth={depth}
      onNodeClick={onNodeClick}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
    />
  );
}

/**
 * Groups Orchestrator nodes by discipline for better organization
 */
function groupByDiscipline(nodes: OrgNodeProps['node'][]): [string, OrgNodeProps['node'][]][] {
  const grouped = nodes.reduce((acc, node) => {
    const discipline = node.data?.discipline || 'Uncategorized';
    if (!acc[discipline]) {
      acc[discipline] = [];
    }
    acc[discipline].push(node);
    return acc;
  }, {} as Record<string, OrgNodeProps['node'][]>);

  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Loading skeleton for org nodes
 */
export function OrgNodeSkeleton({ type = 'orchestrator' }: { type?: 'organization' | 'workspace' | 'orchestrator' }) {
  if (type === 'organization') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'workspace') {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
