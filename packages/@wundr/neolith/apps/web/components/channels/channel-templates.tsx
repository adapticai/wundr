'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Channel Template structure
 */
export interface ChannelTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  icon: string | null;
  isSystem: boolean;
  channelId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelTemplatesProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string) => void;
  isAdmin?: boolean;
}

/**
 * Channel Templates Component
 *
 * Displays available message templates for a channel
 * Allows users to select templates and admins to create custom ones
 */
export function ChannelTemplates({
  channelId,
  open,
  onClose,
  onSelectTemplate,
  isAdmin = false,
}: ChannelTemplatesProps) {
  const [templates, setTemplates] = useState<ChannelTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch templates when dialog opens
  const fetchTemplates = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}/templates`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [channelId, open]);

  // Fetch templates on mount and when dialog opens
  useState(() => {
    if (open) {
      fetchTemplates();
    }
  });

  const handleSelectTemplate = (template: ChannelTemplate) => {
    // Process placeholders in template content
    const processedContent = processPlaceholders(template.content);
    onSelectTemplate(processedContent);
    onClose();
  };

  const handleCreateTemplate = () => {
    setShowCreateForm(true);
  };

  return (
    <>
      <Dialog open={open && !showCreateForm} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Message Templates</DialogTitle>
            <DialogDescription>
              Select a template to quickly compose common messages
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {!loading && !error && templates.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  No templates available yet
                </p>
                {isAdmin && (
                  <Button onClick={handleCreateTemplate} variant="outline">
                    Create First Template
                  </Button>
                )}
              </div>
            )}

            {!loading && !error && templates.length > 0 && (
              <div className="grid gap-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={() => handleSelectTemplate(template)}
                  />
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            {isAdmin && templates.length > 0 && (
              <Button onClick={handleCreateTemplate} variant="outline">
                Create New Template
              </Button>
            )}
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showCreateForm && (
        <CreateTemplateDialog
          channelId={channelId}
          open={showCreateForm}
          onClose={() => {
            setShowCreateForm(false);
            fetchTemplates();
          }}
        />
      )}
    </>
  );
}

/**
 * Template Card Component
 */
interface TemplateCardProps {
  template: ChannelTemplate;
  onSelect: () => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 border rounded-lg hover:bg-accent hover:border-accent-foreground/20 transition-colors group"
    >
      <div className="flex items-start gap-3">
        {template.icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
            {template.icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{template.name}</h4>
            {template.isSystem && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                System
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mb-2">
              {template.description}
            </p>
          )}
          <div className="text-xs font-mono bg-muted/50 rounded p-2 line-clamp-2 group-hover:bg-muted/70 transition-colors">
            {template.content}
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * Create Template Dialog
 */
interface CreateTemplateDialogProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
}

function CreateTemplateDialog({ channelId, open, onClose }: CreateTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) {
      setError('Name and content are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          content: content.trim(),
          icon: icon.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Message Template</DialogTitle>
          <DialogDescription>
            Create a reusable template for common messages. Use placeholders like {'{'}date{'}'}, {'{'}user{'}'}, {'{'}time{'}'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="template-name" className="block text-sm font-medium mb-1.5">
              Template Name <span className="text-destructive">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Standup"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="template-icon" className="block text-sm font-medium mb-1.5">
              Icon (emoji)
            </label>
            <input
              id="template-icon"
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📋"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={4}
            />
          </div>

          <div>
            <label htmlFor="template-description" className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <input
              id="template-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when to use this template"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="template-content" className="block text-sm font-medium mb-1.5">
              Template Content <span className="text-destructive">*</span>
            </label>
            <textarea
              id="template-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'Example:\n\nDaily Standup - {date}\n\nYesterday:\n- [What you did]\n\nToday:\n- [What you will do]\n\nBlockers:\n- [Any issues]'}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm min-h-[200px] resize-y"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {content.length}/2000 characters
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium mb-1">Available Placeholders:</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div><code className="bg-background px-1 rounded">{'{'}date{'}'}</code> - Current date</div>
              <div><code className="bg-background px-1 rounded">{'{'}time{'}'}</code> - Current time</div>
              <div><code className="bg-background px-1 rounded">{'{'}user{'}'}</code> - Your name</div>
              <div><code className="bg-background px-1 rounded">{'{'}channel{'}'}</code> - Channel name</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="ghost" disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Process placeholders in template content
 */
function processPlaceholders(content: string): string {
  const now = new Date();
  const placeholders: Record<string, string> = {
    '{date}': now.toLocaleDateString(),
    '{time}': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    '{user}': 'You',
    '{channel}': 'this channel',
  };

  let processed = content;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    processed = processed.replace(new RegExp(placeholder, 'g'), value);
  }

  return processed;
}

/**
 * Loading Spinner
 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-muted-foreground"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
