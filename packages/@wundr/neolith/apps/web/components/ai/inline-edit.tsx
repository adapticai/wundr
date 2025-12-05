'use client';

import * as React from 'react';
import { Check, X, Loader2, Sparkles, RotateCcw, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface InlineEditProps {
  value: string;
  onChange: (value: string) => void;
  onAIEdit?: (instruction: string) => Promise<string>;
  onCancel?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  minHeight?: number;
  maxHeight?: number;
  showAIActions?: boolean;
  aiInstructions?: string[];
}

export function InlineEdit({
  value,
  onChange,
  onAIEdit,
  onCancel,
  placeholder = 'Start typing...',
  className,
  autoFocus = true,
  minHeight = 100,
  maxHeight = 400,
  showAIActions = true,
  aiInstructions = [
    'Make it shorter',
    'Make it longer',
    'Simplify',
    'Make it formal',
    'Fix grammar',
  ],
}: InlineEditProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const [originalValue, setOriginalValue] = React.useState(value);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing && autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing, autoFocus]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setOriginalValue(value);
    setEditValue(value);
    setHistory([value]);
    setHistoryIndex(0);
  };

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
    setHistory([]);
    setHistoryIndex(-1);
  };

  const handleCancel = () => {
    setEditValue(originalValue);
    setIsEditing(false);
    setHistory([]);
    setHistoryIndex(-1);
    onCancel?.();
  };

  const handleAIEdit = async (instruction: string) => {
    if (!onAIEdit || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await onAIEdit(instruction);
      const newHistory = [...history.slice(0, historyIndex + 1), result];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setEditValue(result);
    } catch (error) {
      console.error('AI edit failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditValue(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditValue(history[newIndex]);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    }
  };

  if (!isEditing) {
    return (
      <div
        onClick={handleStartEdit}
        className={cn(
          'group relative cursor-text rounded-md border border-transparent p-3',
          'hover:border-border hover:bg-muted/50 transition-colors',
          className
        )}
      >
        <div className='whitespace-pre-wrap'>{value || placeholder}</div>
        <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
          <Badge variant='secondary' className='text-xs'>
            Click to edit
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className='relative'>
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessing}
          className={cn(
            'min-h-[100px] resize-none',
            isProcessing && 'opacity-50 cursor-wait'
          )}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: `${maxHeight}px`,
          }}
        />
        {isProcessing && (
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 rounded-md'>
            <div className='flex items-center gap-2 text-sm text-primary'>
              <Loader2 className='h-4 w-4 animate-spin' />
              <span>AI is editing...</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Actions */}
      {showAIActions && onAIEdit && (
        <div className='flex items-center gap-2 flex-wrap'>
          <Sparkles className='h-4 w-4 text-primary' />
          {aiInstructions.map(instruction => (
            <Button
              key={instruction}
              variant='outline'
              size='sm'
              onClick={() => handleAIEdit(instruction)}
              disabled={isProcessing}
              className='h-7 text-xs'
            >
              {instruction}
            </Button>
          ))}
        </div>
      )}

      {/* Control Buttons */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-1'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className='h-8 w-8 p-0'
              >
                <RotateCcw className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo (⌘Z)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className='h-8 w-8 p-0'
              >
                <RotateCcw className='h-4 w-4 rotate-180' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo (⌘⇧Z)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleCopy}
                className='h-8 w-8 p-0'
              >
                <Copy className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy text</p>
            </TooltipContent>
          </Tooltip>

          <div className='text-xs text-muted-foreground ml-2'>
            {editValue.length} characters
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleCancel}
            disabled={isProcessing}
          >
            <X className='h-4 w-4 mr-1' />
            Cancel
          </Button>
          <Button
            size='sm'
            onClick={handleSave}
            disabled={isProcessing || editValue === originalValue}
          >
            <Check className='h-4 w-4 mr-1' />
            Save
          </Button>
        </div>
      </div>

      <div className='text-xs text-muted-foreground'>
        Press <kbd className='px-1 py-0.5 rounded bg-muted'>⌘Enter</kbd> to save
        or <kbd className='px-1 py-0.5 rounded bg-muted'>Esc</kbd> to cancel
      </div>
    </div>
  );
}

// Inline edit with diff view
export function InlineEditWithDiff({
  original,
  edited,
  onAccept,
  onReject,
  className,
}: {
  original: string;
  edited: string;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
}) {
  const getDiff = () => {
    const originalLines = original.split('\n');
    const editedLines = edited.split('\n');
    const maxLines = Math.max(originalLines.length, editedLines.length);

    const diff: Array<{ type: 'same' | 'removed' | 'added'; content: string }> =
      [];

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const editLine = editedLines[i];

      if (origLine === editLine) {
        diff.push({ type: 'same', content: origLine });
      } else {
        if (origLine) {
          diff.push({ type: 'removed', content: origLine });
        }
        if (editLine) {
          diff.push({ type: 'added', content: editLine });
        }
      }
    }

    return diff;
  };

  const diff = getDiff();

  return (
    <div className={cn('space-y-3', className)}>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Sparkles className='h-4 w-4 text-primary' />
          <span className='text-sm font-medium'>AI Suggested Changes</span>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='sm' onClick={onReject}>
            <X className='h-4 w-4 mr-1' />
            Reject
          </Button>
          <Button size='sm' onClick={onAccept}>
            <Check className='h-4 w-4 mr-1' />
            Accept
          </Button>
        </div>
      </div>

      <div className='rounded-md border bg-muted/50 p-3 space-y-1 max-h-[300px] overflow-y-auto'>
        {diff.map((line, index) => (
          <div
            key={index}
            className={cn(
              'px-2 py-0.5 rounded text-sm font-mono',
              line.type === 'removed' &&
                'bg-red-500/10 text-red-700 dark:text-red-400 line-through',
              line.type === 'added' &&
                'bg-green-500/10 text-green-700 dark:text-green-400',
              line.type === 'same' && 'text-muted-foreground'
            )}
          >
            {line.content || ' '}
          </div>
        ))}
      </div>
    </div>
  );
}
