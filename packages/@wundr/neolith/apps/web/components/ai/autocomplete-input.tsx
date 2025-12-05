'use client';

import * as React from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface AutocompleteOption {
  value: string;
  label: string;
  description?: string;
  category?: string;
  confidence?: number;
}

export interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  fetchSuggestions: (query: string) => Promise<AutocompleteOption[]>;
  debounceMs?: number;
  minQueryLength?: number;
  maxSuggestions?: number;
  showConfidence?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing...',
  fetchSuggestions,
  debounceMs = 300,
  minQueryLength = 2,
  maxSuggestions = 8,
  showConfidence = true,
  className,
  inputClassName,
  disabled = false,
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<AutocompleteOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Debounced fetch
  React.useEffect(() => {
    const shouldFetch = value.length >= minQueryLength && !disabled;

    if (!shouldFetch) {
      setOptions([]);
      setOpen(false);
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchSuggestions(value);
        if (!controller.signal.aborted) {
          setOptions(results.slice(0, maxSuggestions));
          setOpen(results.length > 0);
          setSelectedIndex(-1);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch suggestions:', error);
          setOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    value,
    fetchSuggestions,
    debounceMs,
    minQueryLength,
    maxSuggestions,
    disabled,
  ]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < options.length) {
          e.preventDefault();
          handleSelect(options[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        // Accept first suggestion on Tab
        if (options.length > 0) {
          e.preventDefault();
          handleSelect(options[0]);
        }
        break;
    }
  };

  const handleSelect = (option: AutocompleteOption) => {
    onChange(option.value);
    onSelect?.(option);
    setOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Group options by category
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, AutocompleteOption[]> = {};
    options.forEach(option => {
      const category = option.category || 'Suggestions';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(option);
    });
    return groups;
  }, [options]);

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className='relative'>
            <Input
              ref={inputRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                'pr-10',
                isLoading && 'cursor-wait',
                inputClassName
              )}
              aria-autocomplete='list'
              aria-controls='autocomplete-options'
              aria-expanded={open}
              aria-activedescendant={
                selectedIndex >= 0 ? `option-${selectedIndex}` : undefined
              }
            />
            <div className='absolute right-3 top-1/2 -translate-y-1/2'>
              {isLoading ? (
                <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
              ) : value.length >= minQueryLength ? (
                <Sparkles className='h-4 w-4 text-primary' />
              ) : null}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className='p-0'
          align='start'
          onOpenAutoFocus={e => e.preventDefault()}
          style={{ width: inputRef.current?.offsetWidth }}
        >
          <Command>
            <CommandList id='autocomplete-options'>
              <CommandEmpty>
                {isLoading ? 'Loading suggestions...' : 'No suggestions found.'}
              </CommandEmpty>
              {Object.entries(groupedOptions).map(
                ([category, categoryOptions]) => (
                  <CommandGroup key={category} heading={category}>
                    {categoryOptions.map((option, index) => {
                      const globalIndex = options.indexOf(option);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <CommandItem
                          key={option.value}
                          id={`option-${globalIndex}`}
                          value={option.value}
                          onSelect={() => handleSelect(option)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'flex items-center justify-between',
                            isSelected && 'bg-accent'
                          )}
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium truncate'>
                              {option.label}
                            </div>
                            {option.description && (
                              <div className='text-xs text-muted-foreground truncate'>
                                {option.description}
                              </div>
                            )}
                          </div>
                          <div className='flex items-center gap-2 ml-2'>
                            {showConfidence && option.confidence && (
                              <span className='text-xs text-muted-foreground'>
                                {Math.round(option.confidence * 100)}%
                              </span>
                            )}
                            {isSelected && (
                              <Check className='h-4 w-4 text-primary' />
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Inline autocomplete with ghost text
export function InlineAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing...',
  fetchSuggestion,
  debounceMs = 500,
  minQueryLength = 3,
  className,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fetchSuggestion: (query: string) => Promise<string | null>;
  debounceMs?: number;
  minQueryLength?: number;
  className?: string;
  disabled?: boolean;
}) {
  const [suggestion, setSuggestion] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value.length < minQueryLength || disabled) {
      setSuggestion('');
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await fetchSuggestion(value);
        if (result && result.toLowerCase().startsWith(value.toLowerCase())) {
          setSuggestion(result);
        } else {
          setSuggestion('');
        }
      } catch (error) {
        console.error('Failed to fetch suggestion:', error);
        setSuggestion('');
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [value, fetchSuggestion, debounceMs, minQueryLength, disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      onChange(suggestion);
      setSuggestion('');
    } else if (e.key === 'ArrowRight' && suggestion) {
      const cursorAtEnd = e.currentTarget.selectionStart === value.length;
      if (cursorAtEnd) {
        e.preventDefault();
        onChange(suggestion);
        setSuggestion('');
      }
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className='relative z-10 bg-transparent'
      />
      {suggestion && (
        <div
          className='absolute inset-0 flex items-center px-3 pointer-events-none z-0'
          aria-hidden='true'
        >
          <span className='invisible'>{value}</span>
          <span className='text-muted-foreground/50'>
            {suggestion.slice(value.length)}
          </span>
        </div>
      )}
      {isLoading && (
        <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
      )}
    </div>
  );
}
