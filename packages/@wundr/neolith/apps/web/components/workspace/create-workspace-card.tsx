'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

export function CreateWorkspaceCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-card p-6 text-center transition-all hover:border-primary hover:bg-accent"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <PlusIcon />
        </div>
        <span className="font-medium">Create Workspace</span>
        <span className="mt-1 text-sm text-muted-foreground">
          Start a new organization
        </span>
      </button>

      {isModalOpen && (
        <CreateWorkspaceModal onClose={() => setIsModalOpen(false)} />
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
