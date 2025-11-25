'use client';

import { useState, useEffect, useCallback } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Represents metadata details for an admin activity entry.
 * Contains key-value pairs describing changes or additional context.
 */
export interface AdminActivityDetails {
  /** Previous value before the change */
  previousValue?: string | number | boolean;
  /** New value after the change */
  newValue?: string | number | boolean;
  /** Field name that was modified */
  field?: string;
  /** Reason for the action if applicable */
  reason?: string;
  /** Additional contextual information */
  context?: string;
  /** User agent string if available */
  userAgent?: string;
  /** Geographic location derived from IP */
  location?: string;
  /** Duration of the action in milliseconds */
  durationMs?: number;
  /** Error message if the action failed */
  errorMessage?: string;
  /** Count of affected items */
  affectedCount?: number;
}

/**
 * Represents an administrative activity log entry.
 * Tracks actions performed by workspace administrators and system events.
 */
export interface AdminActivity {
  /** Unique identifier for the activity entry */
  id: string;
  /** Human-readable description of the action performed */
  action: string;
  /** Category of the action for filtering and display */
  actionType: 'create' | 'update' | 'delete' | 'access' | 'security' | 'billing';
  /** Information about who performed the action */
  actor: {
    /** Unique identifier of the actor */
    id: string;
    /** Display name of the actor */
    name: string;
    /** Email address of the actor */
    email: string;
    /** Avatar image URL if available */
    image?: string;
  };
  /** The target resource of the action */
  resource: {
    /** Type of resource (e.g., 'member', 'role', 'channel') */
    type: string;
    /** Unique identifier of the resource */
    id: string;
    /** Display name of the resource if available */
    name?: string;
  };
  /** Additional details about the activity */
  details?: AdminActivityDetails;
  /** ISO 8601 timestamp when the activity occurred */
  timestamp: string;
  /** IP address from which the action was performed */
  ipAddress?: string;
}

/**
 * Props for the ActivityLog component.
 */
export interface ActivityLogProps {
  /** The workspace ID to fetch activities for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

const ACTION_TYPE_CONFIG = {
  create: { color: 'bg-emerald-500', icon: PlusIcon },
  update: { color: 'bg-blue-500', icon: EditIcon },
  delete: { color: 'bg-destructive', icon: TrashIcon },
  access: { color: 'bg-violet-500', icon: EyeIcon },
  security: { color: 'bg-amber-500', icon: ShieldIcon },
  billing: { color: 'bg-orange-500', icon: CreditCardIcon },
};

export function ActivityLog({ workspaceId, className }: ActivityLogProps) {
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{
    actionType?: string;
    actorId?: string;
    resourceType?: string;
  }>({});

  const pageSize = 30;

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (filters.actionType) {
params.set('actionType', filters.actionType);
}
      if (filters.actorId) {
params.set('actorId', filters.actorId);
}
      if (filters.resourceType) {
params.set('resourceType', filters.resourceType);
}

      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/activity?${params.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, filters]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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
return `${diffMins} minutes ago`;
}
    if (diffHours < 24) {
return `${diffHours} hours ago`;
}
    if (diffDays < 7) {
return `${diffDays} days ago`;
}
    return date.toLocaleDateString();
  };

  const formatAction = (activity: AdminActivity) => {
    const resourceName = activity.resource.name || activity.resource.id;

    switch (activity.actionType) {
      case 'create':
        return `created ${activity.resource.type} "${resourceName}"`;
      case 'update':
        return `updated ${activity.resource.type} "${resourceName}"`;
      case 'delete':
        return `deleted ${activity.resource.type} "${resourceName}"`;
      case 'access':
        return `accessed ${activity.resource.type} "${resourceName}"`;
      case 'security':
        return activity.action;
      case 'billing':
        return activity.action;
      default:
        return activity.action;
    }
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, AdminActivity[]>);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={filters.actionType || 'all'}
          onValueChange={(value) => {
            setFilters((f) => ({ ...f, actionType: value === 'all' ? undefined : value }));
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="access">Access</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.resourceType || 'all'}
          onValueChange={(value) => {
            setFilters((f) => ({ ...f, resourceType: value === 'all' ? undefined : value }));
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="member">Members</SelectItem>
            <SelectItem value="role">Roles</SelectItem>
            <SelectItem value="channel">Channels</SelectItem>
            <SelectItem value="vp">Virtual Personas</SelectItem>
            <SelectItem value="integration">Integrations</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>

        {(filters.actionType || filters.resourceType) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({});
              setPage(0);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Activity timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      ) : activities.length === 0 ? (
        <div className="p-8 text-center bg-muted/50 rounded-lg">
          <p className="text-muted-foreground">No activity recorded</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date}>
              <h3 className="text-sm font-heading font-medium text-muted-foreground mb-3">
                {date === new Date().toDateString() ? 'Today' : date}
              </h3>

              <div className="space-y-3">
                {dayActivities.map((activity) => {
                  const config = ACTION_TYPE_CONFIG[activity.actionType];
                  const IconComponent = config.icon;

                  return (
                    <Card key={activity.id} className="flex items-start gap-3 p-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center',
                          config.color,
                        )}
                      >
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Actor avatar */}
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={activity.actor.image} alt={activity.actor.name} />
                            <AvatarFallback className="text-xs">
                              {activity.actor.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">
                            {activity.actor.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatAction(activity)}
                          </span>
                        </div>

                        {/* Details */}
                        {activity.details && Object.keys(activity.details).length > 0 && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground font-mono">
                            {Object.entries(activity.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-foreground">{key}:</span>{' '}
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Timestamp and IP */}
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatTimestamp(activity.timestamp)}</span>
                          {activity.ipAddress && (
                            <>
                              <span>-</span>
                              <span>{activity.ipAddress}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

export default ActivityLog;
