'use client';

import { useState, memo, useCallback } from 'react';
import { Smile } from 'lucide-react';

import { cn } from '@/lib/utils';
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from '@/types/chat';

/**
 * Props for the ReactionPicker component
 */
interface ReactionPickerProps {
  /** Callback fired when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Additional CSS class names */
  className?: string;
}

export const ReactionPicker = memo(function ReactionPicker({
  onSelect,
  className,
}: ReactionPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('smileys');
  const [searchQuery, setSearchQuery] = useState('');

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
    },
    [onSelect],
  );

  const filteredCategories = EMOJI_CATEGORIES.map((category) => ({
    ...category,
    emojis: searchQuery
      ? category.emojis.filter((emoji) =>
          emoji.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : category.emojis,
  })).filter((category) => category.emojis.length > 0);

  const currentCategory = filteredCategories.find((c) => c.id === selectedCategory);

  return (
    <div className={cn('w-80 rounded-lg border bg-popover shadow-lg', className)}>
      {/* Quick reactions */}
      <div className="border-b p-3">
        <div className="flex flex-wrap gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-accent"
              title={`Add ${emoji} reaction`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="border-b p-2">
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex gap-1 border-b p-2">
          {EMOJI_CATEGORIES.slice(1).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                selectedCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={category.name}
            >
              {category.emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="max-h-64 overflow-y-auto p-2">
        {searchQuery ? (
          filteredCategories.length > 0 ? (
            <div className="space-y-4">
              {filteredCategories.map((category) => (
                <div key={category.id}>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                    {category.name}
                  </h4>
                  <div className="grid grid-cols-8 gap-1">
                    {category.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiClick(emoji)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-accent"
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
            <div className="py-8 text-center text-sm text-muted-foreground">
              No emojis found
            </div>
          )
        ) : currentCategory ? (
          <div className="grid grid-cols-8 gap-1">
            {currentCategory.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-accent"
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
    [onSelect],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground',
          className,
        )}
        aria-label="Add reaction"
      >
        {children || <Smile className="h-4 w-4" />}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Picker */}
          <div className="absolute bottom-full right-0 z-50 mb-2">
            <ReactionPicker onSelect={handleSelect} />
          </div>
        </>
      )}
    </div>
  );
});
