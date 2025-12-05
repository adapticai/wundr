'use client';

import {
  File,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  Video,
  Music,
  Download,
  X,
  Eye,
} from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  thumbnail?: string;
}

export interface MessageAttachmentsProps {
  attachments: Attachment[];
  onRemove?: (attachmentId: string) => void;
  readOnly?: boolean;
  className?: string;
  variant?: 'compact' | 'detailed';
}

export function MessageAttachments({
  attachments,
  onRemove,
  readOnly = false,
  className,
  variant = 'detailed',
}: MessageAttachmentsProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null
  );

  if (attachments.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap gap-2',
          variant === 'compact' ? 'mt-2' : 'mt-3',
          className
        )}
      >
        {attachments.map(attachment => (
          <AttachmentCard
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
            onPreview={() => setPreviewAttachment(attachment)}
            readOnly={readOnly}
            variant={variant}
          />
        ))}
      </div>

      {/* Preview Dialog */}
      <AttachmentPreview
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}

interface AttachmentCardProps {
  attachment: Attachment;
  onRemove?: (attachmentId: string) => void;
  onPreview: () => void;
  readOnly: boolean;
  variant: 'compact' | 'detailed';
}

function AttachmentCard({
  attachment,
  onRemove,
  onPreview,
  readOnly,
  variant,
}: AttachmentCardProps) {
  const Icon = getFileIcon(attachment.type);
  const isImage = attachment.type.startsWith('image/');
  const canPreview = isImage || attachment.type === 'application/pdf';

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = attachment.url;
    a.download = attachment.name;
    a.click();
  };

  if (variant === 'compact') {
    return (
      <div className='flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm'>
        <Icon className='h-4 w-4 shrink-0 text-muted-foreground' />
        <span className='truncate max-w-[150px]'>{attachment.name}</span>
        <div className='flex items-center gap-1 ml-auto'>
          {canPreview && (
            <Button
              variant='ghost'
              size='sm'
              onClick={onPreview}
              className='h-6 w-6 p-0'
            >
              <Eye className='h-3 w-3' />
            </Button>
          )}
          <Button
            variant='ghost'
            size='sm'
            onClick={handleDownload}
            className='h-6 w-6 p-0'
          >
            <Download className='h-3 w-3' />
          </Button>
          {!readOnly && onRemove && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onRemove(attachment.id)}
              className='h-6 w-6 p-0'
            >
              <X className='h-3 w-3' />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='group relative rounded-lg border border-border overflow-hidden bg-card hover:bg-accent/50 transition-colors w-full max-w-sm'>
      {/* Thumbnail or Icon */}
      <div className='flex items-center gap-3 p-3'>
        {isImage && attachment.thumbnail ? (
          <div className='relative h-12 w-12 shrink-0 rounded overflow-hidden'>
            <img
              src={attachment.thumbnail}
              alt={attachment.name}
              className='h-full w-full object-cover'
            />
          </div>
        ) : (
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted'>
            <Icon className='h-6 w-6 text-muted-foreground' />
          </div>
        )}

        {/* File Info */}
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-medium truncate'>{attachment.name}</p>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <span>{getFileType(attachment.type)}</span>
            {attachment.size && (
              <>
                <span>•</span>
                <span>{formatFileSize(attachment.size)}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
          {canPreview && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={onPreview}
                    className='h-8 w-8 p-0'
                  >
                    <Eye className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleDownload}
                  className='h-8 w-8 p-0'
                >
                  <Download className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!readOnly && onRemove && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => onRemove(attachment.id)}
                    className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: Attachment | null;
  onClose: () => void;
}

function AttachmentPreview({ attachment, onClose }: AttachmentPreviewProps) {
  if (!attachment) return null;

  const isImage = attachment.type.startsWith('image/');
  const isPdf = attachment.type === 'application/pdf';

  return (
    <Dialog open={!!attachment} onOpenChange={onClose}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-hidden'>
        <DialogHeader>
          <DialogTitle>{attachment.name}</DialogTitle>
        </DialogHeader>
        <div className='flex-1 overflow-auto'>
          {isImage && (
            <img
              src={attachment.url}
              alt={attachment.name}
              className='w-full h-auto rounded-lg'
            />
          )}
          {isPdf && (
            <iframe
              src={attachment.url}
              className='w-full h-[70vh] rounded-lg'
              title={attachment.name}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return Video;
  if (type.startsWith('audio/')) return Music;
  if (type.includes('pdf')) return FileText;
  if (type.includes('zip') || type.includes('rar') || type.includes('tar'))
    return FileArchive;
  if (
    type.includes('javascript') ||
    type.includes('typescript') ||
    type.includes('json') ||
    type.includes('html') ||
    type.includes('css')
  )
    return FileCode;
  if (type.includes('text')) return FileText;
  return File;
}

function getFileType(type: string): string {
  const parts = type.split('/');
  if (parts.length === 2) {
    return parts[1].toUpperCase();
  }
  return type.toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default MessageAttachments;
