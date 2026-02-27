'use client';

import { useRef, useEffect, useState } from 'react';
import {
  Send,
  Paperclip,
  X,
  Mic,
  Loader2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface ChatInputProps {
  /**
   * Current input value
   */
  value: string;

  /**
   * Callback when input value changes
   */
  onChange: (value: string) => void;

  /**
   * Callback when user sends message
   */
  onSend: () => void;

  /**
   * Callback when files are attached
   */
  onFileAttach?: (files: File[]) => void;

  /**
   * Callback when file is removed
   */
  onRemoveFile?: (index: number) => void;

  /**
   * Currently attached files
   */
  attachedFiles?: File[];

  /**
   * Whether AI is generating response
   */
  isLoading?: boolean;

  /**
   * Whether input is disabled
   */
  disabled?: boolean;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number;

  /**
   * Allowed file types
   */
  allowedFileTypes?: string[];

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ChatInput - Enhanced input with file attachments and voice support
 *
 * Features:
 * - Auto-resizing textarea
 * - File attachment with preview
 * - Voice input button (UI only)
 * - Keyboard shortcuts (Cmd+Enter to send)
 * - File type and size validation
 * - Drag and drop support
 * - Loading states
 * - Character/file count
 *
 * @example
 * ```tsx
 * const [value, setValue] = useState('');
 * const [files, setFiles] = useState<File[]>([]);
 *
 * <ChatInput
 *   value={value}
 *   onChange={setValue}
 *   onSend={() => {
 *     console.log('Send:', value, files);
 *     setValue('');
 *     setFiles([]);
 *   }}
 *   onFileAttach={(newFiles) => setFiles([...files, ...newFiles])}
 *   onRemoveFile={(index) => setFiles(files.filter((_, i) => i !== index))}
 *   attachedFiles={files}
 * />
 * ```
 */
export function ChatInput({
  value,
  onChange,
  onSend,
  onFileAttach,
  onRemoveFile,
  attachedFiles = [],
  isLoading = false,
  disabled = false,
  placeholder = 'Type your message... (Cmd+Enter to send)',
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedFileTypes = ['image/*', '.pdf', '.txt', '.doc', '.docx'],
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter or Ctrl+Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }

    // Shift+Enter for new line (default behavior)
    // Enter alone also creates new line (changed from send)
  };

  const handleSend = () => {
    if (isLoading || disabled) return;
    if (!value.trim() && attachedFiles.length === 0) return;

    onSend();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleFiles = (files: File[]) => {
    if (!onFileAttach) return;

    const validFiles = files.filter(file => {
      // Check file size
      if (file.size > maxFileSize) {
        console.warn(
          `File "${file.name}" exceeds maximum size of ${formatFileSize(maxFileSize)}`
        );
        return false;
      }

      // Check file type
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      const isAllowed = allowedFileTypes.some(type => {
        if (type.startsWith('.')) {
          return fileName.endsWith(type);
        }
        if (type.endsWith('/*')) {
          const category = type.split('/')[0];
          return fileType.startsWith(category + '/');
        }
        return fileType === type;
      });

      if (!isAllowed) {
        console.warn(`File "${file.name}" type not allowed`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      onFileAttach(validFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSend =
    (value.trim() || attachedFiles.length > 0) && !isLoading && !disabled;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-background p-3 transition-colors',
        isDragging && 'border-primary bg-primary/5',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className='flex flex-wrap gap-2 pb-2 border-b'>
          {attachedFiles.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => onRemoveFile?.(index)}
            />
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className='flex items-end gap-2'>
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'min-h-[48px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-0',
            'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent'
          )}
          aria-label='Message input'
        />

        {/* Action Buttons */}
        <div className='flex items-center gap-1 shrink-0'>
          {/* File Attach Button */}
          {onFileAttach && (
            <>
              <input
                ref={fileInputRef}
                type='file'
                multiple
                accept={allowedFileTypes.join(',')}
                onChange={handleFileSelect}
                className='hidden'
                aria-label='Attach files'
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='h-9 w-9'
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
                title='Attach files'
              >
                <Paperclip className='h-4 w-4' />
              </Button>
            </>
          )}

          {/* Voice Input Button */}
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-9 w-9'
            disabled={disabled || isLoading}
            title='Voice input'
            onClick={() => {
              const SpeechRecognition =
                (
                  window as typeof window & {
                    SpeechRecognition?: typeof window.webkitSpeechRecognition;
                  }
                ).SpeechRecognition || window.webkitSpeechRecognition;

              if (!SpeechRecognition) {
                // Browser does not support the Web Speech API
                const event = new CustomEvent('show-toast', {
                  detail: {
                    title: 'Voice input not supported',
                    description:
                      'Your browser does not support voice input. Try Chrome or Edge.',
                    variant: 'destructive',
                  },
                });
                window.dispatchEvent(event);
                return;
              }

              const recognition = new SpeechRecognition();
              recognition.lang = 'en-US';
              recognition.interimResults = false;
              recognition.maxAlternatives = 1;

              recognition.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = event.results[0][0].transcript;
                onChange(value ? `${value} ${transcript}` : transcript);
              };

              recognition.onerror = () => {
                // Recognition error — silently ignore so the button can be retried
              };

              recognition.start();
            }}
          >
            <Mic className='h-4 w-4' />
          </Button>

          {/* Send Button */}
          <Button
            type='button'
            size='icon'
            className='h-9 w-9'
            onClick={handleSend}
            disabled={!canSend}
            title={
              canSend ? 'Send message (Cmd+Enter)' : 'Type a message to send'
            }
          >
            {isLoading ? (
              <Loader2
                className='h-4 w-4 animate-spin'
                aria-label='Sending...'
              />
            ) : (
              <Send className='h-4 w-4' aria-label='Send' />
            )}
          </Button>
        </div>
      </div>

      {/* Helper Text */}
      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        <span>
          {attachedFiles.length > 0 && (
            <span>
              {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''}{' '}
              attached
            </span>
          )}
        </span>
        <span>Cmd+Enter to send</span>
      </div>
    </div>
  );
}

/**
 * File preview chip component
 */
interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [file, isImage]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className='flex items-center gap-2 rounded-lg border bg-muted px-2 py-1.5 group'>
      {/* Icon or Preview */}
      {isImage && preview ? (
        <img
          src={preview}
          alt={file.name}
          className='h-8 w-8 rounded object-cover'
        />
      ) : (
        <div className='flex h-8 w-8 items-center justify-center rounded bg-muted-foreground/10'>
          {isImage ? (
            <ImageIcon className='h-4 w-4 text-muted-foreground' />
          ) : (
            <FileText className='h-4 w-4 text-muted-foreground' />
          )}
        </div>
      )}

      {/* File Info */}
      <div className='flex-1 min-w-0'>
        <p className='text-xs font-medium truncate max-w-[120px]'>
          {file.name}
        </p>
        <p className='text-xs text-muted-foreground'>
          {formatFileSize(file.size)}
        </p>
      </div>

      {/* Remove Button */}
      <Button
        variant='ghost'
        size='icon'
        className='h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity'
        onClick={onRemove}
        title='Remove file'
      >
        <X className='h-3 w-3' />
      </Button>
    </div>
  );
}
