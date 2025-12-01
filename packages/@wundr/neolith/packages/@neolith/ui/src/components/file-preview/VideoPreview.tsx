import * as React from 'react';
import { DownloadIcon, PlayIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

import { formatFileSize, truncateFilename } from './utils';

export interface VideoPreviewProps {
  filename: string;
  fileUrl: string;
  fileSize?: number;
  thumbnailUrl?: string;
  onDownload?: () => void;
  className?: string;
  maxHeight?: number;
}

/**
 * Video preview component with inline player
 * Shows thumbnail with play button or video player
 */
export const VideoPreview = React.forwardRef<HTMLDivElement, VideoPreviewProps>(
  (
    {
      filename,
      fileUrl,
      fileSize,
      thumbnailUrl,
      onDownload,
      className,
      maxHeight = 400,
    },
    ref
  ) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const handlePlay = () => {
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.play();
      }
    };

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

    const handleVideoError = () => {
      setHasError(true);
    };

    return (
      <Card ref={ref} className={cn('overflow-hidden', className)}>
        <CardContent className='p-0'>
          <div className='relative bg-black' style={{ maxHeight }}>
            {!isPlaying && !hasError && (
              <div
                className='group relative cursor-pointer'
                onClick={handlePlay}
              >
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={`${filename} thumbnail`}
                    className='w-full object-contain'
                    style={{ maxHeight }}
                  />
                ) : (
                  <div
                    className='flex items-center justify-center bg-muted'
                    style={{ height: maxHeight }}
                  >
                    <VideoIcon className='h-16 w-16 text-muted-foreground' />
                  </div>
                )}

                {/* Play button overlay */}
                <div className='absolute inset-0 flex items-center justify-center bg-black/20 transition-all group-hover:bg-black/40'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110'>
                    <PlayIcon className='h-8 w-8 fill-current text-black' />
                  </div>
                </div>
              </div>
            )}

            {hasError && (
              <div
                className='flex flex-col items-center justify-center bg-muted'
                style={{ height: maxHeight }}
              >
                <VideoIcon className='h-16 w-16 text-muted-foreground' />
                <p className='mt-4 text-sm text-muted-foreground'>
                  Unable to load video
                </p>
              </div>
            )}

            <video
              ref={videoRef}
              src={fileUrl}
              controls
              className={cn(
                'w-full',
                isPlaying && !hasError ? 'block' : 'hidden'
              )}
              style={{ maxHeight }}
              onError={handleVideoError}
              preload='metadata'
            >
              Your browser does not support the video tag.
            </video>
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
              title='Download video'
              aria-label={`Download ${filename}`}
            >
              <DownloadIcon className='h-4 w-4' />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

VideoPreview.displayName = 'VideoPreview';

// Video icon component
function VideoIcon({ className }: { className?: string }) {
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
      <path d='m22 8-6 4 6 4V8Z' />
      <rect width='14' height='12' x='2' y='6' rx='2' ry='2' />
    </svg>
  );
}
