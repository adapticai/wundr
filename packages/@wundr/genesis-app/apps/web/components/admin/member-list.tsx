'use client';

import { useState, useEffect, useCallback } from 'react';

import { cn } from '@/lib/utils';

export interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  image?: string;
  role: string;
  status: 'active' | 'suspended' | 'pending';
  lastActiveAt?: string;
  joinedAt: string;
}

export interface MemberListProps {
  workspaceId: string;
  onEditMember?: (member: WorkspaceMember) => void;
  className?: string;
}

export function MemberList({ workspaceId, onEditMember, className }: MemberListProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const pageSize = 20;

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (searchQuery) {
params.set('search', searchQuery);
}
      if (roleFilter) {
params.set('role', roleFilter);
}
      if (statusFilter) {
params.set('status', statusFilter);
}

      const response = await fetch(
        `/api/workspaces/${workspaceId}/admin/members?${params.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkAction = async (action: 'suspend' | 'activate' | 'remove') => {
    if (selectedIds.size === 0) {
return;
}

    const confirmed =
      action === 'remove'
        ? confirm(`Are you sure you want to remove ${selectedIds.size} member(s)?`)
        : true;

    if (!confirmed) {
return;
}

    try {
      await fetch(`/api/workspaces/${workspaceId}/admin/members/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      setSelectedIds(new Set());
      fetchMembers();
    } catch {
      // Handle error
    }
  };

  const formatLastActive = (timestamp?: string) => {
    if (!timestamp) {
return 'Never';
}
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

  const STATUS_COLORS = {
    active: 'bg-green-500/10 text-green-500',
    suspended: 'bg-red-500/10 text-red-500',
    pending: 'bg-yellow-500/10 text-yellow-500',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search members..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          <option value="">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="guest">Guest</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleBulkAction('activate')}
              className="px-3 py-1.5 bg-green-500/10 text-green-500 rounded text-sm hover:bg-green-500/20"
            >
              Activate
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('suspend')}
              className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 rounded text-sm hover:bg-yellow-500/20"
            >
              Suspend
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('remove')}
              className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded text-sm hover:bg-red-500/20"
            >
              Remove
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Member table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={members.length > 0 && selectedIds.size === members.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-border"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Member
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Last Active
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No members found
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(member.id)}
                      onChange={() => handleSelect(member.id)}
                      className="w-4 h-4 rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {member.status === 'active' && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs capitalize">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded text-xs capitalize',
                        STATUS_COLORS[member.status],
                      )}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatLastActive(member.lastActiveAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEditMember?.(member)}
                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm text-foreground"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-muted rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="px-3 py-1.5 bg-muted rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default MemberList;
