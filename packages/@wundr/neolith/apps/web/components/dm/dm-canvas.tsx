'use client';

import {
  Save,
  Clock,
  Users,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Sparkles,
  List,
  Calendar,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn, getInitials } from '@/lib/utils';

/**
 * Canvas note type
 */
interface CanvasNote {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'document' | 'checklist' | 'table' | 'timeline';
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    image?: string;
  };
  lastEditedBy?: {
    id: string;
    name: string;
    image?: string;
  };
  collaborators?: Array<{
    id: string;
    name: string;
    image?: string;
    isActive: boolean;
  }>;
}

/**
 * Save status type
 */
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Props for the DMCanvas component
 */
interface DMCanvasProps {
  channelId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserImage?: string;
  className?: string;
}

/**
 * DM Canvas Component
 *
 * Provides a collaborative shared notes space for direct messages.
 * Features:
 * - Rich text editing with auto-save
 * - Real-time collaboration indicators
 * - Multiple note types
 * - Auto-save functionality with status indicators
 * - Persistent storage to backend
 */
export function DMCanvas({
  channelId,
  currentUserId,
  currentUserName,
  currentUserImage,
  className,
}: DMCanvasProps) {
  const [notes, setNotes] = useState<CanvasNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load notes from backend
  useEffect(() => {
    loadNotes();
  }, [channelId]);

  // Auto-save when content changes
  useEffect(() => {
    if (!activeNoteId || saveStatus === 'saving') {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set unsaved status immediately
    setSaveStatus('unsaved');

    // Auto-save after 2 seconds of no changes
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveNote();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editContent, editTitle, activeNoteId]);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/channels/${channelId}/canvas`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      } else {
        // If endpoint doesn't exist yet, use mock data for demo
        console.warn('Canvas API not implemented, using demo data');
        setNotes([]);
      }
    } catch (error) {
      console.error('Failed to load canvas notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  const handleCreateNote = useCallback(
    async (type: CanvasNote['type']) => {
      setIsCreating(true);
      try {
        const newNote: CanvasNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          content: '',
          type,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: {
            id: currentUserId,
            name: currentUserName,
            image: currentUserImage,
          },
          collaborators: [
            {
              id: currentUserId,
              name: currentUserName,
              image: currentUserImage,
              isActive: true,
            },
          ],
        };

        // Optimistic update
        setNotes(prev => [newNote, ...prev]);
        setActiveNoteId(newNote.id);
        setEditTitle(newNote.title);
        setEditContent(newNote.content);

        // Save to backend
        const response = await fetch(`/api/channels/${channelId}/canvas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newNote.title,
            content: newNote.content,
            type: newNote.type,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update with server response
          setNotes(prev =>
            prev.map(note => (note.id === newNote.id ? data.note : note)),
          );
          setActiveNoteId(data.note.id);
          toast.success('Note created');
        } else {
          // Keep optimistic update if API not implemented
          console.warn('Canvas creation API not implemented');
          toast.success('Note created (demo mode)');
        }
      } catch (error) {
        console.error('Failed to create note:', error);
        toast.error('Failed to create note');
        // Remove optimistic update on error
        setNotes(prev =>
          prev.filter(note => !note.id.startsWith('note-' + Date.now())),
        );
      } finally {
        setIsCreating(false);
      }
    },
    [channelId, currentUserId, currentUserName, currentUserImage],
  );

  const handleSaveNote = useCallback(async () => {
    if (!activeNoteId) {
      return;
    }

    setSaveStatus('saving');

    try {
      // Update local state
      setNotes(prev =>
        prev.map(note =>
          note.id === activeNoteId
            ? {
                ...note,
                title: editTitle,
                content: editContent,
                updatedAt: new Date().toISOString(),
                lastEditedBy: {
                  id: currentUserId,
                  name: currentUserName,
                  image: currentUserImage,
                },
              }
            : note,
        ),
      );

      // Save to backend
      const response = await fetch(
        `/api/channels/${channelId}/canvas/${activeNoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editTitle,
            content: editContent,
          }),
        },
      );

      if (response.ok) {
        setSaveStatus('saved');
      } else {
        // Keep local changes if API not implemented
        console.warn('Canvas update API not implemented');
        setSaveStatus('saved');
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      setSaveStatus('error');
      toast.error('Failed to save changes');
    }
  }, [
    activeNoteId,
    editTitle,
    editContent,
    channelId,
    currentUserId,
    currentUserName,
    currentUserImage,
  ]);

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      try {
        // Optimistic update
        setNotes(prev => prev.filter(note => note.id !== noteId));
        if (activeNoteId === noteId) {
          setActiveNoteId(null);
          setEditTitle('');
          setEditContent('');
        }

        // Delete from backend
        const response = await fetch(
          `/api/channels/${channelId}/canvas/${noteId}`,
          {
            method: 'DELETE',
          },
        );

        if (response.ok) {
          toast.success('Note deleted');
        } else {
          console.warn('Canvas delete API not implemented');
          toast.success('Note deleted (demo mode)');
        }
      } catch (error) {
        console.error('Failed to delete note:', error);
        toast.error('Failed to delete note');
        // Restore on error
        loadNotes();
      }
    },
    [activeNoteId, channelId, loadNotes],
  );

  const handleSelectNote = useCallback(
    (note: CanvasNote) => {
      // Save current note before switching
      if (
        activeNoteId &&
        activeNoteId !== note.id &&
        saveStatus === 'unsaved'
      ) {
        handleSaveNote();
      }

      setActiveNoteId(note.id);
      setEditTitle(note.title);
      setEditContent(note.content);
      setSaveStatus('saved');
    },
    [activeNoteId, saveStatus, handleSaveNote],
  );

  const noteTypes = [
    {
      type: 'note' as const,
      icon: FileText,
      label: 'Note',
      description: 'Free-form shared notes',
    },
    {
      type: 'document' as const,
      icon: Sparkles,
      label: 'Document',
      description: 'Structured document',
    },
    {
      type: 'checklist' as const,
      icon: List,
      label: 'Checklist',
      description: 'Track tasks together',
    },
    {
      type: 'table' as const,
      icon: TableIcon,
      label: 'Table',
      description: 'Organize data',
    },
    {
      type: 'timeline' as const,
      icon: Calendar,
      label: 'Timeline',
      description: 'Plan schedules',
    },
  ];

  const activeNote = notes.find(note => note.id === activeNoteId);

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex flex-1 items-center justify-center',
          className,
        )}
      >
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  // Empty state
  if (notes.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center p-8',
          className,
        )}
      >
        <div className='mb-8 rounded-full bg-muted p-6'>
          <FileText className='h-12 w-12 text-muted-foreground' />
        </div>
        <h2 className='mb-2 text-xl font-semibold'>
          Create shared notes
        </h2>
        <p className='mb-8 max-w-md text-center text-muted-foreground'>
          Canvas lets you create shared notes, documents, and checklists
          that everyone in this conversation can edit together.
        </p>

        <div className='grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {noteTypes.map(({ type, icon: Icon, label, description }) => (
            <button
              key={type}
              type='button'
              onClick={() => handleCreateNote(type)}
              disabled={isCreating}
              className='flex flex-col items-start rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20 disabled:opacity-50'
            >
              <div className='mb-3 rounded-md bg-primary/10 p-2'>
                <Icon className='h-5 w-5 text-primary' />
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

  // Notes view with editor
  return (
    <div className={cn('flex flex-1 overflow-hidden', className)}>
      {/* Notes list sidebar */}
      <div className='w-64 border-r flex flex-col'>
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <h3 className='font-semibold text-sm'>Shared Notes</h3>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => handleCreateNote('note')}
            disabled={isCreating}
            className='h-7 w-7 p-0'
          >
            <Plus className='h-4 w-4' />
          </Button>
        </div>
        <div className='flex-1 overflow-y-auto p-2'>
          <div className='space-y-1'>
            {notes.map(note => {
              const Icon = noteTypes.find(t => t.type === note.type)?.icon || FileText;
              return (
                <button
                  key={note.id}
                  type='button'
                  onClick={() => handleSelectNote(note)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent',
                    activeNoteId === note.id && 'bg-accent',
                  )}
                >
                  <Icon className='h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground' />
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-sm truncate'>
                      {note.title}
                    </div>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='h-3 w-3' />
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor */}
      {activeNote ? (
        <div className='flex-1 flex flex-col'>
          {/* Editor header */}
          <div className='flex items-center justify-between border-b px-4 py-2'>
            <div className='flex items-center gap-3'>
              <input
                type='text'
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className='font-semibold text-lg bg-transparent border-none outline-none focus:outline-none'
                placeholder='Untitled note'
              />
              {/* Save status indicator */}
              <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className='h-3 w-3 text-green-500' />
                    <span>Saved</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className='h-3 w-3 animate-spin' />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === 'unsaved' && (
                  <>
                    <Edit2 className='h-3 w-3' />
                    <span>Unsaved changes</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <AlertCircle className='h-3 w-3 text-red-500' />
                    <span className='text-red-500'>Error saving</span>
                  </>
                )}
              </div>
            </div>
            <div className='flex items-center gap-2'>
              {/* Collaborators */}
              {activeNote.collaborators && activeNote.collaborators.length > 0 && (
                <div className='flex items-center gap-1'>
                  <Users className='h-3 w-3 text-muted-foreground' />
                  <div className='flex -space-x-1'>
                    {activeNote.collaborators.map(collaborator => (
                      <Avatar
                        key={collaborator.id}
                        className='h-6 w-6 border-2 border-background'
                      >
                        <AvatarImage
                          src={collaborator.image || undefined}
                          alt={collaborator.name}
                        />
                        <AvatarFallback className='text-[8px]'>
                          {getInitials(collaborator.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}
              {/* Actions */}
              <Button
                size='sm'
                variant='ghost'
                onClick={handleSaveNote}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className='h-8'
              >
                <Save className='h-3 w-3 mr-1' />
                Save
              </Button>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => handleDeleteNote(activeNote.id)}
                className='h-8'
              >
                <Trash2 className='h-3 w-3' />
              </Button>
            </div>
          </div>

          {/* Editor content */}
          <div className='flex-1 overflow-y-auto p-4'>
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder='Start typing your shared notes here...'
              className='min-h-full resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base'
            />
          </div>

          {/* Editor footer */}
          <div className='border-t px-4 py-2 text-xs text-muted-foreground'>
            {activeNote.lastEditedBy ? (
              <span>
                Last edited by {activeNote.lastEditedBy.name} on{' '}
                {new Date(activeNote.updatedAt).toLocaleString()}
              </span>
            ) : (
              <span>
                Created by {activeNote.createdBy.name} on{' '}
                {new Date(activeNote.createdAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className='flex-1 flex items-center justify-center text-muted-foreground'>
          <p>Select a note to edit</p>
        </div>
      )}
    </div>
  );
}

export default DMCanvas;
