'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileContentViewer } from '@/components/markdown/FileContentViewer';
import { Download, Copy, FileIcon } from 'lucide-react';
import { FileSystemItem, getFileTypeInfo, formatFileSize } from '@/lib/file-system';
import { cn } from '@/lib/utils';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

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
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  };

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-3">
          {React.createElement(typeInfo.icon, { className: cn('h-6 w-6', typeInfo.color) })}
          <div>
            <div className="text-lg font-semibold">{file.name}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{typeInfo.category}</Badge>
              {file.size && <span>{formatFileSize(file.size)}</span>}
              <span className="font-mono text-xs">{file.path}</span>
            </div>
          </div>
        </div>
      }
      contentClassName="md:max-h-[60vh] md:overflow-y-auto"
      className="md:max-w-4xl"
      footer={
        <div className="flex items-center gap-2 justify-between md:justify-end">
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
      }
    >
      <FileContentViewer
        filePath={file.path}
        fileName={file.name}
        fileSize={file.size}
        className="h-full border-0 rounded-none"
      />
    </ResponsiveModal>
  );
}

export default FilePreviewModal;