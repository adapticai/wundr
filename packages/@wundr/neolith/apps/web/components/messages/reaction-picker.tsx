'use client';

import { Smile } from 'lucide-react';
import { useState, memo, useCallback } from 'react';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from '@/types/chat';

/**
 * Props for the ReactionPicker component
 */
interface ReactionPickerProps {
  /** Callback fired when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Callback to close the picker */
  onClose: () => void;
  /** Additional CSS class names */
  className?: string;
}

export const ReactionPicker = memo(function ReactionPicker({
  onSelect,
  onClose,
  className,
}: ReactionPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('smileys');
  const [searchQuery, setSearchQuery] = useState('');

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  const filteredCategories = EMOJI_CATEGORIES.map(category => ({
    ...category,
    emojis: searchQuery
      ? category.emojis.filter(emoji =>
          emoji.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : category.emojis,
  })).filter(category => category.emojis.length > 0);

  const currentCategory = filteredCategories.find(
    c => c.id === selectedCategory
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Quick reactions */}
      <div className='border-b p-3'>
        <div className='flex flex-wrap gap-1'>
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type='button'
              onClick={() => handleEmojiClick(emoji)}
              className='flex h-10 w-10 items-center justify-center rounded-md text-2xl transition-colors hover:bg-accent'
              title={`Add ${emoji} reaction`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className='border-b p-3'>
        <input
          type='text'
          placeholder='Search emojis...'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className='w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20'
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div className='flex gap-1 overflow-x-auto border-b p-2 scrollbar-thin'>
          {EMOJI_CATEGORIES.slice(1).map(category => (
            <button
              key={category.id}
              type='button'
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                selectedCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title={category.name}
            >
              {category.emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className='flex-1 overflow-y-auto p-3 min-h-0'>
        {searchQuery ? (
          filteredCategories.length > 0 ? (
            <div className='space-y-4'>
              {filteredCategories.map(category => (
                <div key={category.id}>
                  <h4 className='mb-2 text-xs font-semibold text-muted-foreground'>
                    {category.name}
                  </h4>
                  <div className='grid grid-cols-8 gap-1'>
                    {category.emojis.map(emoji => (
                      <button
                        key={emoji}
                        type='button'
                        onClick={() => handleEmojiClick(emoji)}
                        className='flex h-10 w-10 items-center justify-center rounded-md text-2xl transition-colors hover:bg-accent'
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              No emojis found
            </div>
          )
        ) : currentCategory ? (
          <div className='grid grid-cols-8 gap-1'>
            {currentCategory.emojis.map(emoji => (
              <button
                key={emoji}
                type='button'
                onClick={() => handleEmojiClick(emoji)}
                className='flex h-10 w-10 items-center justify-center rounded-md text-2xl transition-colors hover:bg-accent'
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

/**
 * Props for the ReactionPickerTrigger component
 */
interface ReactionPickerTriggerProps {
  /** Callback fired when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Children to render as the trigger button */
  children?: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Responsive Reaction Picker Trigger
 *
 * Uses Dialog on desktop (md+) and Drawer on mobile/tablet
 * for proper modal behavior across all devices.
 */
export const ReactionPickerTrigger = memo(function ReactionPickerTrigger({
  onSelect,
  children,
  className,
}: ReactionPickerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      setIsOpen(false);
    },
    [onSelect]
  );

  return (
    <div className={className}>
      <button
        type='button'
        onClick={() => setIsOpen(true)}
        className='rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground'
        aria-label='Add reaction'
      >
        {children || <Smile className='h-4 w-4' />}
      </button>

      <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveModalContent className='max-w-md p-0 sm:max-h-[80vh] max-h-[70vh] flex flex-col'>
          <ResponsiveModalHeader className='p-4 pb-0'>
            <ResponsiveModalTitle>Add a reaction</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className='flex-1 min-h-0 overflow-hidden'>
            <ReactionPicker
              onSelect={handleSelect}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
});
