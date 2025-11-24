'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from '@/types/chat';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  frequentEmojis?: string[];
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
  const pickerRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    if (!search) {
return categories;
}

    const searchLower = search.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter((emoji) => {
          // Simple search - in production, you'd want to search by emoji names
          return emoji.includes(search) || cat.name.toLowerCase().includes(searchLower);
        }),
      }))
      .filter((cat) => cat.emojis.length > 0);
  }, [categories, search]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    categoriesRef.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div
      ref={pickerRef}
      className={cn(
        'w-80 rounded-lg border bg-popover shadow-lg dark:border-border',
        className,
      )}
    >
      {/* Search */}
      <div className="border-b p-2">
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
      </div>

      {/* Quick reactions */}
      <div className="flex gap-1 border-b p-2">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            className="rounded-md p-1.5 text-xl hover:bg-accent"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b px-2 py-1">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => handleCategoryClick(category.id)}
            className={cn(
              'shrink-0 rounded-md px-2 py-1 text-xs transition-colors',
              activeCategory === category.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="h-64 overflow-y-auto p-2">
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            ref={(el) => {
              categoriesRef.current[category.id] = el;
            }}
            className="mb-4"
          >
            <div className="sticky top-0 mb-1 bg-popover py-1 text-xs font-medium text-muted-foreground">
              {category.name}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${category.id}-${index}`}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="rounded-md p-1.5 text-xl hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No emojis found
          </div>
        )}
      </div>
    </div>
  );
}

interface ReactionPickerTriggerProps {
  children: React.ReactNode;
  onSelect: (emoji: string) => void;
  frequentEmojis?: string[];
  className?: string;
}

export function ReactionPickerTrigger({
  children,
  onSelect,
  frequentEmojis,
  className,
}: ReactionPickerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      <div onClick={() => setIsOpen((prev) => !prev)}>{children}</div>

      {isOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-2">
          <ReactionPicker
            onSelect={onSelect}
            onClose={() => setIsOpen(false)}
            frequentEmojis={frequentEmojis}
          />
        </div>
      )}
    </div>
  );
}
