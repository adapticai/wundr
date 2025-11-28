'use client';

import { clsx } from 'clsx';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';

type AdminTab = 'settings' | 'members' | 'roles' | 'billing' | 'activity';

export default function AdminPage() {
  const params = useParams();
  const workspaceId = params?.workspaceSlug as string; // URL uses workspaceSlug
  const { setPageHeader } = usePageHeader();
  const [activeTab, setActiveTab] = useState<AdminTab>('settings');

  // Set page header
  useEffect(() => {
    setPageHeader('Admin Console', 'Manage workspace administration settings');
  }, [setPageHeader]);

  const tabs: { id: AdminTab; label: string; icon: JSX.Element }[] = [
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    { id: 'members', label: 'Members', icon: <UsersIcon /> },
    { id: 'roles', label: 'Roles', icon: <ShieldIcon /> },
    { id: 'billing', label: 'Billing', icon: <CreditCardIcon /> },
    { id: 'activity', label: 'Activity', icon: <ActivityIcon /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main className="flex-1 bg-card rounded-lg border border-border p-6">
            {activeTab === 'settings' && <SettingsPanel workspaceId={workspaceId} />}
            {activeTab === 'members' && <MembersPanel workspaceId={workspaceId} />}
            {activeTab === 'roles' && <RolesPanel workspaceId={workspaceId} />}
            {activeTab === 'billing' && <BillingPanel workspaceId={workspaceId} />}
            {activeTab === 'activity' && <ActivityPanel workspaceId={workspaceId} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ workspaceId: _workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Workspace Settings</h2>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Workspace Name</label>
          <input type="text" className="w-full px-3 py-2 bg-muted border border-border rounded-lg" placeholder="My Workspace" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Timezone</label>
          <select className="w-full px-3 py-2 bg-muted border border-border rounded-lg">
            <option>UTC</option>
            <option>America/New_York</option>
            <option>Europe/London</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="guestAccess" className="rounded" />
          <label htmlFor="guestAccess" className="text-sm">Allow guest access</label>
        </div>
      </div>
      <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save Changes</button>
    </div>
  );
}

function MembersPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Members</h2>
        <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">Invite Members</button>
      </div>
      <div className="text-sm text-muted-foreground">Member list for workspace {workspaceId}</div>
    </div>
  );
}

function RolesPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Roles & Permissions</h2>
        <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">Create Role</button>
      </div>
      <div className="text-sm text-muted-foreground">Role management for workspace {workspaceId}</div>
    </div>
  );
}

function BillingPanel({ workspaceId: _workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Billing & Plans</h2>
      <div className="p-4 bg-muted rounded-lg">
        <div className="text-sm font-medium">Current Plan: Free</div>
        <div className="text-xs text-muted-foreground mt-1">10 members, 5GB storage</div>
      </div>
      <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Upgrade Plan</button>
    </div>
  );
}

function ActivityPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Admin Activity Log</h2>
      <div className="text-sm text-muted-foreground">Activity log for workspace {workspaceId}</div>
    </div>
  );
}

function SettingsIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function UsersIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
function ShieldIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
}
function CreditCardIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
}
function ActivityIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
