'use client';

import { Hash, Plus } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';

export default function ChannelsPage() {
  // TODO: Replace with actual channel fetching logic
  const channels: any[] = [];
  const isLoading = false;
  const error = null;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Channels</h1>
          <p className="text-sm text-muted-foreground">
            Organize conversations and collaborate with your team
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Channel
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">Failed to load channels</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && channels.length === 0 && (
        <EmptyState
          icon={Hash}
          title="No Channels Yet"
          description="Create your first channel to start organizing conversations. Channels help keep discussions focused and make it easy to find information."
          action={{
            label: 'Create Your First Channel',
            onClick: () => setIsCreateDialogOpen(true),
          }}
        />
      )}

      {/* Channel Grid */}
      {!isLoading && !error && channels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel: any) => (
            <div
              key={channel.id}
              className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <h3 className="font-semibold">{channel.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {channel.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create Channel Dialog - TODO: Implement */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-background p-6">
            <h2 className="text-xl font-semibold">Create Channel</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Channel creation dialog to be implemented
            </p>
            <button
              type="button"
              onClick={() => setIsCreateDialogOpen(false)}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
