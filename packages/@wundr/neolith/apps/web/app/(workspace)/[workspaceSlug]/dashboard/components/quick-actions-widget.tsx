'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessageSquarePlus,
  Hash,
  UserPlus,
  Workflow,
  Search
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface QuickActionsWidgetProps {
  workspaceSlug: string;
  onSearchClick?: () => void;
  onComposeClick?: () => void;
  onCreateChannelClick?: () => void;
  onInviteMemberClick?: () => void;
  canCreateWorkflow?: boolean;
}

export function QuickActionsWidget({
  workspaceSlug,
  onSearchClick,
  onComposeClick,
  onCreateChannelClick,
  onInviteMemberClick,
  canCreateWorkflow = true,
}: QuickActionsWidgetProps) {
  const router = useRouter();

  const handleNewMessage = () => {
    if (onComposeClick) {
      onComposeClick();
    } else {
      router.push(`/${workspaceSlug}/messages`);
    }
  };

  const handleCreateChannel = () => {
    if (onCreateChannelClick) {
      onCreateChannelClick();
    } else {
      router.push(`/${workspaceSlug}/channels`);
    }
  };

  const handleInviteMember = () => {
    if (onInviteMemberClick) {
      onInviteMemberClick();
    } else {
      router.push(`/${workspaceSlug}/admin/members`);
    }
  };

  const handleNewWorkflow = () => {
    router.push(`/${workspaceSlug}/workflows`);
  };

  const handleSearch = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      // Focus global search input if available
      const searchInput = document.querySelector<HTMLInputElement>('[data-global-search]');
      if (searchInput) {
        searchInput.focus();
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            icon={<MessageSquarePlus className="h-5 w-5" />}
            label="New Message"
            onClick={handleNewMessage}
            shortcut="⌘K"
          />
          <ActionButton
            icon={<Hash className="h-5 w-5" />}
            label="Create Channel"
            onClick={handleCreateChannel}
          />
          <ActionButton
            icon={<UserPlus className="h-5 w-5" />}
            label="Invite Member"
            onClick={handleInviteMember}
          />
          {canCreateWorkflow && (
            <ActionButton
              icon={<Workflow className="h-5 w-5" />}
              label="New Workflow"
              onClick={handleNewWorkflow}
            />
          )}
          <ActionButton
            icon={<Search className="h-5 w-5" />}
            label="Search"
            onClick={handleSearch}
            shortcut="⌘/"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
}

function ActionButton({ icon, label, onClick, shortcut }: ActionButtonProps) {
  return (
    <Button
      variant="outline"
      className="flex flex-col items-center justify-center h-24 gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
      onClick={onClick}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
    >
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
      {shortcut && (
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded">
          {shortcut}
        </kbd>
      )}
    </Button>
  );
}
