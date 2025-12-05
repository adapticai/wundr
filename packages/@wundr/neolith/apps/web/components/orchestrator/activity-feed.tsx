/**
 * OrchestratorActivityFeed Component
 *
 * Enhanced activity feed for orchestrators with:
 * - Real-time updates via polling
 * - Advanced filtering (type, date range, search)
 * - Timeline visualization
 * - Pagination support
 * - Export capabilities
 *
 * @module components/orchestrator/activity-feed
 */
'use client';

import {
  Activity,
  AlertCircle,
  Brain,
  Calendar,
  Clock,
  Download,
  Filter,
  MessageSquare,
  Pause,
  Play,
  Search,
  Settings,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineTime,
  TimelineTitle,
  TimelineDescription,
} from '@/components/ui/timeline';
import { cn } from '@/lib/utils';

/**
 * Activity entry interface
 */
export interface ActivityEntry {
  id: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
  channelId?: string;
  taskId?: string;
  importance: number;
  keywords: string[];
  timestamp: string;
  updatedAt: string;
}

/**
 * Activity type configuration for visual styling
 */
const ACTIVITY_TYPE_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
    label: string;
  }
> = {
  TASK_STARTED: {
    icon: Play,
    color: 'text-green-600',
    variant: 'success',
    label: 'Task Started',
  },
  TASK_COMPLETED: {
    icon: Zap,
    color: 'text-blue-600',
    variant: 'primary',
    label: 'Task Completed',
  },
  TASK_UPDATED: {
    icon: Activity,
    color: 'text-amber-600',
    variant: 'warning',
    label: 'Task Updated',
  },
  STATUS_CHANGE: {
    icon: Clock,
    color: 'text-purple-600',
    variant: 'info',
    label: 'Status Change',
  },
  MESSAGE_SENT: {
    icon: MessageSquare,
    color: 'text-indigo-600',
    variant: 'info',
    label: 'Message Sent',
  },
  CHANNEL_JOINED: {
    icon: Users,
    color: 'text-teal-600',
    variant: 'success',
    label: 'Channel Joined',
  },
  CHANNEL_LEFT: {
    icon: Users,
    color: 'text-gray-600',
    variant: 'default',
    label: 'Channel Left',
  },
  DECISION_MADE: {
    icon: Brain,
    color: 'text-pink-600',
    variant: 'primary',
    label: 'Decision Made',
  },
  LEARNING_RECORDED: {
    icon: TrendingUp,
    color: 'text-cyan-600',
    variant: 'info',
    label: 'Learning Recorded',
  },
  CONVERSATION_INITIATED: {
    icon: MessageSquare,
    color: 'text-violet-600',
    variant: 'info',
    label: 'Conversation Initiated',
  },
  TASK_DELEGATED: {
    icon: Users,
    color: 'text-orange-600',
    variant: 'warning',
    label: 'Task Delegated',
  },
  TASK_ESCALATED: {
    icon: TrendingUp,
    color: 'text-red-600',
    variant: 'error',
    label: 'Task Escalated',
  },
  ERROR_OCCURRED: {
    icon: AlertCircle,
    color: 'text-red-600',
    variant: 'error',
    label: 'Error Occurred',
  },
  SYSTEM_EVENT: {
    icon: Settings,
    color: 'text-gray-600',
    variant: 'default',
    label: 'System Event',
  },
};

/**
 * Props for OrchestratorActivityFeed component
 */
export interface OrchestratorActivityFeedProps {
  orchestratorId: string;
  workspaceSlug: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialLimit?: number;
}

/**
 * Enhanced activity feed component with filtering and real-time updates
 */
export function OrchestratorActivityFeed({
  orchestratorId,
  workspaceSlug,
  autoRefresh = false,
  refreshInterval = 30000,
  initialLimit = 20,
}: OrchestratorActivityFeedProps) {
  // State
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Format relative time for activity timestamps
   */
  const formatRelativeTime = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
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

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(
    async (append = false) => {
      if (!workspaceSlug || !orchestratorId) {
return;
}

      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: initialLimit.toString(),
        });

        if (append && cursor) {
          params.set('cursor', cursor);
        }

        if (selectedType !== 'all') {
          params.set('type', selectedType);
        }

        if (dateFrom) {
          params.set('dateFrom', new Date(dateFrom).toISOString());
        }

        if (dateTo) {
          params.set('dateTo', new Date(dateTo).toISOString());
        }

        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/activity?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.status}`);
        }

        const result = await response.json();
        const newActivities = result.data?.activities || [];
        const pagination = result.data?.pagination || {};

        if (append) {
          setActivities(prev => [...prev, ...newActivities]);
        } else {
          setActivities(newActivities);
        }

        setCursor(pagination.cursor || null);
        setHasMore(pagination.hasMore || false);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to fetch activities');
        setError(error);
        console.error('[OrchestratorActivityFeed] Error:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      workspaceSlug,
      orchestratorId,
      cursor,
      initialLimit,
      selectedType,
      dateFrom,
      dateTo,
    ],
  );

  /**
   * Load more activities (pagination)
   */
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
return;
}
    fetchActivities(true);
  }, [hasMore, isLoadingMore, fetchActivities]);

  /**
   * Retry after error
   */
  const handleRetry = useCallback(() => {
    setCursor(null);
    fetchActivities(false);
  }, [fetchActivities]);

  /**
   * Apply filters
   */
  const handleApplyFilters = useCallback(() => {
    setCursor(null);
    fetchActivities(false);
  }, [fetchActivities]);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedType('all');
    setDateFrom('');
    setDateTo('');
    setCursor(null);
  }, []);

  /**
   * Export activities to CSV
   */
  const handleExport = useCallback(() => {
    const csv = [
      ['Timestamp', 'Type', 'Description', 'Importance', 'Keywords'].join(','),
      ...activities.map(a =>
        [
          new Date(a.timestamp).toISOString(),
          a.type,
          `"${a.description.replace(/"/g, '""')}"`,
          a.importance,
          `"${a.keywords.join(', ')}"`,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orchestrator-activity-${orchestratorId}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activities, orchestratorId]);

  /**
   * Filter activities by search query
   */
  const filteredActivities = useMemo(() => {
    if (!searchQuery) {
return activities;
}

    const query = searchQuery.toLowerCase();
    return activities.filter(
      activity =>
        activity.description.toLowerCase().includes(query) ||
        activity.keywords.some(k => k.toLowerCase().includes(query)) ||
        activity.type.toLowerCase().includes(query),
    );
  }, [activities, searchQuery]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchActivities(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestratorId, workspaceSlug]);

  /**
   * Auto-refresh setup
   */
  useEffect(() => {
    if (!autoRefresh) {
return;
}

    const interval = setInterval(() => {
      fetchActivities(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchActivities]);

  /**
   * Refresh when filters change
   */
  useEffect(() => {
    if (!isLoading) {
      handleApplyFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, dateFrom, dateTo]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedType !== 'all') {
count++;
}
    if (dateFrom) {
count++;
}
    if (dateTo) {
count++;
}
    if (searchQuery) {
count++;
}
    return count;
  }, [selectedType, dateFrom, dateTo, searchQuery]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 items-start animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Card className="border-red-200 bg-red-50 max-w-sm">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <p className="text-sm text-red-800 font-medium">
              Failed to load activity
            </p>
            <p className="text-xs text-red-600 mt-1">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="mt-3"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Activity Type</h4>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Object.entries(ACTIVITY_TYPE_CONFIG).map(
                        ([type, config]) => (
                          <SelectItem key={type} value={type}>
                            {config.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-sm mb-2">Date Range</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        From
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="datetime-local"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">To</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="datetime-local"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="flex-1"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    className="flex-1"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={filteredActivities.length === 0}
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </Button>

          {autoRefresh && (
            <Button variant="outline" size="icon" disabled>
              <Activity className="h-4 w-4 animate-pulse" />
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {filteredActivities.length} of {activities.length} activities
          </p>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-auto py-1"
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            {activities.length === 0
              ? 'No activity recorded yet'
              : 'No activities match your filters'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {activities.length === 0
              ? 'Activity will appear here as this orchestrator performs actions'
              : 'Try adjusting your search or filters'}
          </p>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="mt-4"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Timeline */}
          <Timeline>
            {filteredActivities.map((activity, index) => {
              const config =
                ACTIVITY_TYPE_CONFIG[activity.type] ||
                ACTIVITY_TYPE_CONFIG.SYSTEM_EVENT;
              const IconComponent = config.icon;
              const isLast = index === filteredActivities.length - 1;

              return (
                <TimelineItem key={activity.id}>
                  <TimelineDot variant={config.variant} icon={<IconComponent className="h-4 w-4" />} />
                  {!isLast && <TimelineConnector />}
                  <TimelineContent>
                    <TimelineTime>
                      {formatRelativeTime(activity.timestamp)}
                    </TimelineTime>
                    <TimelineTitle className="flex items-center gap-2">
                      {activity.description}
                      {activity.importance >= 7 && (
                        <Badge variant="outline" className="text-xs">
                          High Priority
                        </Badge>
                      )}
                    </TimelineTitle>
                    {activity.keywords && activity.keywords.length > 0 && (
                      <TimelineDescription>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activity.keywords.slice(0, 5).map((keyword, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-muted px-1.5 py-0.5 rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </TimelineDescription>
                    )}
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Activity className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
