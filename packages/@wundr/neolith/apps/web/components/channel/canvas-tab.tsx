'use client';

import {
  FileText,
  Plus,
  Sparkles,
  Calendar,
  List,
  Table as TableIcon,
  Trash2,
  Pencil,
  X,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn, getInitials } from '@/lib/utils';

/**
 * Canvas document type (mirrors the API shape)
 */
interface CanvasDocument {
  id: string;
  title: string;
  type: 'note' | 'document' | 'checklist' | 'table' | 'timeline';
  content: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
  createdByImage: string | null;
}

/**
 * Props for the CanvasTab component
 */
interface CanvasTabProps {
  channelId: string;
  className?: string;
}

const CANVAS_TYPES = [
  {
    type: 'note' as const,
    icon: FileText,
    label: 'Note',
    description: 'Free-form text and formatting',
  },
  {
    type: 'document' as const,
    icon: Sparkles,
    label: 'AI Document',
    description: 'AI-assisted document creation',
  },
  {
    type: 'checklist' as const,
    icon: List,
    label: 'Checklist',
    description: 'Track tasks and todos',
  },
  {
    type: 'table' as const,
    icon: TableIcon,
    label: 'Table',
    description: 'Structured data in rows and columns',
  },
  {
    type: 'timeline' as const,
    icon: Calendar,
    label: 'Timeline',
    description: 'Plan and visualize schedules',
  },
] as const;

function CanvasTypeIcon({
  type,
  className,
}: {
  type: CanvasDocument['type'];
  className?: string;
}) {
  switch (type) {
    case 'document':
      return <Sparkles className={className} />;
    case 'checklist':
      return <List className={className} />;
    case 'table':
      return <TableIcon className={className} />;
    case 'timeline':
      return <Calendar className={className} />;
    default:
      return <FileText className={className} />;
  }
}

/**
 * Inline editor shown when a canvas document is open
 */
function CanvasEditor({
  document,
  channelId,
  currentUserId,
  onSave,
  onClose,
}: {
  document: CanvasDocument;
  channelId: string;
  currentUserId: string;
  onSave: (updated: CanvasDocument) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation error',
        description: 'Title cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/channels/${channelId}/canvas/${document.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save document');
      }
      const result = await response.json();
      onSave(result.data as CanvasDocument);
      toast({ title: 'Saved', description: 'Canvas document updated.' });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save document',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [channelId, document.id, title, content, onSave, toast]);

  const canEdit =
    document.createdById === currentUserId ||
    // Admins are handled server-side; optimistically allow editing for now
    true;

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      {/* Editor header */}
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <Button
          variant='ghost'
          size='sm'
          onClick={onClose}
          className='h-8 w-8 p-0'
        >
          <ChevronLeft className='h-4 w-4' />
          <span className='sr-only'>Back</span>
        </Button>
        <CanvasTypeIcon
          type={document.type}
          className='h-4 w-4 text-muted-foreground'
        />
        <input
          className='flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground'
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder='Document title...'
          disabled={!canEdit}
        />
        {canEdit && (
          <Button size='sm' onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className='mr-2 h-3 w-3 animate-spin' />}
            Save
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className='flex-1 overflow-y-auto p-6'>
        <textarea
          className='h-full min-h-[400px] w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground'
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={getPlaceholder(document.type)}
          disabled={!canEdit}
        />
      </div>
    </div>
  );
}

function getPlaceholder(type: CanvasDocument['type']): string {
  switch (type) {
    case 'checklist':
      return '- [ ] First item\n- [ ] Second item\n- [ ] Third item';
    case 'table':
      return '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Value    | Value    | Value    |';
    case 'timeline':
      return 'Q1 - Planning\nQ2 - Development\nQ3 - Testing\nQ4 - Launch';
    case 'document':
      return 'Start writing your document...';
    default:
      return 'Start writing your note...';
  }
}

/**
 * Canvas Tab Component
 *
 * Provides a collaborative space for creating and editing documents,
 * notes, checklists, and other structured content within a channel.
 * CRUD operations are backed by the channel canvas API.
 */
export function CanvasTab({ channelId, className }: CanvasTabProps) {
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  const [canvasItems, setCanvasItems] = useState<CanvasDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [openDocument, setOpenDocument] = useState<CanvasDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch existing canvas documents on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchDocuments() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/channels/${channelId}/canvas`);
        if (!response.ok) {
          throw new Error('Failed to fetch canvas documents');
        }
        const result = await response.json();
        if (!cancelled) {
          setCanvasItems(result.data ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[CanvasTab] Failed to fetch documents:', error);
          toast({
            title: 'Error',
            description: 'Failed to load canvas documents.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDocuments();
    return () => {
      cancelled = true;
    };
  }, [channelId, toast]);

  const handleCreateCanvas = useCallback(
    async (type: CanvasDocument['type']) => {
      setIsCreating(true);
      try {
        const label =
          CANVAS_TYPES.find(t => t.type === type)?.label ?? 'Document';
        const title = `New ${label}`;

        const response = await fetch(`/api/channels/${channelId}/canvas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, type, content: '' }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create canvas document');
        }

        const result = await response.json();
        const newDoc = result.data as CanvasDocument;

        setCanvasItems(prev => [newDoc, ...prev]);
        // Open the new document immediately for editing
        setOpenDocument(newDoc);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to create canvas document',
          variant: 'destructive',
        });
      } finally {
        setIsCreating(false);
      }
    },
    [channelId, toast]
  );

  const handleDocumentSaved = useCallback((updated: CanvasDocument) => {
    setCanvasItems(prev =>
      prev.map(item => (item.id === updated.id ? updated : item))
    );
    setOpenDocument(updated);
  }, []);

  const handleDeleteCanvas = useCallback(
    async (docId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeletingId(docId);
      try {
        const response = await fetch(
          `/api/channels/${channelId}/canvas/${docId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to delete canvas document');
        }

        setCanvasItems(prev => prev.filter(item => item.id !== docId));
        if (openDocument?.id === docId) {
          setOpenDocument(null);
        }
        toast({ title: 'Deleted', description: 'Canvas document removed.' });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to delete canvas document',
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [channelId, openDocument, toast]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn('flex flex-1 items-center justify-center p-8', className)}
      >
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  // Open document editor
  if (openDocument) {
    return (
      <div className={cn('flex flex-1 flex-col', className)}>
        <CanvasEditor
          document={openDocument}
          channelId={channelId}
          currentUserId={authUser?.id ?? ''}
          onSave={handleDocumentSaved}
          onClose={() => setOpenDocument(null)}
        />
      </div>
    );
  }

  // Empty state
  if (canvasItems.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center p-8',
          className
        )}
      >
        <div className='mb-8 rounded-full bg-muted p-6'>
          <FileText className='h-12 w-12 text-muted-foreground' />
        </div>
        <h2 className='mb-2 text-xl font-semibold'>
          Create collaborative content
        </h2>
        <p className='mb-8 max-w-md text-center text-muted-foreground'>
          Canvas lets you create and collaborate on documents, notes,
          checklists, and more within your channel.
        </p>

        <div className='grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {CANVAS_TYPES.map(({ type, icon: Icon, label, description }) => (
            <button
              key={type}
              type='button'
              onClick={() => handleCreateCanvas(type)}
              disabled={isCreating}
              className='flex flex-col items-start rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20 disabled:pointer-events-none disabled:opacity-50'
            >
              <div className='mb-3 rounded-md bg-primary/10 p-2'>
                {isCreating ? (
                  <Loader2 className='h-5 w-5 animate-spin text-primary' />
                ) : (
                  <Icon className='h-5 w-5 text-primary' />
                )}
              </div>
              <span className='font-medium'>{label}</span>
              <span className='mt-1 text-xs text-muted-foreground'>
                {description}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Document list
  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <h3 className='font-semibold'>Canvas</h3>
        <Button
          size='sm'
          onClick={() => handleCreateCanvas('note')}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Plus className='mr-2 h-4 w-4' />
          )}
          New Canvas
        </Button>
      </div>

      {/* Canvas list */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {canvasItems.map(item => (
            <div key={item.id} className='group relative'>
              <button
                type='button'
                onClick={() => setOpenDocument(item)}
                className='flex w-full flex-col items-start rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent'
              >
                <div className='mb-2 flex w-full items-center justify-between'>
                  <CanvasTypeIcon
                    type={item.type}
                    className='h-5 w-5 text-muted-foreground'
                  />
                  <span className='text-xs text-muted-foreground'>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <span className='font-medium'>{item.title}</span>
                {item.preview && (
                  <span className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                    {item.preview}
                  </span>
                )}
                <div className='mt-3 flex items-center gap-2'>
                  <div className='flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium'>
                    {getInitials(item.createdByName)}
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    {item.createdByName}
                  </span>
                </div>
              </button>

              {/* Action buttons */}
              <div className='absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                <button
                  type='button'
                  onClick={() => setOpenDocument(item)}
                  className='flex h-6 w-6 items-center justify-center rounded bg-background/80 text-muted-foreground shadow-sm hover:text-foreground'
                  title='Edit document'
                >
                  <Pencil className='h-3 w-3' />
                  <span className='sr-only'>Edit</span>
                </button>
                <button
                  type='button'
                  onClick={e => handleDeleteCanvas(item.id, e)}
                  disabled={deletingId === item.id}
                  className='flex h-6 w-6 items-center justify-center rounded bg-background/80 text-muted-foreground shadow-sm hover:text-destructive disabled:opacity-50'
                  title='Delete document'
                >
                  {deletingId === item.id ? (
                    <Loader2 className='h-3 w-3 animate-spin' />
                  ) : (
                    <Trash2 className='h-3 w-3' />
                  )}
                  <span className='sr-only'>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CanvasTab;
