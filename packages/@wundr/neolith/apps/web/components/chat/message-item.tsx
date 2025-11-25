'use client';

import { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';

import { ReactionDisplay } from './reaction-display';
import { ReactionPickerTrigger } from './reaction-picker';

import type { Message, User } from '@/types/chat';

/**
 * Props for the MessageItem component
 */
interface MessageItemProps {
  /** The message to display */
  message: Message;
  /** The current authenticated user */
  currentUser: User;
  /** Callback fired when replying to the message */
  onReply?: (message: Message) => void;
  /** Callback fired when editing the message */
  onEdit?: (message: Message) => void;
  /** Callback fired when deleting the message */
  onDelete?: (messageId: string) => void;
  /** Callback fired when adding/removing a reaction */
  onReaction?: (messageId: string, emoji: string) => void;
  /** Callback fired when opening the message thread */
  onOpenThread?: (message: Message) => void;
  /** Whether this is rendered in a thread view */
  isThreadView?: boolean;
  /** Whether to show a date separator above this message */
  showDateSeparator?: boolean;
  /** Whether to show an unread separator above this message */
  isUnreadSeparator?: boolean;
  /** Additional CSS class names */
  className?: string;
}

export function MessageItem({
  message,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onOpenThread,
  isThreadView = false,
  showDateSeparator,
  isUnreadSeparator,
  className,
}: MessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwn = message.authorId === currentUser.id;
  const formattedTime = useMemo(
    () =>
      new Date(message.createdAt).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [message.createdAt],
  );

  const formattedDate = useMemo(() => {
    const date = new Date(message.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [message.createdAt]);

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      onReaction?.(message.id, emoji);
    },
    [message.id, onReaction],
  );

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() !== message.content) {
      onEdit?.({ ...message, content: editContent.trim() });
    }
    setIsEditing(false);
  }, [editContent, message, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(false);
  }, [message.content]);

  if (message.isDeleted) {
    return (
      <div className={cn('px-4 py-2', className)}>
        <div className="text-sm italic text-muted-foreground">
          This message has been deleted.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Date separator */}
      {showDateSeparator && (
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground">{formattedDate}</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Unread separator */}
      {isUnreadSeparator && (
        <div className="flex items-center gap-4 px-4 py-2">
          <div className="h-px flex-1 bg-destructive" />
          <span className="text-xs font-medium text-destructive">New</span>
          <div className="h-px flex-1 bg-destructive" />
        </div>
      )}

      {/* Message */}
      <div
        className={cn(
          'group relative px-4 py-2 transition-colors hover:bg-accent/50',
          className,
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="shrink-0">
            {message.author.image ? (
              <img
                src={message.author.image}
                alt={message.author.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {message.author.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="mb-1 flex items-baseline gap-2">
              <span className="font-semibold text-foreground">{message.author.name}</span>
              <span className="text-xs text-muted-foreground">{formattedTime}</span>
              {message.editedAt && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            {/* Message content */}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] w-full resize-none rounded-md border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <MessageContent content={message.content} />
            )}

            {/* Attachments */}
            {message.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <AttachmentPreview key={attachment.id} attachment={attachment} />
                ))}
              </div>
            )}

            {/* Reactions */}
            {message.reactions.length > 0 && (
              <div className="mt-2">
                <ReactionDisplay
                  reactions={message.reactions}
                  onToggleReaction={handleToggleReaction}
                />
              </div>
            )}

            {/* Thread indicator */}
            {!isThreadView && message.replyCount > 0 && (
              <button
                type="button"
                onClick={() => onOpenThread?.(message)}
                className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ThreadIcon />
                <span>
                  {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                </span>
                {message.replyPreview && message.replyPreview.length > 0 && (
                  <div className="flex -space-x-1">
                    {message.replyPreview.slice(0, 3).map((reply) => (
                      <div
                        key={reply.id}
                        className="h-5 w-5 rounded-full border-2 border-background bg-primary text-[10px] font-medium text-primary-foreground"
                        title={reply.author.name}
                      >
                        {reply.author.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Hover actions */}
        {isHovered && !isEditing && (
          <div className="absolute -top-3 right-4 flex items-center gap-0.5 rounded-md border bg-popover p-0.5 shadow-sm">
            <ReactionPickerTrigger onSelect={handleToggleReaction}>
              <ActionButton icon={<EmojiIcon />} title="Add reaction" />
            </ReactionPickerTrigger>
            {!isThreadView && (
              <ActionButton
                icon={<ReplyIcon />}
                title="Reply in thread"
                onClick={() => onReply?.(message)}
              />
            )}
            {isOwn && (
              <>
                <ActionButton
                  icon={<EditIcon />}
                  title="Edit"
                  onClick={() => setIsEditing(true)}
                />
                <ActionButton
                  icon={<DeleteIcon />}
                  title="Delete"
                  onClick={() => onDelete?.(message.id)}
                  className="text-destructive hover:text-destructive"
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

interface MessageContentProps {
  content: string;
}

function MessageContent({ content }: MessageContentProps) {
  // Simple markdown-like rendering
  // In production, use a proper markdown library like react-markdown
  const parts = useMemo(() => {
    const result: React.ReactNode[] = [];
    let key = 0;

    // Code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push(
          <span key={key++}>{parseInlineContent(content.slice(lastIndex, match.index))}</span>,
        );
      }

      const language = match[1] || 'text';
      const code = match[2];
      result.push(
        <CodeBlock key={key++} language={language} code={code.trim()} />,
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      result.push(
        <span key={key++}>{parseInlineContent(content.slice(lastIndex))}</span>,
      );
    }

    return result.length > 0 ? result : parseInlineContent(content);
  }, [content]);

  return <div className="text-sm leading-relaxed text-foreground">{parts}</div>;
}

function parseInlineContent(text: string): React.ReactNode {
  // Inline code
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith('**') && bp.endsWith('**')) {
        return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
      }
      // Italic
      const italicParts = bp.split(/(_[^_]+_)/g);
      return italicParts.map((ip, k) => {
        if (ip.startsWith('_') && ip.endsWith('_')) {
          return <em key={`${i}-${j}-${k}`}>{ip.slice(1, -1)}</em>;
        }
        return ip;
      });
    });
  });
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 overflow-hidden rounded-md border bg-muted/50">
      <div className="flex items-center justify-between border-b bg-muted px-3 py-1">
        <span className="text-xs font-medium text-muted-foreground">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    mimeType: string;
  };
}

function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
return `${bytes} B`;
}
    if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (attachment.type === 'image') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-xs overflow-hidden rounded-md border"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-64 w-full object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 hover:bg-muted"
    >
      <FileIcon />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{attachment.name}</div>
        <div className="text-xs text-muted-foreground">{formatSize(attachment.size)}</div>
      </div>
    </a>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  className?: string;
}

function ActionButton({ icon, title, onClick, className }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {icon}
    </button>
  );
}

// Icons
function EmojiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function ThreadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
