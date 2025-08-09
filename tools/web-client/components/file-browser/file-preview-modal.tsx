'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileContentViewer } from '@/components/markdown/FileContentViewer';
import { Download, Copy, FileIcon } from 'lucide-react';
import { FileSystemItem, getFileTypeInfo, formatFileSize } from '@/lib/file-system';
import { cn } from '@/lib/utils';

export interface FilePreviewModalProps {
  file: FileSystemItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (file: FileSystemItem) => void;
  onCopyPath?: (file: FileSystemItem) => void;
  children?: React.ReactNode;
}

export function FilePreviewModal({
  file,
  isOpen,
  onOpenChange,
  onDownload,
  onCopyPath,
  children,
}: FilePreviewModalProps) {
  if (!file || file.type !== 'file') {
    return null;
  }

  const typeInfo = getFileTypeInfo(file.name);

  const handleDownload = () => {
    onDownload?.(file);
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(file.path);
      onCopyPath?.(file);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileIcon className={cn('h-6 w-6', typeInfo.color)} />
              <div>
                <DialogTitle className="text-lg">{file.name}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{typeInfo.category}</Badge>
                  {file.size && <span>{formatFileSize(file.size)}</span>}
                  <span className="font-mono text-xs">{file.path}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPath}
                className="flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy Path
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <FileContentViewer
            filePath={file.path}
            fileName={file.name}
            fileSize={file.size}
            className="h-full border-0 rounded-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FilePreviewModal;