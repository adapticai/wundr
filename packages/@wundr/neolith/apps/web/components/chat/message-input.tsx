'use client';

import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { UserAvatar } from '@/components/ui/user-avatar';
import type { User } from '@/types/chat';
import { ReactionPickerTrigger } from './reaction-picker';

/**
 * Props for the MessageInput component
 */
interface MessageInputProps {
  /** The channel ID where the message will be sent */
  channelId: string;
  /** Channel name for placeholder */
  channelName?: string;
  /** Optional parent message ID for thread replies */
  parentId?: string;
  /** The current authenticated user */
  currentUser: User;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Maximum character length for the message (default: 4000) */
  maxLength?: number;
  /** Callback fired when a message is sent */
  onSend: (content: string, mentions: string[], attachments: File[]) => void;
  /** Callback fired when user starts typing */
  onTyping?: () => void;
  /** Callback fired when user stops typing */
  onStopTyping?: () => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// Schedule options
interface ScheduleOption {
  label: string;
  getTime: () => Date;
}

export function MessageInput({
  channelId,
  channelName,
  parentId,
  currentUser,
  placeholder,
  maxLength = 4000,
  onSend,
  onTyping,
  onStopTyping,
  disabled = false,
  className,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<User[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showFormatting, setShowFormatting] = useState(true);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleMenuRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  // Close schedule menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        scheduleMenuRef.current &&
        !scheduleMenuRef.current.contains(event.target as Node)
      ) {
        setShowScheduleMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping?.();

    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping?.();
    }, 3000);
  }, [onTyping, onStopTyping]);

  // Fetch mention suggestions
  const fetchMentionSuggestions = useCallback(
    async (query: string) => {
      try {
        const response = await fetch(
          `/api/channels/${channelId}/members?search=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          const filteredMembers = (data.members || []).filter(
            (member: User) => member.id !== currentUser.id
          );
          setMentionUsers(filteredMembers);
        } else {
          // Handle non-OK responses gracefully
          console.warn('Failed to fetch mention suggestions:', response.status);
          setMentionUsers([]);
        }
      } catch (error) {
        // Handle network errors or JSON parsing failures
        console.error('Error fetching mention suggestions:', error);
        setMentionUsers([]);
      }
    },
    [channelId, currentUser.id]
  );

  // Handle content change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        setContent(value);
        handleTyping();

        // Check for @ mentions
        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
          setShowMentions(true);
          setSelectedMentionIndex(0);
          fetchMentionSuggestions(mentionMatch[1]);
        } else {
          setShowMentions(false);
        }
      }
    },
    [maxLength, handleTyping, fetchMentionSuggestions]
  );

  // Insert mention
  const insertMention = useCallback(
    (user: User) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = content.slice(0, cursorPosition);
      const textAfterCursor = content.slice(cursorPosition);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        const beforeMention = textBeforeCursor.slice(
          0,
          -mentionMatch[0].length
        );
        const newContent = `${beforeMention}@${user.name} ${textAfterCursor}`;
        setContent(newContent);
        setMentions(prev => [...prev, user.id]);

        setTimeout(() => {
          const newCursorPosition = beforeMention.length + user.name.length + 2;
          textarea.setSelectionRange(newCursorPosition, newCursorPosition);
          textarea.focus();
        }, 0);
      }

      setShowMentions(false);
    },
    [content]
  );

  // Apply formatting to selected text
  const applyFormatting = useCallback(
    (format: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.slice(start, end);

      let formattedText = '';
      let cursorOffset = 0;

      switch (format) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          cursorOffset = 2;
          break;
        case 'italic':
          formattedText = `_${selectedText}_`;
          cursorOffset = 1;
          break;
        case 'underline':
          formattedText = `<u>${selectedText}</u>`;
          cursorOffset = 3;
          break;
        case 'strike':
          formattedText = `~~${selectedText}~~`;
          cursorOffset = 2;
          break;
        case 'code':
          formattedText = `\`${selectedText}\``;
          cursorOffset = 1;
          break;
        case 'codeblock':
          formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
          cursorOffset = 4;
          break;
        case 'quote':
          formattedText = `> ${selectedText}`;
          cursorOffset = 2;
          break;
        case 'link':
          formattedText = `[${selectedText || 'link text'}](url)`;
          cursorOffset = 1;
          break;
        case 'ordered':
          formattedText = `1. ${selectedText}`;
          cursorOffset = 3;
          break;
        case 'bullet':
          formattedText = `• ${selectedText}`;
          cursorOffset = 2;
          break;
        default:
          formattedText = selectedText;
      }

      const newContent =
        content.slice(0, start) + formattedText + content.slice(end);
      setContent(newContent);

      setTimeout(() => {
        if (selectedText) {
          textarea.setSelectionRange(start, start + formattedText.length);
        } else {
          textarea.setSelectionRange(
            start + cursorOffset,
            start + cursorOffset
          );
        }
        textarea.focus();
      }, 0);
    },
    [content]
  );

  // Handle send - defined before handleKeyDown to avoid circular dependency
  const handleSend = useCallback(() => {
    const trimmedContent = content.trim();
    console.log(
      '[MessageInput.handleSend] attachments:',
      attachments.length,
      attachments.map(f => f.name)
    );
    if (!trimmedContent && attachments.length === 0) return;
    if (disabled) return;

    console.log(
      '[MessageInput.handleSend] calling onSend with attachments:',
      attachments.length
    );
    onSend(trimmedContent, mentions, attachments);
    setContent('');
    setMentions([]);
    setAttachments([]);
    onStopTyping?.();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, mentions, attachments, disabled, onSend, onStopTyping]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle mention navigation
      if (showMentions && mentionUsers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedMentionIndex(prev =>
            prev < mentionUsers.length - 1 ? prev + 1 : prev
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedMentionIndex(prev => (prev > 0 ? prev - 1 : prev));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(mentionUsers[selectedMentionIndex]);
          return;
        }
        if (e.key === 'Escape') {
          setShowMentions(false);
          return;
        }
      }

      // Send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      showMentions,
      mentionUsers,
      selectedMentionIndex,
      insertMention,
      handleSend,
    ]
  );

  // Handle scheduled send
  const handleScheduledSend = useCallback((scheduledTime: Date) => {
    // For now, just log the scheduled time
    // In production, this would call a scheduling API
    console.log('Message scheduled for:', scheduledTime);
    setShowScheduleDialog(false);
    setShowScheduleMenu(false);
    // Could show a toast notification here
  }, []);

  // Schedule options
  const scheduleOptions: ScheduleOption[] = useMemo(() => {
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
    nextMonday.setHours(9, 0, 0, 0);

    return [
      {
        label: `Monday at 09:00`,
        getTime: () => nextMonday,
      },
    ];
  }, []);

  // File validation
  const validateFile = useCallback((file: File): string | null => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return `${file.name}: File size exceeds 10MB`;
    }
    return null;
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const errors: string[] = [];
      const validFiles: File[] = [];

      files.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      });

      setUploadErrors(errors);
      setAttachments(prev => [...prev, ...validFiles]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [validateFile]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const files = Array.from(e.dataTransfer.files);
      const errors: string[] = [];
      const validFiles: File[] = [];

      files.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      });

      setUploadErrors(errors);
      setAttachments(prev => [...prev, ...validFiles]);
    },
    [validateFile]
  );

  // Handle emoji insert
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart;
      const newContent =
        content.slice(0, cursorPosition) +
        emoji +
        content.slice(cursorPosition);
      setContent(newContent);

      setTimeout(() => {
        const newCursorPosition = cursorPosition + emoji.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        textarea.focus();
      }, 0);
    },
    [content]
  );

  // Trigger @ mention
  const triggerMention = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const newContent =
      content.slice(0, cursorPosition) + '@' + content.slice(cursorPosition);
    setContent(newContent);

    setTimeout(() => {
      textarea.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
      textarea.focus();
      setShowMentions(true);
      fetchMentionSuggestions('');
    }, 0);
  }, [content, fetchMentionSuggestions]);

  const remainingChars = maxLength - content.length;
  const showCharCount = remainingChars < 500;
  const isNearLimit = remainingChars < 100;

  // Dynamic placeholder based on context
  const inputPlaceholder = parentId
    ? 'Reply to thread...'
    : placeholder || `Message #${channelName || 'channel'}`;

  const canSend = content.trim().length > 0 || attachments.length > 0;

  return (
    <div className={cn('bg-background', className)}>
      {/* Upload errors */}
      {uploadErrors.length > 0 && (
        <div className='mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg'>
          <div className='text-sm text-destructive font-medium mb-1'>
            Upload Errors:
          </div>
          {uploadErrors.map((error, index) => (
            <div key={index} className='text-xs text-destructive/80'>
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className='flex flex-wrap gap-2 border-t border-x rounded-t-lg mx-4 mt-2 p-3 bg-muted/30'>
          {attachments.map((file, index) => (
            <AttachmentPreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => removeAttachment(index)}
            />
          ))}
        </div>
      )}

      {/* Drag overlay */}
      {isDraggingOver && (
        <div className='fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center'>
          <div className='bg-background border-2 border-dashed border-primary rounded-xl p-12 flex flex-col items-center gap-4'>
            <UploadIcon className='h-16 w-16 text-primary' />
            <div className='text-xl font-semibold'>Drop files to upload</div>
            <div className='text-sm text-muted-foreground'>
              Maximum file size: 10MB
            </div>
          </div>
        </div>
      )}

      {/* Main input container - Slack style */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'mx-4 mb-4 border rounded-lg bg-background transition-colors',
          attachments.length > 0 ? 'rounded-t-none border-t-0' : '',
          isDraggingOver && 'border-primary border-2'
        )}
      >
        {/* Formatting toolbar */}
        {showFormatting && (
          <div className='flex items-center gap-0.5 px-3 py-2 border-b'>
            <FormatButton
              icon={<BoldIcon />}
              onClick={() => applyFormatting('bold')}
              title='Bold'
            />
            <FormatButton
              icon={<ItalicIcon />}
              onClick={() => applyFormatting('italic')}
              title='Italic'
            />
            <FormatButton
              icon={<UnderlineIcon />}
              onClick={() => applyFormatting('underline')}
              title='Underline'
            />
            <FormatButton
              icon={<StrikeIcon />}
              onClick={() => applyFormatting('strike')}
              title='Strikethrough'
            />
            <div className='w-px h-5 bg-border mx-1' />
            <FormatButton
              icon={<LinkIcon />}
              onClick={() => applyFormatting('link')}
              title='Link'
            />
            <FormatButton
              icon={<OrderedListIcon />}
              onClick={() => applyFormatting('ordered')}
              title='Ordered list'
            />
            <FormatButton
              icon={<BulletListIcon />}
              onClick={() => applyFormatting('bullet')}
              title='Bullet list'
            />
            <div className='w-px h-5 bg-border mx-1' />
            <FormatButton
              icon={<BlockquoteIcon />}
              onClick={() => applyFormatting('quote')}
              title='Quote'
            />
            <FormatButton
              icon={<CodeIcon />}
              onClick={() => applyFormatting('code')}
              title='Code'
            />
            <FormatButton
              icon={<CodeBlockIcon />}
              onClick={() => applyFormatting('codeblock')}
              title='Code block'
            />
          </div>
        )}

        {/* Mention suggestions - positioned above input */}
        {showMentions && mentionUsers.length > 0 && (
          <div className='border-b bg-popover'>
            <div className='max-h-64 overflow-y-auto'>
              {mentionUsers.slice(0, 8).map((user, index) => (
                <button
                  key={user.id}
                  type='button'
                  onClick={() => insertMention(user)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left',
                    selectedMentionIndex === index
                      ? 'bg-accent'
                      : 'hover:bg-accent/50'
                  )}
                >
                  {/* Avatar */}
                  {user.isOrchestrator ? (
                    <div className='flex h-7 w-7 items-center justify-center rounded-md bg-violet-500 text-white'>
                      <OrchestratorIcon className='h-4 w-4' />
                    </div>
                  ) : (
                    <UserAvatar user={user} size='md' shape='rounded' />
                  )}
                  {/* Name and username */}
                  <div className='flex-1 min-w-0'>
                    <span className='font-semibold'>{user.name}</span>
                    {user.isOrchestrator && (
                      <span className='ml-2 text-xs text-violet-500'>
                        <ExternalLinkIcon className='inline h-3 w-3 mr-0.5' />
                      </span>
                    )}
                    <span className='ml-2 text-muted-foreground'>
                      {user.name}
                    </span>
                  </div>
                  {/* Enter hint for first item */}
                  {index === selectedMentionIndex && (
                    <span className='text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded'>
                      Enter
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Navigation hint */}
            <div className='px-4 py-2 border-t text-xs text-muted-foreground flex items-center gap-4'>
              <span>
                <kbd className='font-sans'>↑</kbd>{' '}
                <kbd className='font-sans'>↓</kbd> to navigate
              </span>
              <span>
                <kbd className='font-sans'>↵</kbd> to select
              </span>
              <span>
                <kbd className='font-sans'>Esc</kbd> to dismiss
              </span>
            </div>
          </div>
        )}

        {/* Textarea */}
        <div className='px-3 py-2'>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={disabled}
            rows={1}
            aria-label={inputPlaceholder}
            aria-invalid={content.length > maxLength}
            aria-describedby={showCharCount ? 'char-count' : undefined}
            className={cn(
              'max-h-[200px] min-h-[24px] w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>

        {/* Bottom toolbar */}
        <div className='flex items-center justify-between px-2 py-1.5 border-t'>
          {/* Left side tools */}
          <div className='flex items-center gap-0.5'>
            {/* Attach file */}
            <input
              ref={fileInputRef}
              type='file'
              multiple
              onChange={handleFileSelect}
              className='hidden'
              accept='image/*,.pdf,.doc,.docx,.txt,.md'
            />
            <ToolButton
              icon={<PlusIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title='Attach file'
            />

            {/* Toggle formatting */}
            <ToolButton
              icon={<TextFormatIcon />}
              onClick={() => setShowFormatting(!showFormatting)}
              active={showFormatting}
              title={showFormatting ? 'Hide formatting' : 'Show formatting'}
            />

            {/* Emoji picker */}
            <ReactionPickerTrigger onSelect={handleEmojiSelect}>
              <ToolButton
                icon={<EmojiIcon />}
                disabled={disabled}
                title='Add emoji'
              />
            </ReactionPickerTrigger>

            {/* Mention */}
            <ToolButton
              icon={<AtIcon />}
              onClick={triggerMention}
              disabled={disabled}
              title='Mention someone'
            />

            <div className='w-px h-5 bg-border mx-1' />

            {/* Video recording */}
            <ToolButton
              icon={<VideoIcon />}
              onClick={() => {
                /* Video recording not implemented */
              }}
              disabled={disabled}
              title='Record video clip'
            />

            {/* Voice message */}
            <ToolButton
              icon={<MicrophoneIcon />}
              onClick={() => {
                /* Voice recording not implemented */
              }}
              disabled={disabled}
              title='Record voice message'
            />
          </div>

          {/* Right side - send button with schedule dropdown */}
          <div className='flex items-center'>
            {showCharCount && (
              <span
                id='char-count'
                className={cn(
                  'mr-2 text-xs',
                  isNearLimit ? 'text-destructive' : 'text-muted-foreground'
                )}
                aria-live='polite'
              >
                {remainingChars}
              </span>
            )}
            <div className='relative' ref={scheduleMenuRef}>
              <div className='flex'>
                {/* Send button */}
                <button
                  type='button'
                  onClick={handleSend}
                  disabled={disabled || !canSend}
                  className={cn(
                    'flex items-center justify-center h-8 px-2 rounded-l-md transition-colors',
                    canSend
                      ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                  title='Send message (Enter)'
                >
                  <SendIcon />
                </button>
                {/* Schedule dropdown trigger */}
                <button
                  type='button'
                  onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                  disabled={disabled || !canSend}
                  className={cn(
                    'flex items-center justify-center h-8 px-1.5 rounded-r-md border-l border-white/20 transition-colors',
                    canSend
                      ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                  title='Schedule message'
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {/* Schedule dropdown menu */}
              {showScheduleMenu && canSend && (
                <div className='absolute bottom-full right-0 mb-2 w-56 bg-popover border rounded-lg shadow-lg overflow-hidden z-50'>
                  <div className='p-1'>
                    <div className='px-3 py-2 text-sm text-muted-foreground'>
                      Schedule message
                    </div>
                    {scheduleOptions.map((option, index) => (
                      <button
                        key={index}
                        type='button'
                        onClick={() => handleScheduledSend(option.getTime())}
                        className='w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md'
                      >
                        {option.label}
                      </button>
                    ))}
                    <div className='border-t my-1' />
                    <button
                      type='button'
                      onClick={() => {
                        setShowScheduleDialog(true);
                        setShowScheduleMenu(false);
                      }}
                      className='w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md'
                    >
                      Custom time
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule dialog */}
      {showScheduleDialog && (
        <ScheduleMessageDialog
          onClose={() => setShowScheduleDialog(false)}
          onSchedule={handleScheduledSend}
        />
      )}
    </div>
  );
}

// Schedule message dialog component
interface ScheduleMessageDialogProps {
  onClose: () => void;
  onSchedule: (date: Date) => void;
}

function ScheduleMessageDialog({
  onClose,
  onSchedule,
}: ScheduleMessageDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState<string>('23:00');

  const handleSchedule = () => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const date = new Date(selectedDate);
    date.setHours(hours, minutes, 0, 0);
    onSchedule(date);
  };

  // Get timezone string
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone.replace(/_/g, ', ')
        .replace(/\//g, ', ');
    } catch {
      return 'Local time';
    }
  }, []);

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-background border rounded-xl shadow-xl w-full max-w-md mx-4'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 pb-2'>
          <div>
            <h2 className='text-xl font-bold'>Schedule message</h2>
            <p className='text-sm text-muted-foreground'>
              Time zone: {timezone}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-2 hover:bg-accent rounded-lg'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        {/* Content */}
        <div className='p-6 pt-4'>
          <div className='flex gap-4'>
            {/* Date picker */}
            <div className='flex-1'>
              <div className='relative'>
                <CalendarIcon className='absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                <select
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className='w-full h-12 pl-10 pr-4 bg-muted/50 border rounded-lg appearance-none cursor-pointer text-sm font-medium'
                >
                  {generateDateOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className='absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none' />
              </div>
            </div>

            {/* Time picker */}
            <div className='flex-1'>
              <div className='relative'>
                <ClockIcon className='absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                <select
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  className='w-full h-12 pl-10 pr-4 bg-muted/50 border rounded-lg appearance-none cursor-pointer text-sm font-medium'
                >
                  {generateTimeOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className='absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none' />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-3 p-6 pt-2'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium hover:bg-accent rounded-lg'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSchedule}
            className='px-4 py-2 text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-600 rounded-lg'
          >
            Schedule message
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper functions for date/time options
function generateDateOptions() {
  const options = [];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const value = date.toISOString().split('T')[0];
    let label = '';

    if (i === 0) {
      label = 'Today';
    } else if (i === 1) {
      label = 'Tomorrow';
    } else {
      label = date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }

    options.push({ value, label });
  }

  return options;
}

function generateTimeOptions() {
  const options = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const date = new Date();
      date.setHours(hour, minute);
      const label = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      options.push({ value, label });
    }
  }

  return options;
}

// Attachment preview component
interface AttachmentPreviewProps {
  file: File;
  onRemove: () => void;
}

function AttachmentPreview({ file, onRemove }: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Create object URL on mount and revoke on unmount
  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setImageError(false);

      // Revoke URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    return undefined;
  }, [file]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const isImage = file.type.startsWith('image/');
  const showImage = isImage && previewUrl && !imageError;

  return (
    <div className='group relative flex items-center gap-2 rounded-md border bg-background px-3 py-2'>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className='h-10 w-10 rounded object-cover'
          onError={handleImageError}
        />
      ) : isImage && !imageError ? (
        <div className='h-10 w-10 rounded bg-muted animate-pulse' />
      ) : (
        <FileIcon className='h-10 w-10 text-muted-foreground' />
      )}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>{file.name}</div>
        <div className='text-xs text-muted-foreground'>
          {formatSize(file.size)}
        </div>
      </div>
      <button
        type='button'
        onClick={onRemove}
        className='absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100'
      >
        <CloseIcon className='h-3 w-3' />
      </button>
    </div>
  );
}

// Button components
interface ToolButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}

function ToolButton({
  icon,
  onClick,
  disabled,
  active,
  title,
}: ToolButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        active && 'bg-accent text-foreground'
      )}
      title={title}
    >
      {icon}
    </button>
  );
}

interface FormatButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
}

function FormatButton({ icon, onClick, title }: FormatButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors'
      title={title}
    >
      {icon}
    </button>
  );
}

// Icons
function BoldIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M6 12h9a4 4 0 0 1 0 8H6V4h8a4 4 0 0 1 0 8' />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='19' x2='10' y1='4' y2='4' />
      <line x1='14' x2='5' y1='20' y2='20' />
      <line x1='15' x2='9' y1='4' y2='20' />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M6 4v6a6 6 0 0 0 12 0V4' />
      <line x1='4' x2='20' y1='20' y2='20' />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M16 4H9a3 3 0 0 0-2.83 4' />
      <path d='M14 12a4 4 0 0 1 0 8H6' />
      <line x1='4' x2='20' y1='12' y2='12' />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
      <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='10' x2='21' y1='6' y2='6' />
      <line x1='10' x2='21' y1='12' y2='12' />
      <line x1='10' x2='21' y1='18' y2='18' />
      <path d='M4 6h1v4' />
      <path d='M4 10h2' />
      <path d='M6 18H4c0-1 2-2 2-3s-1-1.5-2-1' />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='9' x2='21' y1='6' y2='6' />
      <line x1='9' x2='21' y1='12' y2='12' />
      <line x1='9' x2='21' y1='18' y2='18' />
      <circle cx='4' cy='6' r='1' fill='currentColor' />
      <circle cx='4' cy='12' r='1' fill='currentColor' />
      <circle cx='4' cy='18' r='1' fill='currentColor' />
    </svg>
  );
}

function BlockquoteIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z' />
      <path d='M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z' />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polyline points='16 18 22 12 16 6' />
      <polyline points='8 6 2 12 8 18' />
    </svg>
  );
}

function CodeBlockIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' />
      <path d='m10 10-2 2 2 2' />
      <path d='m14 10 2 2-2 2' />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='16' />
      <line x1='8' x2='16' y1='12' y2='12' />
    </svg>
  );
}

function TextFormatIcon() {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M4 7V4h16v3' />
      <path d='M9 20h6' />
      <path d='M12 4v16' />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M8 14s1.5 2 4 2 4-2 4-2' />
      <line x1='9' x2='9.01' y1='9' y2='9' />
      <line x1='15' x2='15.01' y1='9' y2='9' />
    </svg>
  );
}

function AtIcon() {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='4' />
      <path d='M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8' />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m22 8-6 4 6 4V8Z' />
      <rect width='14' height='12' x='2' y='6' rx='2' ry='2' />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' />
      <path d='M19 10v2a7 7 0 0 1-14 0v-2' />
      <line x1='12' x2='12' y1='19' y2='22' />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m5 12 14-7-7 14v-7H5z' />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width='20'
      height='20'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function OrchestratorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='3' />
      <path d='M12 2v4' />
      <path d='M12 18v4' />
      <path d='m4.93 4.93 2.83 2.83' />
      <path d='m16.24 16.24 2.83 2.83' />
      <path d='M2 12h4' />
      <path d='M18 12h4' />
      <path d='m4.93 19.07 2.83-2.83' />
      <path d='m16.24 7.76 2.83-2.83' />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
      <polyline points='15 3 21 3 21 9' />
      <line x1='10' x2='21' y1='14' y2='3' />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect width='18' height='18' x='3' y='4' rx='2' ry='2' />
      <line x1='16' x2='16' y1='2' y2='6' />
      <line x1='8' x2='8' y1='2' y2='6' />
      <line x1='3' x2='21' y1='10' y2='10' />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
      <polyline points='17 8 12 3 7 8' />
      <line x1='12' x2='12' y1='3' y2='15' />
    </svg>
  );
}
