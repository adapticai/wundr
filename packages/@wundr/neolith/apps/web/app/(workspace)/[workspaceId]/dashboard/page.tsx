import { LayoutDashboard } from 'lucide-react';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { CreateWorkspaceCard } from '@/components/workspace/create-workspace-card';
import { WorkspaceCardSkeleton } from '@/components/workspace/workspace-card';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  // TODO: Replace with actual workspace fetching logic
  const workspaces: any[] = []; // This should fetch user's workspaces
  const isLoading = false; // This should come from data fetching state

  return (
    <div className="py-2">
      <h1 className="text-3xl font-bold mb-8">
        Welcome, {session.user?.name || 'User'}
      </h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Workspaces Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Your Workspaces</h2>

          {/* Empty State for New Users */}
          {!isLoading && workspaces.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="Welcome to Your Dashboard"
              description="Get started by creating your first workspace. Workspaces help you organize your projects, teams, and AI-powered virtual persons."
              action={{
                label: 'Create Your First Workspace',
                onClick: () => {
                  // TODO: Implement workspace creation navigation
                  window.location.href = '/workspaces/new';
                },
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Workspace cards will be rendered here */}
              {isLoading ? (
                <>
                  <WorkspaceCardSkeleton />
                  <WorkspaceCardSkeleton />
                </>
              ) : (
                workspaces.map((workspace: any) => (
                  <div key={workspace.id}>
                    {/* Workspace card component */}
                  </div>
                ))
              )}
              <CreateWorkspaceCard />
            </div>
          )}
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <ActivityItem
                title="Organization created"
                description="AI Research Lab"
                time="2 hours ago"
              />
              <ActivityItem
                title="Agent deployed"
                description="Data Analyst Agent"
                time="5 hours ago"
              />
              <ActivityItem
                title="Workflow updated"
                description="Onboarding Pipeline"
                time="1 day ago"
              />
              <ActivityItem
                title="Team member added"
                description="john@example.com"
                time="2 days ago"
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <StatItem label="Organizations" value="3" />
              <StatItem label="Active Agents" value="12" />
              <StatItem label="Workflows" value="8" />
              <StatItem label="Deployments" value="5" />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <QuickAction
                label="Create Organization"
                href="/organizations/new"
              />
              <QuickAction label="Deploy Agent" href="/agents/deploy" />
              <QuickAction label="New Workflow" href="/workflows/new" />
              <QuickAction label="View Documentation" href="/docs" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  title,
  description,
  time,
}: {
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {time}
      </span>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      {label}
      <ChevronRightIcon />
    </a>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
