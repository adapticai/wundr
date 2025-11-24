'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { ReactionPickerTrigger } from './reaction-picker';

import type { User } from '@/types/chat';

interface MessageInputProps {
  channelId: string;
  parentId?: string;
  currentUser: User;
  placeholder?: string;
  maxLength?: number;
  onSend: (content: string, mentions: string[], attachments: File[]) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  disabled?: boolean;
  className?: string;
}

export function MessageInput({
  channelId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parentId: _parentId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentUser: _currentUser,
  placeholder = 'Type a message...',
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
  const [, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<User[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentions, setMentions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (query.length < 1) {
        setMentionUsers([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/channels/${channelId}/members?search=${encodeURIComponent(query)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setMentionUsers(data.members || []);
        }
      } catch {
        setMentionUsers([]);
      }
    },
    [channelId],
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
          setMentionQuery(mentionMatch[1]);
          setSelectedMentionIndex(0);
          fetchMentionSuggestions(mentionMatch[1]);
        } else {
          setShowMentions(false);
          setMentionQuery('');
        }
      }
    },
    [maxLength, handleTyping, fetchMentionSuggestions],
  );

  // Insert mention
  const insertMention = useCallback(
    (user: User) => {
      const textarea = textareaRef.current;
      if (!textarea) {
return;
}

      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = content.slice(0, cursorPosition);
      const textAfterCursor = content.slice(cursorPosition);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        const beforeMention = textBeforeCursor.slice(0, -mentionMatch[0].length);
        const newContent = `${beforeMention}@${user.name} ${textAfterCursor}`;
        setContent(newContent);
        setMentions((prev) => [...prev, user.id]);

        // Set cursor position after mention
        setTimeout(() => {
          const newCursorPosition = beforeMention.length + user.name.length + 2;
          textarea.setSelectionRange(newCursorPosition, newCursorPosition);
          textarea.focus();
        }, 0);
      }

      setShowMentions(false);
      setMentionQuery('');
    },
    [content],
  );

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle mention navigation
      if (showMentions && mentionUsers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < mentionUsers.length - 1 ? prev + 1 : prev,
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : prev));
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
    [showMentions, mentionUsers, selectedMentionIndex, insertMention],
  );

  // Handle send
  const handleSend = useCallback(() => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) {
return;
}
    if (disabled) {
return;
}

    onSend(trimmedContent, mentions, attachments);
    setContent('');
    setMentions([]);
    setAttachments([]);
    onStopTyping?.();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, mentions, attachments, disabled, onSend, onStopTyping]);

  // Handle file upload
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle emoji insert
  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
return;
}

    const cursorPosition = textarea.selectionStart;
    const newContent =
      content.slice(0, cursorPosition) + emoji + content.slice(cursorPosition);
    setContent(newContent);

    // Set cursor after emoji
    setTimeout(() => {
      const newCursorPosition = cursorPosition + emoji.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      textarea.focus();
    }, 0);
  }, [content]);

  const remainingChars = maxLength - content.length;
  const showCharCount = remainingChars < 500;
  const isNearLimit = remainingChars < 100;

  return (
    <div className={cn('border-t bg-background', className)}>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b p-2">
          {attachments.map((file, index) => (
            <AttachmentPreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => removeAttachment(index)}
            />
          ))}
        </div>
      )}

      {/* Mention suggestions */}
      {showMentions && mentionUsers.length > 0 && (
        <div className="border-b bg-popover p-2">
          <div className="text-xs font-medium text-muted-foreground">Members</div>
          <div className="mt-1 space-y-0.5">
            {mentionUsers.slice(0, 5).map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                  selectedMentionIndex === index
                    ? 'bg-accent text-foreground'
                    : 'hover:bg-accent/50',
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span>{user.name}</span>
                <span className="text-muted-foreground">@{user.email?.split('@')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-4">
        {/* File upload button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.md"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title="Attach file"
        >
          <AttachIcon />
        </button>

        {/* Emoji picker */}
        <ReactionPickerTrigger onSelect={handleEmojiSelect}>
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title="Add emoji"
          >
            <EmojiIcon />
          </button>
        </ReactionPickerTrigger>

        {/* Textarea */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'max-h-[200px] min-h-[40px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
              isNearLimit && 'border-destructive focus:ring-destructive/20',
            )}
          />
          {showCharCount && (
            <div
              className={cn(
                'absolute bottom-1 right-2 text-xs',
                isNearLimit ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {remainingChars}
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || (!content.trim() && attachments.length === 0)}
          className="shrink-0 rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          title="Send message (Enter)"
        >
          <SendIcon />
        </button>
      </div>

      {/* Help text */}
      <div className="flex items-center justify-between border-t px-4 py-1 text-xs text-muted-foreground">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>@ to mention, : for emoji</span>
      </div>
    </div>
  );
}

interface AttachmentPreviewProps {
  file: File;
  onRemove: () => void;
}

function AttachmentPreview({ file, onRemove }: AttachmentPreviewProps) {
  const preview = useMemo(() => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
return `${bytes} B`;
}
    if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="group relative flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <FileIcon className="h-10 w-10 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{file.name}</div>
        <div className="text-xs text-muted-foreground">{formatSize(file.size)}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// Icons
function AttachIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
