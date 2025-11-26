'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrgGenesisWizard } from '@/components/org-genesis/org-genesis-wizard';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/**
 * API response type for workspace creation
 */
interface CreateWorkspaceResponse {
  data?: {
    id: string;
    name: string;
    slug: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

type CreationMode = 'quick' | 'genesis' | null;

export function CreateWorkspaceCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>(null);

  const handleQuickCreate = () => {
    setCreationMode('quick');
    setIsModalOpen(true);
  };

  const handleGenesisCreate = () => {
    setCreationMode('genesis');
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setCreationMode(null);
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Create */}
        <button
          type="button"
          onClick={handleQuickCreate}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-card p-6 text-center transition-all hover:border-primary hover:bg-accent"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <PlusIcon />
          </div>
          <span className="font-medium">Quick Create</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Simple workspace setup
          </span>
        </button>

        {/* Genesis Create */}
        <button
          type="button"
          onClick={handleGenesisCreate}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/25 bg-card p-6 text-center transition-all hover:border-primary hover:bg-accent"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SparklesIcon />
          </div>
          <span className="font-medium">AI-Powered Organization</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Generate complete org structure
          </span>
        </button>
      </div>

      {isModalOpen && creationMode === 'quick' && (
        <CreateWorkspaceModal onClose={handleClose} />
      )}

      {isModalOpen && creationMode === 'genesis' && (
        <Dialog open={isModalOpen} onOpenChange={handleClose}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <OrgGenesisWizard />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

interface CreateWorkspaceModalProps {
  onClose: () => void;
}

function CreateWorkspaceModal({ onClose }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generates a URL-friendly slug from a workspace name
   */
  const generateSlug = (workspaceName: string): string => {
    return workspaceName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Create workspace via REST API
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          slug: generateSlug(name),
        }),
      });

      const result: CreateWorkspaceResponse = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message ?? 'Failed to create workspace');
      }

      // Close modal and navigate to new workspace
      onClose();
      if (result.data?.id) {
        router.push(`/${result.data.id}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(errorMessage);
      console.error('Failed to create workspace:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg animate-scale-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Workspace</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="workspace-name"
              className="mb-2 block text-sm font-medium"
            >
              Workspace Name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
              required
              className="w-full rounded-lg border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="workspace-description"
              className="mb-2 block text-sm font-medium"
            >
              Description (optional)
            </label>
            <textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your organization..."
              rows={3}
              className="w-full rounded-lg border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
