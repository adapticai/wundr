'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

import { ChannelTemplates } from './channel-templates';

interface TemplateSelectorProps {
  channelId: string;
  onSelectTemplate: (content: string) => void;
  isAdmin?: boolean;
  disabled?: boolean;
}

/**
 * Template Selector Button Component
 *
 * Provides quick access to message templates via a dropdown menu
 * Integrates with the message input component
 */
export function TemplateSelector({
  channelId,
  onSelectTemplate,
  isAdmin = false,
  disabled = false,
}: TemplateSelectorProps) {
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-8 px-2 hover:bg-accent"
            title="Insert template"
          >
            <TemplateIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Quick Templates</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => onSelectTemplate(getStandupTemplate())}
          >
            <span className="mr-2">📋</span>
            <div>
              <div className="font-medium text-sm">Daily Standup</div>
              <div className="text-xs text-muted-foreground">Yesterday, Today, Blockers</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onSelectTemplate(getAnnouncementTemplate())}
          >
            <span className="mr-2">📢</span>
            <div>
              <div className="font-medium text-sm">Announcement</div>
              <div className="text-xs text-muted-foreground">Important team message</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onSelectTemplate(getMeetingNotesTemplate())}
          >
            <span className="mr-2">📝</span>
            <div>
              <div className="font-medium text-sm">Meeting Notes</div>
              <div className="text-xs text-muted-foreground">Agenda and action items</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onSelectTemplate(getDecisionTemplate())}
          >
            <span className="mr-2">✅</span>
            <div>
              <div className="font-medium text-sm">Decision</div>
              <div className="text-xs text-muted-foreground">Document team decision</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowTemplatesDialog(true)}
            className="text-primary"
          >
            <span className="mr-2">🔍</span>
            Browse All Templates
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChannelTemplates
        channelId={channelId}
        open={showTemplatesDialog}
        onClose={() => setShowTemplatesDialog(false)}
        onSelectTemplate={onSelectTemplate}
        isAdmin={isAdmin}
      />
    </>
  );
}

/**
 * Built-in template generators
 */
function getStandupTemplate(): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `**Daily Standup - ${date}**

**Yesterday:**
-

**Today:**
-

**Blockers:**
- None`;
}

function getAnnouncementTemplate(): string {
  return `**📢 Announcement**

**Subject:**

**Details:**


**Action Required:**
-

**Questions?** Feel free to ask below 👇`;
}

function getMeetingNotesTemplate(): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `**Meeting Notes - ${date} at ${time}**

**Attendees:**
-

**Agenda:**
1.

**Discussion Points:**
-

**Decisions Made:**
-

**Action Items:**
- [ ]

**Next Meeting:**
- Date:
- Time: `;
}

function getDecisionTemplate(): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `**✅ Decision - ${date}**

**Context:**


**Options Considered:**
1.
2.

**Decision:**


**Rationale:**


**Next Steps:**
-

**Decision Makers:**
- `;
}

/**
 * Template Icon
 */
function TemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}
