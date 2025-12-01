import * as React from 'react';
import { DownloadIcon, XIcon, ZoomInIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogClose } from '../ui/dialog';

import { formatFileSize, truncateFilename } from './utils';

export interface ImagePreviewProps {
  filename: string;
  fileUrl: string;
  fileSize?: number;
  alt?: string;
  onDownload?: () => void;
  className?: string;
  thumbnailClassName?: string;
  maxThumbnailHeight?: number;
}

/**
 * Image preview component with thumbnail and lightbox functionality
 * Click to open full-size image in a modal
 */
export const ImagePreview = React.forwardRef<HTMLDivElement, ImagePreviewProps>(
  (
    {
      filename,
      fileUrl,
      fileSize,
      alt,
      onDownload,
      className,
      thumbnailClassName,
      maxThumbnailHeight = 300,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);

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

    const handleImageLoad = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleImageError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    return (
      <>
        <Card ref={ref} className={cn('overflow-hidden', className)}>
          <CardContent className='p-0'>
            <div className='group relative'>
              {isLoading && !hasError && (
                <div
                  className='flex items-center justify-center bg-muted'
                  style={{ height: maxThumbnailHeight }}
                >
                  <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
                </div>
              )}

              {hasError && (
                <div
                  className='flex flex-col items-center justify-center bg-muted'
                  style={{ height: maxThumbnailHeight }}
                >
                  <FileImageIcon className='h-12 w-12 text-muted-foreground' />
                  <p className='mt-2 text-sm text-muted-foreground'>
                    Failed to load image
                  </p>
                </div>
              )}

              <img
                src={fileUrl}
                alt={alt || filename}
                className={cn(
                  'w-full cursor-pointer object-contain transition-opacity',
                  isLoading || hasError ? 'hidden' : 'block',
                  thumbnailClassName
                )}
                style={{ maxHeight: maxThumbnailHeight }}
                onClick={() => setIsOpen(true)}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />

              {/* Overlay on hover */}
              {!isLoading && !hasError && (
                <div className='absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100'>
                  <Button
                    variant='secondary'
                    size='sm'
                    className='gap-2'
                    onClick={() => setIsOpen(true)}
                  >
                    <ZoomInIcon className='h-4 w-4' />
                    View full size
                  </Button>
                </div>
              )}
            </div>

            {/* File info footer */}
            <div className='flex items-center justify-between border-t bg-muted/30 px-3 py-2'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium' title={filename}>
                  {truncateFilename(filename)}
                </p>
                {fileSize !== undefined && (
                  <p className='text-xs text-muted-foreground'>
                    {formatFileSize(fileSize)}
                  </p>
                )}
              </div>
              <Button
                variant='ghost'
                size='icon'
                onClick={handleDownload}
                title='Download image'
                aria-label={`Download ${filename}`}
              >
                <DownloadIcon className='h-4 w-4' />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lightbox Modal */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className='max-w-7xl p-0'>
            <div className='relative'>
              <DialogClose asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='absolute right-2 top-2 z-10 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white'
                  aria-label='Close'
                >
                  <XIcon className='h-4 w-4' />
                </Button>
              </DialogClose>

              <img
                src={fileUrl}
                alt={alt || filename}
                className='max-h-[90vh] w-full object-contain'
              />

              <div className='flex items-center justify-between border-t bg-background p-4'>
                <div>
                  <p className='font-medium'>{filename}</p>
                  {fileSize !== undefined && (
                    <p className='text-sm text-muted-foreground'>
                      {formatFileSize(fileSize)}
                    </p>
                  )}
                </div>
                <Button onClick={handleDownload} className='gap-2'>
                  <DownloadIcon className='h-4 w-4' />
                  Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

ImagePreview.displayName = 'ImagePreview';

// Fallback icon component
function FileImageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <rect width='18' height='18' x='3' y='3' rx='2' ry='2' />
      <circle cx='9' cy='9' r='2' />
      <path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' />
    </svg>
  );
}
