'use client';

import {
  FileText,
  Plus,
  Sparkles,
  Calendar,
  List,
  Table as TableIcon,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';

/**
 * Canvas item type
 */
interface CanvasItem {
  id: string;
  title: string;
  type: 'note' | 'document' | 'checklist' | 'table' | 'timeline';
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    image?: string;
  };
  preview?: string;
}

/**
 * Props for the CanvasTab component
 */
interface CanvasTabProps {
  channelId: string;
  className?: string;
}

/**
 * Canvas Tab Component
 *
 * Provides a collaborative space for creating and editing documents,
 * notes, checklists, and other structured content within a channel.
 */
export function CanvasTab({
  channelId: _channelId,
  className,
}: CanvasTabProps) {
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCanvas = useCallback(async (type: CanvasItem['type']) => {
    setIsCreating(true);
    try {
      // TODO: Implement canvas creation API call
      const newItem: CanvasItem = {
        id: `canvas-${Date.now()}`,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: 'current-user',
          name: 'You',
        },
      };
      setCanvasItems(prev => [newItem, ...prev]);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const canvasTypes = [
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
  ];

  if (canvasItems.length === 0) {
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
          Create collaborative content
        </h2>
        <p className='mb-8 max-w-md text-center text-muted-foreground'>
          Canvas lets you create and collaborate on documents, notes,
          checklists, and more within your channel.
        </p>

        <div className='grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {canvasTypes.map(({ type, icon: Icon, label, description }) => (
            <button
              key={type}
              type='button'
              onClick={() => handleCreateCanvas(type)}
              disabled={isCreating}
              className='flex flex-col items-start rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20'
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
          <Plus className='mr-2 h-4 w-4' />
          New Canvas
        </Button>
      </div>

      {/* Canvas list */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {canvasItems.map(item => (
            <button
              key={item.id}
              type='button'
              className='flex flex-col items-start rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent'
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
                  {getInitials(item.createdBy.name)}
                </div>
                <span className='text-xs text-muted-foreground'>
                  {item.createdBy.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CanvasTypeIcon({
  type,
  className,
}: {
  type: CanvasItem['type'];
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

export default CanvasTab;
