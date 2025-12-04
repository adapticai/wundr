'use client';

import { ArrowLeft, Bot, ChevronRight, Mail, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

interface Recipient {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  type: 'user' | 'orchestrator' | 'email';
  status?: 'online' | 'offline' | 'away' | 'busy';
}

interface SearchResult extends Recipient {
  subtitle?: string;
}

interface AddPeopleDialogProps {
  isOpen: boolean;
  workspaceSlug: string;
  conversationId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onAddPeople: (userIds: string[], includeHistory: boolean) => Promise<void>;
}

/**
 * Add People Dialog - Two-Step Slack-Style Flow
 *
 * Step 1: Simple search input to select people
 * Step 2: History inclusion confirmation with preview
 */
export function AddPeopleDialog({
  isOpen,
  workspaceSlug,
  existingMemberIds,
  onClose,
  onAddPeople,
}: AddPeopleDialogProps) {
  // Step: 'select' (step 1) or 'confirm' (step 2)
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens or returns to step 1
  useEffect(() => {
    if (isOpen && step === 'select') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      // Reset state when dialog closes
      setStep('select');
      setRecipients([]);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, step]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/search?q=${encodeURIComponent(searchQuery)}&types=users,orchestrators`
        );

        if (response.ok) {
          const responseData = await response.json();
          const results: SearchResult[] = [];

          // Handle new unified data format from search API
          if (responseData.data && Array.isArray(responseData.data)) {
            for (const item of responseData.data) {
              // Exclude existing members and already selected
              if (existingMemberIds.includes(item.id)) {
                continue;
              }
              if (recipients.some(r => r.id === item.id)) {
                continue;
              }

              if (item.type === 'user') {
                results.push({
                  id: item.id,
                  name: item.displayName || item.name || item.email,
                  email: item.email,
                  image: item.avatarUrl,
                  type: 'user',
                  status: item.status || 'offline',
                  subtitle: item.email,
                });
              } else if (item.type === 'orchestrator') {
                results.push({
                  id: item.id,
                  name: item.displayName || item.name || 'Orchestrator',
                  image: item.avatarUrl,
                  type: 'orchestrator',
                  subtitle: item.role || item.discipline || 'Orchestrator',
                });
              }
            }
          }

          // Check if query looks like an email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (
            emailRegex.test(searchQuery) &&
            !recipients.some(r => r.email === searchQuery)
          ) {
            results.push({
              id: `email-${searchQuery}`,
              name: searchQuery,
              email: searchQuery,
              type: 'email',
              subtitle: 'Invite via email',
            });
          }

          setSearchResults(results);
          setHighlightedIndex(0);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, workspaceSlug, existingMemberIds, recipients]);

  const handleSelectRecipient = useCallback((recipient: SearchResult) => {
    setRecipients(prev => [...prev, recipient]);
    setSearchQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  }, []);

  const handleRemoveRecipient = useCallback((recipientId: string) => {
    setRecipients(prev => prev.filter(r => r.id !== recipientId));
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !searchQuery && recipients.length > 0) {
        setRecipients(prev => prev.slice(0, -1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          Math.min(prev + 1, searchResults.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault();
        handleSelectRecipient(searchResults[highlightedIndex]);
      } else if (e.key === 'Escape') {
        setSearchQuery('');
        setSearchResults([]);
      }
    },
    [
      searchQuery,
      recipients.length,
      searchResults,
      highlightedIndex,
      handleSelectRecipient,
    ]
  );

  const handleProceedToConfirm = useCallback(() => {
    if (recipients.length > 0) {
      setStep('confirm');
    }
  }, [recipients.length]);

  const handleGoBack = useCallback(() => {
    setStep('select');
  }, []);

  const handleSubmit = useCallback(
    async (includeHistory: boolean) => {
      if (recipients.length === 0) {
        return;
      }

      setIsSubmitting(true);
      try {
        const userIds = recipients
          .filter(r => r.type !== 'email')
          .map(r => r.id);

        await onAddPeople(userIds, includeHistory);
        onClose();
      } catch (error) {
        console.error('Failed to add people:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [recipients, onAddPeople, onClose]
  );

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  // Calculate remaining slots (DMs can have up to 9 people)
  const maxPeople = 9;
  const currentMemberCount = existingMemberIds.length;
  const remainingSlots = Math.max(
    0,
    maxPeople - currentMemberCount - recipients.length
  );

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-md'>
        {step === 'select' ? (
          /* Step 1: Select People */
          <>
            <DialogHeader>
              <DialogTitle>Add people</DialogTitle>
              <DialogDescription className='text-sm text-muted-foreground'>
                DMs can have up to 9 people.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4 mt-2'>
              {/* Search input with chips */}
              <div
                className='flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 min-h-[44px] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary cursor-text'
                onClick={() => inputRef.current?.focus()}
              >
                {/* Selected recipient chips */}
                {recipients.map(recipient => (
                  <div
                    key={recipient.id}
                    className='flex items-center gap-1.5 rounded-full bg-accent px-2 py-1 text-sm'
                  >
                    {recipient.type === 'user' ? (
                      <UserAvatar user={recipient} size='xs' />
                    ) : recipient.type === 'orchestrator' ? (
                      <Bot className='h-3 w-3' />
                    ) : (
                      <Mail className='h-3 w-3' />
                    )}
                    <span className='max-w-[120px] truncate'>
                      {recipient.name}
                    </span>
                    <button
                      type='button'
                      onClick={e => {
                        e.stopPropagation();
                        handleRemoveRecipient(recipient.id);
                      }}
                      className='rounded-full p-0.5 hover:bg-background/50 transition-colors'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  </div>
                ))}

                {/* Search input */}
                <Input
                  ref={inputRef}
                  type='text'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    recipients.length === 0 ? 'e.g. Matt or @mbrewer' : ''
                  }
                  className='flex-1 min-w-[150px] border-0 p-0 h-7 focus-visible:ring-0 shadow-none'
                  disabled={remainingSlots <= 0}
                />
              </div>

              {/* Remaining slots indicator */}
              {remainingSlots <= 3 && remainingSlots > 0 && (
                <p className='text-xs text-muted-foreground'>
                  You can add {remainingSlots} more{' '}
                  {remainingSlots === 1 ? 'person' : 'people'}.
                </p>
              )}

              {remainingSlots <= 0 && (
                <p className='text-xs text-destructive'>
                  This conversation has reached the maximum of 9 people.
                </p>
              )}

              {/* Search dropdown */}
              {(searchResults.length > 0 || isSearching) && (
                <div className='rounded-md border bg-popover shadow-lg'>
                  {isSearching ? (
                    <div className='flex items-center justify-center py-4'>
                      <LoadingSpinner size='sm' />
                    </div>
                  ) : (
                    <div className='max-h-[200px] overflow-y-auto py-1'>
                      {searchResults.map((result, index) => (
                        <button
                          key={result.id}
                          type='button'
                          onClick={() => handleSelectRecipient(result)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                            index === highlightedIndex
                              ? 'bg-accent'
                              : 'hover:bg-accent/50'
                          )}
                        >
                          <div className='relative'>
                            {result.type === 'orchestrator' ? (
                              <div className='flex h-8 w-8 items-center justify-center rounded-md bg-primary/10'>
                                <Bot className='h-4 w-4 text-primary' />
                              </div>
                            ) : result.type === 'email' ? (
                              <div className='flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10'>
                                <Mail className='h-4 w-4 text-blue-500' />
                              </div>
                            ) : (
                              <>
                                <UserAvatar
                                  user={result}
                                  size='md'
                                  shape='rounded'
                                />
                                {result.status && (
                                  <span
                                    className={cn(
                                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-popover',
                                      statusColors[result.status]
                                    )}
                                  />
                                )}
                              </>
                            )}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium text-sm truncate'>
                              {result.name}
                            </div>
                            {result.subtitle && (
                              <div className='text-xs text-muted-foreground truncate'>
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className='flex justify-end gap-2 pt-2'>
                <Button variant='outline' onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleProceedToConfirm}
                  disabled={recipients.length === 0}
                >
                  Next
                  <ChevronRight className='h-4 w-4 ml-1' />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Step 2: Confirm with History Option */
          <>
            <DialogHeader>
              <div className='flex items-center gap-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={handleGoBack}
                >
                  <ArrowLeft className='h-4 w-4' />
                </Button>
                <DialogTitle>Include conversation history?</DialogTitle>
              </div>
            </DialogHeader>

            <div className='space-y-4 mt-2'>
              {/* Preview of people being added */}
              <div className='rounded-lg border p-4'>
                <p className='text-sm text-muted-foreground mb-3'>
                  Adding {recipients.length}{' '}
                  {recipients.length === 1 ? 'person' : 'people'}:
                </p>
                <div className='flex flex-wrap gap-2'>
                  {recipients.map(recipient => (
                    <div
                      key={recipient.id}
                      className='flex items-center gap-2 rounded-md bg-muted px-3 py-2'
                    >
                      {recipient.type === 'orchestrator' ? (
                        <div className='flex h-6 w-6 items-center justify-center rounded-full bg-primary/10'>
                          <Bot className='h-3 w-3 text-primary' />
                        </div>
                      ) : recipient.type === 'email' ? (
                        <div className='flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10'>
                          <Mail className='h-3 w-3 text-blue-500' />
                        </div>
                      ) : (
                        <UserAvatar user={recipient} size='sm' />
                      )}
                      <span className='text-sm font-medium'>
                        {recipient.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* History options as two distinct buttons (Slack-style) */}
              <div className='space-y-2'>
                <Button
                  variant='outline'
                  className='w-full justify-start h-auto py-3 px-4'
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                >
                  <div className='text-left'>
                    <p className='font-medium'>
                      Yes, share the conversation history
                    </p>
                    <p className='text-xs text-muted-foreground font-normal'>
                      New members will see all previous messages.
                    </p>
                  </div>
                </Button>

                <Button
                  variant='outline'
                  className='w-full justify-start h-auto py-3 px-4'
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                >
                  <div className='text-left'>
                    <p className='font-medium'>No, start fresh</p>
                    <p className='text-xs text-muted-foreground font-normal'>
                      New members will only see new messages.
                    </p>
                  </div>
                </Button>
              </div>

              {isSubmitting && (
                <div className='flex items-center justify-center py-2'>
                  <LoadingSpinner size='sm' />
                  <span className='ml-2 text-sm text-muted-foreground'>
                    Adding people...
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
