import * as React from 'react';
import { DownloadIcon, FileTextIcon, ExternalLinkIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

import { formatFileSize, getFileExtension, truncateFilename } from './utils';

export interface DocumentPreviewProps {
  filename: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  onDownload?: () => void;
  className?: string;
  showPreview?: boolean;
}

/**
 * Document preview component for PDFs and other documents
 * Shows document icon with optional embedded preview for PDFs
 */
export const DocumentPreview = React.forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ filename, fileUrl, fileSize, mimeType, onDownload, className, showPreview = false }, ref) => {
    const extension = getFileExtension(filename);
    const isPDF = extension === 'pdf' || mimeType === 'application/pdf';

    const handleDownload = () => {
      if (onDownload) {
        onDownload();
      } else {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    const handleOpenInNewTab = () => {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    };

    const getDocumentColor = () => {
      switch (extension) {
        case 'pdf':
          return 'from-red-500 to-red-600';
        case 'doc':
        case 'docx':
          return 'from-blue-500 to-blue-600';
        case 'xls':
        case 'xlsx':
          return 'from-green-500 to-green-600';
        case 'ppt':
        case 'pptx':
          return 'from-orange-500 to-orange-600';
        case 'txt':
          return 'from-gray-500 to-gray-600';
        default:
          return 'from-blue-500 to-blue-600';
      }
    };

    return (
      <Card ref={ref} className={cn('overflow-hidden', className)}>
        <CardContent className="p-0">
          {/* Document preview for PDF */}
          {showPreview && isPDF && (
            <div className="border-b">
              <iframe
                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="h-96 w-full"
                title={filename}
              />
            </div>
          )}

          {/* Document info */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Document icon with extension badge */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div
                    className={cn(
                      'flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br',
                      getDocumentColor(),
                    )}
                  >
                    <FileTextIcon className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    {extension}
                  </div>
                </div>
              </div>

              {/* File info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground" title={filename}>
                  {truncateFilename(filename)}
                </p>
                {fileSize !== undefined && (
                  <p className="text-sm text-muted-foreground">{formatFileSize(fileSize)}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPDF ? 'PDF Document' : 'Document'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 gap-1">
                {isPDF && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOpenInNewTab}
                    title="Open in new tab"
                    aria-label={`Open ${filename} in new tab`}
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  title="Download document"
                  aria-label={`Download ${filename}`}
                >
                  <DownloadIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

DocumentPreview.displayName = 'DocumentPreview';
