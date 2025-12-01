import * as React from 'react';
import {
  FileIcon,
  FileTextIcon,
  CodeIcon,
  ArchiveIcon,
  DownloadIcon,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

import {
  formatFileSize,
  getFileExtension,
  detectFileType,
  truncateFilename,
} from './utils';

export interface GenericFilePreviewProps {
  filename: string;
  fileSize?: number;
  fileUrl?: string;
  mimeType?: string;
  onDownload?: () => void;
  className?: string;
}

/**
 * Generic file preview component for non-media files
 * Displays file icon, name, size, and download button
 */
export const GenericFilePreview = React.forwardRef<
  HTMLDivElement,
  GenericFilePreviewProps
>(({ filename, fileSize, fileUrl, mimeType, onDownload, className }, ref) => {
  const fileType = detectFileType(filename, mimeType);
  const extension = getFileExtension(filename);

  const getFileIcon = () => {
    switch (fileType) {
      case 'document':
        return <FileTextIcon className='h-12 w-12 text-blue-500' />;
      case 'code':
        return <CodeIcon className='h-12 w-12 text-green-500' />;
      case 'archive':
        return <ArchiveIcon className='h-12 w-12 text-orange-500' />;
      default:
        return <FileIcon className='h-12 w-12 text-gray-500' />;
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card ref={ref} className={cn('overflow-hidden', className)}>
      <CardContent className='p-4'>
        <div className='flex items-center gap-4'>
          <div className='flex-shrink-0'>
            <div className='relative'>
              {getFileIcon()}
              <div className='absolute -bottom-1 -right-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white'>
                {extension}
              </div>
            </div>
          </div>

          <div className='min-w-0 flex-1'>
            <p
              className='truncate font-medium text-foreground'
              title={filename}
            >
              {truncateFilename(filename)}
            </p>
            {fileSize !== undefined && (
              <p className='text-sm text-muted-foreground'>
                {formatFileSize(fileSize)}
              </p>
            )}
          </div>

          <div className='flex-shrink-0'>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleDownload}
              title='Download file'
              aria-label={`Download ${filename}`}
            >
              <DownloadIcon className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

GenericFilePreview.displayName = 'GenericFilePreview';
