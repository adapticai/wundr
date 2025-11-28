'use client';

import { useState, useMemo, useCallback } from 'react';

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
  /** Array of frequently used emojis */
  frequentEmojis?: string[];
  /** Additional CSS class names */
  className?: string;
}

export function ReactionPicker({
  onSelect,
  onClose,
  frequentEmojis = [],
  className,
}: ReactionPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('frequent');

  // Build categories with frequent emojis
  const categories = useMemo(() => {
    const cats = [...EMOJI_CATEGORIES];
    const frequentIndex = cats.findIndex((c) => c.id === 'frequent');
    if (frequentIndex >= 0) {
      cats[frequentIndex] = {
        ...cats[frequentIndex],
        emojis: frequentEmojis.length > 0 ? frequentEmojis : QUICK_REACTIONS,
      };
    }
    return cats;
  }, [frequentEmojis]);

  // Filter emojis by search
  const filteredCategories = useMemo(() => {
    if (!search) return categories;

    const searchLower = search.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter((emoji) => {
          return emoji.includes(search) || cat.name.toLowerCase().includes(searchLower);
        }),
      }))
      .filter((cat) => cat.emojis.length > 0);
  }, [categories, search]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`emoji-category-${categoryId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
      </div>

      {/* Quick reactions */}
      <div className="flex gap-1 border-b p-3">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            className="rounded-md p-2 text-2xl hover:bg-accent transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b px-3 py-2 scrollbar-thin">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => handleCategoryClick(category.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeCategory === category.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            id={`emoji-category-${category.id}`}
            className="mb-4"
          >
            <div className="sticky top-0 mb-2 bg-background py-1 text-xs font-semibold text-muted-foreground">
              {category.name}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${category.id}-${index}`}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="rounded-md p-2 text-2xl hover:bg-accent transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No emojis found
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Props for the ReactionPickerTrigger component
 */
interface ReactionPickerTriggerProps {
  /** Child elements that act as the trigger button */
  children: React.ReactNode;
  /** Callback fired when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Array of frequently used emojis */
  frequentEmojis?: string[];
  /** Additional CSS class names */
  className?: string;
}

/**
 * Responsive Emoji Picker Trigger
 *
 * Uses Dialog on desktop (md+) and Drawer on mobile/tablet
 * for proper modal behavior across all devices.
 */
export function ReactionPickerTrigger({
  children,
  onSelect,
  frequentEmojis,
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
    <div className={className}>
      <div onClick={() => setIsOpen(true)}>{children}</div>

      <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveModalContent className="max-w-md p-0 sm:max-h-[80vh] max-h-[70vh] flex flex-col">
          <ResponsiveModalHeader className="p-4 pb-0">
            <ResponsiveModalTitle>Choose an emoji</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ReactionPicker
              onSelect={handleSelect}
              onClose={() => setIsOpen(false)}
              frequentEmojis={frequentEmojis}
            />
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
